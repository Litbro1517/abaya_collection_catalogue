'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { Column } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Palette, Database, Key, Loader2, Unlink, AlertCircle, RefreshCw, ArrowRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Color Source Config type ──
export interface ColorSourceConfig {
  sourceTableId: string;       // ID of the data source to look up
  matchColumnSlug: string;     // Column slug in the source table to match against (empty if same table)
  colorColumnSlug: string;     // Column slug in the source table that contains raw color text
  matchTargetSlug?: string;    // Column slug in the current table to match on (defaults to __n_ordre__)
}

interface ColorSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDataSourceId: string;
  currentConfig: ColorSourceConfig | null;
  colorColumnSlug: string;  // The slug of the COLOR column (e.g., "__colors__")
  onConfigSaved: (config: ColorSourceConfig | null) => void;
}

export function ColorSourceModal({
  open,
  onOpenChange,
  currentDataSourceId,
  currentConfig,
  colorColumnSlug,
  onConfigSaved,
}: ColorSourceModalProps) {
  const { dataSources } = useAppStore();

  // Local form state
  const [sourceTableId, setSourceTableId] = useState(currentConfig?.sourceTableId || '');
  const [matchColumnSlug, setMatchColumnSlug] = useState(currentConfig?.matchColumnSlug || '');
  const [sourceColorColumnSlug, setSourceColorColumnSlug] = useState(currentConfig?.colorColumnSlug || '');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // ━━━ Unknown colors confirmation state ━━━
  const [unknownColorsAlert, setUnknownColorsAlert] = useState<{
    open: boolean;
    unknown: string[];
    config: ColorSourceConfig | null;
    /** Callback to invoke after user decides (save path vs reimport path) */
    mode: 'save' | 'reimport';
  }>({ open: false, unknown: [], config: null, mode: 'save' });

  // Derived: ALL tables (including current — the user explicitly requested this)
  const allTables = dataSources;
  const isSameTable = sourceTableId === currentDataSourceId;

  // Derived: columns of the selected source table
  const [sourceColumns, setSourceColumns] = useState<Column[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Load columns of the selected source table
  useEffect(() => {
    if (!sourceTableId) {
      setSourceColumns([]);
      return;
    }
    setLoadingColumns(true);
    fetch(`/api/datasources/${sourceTableId}?mode=meta`)
      .then(res => res.ok ? res.json() : { data: { columns: [] } })
      .then(json => {
        setSourceColumns(json.data?.columns || []);
      })
      .catch(() => setSourceColumns([]))
      .finally(() => setLoadingColumns(false));
  }, [sourceTableId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSourceTableId(currentConfig?.sourceTableId || '');
      setMatchColumnSlug(currentConfig?.matchColumnSlug || '');
      setSourceColorColumnSlug(currentConfig?.colorColumnSlug || '');
    }
  }, [open, currentConfig]);

  // TEXT columns in the source table (for color column selector)
  // When same table, also exclude the COLOR column itself
  const textColumns = sourceColumns.filter(c =>
    c.type === 'TEXT' &&
    !(isSameTable && c.slug === colorColumnSlug)
  );

  // All columns in source table (for match column selector — only shown for different tables)
  const matchableColumns = sourceColumns;

  // Is form valid?
  const isValid = isSameTable
    ? !!(sourceTableId && sourceColorColumnSlug)
    : !!(sourceTableId && matchColumnSlug && sourceColorColumnSlug);

  // Selected source table name
  const selectedTable = allTables.find(ds => ds.id === sourceTableId);

  // ── One-shot import: bulk copy color values from source ━━━
  const performImport = async (
    config: ColorSourceConfig,
    force = false,
  ): Promise<{ updated: number; unknown?: string[]; unknownCount?: number }> => {
    setImporting(true);
    try {
      const res = await fetch(`/api/datasources/${currentDataSourceId}/color-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: config.sourceTableId,
          matchColumnSlug: config.matchColumnSlug || '',
          colorColumnSlug: config.colorColumnSlug,
          matchTargetSlug: config.matchTargetSlug || '__n_ordre__',
          targetColorColumnSlug: colorColumnSlug,
          force,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        // If 422 with unknown colors → return them for confirmation instead of throwing
        if (res.status === 422 && json.unknown) {
          return { updated: 0, unknown: json.unknown as string[], unknownCount: json.count as number };
        }
        throw new Error(json.error || 'Erreur d\'importation');
      }

      const json = await res.json();
      return {
        updated: json.updated as number,
        unknown: json.unknown as string[] | undefined,
        unknownCount: json.unknownCount as number | undefined,
      };
    } finally {
      setImporting(false);
    }
  };

  // Save handler: save config + perform one-shot import
  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      // Build the config
      const config: ColorSourceConfig = {
        sourceTableId,
        matchColumnSlug: isSameTable ? '' : matchColumnSlug,
        colorColumnSlug: sourceColorColumnSlug,
        matchTargetSlug: isSameTable ? '' : '__n_ordre__',
      };

      // Find the COLOR column in the current data source
      const metaRes = await fetch(`/api/datasources/${currentDataSourceId}?mode=meta`);
      if (!metaRes.ok) throw new Error('Failed to load columns');
      const metaJson = await metaRes.json();
      const colorColumn = (metaJson.data?.columns || []).find(
        (c: Column) => c.slug === colorColumnSlug
      );
      if (!colorColumn) throw new Error('Color column not found');

      // Save the config to the column's config field
      const existingColConfig = (colorColumn.config as Record<string, unknown>) || {};
      const updateRes = await fetch(
        `/api/datasources/${currentDataSourceId}/columns/${colorColumn.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              ...existingColConfig,
              colorSource: config,
            },
          }),
        }
      );

      if (!updateRes.ok) throw new Error('Failed to save config');

      // ━━━ ONE-SHOT BULK IMPORT (non-force first) ━━━
      const result = await performImport(config, false);

      // If unknown colors detected → show confirmation dialog
      if (result.unknown && result.unknown.length > 0) {
        setUnknownColorsAlert({ open: true, unknown: result.unknown, config, mode: 'save' });
        return; // Don't close the modal yet — wait for user decision
      }

      toast.success(`Source de couleurs connectée — ${result.updated} produit(s) mis à jour`);
      onConfigSaved(config);
      onOpenChange(false);
    } catch (err) {
      toast.error('Erreur', {
        description: err instanceof Error ? err.message : 'Impossible de sauvegarder',
      });
    } finally {
      setSaving(false);
    }
  };

  // Force re-import handler: uses current config to re-import
  const handleForceReimport = async () => {
    if (!currentConfig) return;
    setSaving(true);
    try {
      const result = await performImport(currentConfig, false);

      // If unknown colors detected → show confirmation dialog
      if (result.unknown && result.unknown.length > 0) {
        setUnknownColorsAlert({ open: true, unknown: result.unknown, config: currentConfig, mode: 'reimport' });
        return; // Don't close yet
      }

      toast.success(`Source de couleurs connectée — ${result.updated} produit(s) mis à jour`);
      onConfigSaved(currentConfig); // trigger onRefresh with forceNetwork
      onOpenChange(false);
    } catch (err) {
      toast.error('Erreur de ré-importation', {
        description: err instanceof Error ? err.message : 'Impossible de ré-importer',
      });
    } finally {
      setSaving(false);
    }
  };

  // ━━━ User confirmed: import with force=true ━━━
  const handleForceImportConfirm = async () => {
    const { config, mode } = unknownColorsAlert;
    setUnknownColorsAlert(prev => ({ ...prev, open: false }));

    if (!config) return;
    setSaving(true);
    try {
      const result = await performImport(config, true);

      toast.success(`Importation terminée — ${result.updated} produit(s) mis à jour`, {
        description: result.unknownCount
          ? `${result.unknownCount} couleur(s) non reconnue(s) importée(s) en texte brut`
          : undefined,
      });

      onConfigSaved(config); // always trigger onRefresh (save or reimport)
      onOpenChange(false);
    } catch (err) {
      toast.error('Erreur d\'importation', {
        description: err instanceof Error ? err.message : 'Impossible d\'importer',
      });
    } finally {
      setSaving(false);
    }
  };

  // ━━━ User cancelled: abort import ━━━
  const handleForceImportCancel = () => {
    setUnknownColorsAlert(prev => ({ ...prev, open: false }));
    setSaving(false);
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const metaRes = await fetch(`/api/datasources/${currentDataSourceId}?mode=meta`);
      if (!metaRes.ok) throw new Error('Failed to load columns');
      const metaJson = await metaRes.json();
      const colorColumn = (metaJson.data?.columns || []).find(
        (c: Column) => c.slug === colorColumnSlug
      );
      if (!colorColumn) throw new Error('Color column not found');

      const existingConfig = (colorColumn.config as Record<string, unknown>) || {};
      delete existingConfig.colorSource;

      await fetch(`/api/datasources/${currentDataSourceId}/columns/${colorColumn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: existingConfig }),
      });

      toast.success('Source de couleurs déconnectée', {
        description: 'Les couleurs restent modifiables manuellement',
      });
      onConfigSaved(null);
      onOpenChange(false);
    } catch {
      toast.error('Erreur de déconnexion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#C9A84C]" />
              Connecter une source de couleurs
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-relaxed">
              Liez la colonne Couleurs à une colonne de la table actuelle ou d&apos;une table externe pour importer les valeurs de couleur en masse. Les noms seront normalisés et résolus via la ColorMap.
            </DialogDescription>
          </DialogHeader>

          {currentConfig && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Source configurée : « {allTables.find(ds => ds.id === currentConfig.sourceTableId)?.name || 'table inconnue'} »
                {currentConfig.sourceTableId === currentDataSourceId && ' (table actuelle)'}
              </span>
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* Table Source selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Database className="w-3 h-3" />
                Table Source
              </label>
              <Select value={sourceTableId} onValueChange={(v) => {
                setSourceTableId(v);
                setMatchColumnSlug('');
                setSourceColorColumnSlug('');
              }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choisir une table…" />
                </SelectTrigger>
                <SelectContent>
                  {allTables.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">
                      Aucune table disponible
                    </div>
                  )}
                  {allTables.map(ds => (
                    <SelectItem key={ds.id} value={ds.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ds.color }}
                        />
                        {ds.name}
                        {ds.id === currentDataSourceId && (
                          <span className="text-[9px] text-[#C9A84C] font-medium ml-1">(actuelle)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSameTable && sourceTableId && (
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Même table — les valeurs seront copiées directement entre colonnes
                </p>
              )}
            </div>

            {/* Match Column selector — only shown for DIFFERENT tables */}
            {!isSameTable && (
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Key className="w-3 h-3" />
                  Clé de Pivot
                </label>
                <Select
                  value={matchColumnSlug}
                  onValueChange={setMatchColumnSlug}
                  disabled={!sourceTableId || loadingColumns}
                >
                  <SelectTrigger className="h-9 text-xs">
                    {loadingColumns ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Chargement…
                      </span>
                    ) : (
                      <SelectValue placeholder={!sourceTableId ? "Sélectionnez d'abord une table…" : "Choisir la colonne pivot…"} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {matchableColumns.map(col => (
                      <SelectItem key={col.id} value={col.slug}>
                        <span className="flex items-center gap-1.5">
                          {col.name}
                          <span className="text-[10px] text-muted-foreground">({col.type})</span>
                        </span>
                      </SelectItem>
                    ))}
                    {sourceTableId && matchableColumns.length === 0 && !loadingColumns && (
                      <div className="px-3 py-2 text-xs text-muted-foreground italic">
                        Aucune colonne dans cette table
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Colonne dans la table source qui correspond au N° d&apos;ordre du catalogue
                </p>
              </div>
            )}

            {/* Color Column selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Palette className="w-3 h-3" />
                Colonne Couleur Source
              </label>
              <Select
                value={sourceColorColumnSlug}
                onValueChange={setSourceColorColumnSlug}
                disabled={!sourceTableId || loadingColumns}
              >
                <SelectTrigger className="h-9 text-xs">
                  {loadingColumns ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Chargement…
                    </span>
                  ) : (
                    <SelectValue placeholder={!sourceTableId ? "Sélectionnez d'abord une table…" : "Choisir la colonne couleur…"} />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {textColumns.map(col => (
                    <SelectItem key={col.id} value={col.slug}>
                      <span className="flex items-center gap-1.5">
                        {col.name}
                        <span className="text-[10px] text-muted-foreground">({col.type})</span>
                      </span>
                    </SelectItem>
                  ))}
                  {sourceTableId && textColumns.length === 0 && !loadingColumns && (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" />
                      Aucune colonne texte dans cette table
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Colonne contenant les noms de couleur bruts (ex: &quot;noir, beige&quot;)
              </p>
            </div>
          </div>

          {/* Info box about one-shot behavior */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] leading-relaxed">
            <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              L&apos;importation est <strong>ponctuelle</strong> : les noms de couleur sont normalisés et résolus via la ColorMap.
              Les couleurs non reconnues seront signalées. Les valeurs restent <strong>modifiables manuellement</strong> après import.
            </span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            {currentConfig && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                  onClick={handleForceReimport}
                  disabled={saving || importing}
                >
                  {importing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Forcer la ré-importation des couleurs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleDisconnect}
                  disabled={saving}
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Déconnecter
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              className={cn(
                "gap-1.5 text-white",
                !isValid && "opacity-50"
              )}
              style={{ backgroundColor: '#1A3C34' }}
              onClick={handleSave}
              disabled={!isValid || saving}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Palette className="w-3.5 h-3.5" />
              )}
              Connecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━ Unknown Colors Confirmation AlertDialog ━━━ */}
      <AlertDialog open={unknownColorsAlert.open} onOpenChange={(isOpen) => {
        if (!isOpen) handleForceImportCancel();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Certaines couleurs ne sont pas configurées.
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous quand même importer les données ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleForceImportCancel}>
              Non, annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceImportConfirm}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Oui, importer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
