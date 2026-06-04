'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import type { Column } from '@/types';
import {
  Eye, EyeOff, Search, Check,
  Type, Hash, Banknote, Image as ImageIcon, Images,
  ChevronDown, ListChecks, Link2, Layers, ToggleRight, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Column type icon mapping
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

interface Props {
  columns: Column[];
  onToggleVisibility: (col: Column) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function ColumnVisibilityDropdown({ columns, onToggleVisibility, onShowAll, onHideAll }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const visibleCount = columns.filter(c => c.visible).length;
  const hiddenCount = columns.length - visibleCount;
  const allVisible = hiddenCount === 0;

  const filteredColumns = useMemo(() => {
    if (!search.trim()) return columns;
    const q = search.toLowerCase();
    return columns.filter(c =>
      c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
    );
  }, [columns, search]);

  // Group into visible and hidden
  const visibleColumns = filteredColumns.filter(c => c.visible);
  const hiddenColumns = filteredColumns.filter(c => !c.visible);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs gap-1.5 transition-colors",
            hiddenCount > 0
              ? "border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#C9A84C] hover:bg-[#C9A84C]/10"
              : "hover:bg-muted"
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Masquer</span>
          {hiddenCount > 0 && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-[9px] font-bold flex items-center justify-center">
              {hiddenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 shadow-lg border-border/60"
        sideOffset={4}
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground tracking-wide">
              Visibilité des colonnes
            </span>
            <span className="text-[10px] text-muted-foreground">
              {visibleCount}/{columns.length}
            </span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une colonne..."
              className="h-7 text-xs pl-7 bg-muted/30 border-border/40 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20"
            />
          </div>
        </div>

        <Separator className="bg-border/40" />

        {/* Column list — grouped: visible first, then hidden — compact vertical list */}
        <div className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
          {/* All visible empty state */}
          {allVisible && !search.trim() && (
            <div className="px-3 py-4 text-center">
              <div className="w-8 h-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-2">
                <Eye className="w-4 h-4 text-[#C9A84C]" />
              </div>
              <p className="text-xs font-medium text-foreground">Toutes visibles</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Toutes les colonnes sont actuellement affichées.
              </p>
            </div>
          )}

          {/* Visible columns section */}
          {visibleColumns.length > 0 && (!allVisible || search.trim()) && (
            <>
              {!search.trim() && visibleColumns.length > 0 && hiddenColumns.length > 0 && (
                <div className="px-3 py-1">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    Visibles ({visibleColumns.length})
                  </span>
                </div>
              )}
              {visibleColumns.map(col => (
                <button
                  key={col.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                    "hover:bg-secondary/60"
                  )}
                  onClick={() => onToggleVisibility(col)}
                >
                  <Checkbox
                    checked={col.visible}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-[#C9A84C] data-[state=checked]:border-[#C9A84C]"
                  />
                  <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {COLUMN_TYPE_ICON[col.type] || <Type className="w-3 h-3" />}
                  </div>
                  <span className="text-xs truncate flex-1 text-foreground">
                    {col.name}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Separator between visible and hidden sections */}
          {visibleColumns.length > 0 && hiddenColumns.length > 0 && !search.trim() && (
            <Separator className="bg-border/30 my-1" />
          )}

          {/* Hidden columns section */}
          {hiddenColumns.length > 0 && (
            <>
              {!search.trim() && (
                <div className="px-3 py-1">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    Masquées ({hiddenColumns.length})
                  </span>
                </div>
              )}
              {hiddenColumns.map(col => (
                <button
                  key={col.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                    "hover:bg-secondary/60 opacity-60"
                  )}
                  onClick={() => onToggleVisibility(col)}
                >
                  <Checkbox
                    checked={col.visible}
                    className="h-3.5 w-3.5"
                  />
                  <div className="w-5 h-5 rounded bg-muted/50 text-muted-foreground flex items-center justify-center shrink-0">
                    {COLUMN_TYPE_ICON[col.type] || <Type className="w-3 h-3" />}
                  </div>
                  <span className="text-xs truncate flex-1 text-muted-foreground line-through">
                    {col.name}
                  </span>
                  <EyeOff className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </>
          )}

          {/* No results */}
          {filteredColumns.length === 0 && search.trim() && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune colonne trouvée
            </div>
          )}
        </div>

        {/* Footer with Show All / Hide All */}
        {(hiddenCount > 0 || visibleCount > 0) && !search.trim() && (
          <>
            <Separator className="bg-border/40" />
            <div className="p-2 flex gap-1">
              {hiddenCount > 0 && (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-md transition-colors"
                  onClick={() => {
                    onShowAll();
                    setOpen(false);
                  }}
                >
                  <Check className="w-3 h-3" />
                  Tout afficher ({hiddenCount})
                </button>
              )}
              {visibleCount > 0 && (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => {
                    onHideAll();
                    setOpen(false);
                  }}
                >
                  <EyeOff className="w-3 h-3" />
                  Tout masquer ({visibleCount})
                </button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
