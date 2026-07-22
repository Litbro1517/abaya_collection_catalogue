'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Search, ImageIcon, Cloud, HardDrive, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveHybridImageUrl } from '@/lib/media-utils';

/**
 * MediaLibrary (VG33 / Pillar 5)
 *
 * Dedicated media management space — 3-column strict grid:
 * 1. N° Ordre Système (BDD) — fixed immutable index 1..N
 * 2. Nom du Produit — exact title of the associated product
 * 3. Grille d'Images — visual thumbnails + source badge (Drive vs CDN) + delete button
 *
 * Features:
 * - Filer "Afficher les images orphelines" — shows CDN files no longer
 *   referenced by any product (for cleanup).
 * - Physical CDN deletion (safety-checked: blocks if still referenced).
 */

interface MediaImage {
  url: string;
  source: 'drive' | 'cdn' | 'unknown';
  fileId: string | null;
  assetStatus: string | null;
}

interface MediaEntry {
  order: number;
  rowId: string;
  productTitle: string;
  images: MediaImage[];
  hasMediaAsset: boolean;
}

interface Props {
  dataSourceId: string;
  onRefresh?: () => void;
}

export function MediaLibrary({ dataSourceId, onRefresh }: Props) {
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/catalog/media/list?dataSourceId=${dataSourceId}&orphansOnly=${orphansOnly}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load media');
      const json = await res.json();
      setEntries(json.data || []);
    } catch {
      toast.error('Erreur de chargement de la médiathèque');
    } finally {
      setLoading(false);
    }
  }, [dataSourceId, orphansOnly]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleDelete = async (entry: MediaEntry, image: MediaImage) => {
    if (!confirm('Supprimer définitivement ce fichier média du CDN ?')) return;
    setDeletingId(entry.rowId + image.url);
    try {
      const res = await fetch('/api/catalog/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cdnUrl: image.url }),
      });
      if (res.status === 409) {
        toast.error('Suppression bloquée : l\'image est encore référencée par un produit.');
        return;
      }
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Fichier supprimé du CDN');
      loadMedia();
      onRefresh?.();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.productTitle.toLowerCase().includes(search.toLowerCase()) ||
        String(e.order).includes(search),
      )
    : entries;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-[220px] flex-1 min-w-[140px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher produit ou n°..."
            className="h-7 text-xs pl-7 bg-muted/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="orphans-toggle"
            checked={orphansOnly}
            onCheckedChange={setOrphansOnly}
          />
          <Label htmlFor="orphans-toggle" className="text-xs cursor-pointer flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Afficher les images orphelines
          </Label>
        </div>
        <Button variant="ghost" size="sm" onClick={loadMedia} disabled={loading} className="ml-auto">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Rafraîchir'}
        </Button>
      </div>

      {/* Grid header */}
      <div className="grid grid-cols-[60px_1fr_2fr] gap-3 px-3 py-1.5 bg-muted/40 rounded text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div>N° Ordre</div>
        <div>Produit</div>
        <div>Images</div>
      </div>

      {/* Entries */}
      <div className="max-h-[600px] overflow-y-auto space-y-1">
        {loading && entries.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            Aucun média trouvé
          </div>
        )}
        {filtered.map((entry) => (
          <div
            key={entry.rowId + entry.order}
            className="grid grid-cols-[60px_1fr_2fr] gap-3 px-3 py-2 rounded border border-border/40 hover:bg-muted/20 transition-colors items-start"
          >
            {/* Col 1: Order */}
            <div className="text-sm font-mono font-semibold text-muted-foreground pt-1">
              {entry.order < 0 ? '—' : entry.order}
            </div>
            {/* Col 2: Product name */}
            <div className="text-xs font-medium pt-1 break-words">
              {entry.productTitle || <span className="text-muted-foreground italic">(sans titre)</span>}
              {entry.order < 0 && (
                <span className="block text-[9px] text-amber-600 mt-0.5">orpheline</span>
              )}
            </div>
            {/* Col 3: Image grid */}
            <div className="flex flex-wrap gap-2">
              {entry.images.map((img, i) => {
                const isCdn = img.source === 'cdn';
                const deleteKey = entry.rowId + img.url;
                return (
                  <div
                    key={i}
                    className="relative group w-16 h-16 rounded border border-border/50 overflow-hidden bg-muted/30"
                  >
                    <img
                      src={resolveHybridImageUrl(img.url, 150)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = '0.2';
                      }}
                    />
                    {/* Source badge */}
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 text-[7px] font-bold px-1 py-0.5 rounded text-white',
                        isCdn ? 'bg-emerald-600' : 'bg-blue-600',
                      )}
                    >
                      {isCdn ? <Cloud className="w-2 h-2 inline" /> : <HardDrive className="w-2 h-2 inline" />}
                      {' '}{isCdn ? 'CDN' : 'Drive'}
                    </span>
                    {/* Delete button (only for CDN) */}
                    {isCdn && (
                      <button
                        onClick={() => handleDelete(entry, img)}
                        disabled={deletingId === deleteKey}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-700"
                        title="Supprimer du CDN"
                      >
                        {deletingId === deleteKey
                          ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          : <Trash2 className="w-2.5 h-2.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
              {entry.images.length === 0 && (
                <div className="flex items-center justify-center w-16 h-16 text-muted-foreground/30">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
