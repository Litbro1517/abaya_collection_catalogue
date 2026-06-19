'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Check, X, Palette, ArrowRightLeft, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveColorHex, buildColorLookupMap, normalizeCouleurKey } from '@/lib/color-utils';

// ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ColorMapItem {
  id: string;
  name: string;
  slug: string;
  hex: string;
  ordre: number;
  visible: boolean;
  isActive: boolean;
}

interface ColorCellProps {
  value: string;           // Current value: comma-separated color names (e.g. "Noir, Beige, Rose")
  rowId: string;
  colSlug: string;
  dataSourceId: string;
  rowData: Record<string, unknown>;
  onUpdateRow: (rowId: string, newData: Record<string, unknown>) => void;
  onRefresh: (options?: { forceNetwork?: boolean }) => void;
  colormapItems?: Array<{
    id: string; name: string; slug: string; hex: string; ordre: number; visible: boolean; isActive: boolean;
  }>;
}

// ━━━ Helper ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// ━━━ ColumnSelector Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ColumnSelector({ dataSourceId, colSlug, value, onChange }: {
  dataSourceId: string;
  colSlug: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [columns, setColumns] = useState<{slug: string; name: string}[]>([]);

  useEffect(() => {
    fetch(`/api/datasources/${dataSourceId}/columns`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) {
          setColumns(
            json.data
              .filter((c: any) => c.type === 'TEXT' && c.slug !== colSlug)
              .map((c: any) => ({ slug: c.slug, name: c.name }))
          );
        }
      })
      .catch(() => {});
  }, [dataSourceId, colSlug]);

  return (
    <select
      className="w-full h-7 text-xs rounded-md border border-input bg-background px-2"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Choisir une colonne...</option>
      {columns.map(c => (
        <option key={c.slug} value={c.slug}>{c.name}</option>
      ))}
    </select>
  );
}

// ━━━ ColorCell Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ColorCell({
  value,
  rowId,
  colSlug,
  dataSourceId,
  rowData,
  onUpdateRow,
  onRefresh,
  colormapItems,
}: ColorCellProps) {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<ColorMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#000000');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mapper state
  const [showMapper, setShowMapper] = useState(false);
  const [mapperSourceCol, setMapperSourceCol] = useState<string>('');
  const [mapperPreview, setMapperPreview] = useState<{raw: string; mapped: string | null; hex: string | null}[]>([]);
  const [mapperLoading, setMapperLoading] = useState(false);

  // Parse the current value into an array of selected color names
  const selectedNames = value
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // ━━━ Colormap: use injected dict from DataPillar (loaded once, shared by all cells) ━━━
  // Falls back to individual fetch only if prop is not provided (backward compat)
  useEffect(() => {
    if (colormapItems && colormapItems.length > 0) {
      setColors(colormapItems);
      setLoading(false);
    } else {
      // Fallback: fetch individually (for standalone use outside DataPillar)
      fetch('/api/colormap')
        .then(res => (res.ok ? res.json() : null))
        .then(json => {
          if (json?.data) {
            setColors(json.data);
          }
        })
        .catch(() => {
          toast.error('Erreur de chargement des couleurs');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [colormapItems]);

  // Focus the name input when quick-add form appears
  useEffect(() => {
    if (showQuickAdd && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showQuickAdd]);

  // Visible colors only, sorted by ordre
  const visibleColors = colors
    .filter(c => c.visible && c.isActive)
    .sort((a, b) => a.ordre - b.ordre);

  // Build a robust lookup map for hex resolution (same as ProductPage)
  const colorLookupMap = buildColorLookupMap(colors);

  // Helper: lookup color by name (fuzzy — case-insensitive, accent-tolerant)
  const getColorByName = (name: string): ColorMapItem | undefined => {
    // Strategy 1: Exact match (fast path)
    const exact = colors.find(c => c.name === name);
    if (exact) return exact;
    // Strategy 2: Normalized key match (case-insensitive, accent-insensitive)
    const normKey = normalizeCouleurKey(name);
    const byNorm = colors.find(c => normalizeCouleurKey(c.name) === normKey);
    if (byNorm) return byNorm;
    // Strategy 3: Slug match
    const slugMatch = colors.find(c => c.slug === normKey);
    if (slugMatch) return slugMatch;
    return undefined;
  };

  // Resolve hex for a color name using the multi-strategy resolver
  const resolveHex = (name: string): string | null => resolveColorHex(name, colorLookupMap);

  // Local slug generator for fuzzy matching
  const generateColorSlugLocal = (name: string): string =>
    name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');

  // ── Toggle a color selection ──
  const toggleColor = (colorName: string) => {
    // Check if already selected (fuzzy match for case-insensitive equality)
    const existingIdx = selectedNames.findIndex(n =>
      n === colorName ||
      normalizeCouleurKey(n) === normalizeCouleurKey(colorName) ||
      normalizeCouleurKey(n) === generateColorSlugLocal(colorName)
    );

    let newSelected: string[];
    if (existingIdx >= 0) {
      // Remove the existing entry (even if case differs)
      newSelected = selectedNames.filter((_, i) => i !== existingIdx);
    } else {
      // Add using the canonical ColorMap name
      newSelected = [...selectedNames, colorName];
    }

    const newData = { ...rowData };
    newData[colSlug] = newSelected.join(', ');
    onUpdateRow(rowId, newData);

    // Background save
    fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: newData }),
    }).then(res => {
      if (res.ok) toast.success('Couleurs mises à jour');
      else {
        toast.error('Erreur');
        onRefresh();
      }
    }).catch(() => {
      toast.error('Erreur réseau');
      onRefresh();
    });
  };

  // ── Remove a color chip ──
  const removeColor = (colorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleColor(colorName);
  };

  // ── Quick-add a new color to ColorMap ──
  const handleQuickAdd = async () => {
    const name = newName.trim();
    const hex = newHex.trim();
    if (!name) {
      toast.error('Le nom est requis');
      return;
    }
    if (!hex || !hex.startsWith('#') || hex.length < 4) {
      toast.error('Code hex invalide (ex: #FF5500)');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/colormap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, hex }),
      });
      if (res.ok) {
        const json = await res.json();
        const newColor: ColorMapItem = json.data;
        // Add to local colors list
        setColors(prev => [...prev, newColor]);
        // Auto-select the new color
        const newSelected = [...selectedNames, newColor.name];
        const newData = { ...rowData };
        newData[colSlug] = newSelected.join(', ');
        onUpdateRow(rowId, newData);
        // Background save
        fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: newData }),
        }).then(r => {
          if (r.ok) toast.success(`Couleur "${newColor.name}" ajoutée et sélectionnée`);
          else {
            toast.error('Erreur');
            onRefresh();
          }
        }).catch(() => {
          toast.error('Erreur réseau');
          onRefresh();
        });
        // Reset form
        setNewName('');
        setNewHex('#000000');
        setShowQuickAdd(false);
      } else {
        toast.error('Erreur lors de l\'ajout de la couleur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setAdding(false);
    }
  };

  // ── Mapper: preview color mapping from source column ──
  const handleMapperPreview = async () => {
    if (!mapperSourceCol) return;
    setMapperLoading(true);
    try {
      // Get the raw value from the source column
      const sourceVal = String(rowData[mapperSourceCol] || '');
      if (!sourceVal.trim()) {
        toast.error('Aucune valeur dans la colonne source');
        setMapperLoading(false);
        return;
      }
      // Parse into individual names
      const names = sourceVal.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
      // Lookup via ColorMap API
      const res = await fetch(`/api/colormap/lookup?names=${encodeURIComponent(names.join(','))}`);
      if (res.ok) {
        const json = await res.json();
        const results = json.data || [];
        setMapperPreview(names.map((name, i) => ({
          raw: name,
          mapped: results[i]?.hex ? name : null,
          hex: results[i]?.hex || null,
        })));
      }
    } catch {
      toast.error('Erreur lors du mapping');
    } finally {
      setMapperLoading(false);
    }
  };

  // ── Mapper: apply the mapping results to the cell ──
  const handleMapperApply = () => {
    // Only keep colors that were successfully mapped
    const mappedNames = mapperPreview
      .filter(p => p.mapped)
      .map(p => p.raw);

    if (mappedNames.length === 0) {
      toast.error('Aucune couleur reconnue dans la source');
      return;
    }

    // Combine with existing selection
    const newSelected = [...new Set([...selectedNames, ...mappedNames])];
    const newData = { ...rowData };
    newData[colSlug] = newSelected.join(', ');
    onUpdateRow(rowId, newData);

    // Background save
    fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: newData }),
    }).then(res => {
      if (res.ok) toast.success(`${mappedNames.length} couleur(s) mappée(s)`);
      else {
        toast.error('Erreur');
        onRefresh();
      }
    }).catch(() => {
      toast.error('Erreur réseau');
      onRefresh();
    });

    setShowMapper(false);
    setMapperPreview([]);
    setMapperSourceCol('');
  };

  // ── Handle Enter key in quick-add form ──
  const handleQuickAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickAdd();
    } else if (e.key === 'Escape') {
      setShowQuickAdd(false);
      setNewName('');
      setNewHex('#000000');
    }
  };

  // ━━━ Inline Display Mode (popover closed) ━━━━━━━━━━━━━━━━━━━━━━━━
  const renderInlineDisplay = () => {
    if (selectedNames.length === 0) {
      return (
        <span className="text-muted-foreground/40 text-xs flex items-center gap-1">
          <Palette className="w-3 h-3" />
          <span>—</span>
        </span>
      );
    }

    return (
      <div className="flex items-center gap-0.5 flex-wrap" title={selectedNames.join(', ')}>
        {selectedNames.map(name => {
          const resolvedHex = resolveHex(name);
          return (
            <div
              key={name}
              className={cn('w-4 h-4 rounded-full shrink-0 border border-white/50 shadow-sm', !resolvedHex && 'color-dot-missing')}
              style={resolvedHex ? { backgroundColor: resolvedHex } : undefined}
              title={name}
            />
          );
        })}
      </div>
    );
  };

  // ━━━ Selected color chips (inside popover) ━━━━━━━━━━━━━━━━━━━━━━━━
  const renderSelectedChips = () => {
    if (selectedNames.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-border/50">
        {selectedNames.map(name => {
          const resolvedHex = resolveHex(name);
          return (
            <Badge
              key={name}
              variant="secondary"
              className={cn(
                "text-[10px] gap-1 pr-0.5 py-0 h-5 font-medium",
                "hover:bg-muted/80 transition-colors"
              )}
            >
              <div
                className={cn('w-3 h-3 rounded-full shrink-0 border border-white/30', !resolvedHex && 'color-dot-missing')}
                style={resolvedHex ? { backgroundColor: resolvedHex } : undefined}
              />
              <span>{name}</span>
              <button
                className="ml-0.5 p-0.5 rounded-sm hover:bg-destructive/20 hover:text-destructive transition-colors"
                onClick={(e) => removeColor(name, e)}
                title={`Retirer ${name}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          );
        })}
      </div>
    );
  };

  // ━━━ Dropdown content ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderDropdownContent = () => (
    <div className="w-56">
      {/* Selected chips */}
      {renderSelectedChips()}

      {/* Color list with checkboxes */}
      <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
            <Palette className="w-3 h-3 mr-1.5 animate-pulse" />
            Chargement…
          </div>
        ) : visibleColors.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">
            Aucune couleur disponible
          </div>
        ) : (
          visibleColors.map(color => {
            // Fuzzy match: check if any selected name matches this color (case-insensitive, accent-insensitive)
            const isSelected = selectedNames.some(selName => {
              if (selName === color.name) return true;
              return normalizeCouleurKey(selName) === normalizeCouleurKey(color.name) ||
                     normalizeCouleurKey(selName) === color.slug;
            });
            return (
              <label
                key={color.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm",
                  "hover:bg-muted/60",
                  isSelected && "bg-muted/40"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleColor(color.name)}
                  className="shrink-0"
                />
                <div
                  className="w-4 h-4 rounded-full shrink-0 border border-border/40 shadow-sm"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="truncate text-xs">{color.name}</span>
              </label>
            );
          })
        )}
      </div>

      {/* Quick-add section */}
      <div className="mt-2 pt-2 border-t border-border/50">
        {!showQuickAdd ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setShowQuickAdd(true)}
          >
            <Plus className="w-3 h-3" />
            Ajouter une couleur
          </Button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Input
                ref={inputRef}
                placeholder="Nom"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={handleQuickAddKeyDown}
                className="h-7 text-xs flex-1 min-w-0"
                disabled={adding}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full shrink-0 border border-border/40 shadow-sm"
                style={{ backgroundColor: newHex || '#000000' }}
              />
              <Input
                placeholder="#FF5500"
                value={newHex}
                onChange={e => setNewHex(e.target.value)}
                onKeyDown={handleQuickAddKeyDown}
                className="h-7 text-xs flex-1 min-w-0 font-mono"
                disabled={adding}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 gap-0.5 flex-1"
                onClick={handleQuickAdd}
                disabled={adding || !newName.trim()}
              >
                {adding ? (
                  <Palette className="w-2.5 h-2.5 animate-pulse" />
                ) : (
                  <Check className="w-2.5 h-2.5" />
                )}
                {adding ? 'Ajout…' : 'Ajouter'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setShowQuickAdd(false);
                  setNewName('');
                  setNewHex('#000000');
                }}
                disabled={adding}
              >
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* ── Import/Map from source ── */}
      <div className="mt-2 pt-2 border-t border-border/50">
        {!showMapper ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setShowMapper(true)}
          >
            <ArrowRightLeft className="w-3 h-3" />
            Importer / Mapper
          </Button>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[10px] text-muted-foreground font-medium">Source column:</div>
            <ColumnSelector
              dataSourceId={dataSourceId}
              colSlug={colSlug}
              value={mapperSourceCol}
              onChange={setMapperSourceCol}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 gap-0.5 flex-1"
                onClick={handleMapperPreview}
                disabled={mapperLoading || !mapperSourceCol}
              >
                {mapperLoading ? <Palette className="w-2.5 h-2.5 animate-pulse" /> : <Search className="w-2.5 h-2.5" />}
                {mapperLoading ? 'Analyse...' : 'Analyser'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => { setShowMapper(false); setMapperPreview([]); setMapperSourceCol(''); }}
              >
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
            {/* Preview results */}
            {mapperPreview.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-0.5 custom-scrollbar">
                {mapperPreview.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <div
                      className={cn('w-3 h-3 rounded-full shrink-0 border border-border/30', !p.hex && 'color-dot-missing')}
                      style={p.hex ? { backgroundColor: p.hex } : undefined}
                    />
                    <span className="truncate flex-1">{p.raw}</span>
                    {p.mapped ? (
                      <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="w-2.5 h-2.5 text-red-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
            {mapperPreview.length > 0 && mapperPreview.some(p => p.mapped) && (
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 gap-0.5 w-full"
                onClick={handleMapperApply}
              >
                <Check className="w-2.5 h-2.5" />
                Appliquer ({mapperPreview.filter(p => p.mapped).length} couleur(s))
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ━━━ Render ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 min-h-[24px] px-1 py-0.5 rounded transition-colors w-full text-left",
            "hover:bg-muted/40 cursor-pointer",
            open && "bg-muted/40 ring-1 ring-ring/20"
          )}
        >
          {renderInlineDisplay()}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-2 w-auto"
        onOpenAutoFocus={(e) => {
          // Prevent focus stealing from the trigger
          e.preventDefault();
        }}
      >
        {renderDropdownContent()}
      </PopoverContent>
    </Popover>
  );
}
