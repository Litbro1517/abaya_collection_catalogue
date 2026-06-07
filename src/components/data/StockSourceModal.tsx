'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { DataSource, Column } from '@/types';
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
import { Link2, Database, Key, Hash, Loader2, Unlink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Stock Source Config type ──
export interface StockSourceConfig {
  sourceTableId: string;       // ID of the data source to look up
  matchColumnSlug: string;     // Column slug in the source table to match against
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

  // Derived: other tables (exclude current)
  const otherTables = dataSources.filter(ds => ds.id !== currentDataSourceId);

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
  const numberColumns = sourceColumns.filter(c =>
    c.type === 'NUMBER' || c.type === 'CURRENCY'
  );

  // All columns in source table (for match column selector)
  const matchableColumns = sourceColumns;

  // Is form valid?
  const isValid = sourceTableId && matchColumnSlug && stockColumnSlug;

  // Selected source table name
  const selectedTable = otherTables.find(ds => ds.id === sourceTableId);

  // Save handler
  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      // Save the config to the column's config field via API
      const config: StockSourceConfig = {
        sourceTableId,
        matchColumnSlug,
        stockColumnSlug,
        matchTargetSlug: '__n_ordre__',
      };

      // Find the __stock__ column in the current data source
      const metaRes = await fetch(`/api/datasources/${currentDataSourceId}?mode=meta`);
      if (!metaRes.ok) throw new Error('Failed to load columns');
      const metaJson = await metaRes.json();
      const stockColumn = (metaJson.data?.columns || []).find(
        (c: Column) => c.slug === '__stock__'
      );
      if (!stockColumn) throw new Error('Stock column not found');

      // Update the column config
      const updateRes = await fetch(
        `/api/datasources/${currentDataSourceId}/columns/${stockColumn.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              ...((stockColumn.config as Record<string, unknown>) || {}),
              stockSource: config,
            },
          }),
        }
      );

      if (!updateRes.ok) throw new Error('Failed to save config');

      toast.success('Source de stock connectée', {
        description: `Stock lu depuis « ${selectedTable?.name || 'table'} »`,
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
        description: 'Le stock est redevenu modifiable manuellement',
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
            <Link2 className="w-4 h-4 text-[#C9A84C]" />
            Connecter une source de stock
          </DialogTitle>
          <DialogDescription>
            Liez la colonne Stock à une table externe pour récupérer automatiquement les valeurs.
            Le stock deviendra en lecture seule.
          </DialogDescription>
        </DialogHeader>

        {currentConfig && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Actuellement connecté à « {otherTables.find(ds => ds.id === currentConfig.sourceTableId)?.name || 'table inconnue'} »
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
                {otherTables.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">
                    Aucune autre table disponible
                  </div>
                )}
                {otherTables.map(ds => (
                  <SelectItem key={ds.id} value={ds.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ds.color }}
                      />
                      {ds.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match Column selector */}
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
              Colonne contenant la valeur numérique du stock à afficher
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {currentConfig && (
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
              <Link2 className="w-3.5 h-3.5" />
            )}
            Connecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
