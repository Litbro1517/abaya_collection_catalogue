'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Column } from '@/types';
import {
  Trash2, Search, AlertTriangle, Lock, Loader2,
  Type, Hash, Banknote, Image as ImageIcon, Images,
  ChevronDown, ListChecks, Link2, Layers, ToggleRight, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const COLUMN_TYPE_ICON: Record<string, React.ReactNode> = {
  TEXT: <Type className="w-3 h-3" />,
  NUMBER: <Hash className="w-3 h-3" />,
  CURRENCY: <Banknote className="w-3 h-3" />,
  IMAGE: <ImageIcon className="w-3 h-3" />,
  IMAGE_ARRAY: <Images className="w-3 h-3" />,
  SELECT: <ChevronDown className="w-3 h-3" />,
  MULTI_SELECT: <ListChecks className="w-3 h-3" />,
  RELATION: <Link2 className="w-3 h-3" />,
  ARRAY: <Layers className="w-3 h-3" />,
  BOOLEAN: <ToggleRight className="w-3 h-3" />,
  URL: <ExternalLink className="w-3 h-3" />,
};

// Native column slugs that must NEVER be deleted
const NATIVE_SLUGS = [
  '__title__', '__colors__', '__category__', '__sub_category__',
  '__disponibilite__', '__stock__', '__statut__', '__compare_at_price__',
  '__statut_locked__', '__is_visible__',
];

interface Props {
  columns: Column[];
  dataSourceId: string;
  onDeleted: () => void;
}

export function DeleteColumnsMenu({ columns, dataSourceId, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Categorize columns
  const imageColumns = useMemo(
    () => columns.filter(c => c.type === 'IMAGE' && !NATIVE_SLUGS.includes(c.slug)),
    [columns],
  );
  const lockedColumns = useMemo(
    () => columns.filter(c =>
      c.type === 'IMAGE_ARRAY' ||
      NATIVE_SLUGS.includes(c.slug) ||
      (columns.indexOf(c) === 0 && c.type !== 'IMAGE'),
    ),
    [columns],
  );

  const filteredImageCols = useMemo(() => {
    if (!search.trim()) return imageColumns;
    const q = search.toLowerCase();
    return imageColumns.filter(c =>
      c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [imageColumns, search]);

  const allImageSelected = filteredImageCols.length > 0 &&
    filteredImageCols.every(c => selected.has(c.id));

  const toggleSelect = (colId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allImageSelected) {
      // Deselect only the filtered ones
      setSelected(prev => {
        const next = new Set(prev);
        filteredImageCols.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      // Select all filtered image columns
      setSelected(prev => {
        const next = new Set(prev);
        filteredImageCols.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/datasources/${dataSourceId}/columns/bulk-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Delete failed');
      }
      const json = await res.json();
      toast.success(`${json.data.deleted} colonne(s) image supprimée(s) définitivement`);
      setSelected(new Set());
      setConfirmOpen(false);
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 hover:bg-destructive/5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nettoyer colonnes</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-80 p-0 shadow-lg border-border/60"
          sideOffset={4}
        >
          {/* Header */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Suppression définitive
              </span>
              <span className="text-[10px] text-muted-foreground">
                {imageColumns.length} image(s) · {selected.size} sélectionnée(s)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
              Supprime définitivement les colonnes d&apos;images individuelles (type IMAGE).
              Les colonnes Galerie (IMAGE_ARRAY) et natives sont verrouillées.
            </p>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une colonne image..."
                className="h-7 text-xs pl-7 bg-muted/30 border-border/40 focus:border-gold/50 focus:ring-gold/20"
              />
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Select all bar */}
          {filteredImageCols.length > 0 && (
            <div className="px-3 py-1.5 flex items-center justify-between bg-muted/20">
              <button
                onClick={toggleSelectAll}
                className="text-[10px] font-medium text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
              >
                <Checkbox
                  checked={allImageSelected}
                  className="h-3 w-3 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                />
                Tout sélectionner ({filteredImageCols.length})
              </button>
              {selected.size > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {selected.size} cochée(s)
                </span>
              )}
            </div>
          )}

          {/* Column list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredImageCols.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  {search.trim() ? 'Aucune colonne image trouvée' : 'Aucune colonne image à supprimer'}
                </p>
              </div>
            )}

            {/* Selectable IMAGE columns */}
            {filteredImageCols.map(col => {
              const isSelected = selected.has(col.id);
              return (
                <button
                  key={col.id}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-destructive/5',
                    isSelected && 'bg-destructive/5',
                  )}
                  onClick={() => toggleSelect(col.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                  />
                  <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {COLUMN_TYPE_ICON[col.type] || <Type className="w-3 h-3" />}
                  </div>
                  <span className={cn('text-xs truncate flex-1', isSelected ? 'text-destructive' : 'text-foreground')}>
                    {col.name}
                  </span>
                  {!col.visible && (
                    <span className="text-[8px] text-muted-foreground px-1 py-0.5 bg-muted rounded">masquée</span>
                  )}
                </button>
              );
            })}

            {/* Locked columns (Galerie + natives + first column) — shown but disabled */}
            {!search.trim() && lockedColumns.length > 0 && (
              <>
                <Separator className="bg-border/30 my-1" />
                <div className="px-3 py-1">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Verrouillées ({lockedColumns.length})
                  </span>
                </div>
                {lockedColumns.map(col => (
                  <div
                    key={col.id}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left opacity-50 cursor-not-allowed"
                  >
                    <Checkbox disabled className="h-3.5 w-3.5" />
                    <div className="w-5 h-5 rounded bg-muted/50 text-muted-foreground flex items-center justify-center shrink-0">
                      {COLUMN_TYPE_ICON[col.type] || <Type className="w-3 h-3" />}
                    </div>
                    <span className="text-xs truncate flex-1 text-muted-foreground">
                      {col.name}
                    </span>
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer with delete button */}
          <Separator className="bg-border/40" />
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {selected.size === 0
                ? 'Sélectionnez les colonnes à supprimer'
                : `${selected.size} colonne(s) seront supprimées définitivement`}
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1"
              disabled={selected.size === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="w-3 h-3" />
              Supprimer ({selected.size})
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Suppression définitive
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 p-3 bg-destructive/5 rounded border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-xs text-foreground">
                Vous êtes sur le point de supprimer <strong>{selected.size} colonne(s) image</strong> de façon <strong>irréversible</strong>.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Cette action supprimera les colonnes de la base de données. Les données des cellules (URLs Drive) seront perdues, mais les fichiers sur Google Drive et le bucket CDN ne sont pas affectés. Les colonnes Galerie (IMAGE_ARRAY) et natives sont protégées et ne seront pas touchées.
            </p>
            <div className="max-h-32 overflow-y-auto rounded bg-muted/30 p-2 space-y-0.5">
              {Array.from(selected).map(colId => {
                const col = columns.find(c => c.id === colId);
                return col ? (
                  <div key={colId} className="flex items-center gap-1.5 text-[10px]">
                    <ImageIcon className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{col.name}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Confirmer la suppression ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
