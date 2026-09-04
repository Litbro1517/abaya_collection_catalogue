'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FolderOpen, Check, X } from 'lucide-react';
import { toast } from 'sonner';

/**
 * GoogleDrivePicker (VG33 / Pillar 2)
 *
 * Opens the official Google Drive Picker modal to select one or more images.
 * Selected images' Drive URLs are injected into the target column via
 * POST /api/catalog/media/picker-sync.
 *
 * Architecture:
 * - Loads Google Identity Services (GIS) + Google Picker API scripts dynamically.
 * - Requests an OAuth access token (scope: drive.file) via a backend endpoint
 *   that returns a fresh token from the stored Google session.
 * - Builds the Picker with image-only mime type filter + multi-select.
 * - On "Select", extracts the Drive URLs and sends them to picker-sync.
 *
 * Props:
 * - open: boolean (controlled)
 * - onOpenChange: (open: boolean) => void
 * - dataSourceId, columnSlug, columnType: target column metadata
 * - onSynced: (count: number) => void  (callback after successful injection)
 */

declare global {
  interface Window {
    google?: {
      picker?: {
        PickerBuilder: new () => PickerBuilder;
        View: new () => PickerView;
        ViewId: { DOCS: string; DOCS_IMAGES: string };
        Feature: { MULTISELECT_ENABLED: string };
        DocsViewMode: { GRID: string; LIST: string };
      };
      accounts?: {
        oauth2?: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
      };
    };
  }
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setCallback(cb: (data: PickerData) => void): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setMaxItems(n: number): PickerBuilder;
  build(): { setVisible(v: boolean): void };
}

interface PickerView {
  setMimeTypes(mime: string): PickerView;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (resp: { access_token?: string }) => void;
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface PickerData {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType: string; url?: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataSourceId: string;
  columnSlug: string;
  columnType: 'IMAGE' | 'IMAGE_ARRAY';
  onSynced?: (count: number) => void;
}

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
const PICKER_SCRIPT = 'https://apis.google.com/js/api.js?onload=onPickerLoad';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function GoogleDrivePicker({
  open,
  onOpenChange,
  dataSourceId,
  columnSlug,
  columnType,
  onSynced,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedUrls([]);
      setError(null);
    }
  }, [open]);

  const openPicker = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch OAuth token from backend (uses stored Google session)
      const tokenRes = await fetch('/api/google/picker-token');
      if (!tokenRes.ok) {
        throw new Error('Google non connecté. Veuillez lier votre compte Google dans les paramètres.');
      }
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.data?.accessToken;
      if (!accessToken) {
        throw new Error('Token Google inaccessible.');
      }

      // Load Picker API
      await loadScript(PICKER_SCRIPT);

      // Wait for google.picker to be available
      await new Promise<void>((resolve, reject) => {
        let tries = 0;
        const check = () => {
          if (window.google?.picker) resolve();
          else if (tries++ > 50) reject(new Error('Picker API timeout'));
          else setTimeout(check, 100);
        };
        check();
      });

      // MANDAT 4P — tsc : narrowing de window.google.picker APRÈS la
      // résolution de la promesse (TS18048 ×6 : l'optionnel chaîné dans le
      // poll ci-dessus ne narrow pas le type pour le code qui suit).
      // Capture locale + garde explicite — runtime identique (la promesse
      // n'est résolue QUE si window.google.picker est déjà présent).
      const pickerApi = window.google?.picker;
      if (!pickerApi) {
        throw new Error('Picker API indisponible.');
      }

      const view = new pickerApi.View();
      view.setMimeTypes('image/png,image/jpeg,image/jpg,image/webp,image/gif');

      const builder = new pickerApi.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
        .setMaxItems(50)
        .setCallback((data: PickerData) => {
          if (data.action === 'picked' && data.docs) {
            const urls = data.docs.map((doc) => `https://drive.google.com/file/d/${doc.id}/view`);
            setSelectedUrls(urls);
          }
        });

      const picker = builder.build();
      picker.setVisible(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur Drive Picker';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = async () => {
    if (selectedUrls.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/catalog/media/picker-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId,
          columnSlug,
          columnType,
          urls: selectedUrls,
        }),
      });
      if (!res.ok) throw new Error('Sync failed');
      const json = await res.json();
      toast.success(`${json.data.injected} URL(s) injectée(s) dans la colonne`);
      onSynced?.(json.data.injected);
      onOpenChange(false);
    } catch {
      toast.error('Erreur lors de l\'injection des URLs');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Importer via Google Drive
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              {error}
            </div>
          )}

          {selectedUrls.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground mb-4">
                Cliquez pour ouvrir le sélecteur Google Drive. Sélectionnez une ou plusieurs images (Ctrl+Clic pour la sélection multiple).
              </p>
              <Button onClick={openPicker} disabled={loading} size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FolderOpen className="w-4 h-4 mr-1.5" />}
                Ouvrir Drive Picker
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {selectedUrls.length} image(s) sélectionnée(s)
              </p>
              <div className="max-h-40 overflow-y-auto text-[10px] text-muted-foreground space-y-1">
                {selectedUrls.map((url, i) => (
                  <div key={i} className="truncate font-mono">{url}</div>
                ))}
              </div>
              <Button onClick={openPicker} variant="outline" size="sm" className="w-full text-xs">
                Changer la sélection
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSync} disabled={syncing || selectedUrls.length === 0}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
            Injecter ({selectedUrls.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
