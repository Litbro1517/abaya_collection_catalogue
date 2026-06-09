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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Link2, Database, Key, Hash, Loader2, Unlink, AlertCircle, RefreshCw, ArrowRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Stock Source Config type ──
export interface StockSourceConfig {
  sourceTableId: string;       // ID of the data source to look up
  matchColumnSlug: string;     // Column slug in the source table to match against (empty if same table)
  stockColumnSlug: string;     // Column slug in the source table that contains the stock value
  matchTargetSlug?: string;    // Column slug in the current table to match on (defaults to __n_ordre__)
}

interface StockSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDataSourceId: string;
  currentConfig: StockSourceConfig | null;
  onConfigSaved: (config: StockSourceConfig | null) => void;
}

export function StockSourceModal({
  open,
  onOpenChange,
  currentDataSourceId,
  currentConfig,
  onConfigSaved,
}: StockSourceModalProps) {
  const { dataSources } = useAppStore();

  // Local form state
  const [sourceTableId, setSourceTableId] = useState(currentConfig?.sourceTableId || '');
  const [matchColumnSlug, setMatchColumnSlug] = useState(currentConfig?.matchColumnSlug || '');
  const [stockColumnSlug, setStockColumnSlug] = useState(currentConfig?.stockColumnSlug || '');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

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
      setStockColumnSlug(currentConfig?.stockColumnSlug || '');
    }
  }, [open, currentConfig]);

  // Number columns in the source table (for stock column selector)
  // When same table, also exclude __stock__ itself
  const numberColumns = sourceColumns.filter(c =>
    (c.type === 'NUMBER' || c.type === 'CURRENCY') &&
    !(isSameTable && c.slug === '__stock__')
  );

  // All columns in source table (for match column selector — only shown for different tables)
  const matchableColumns = sourceColumns;

  // Is form valid?
  // Same table: only need sourceTableId + stockColumnSlug
  // Different table: need sourceTableId + matchColumnSlug + stockColumnSlug
  const isValid = isSameTable
    ? !!(sourceTableId && stockColumnSlug)
    : !!(sourceTableId && matchColumnSlug && stockColumnSlug);

  // Selected source table name
  const selectedTable = allTables.find(ds => ds.id === sourceTableId);

  // ── One-shot import: bulk copy values from source to __stock__ ──
  const performImport = async (config: StockSourceConfig) => {
    setImporting(true);
    try {
      const res = await fetch(`/api/datasources/${currentDataSourceId}/stock-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: config.sourceTableId,
          matchColumnSlug: config.matchColumnSlug || '',
          stockColumnSlug: config.stockColumnSlug,
          matchTargetSlug: config.matchTargetSlug || '__n_ordre__',
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur d\'importation');
      }

      const json = await res.json();
      return json.updated as number;
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
      const config: StockSourceConfig = {
        sourceTableId,
        matchColumnSlug: isSameTable ? '' : matchColumnSlug,
        stockColumnSlug,
        matchTargetSlug: isSameTable ? '' : '__n_ordre__',
      };

      // Find the __stock__ column in the current data source
      const metaRes = await fetch(`/api/datasources/${currentDataSourceId}?mode=meta`);
      if (!metaRes.ok) throw new Error('Failed to load columns');
      const metaJson = await metaRes.json();
      const stockColumn = (metaJson.data?.columns || []).find(
        (c: Column) => c.slug === '__stock__'
      );
      if (!stockColumn) throw new Error('Stock column not found');

      // Save the config to the column's config field
      const existingColConfig = (stockColumn.config as Record<string, unknown>) || {};
      const updateRes = await fetch(
        `/api/datasources/${currentDataSourceId}/columns/${stockColumn.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              ...existingColConfig,
              stockSource: config,
            },
          }),
        }
      );

      if (!updateRes.ok) throw new Error('Failed to save config');

      // ━━━ ONE-SHOT BULK IMPORT ━━━
      const updatedCount = await performImport(config);

      toast.success('Source de stock connectée', {
        description: `${updatedCount} valeur(s) de stock importée(s) depuis « ${selectedTable?.name || 'table'} ». Le stock reste modifiable manuellement.`,
      });
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
      const updatedCount = await performImport(currentConfig);

      toast.success('Ré-importation du stock effectuée', {
        description: `${updatedCount} valeur(s) de stock mise(s) à jour depuis la source.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error('Erreur de ré-importation', {
        description: err instanceof Error ? err.message : 'Impossible de ré-importer',
      });
    } finally {
      setSaving(false);
    }
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    setSaving(true);
    try {
      const metaRes = await fetch(`/api/datasources/${currentDataSourceId}?mode=meta`);
      if (!metaRes.ok) throw new Error('Failed to load columns');
      const metaJson = await metaRes.json();
      const stockColumn = (metaJson.data?.columns || []).find(
        (c: Column) => c.slug === '__stock__'
      );
      if (!stockColumn) throw new Error('Stock column not found');

      const existingConfig = (stockColumn.config as Record<string, unknown>) || {};
      delete existingConfig.stockSource;

      await fetch(`/api/datasources/${currentDataSourceId}/columns/${stockColumn.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: existingConfig }),
      });

      toast.success('Source de stock déconnectée', {
        description: 'Le stock reste modifiable manuellement',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-gold" />
            Connecter une source de stock
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-relaxed">
            Liez la colonne Stock à une colonne de la table actuelle ou d&apos;une table externe pour importer les valeurs en masse, tout en conservant la modification manuelle au produit au quotidien.
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
              setStockColumnSlug('');
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
                        <span className="text-[9px] text-gold font-medium ml-1">(actuelle)</span>
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
                Clé de Correspondance
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

          {/* Stock Column selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Hash className="w-3 h-3" />
              Colonne Stock Source
            </label>
            <Select
              value={stockColumnSlug}
              onValueChange={setStockColumnSlug}
              disabled={!sourceTableId || loadingColumns}
            >
              <SelectTrigger className="h-9 text-xs">
                {loadingColumns ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Chargement…
                  </span>
                ) : (
                  <SelectValue placeholder={!sourceTableId ? "Sélectionnez d'abord une table…" : "Choisir la colonne stock…"} />
                )}
              </SelectTrigger>
              <SelectContent>
                {numberColumns.map(col => (
                  <SelectItem key={col.id} value={col.slug}>
                    <span className="flex items-center gap-1.5">
                      {col.name}
                      <span className="text-[10px] text-muted-foreground">({col.type})</span>
                    </span>
                  </SelectItem>
                ))}
                {sourceTableId && numberColumns.length === 0 && !loadingColumns && (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" />
                    Aucune colonne numérique dans cette table
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Colonne contenant la valeur numérique du stock à copier
            </p>
          </div>
        </div>

        {/* Info box about one-shot behavior */}
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] leading-relaxed">
          <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            L&apos;importation est <strong>ponctuelle</strong> : les valeurs sont copiées une seule fois.
            Le stock reste <strong>modifiable manuellement</strong> après import.
            Une actualisation générale du catalogue n&apos;écrasera pas les valeurs de stock.
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
                Forcer la ré-importation du stock
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
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            Connecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
