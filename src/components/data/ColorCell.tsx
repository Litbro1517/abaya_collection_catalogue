'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Check, X, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  onRefresh: () => void;
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

// ━━━ ColorCell Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ColorCell({
  value,
  rowId,
  colSlug,
  dataSourceId,
  rowData,
  onUpdateRow,
  onRefresh,
}: ColorCellProps) {
  const [open, setOpen] = useState(false);
  const [colors, setColors] = useState<ColorMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#000000');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse the current value into an array of selected color names
  const selectedNames = value
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Load ColorMap data on mount
  useEffect(() => {
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
  }, []);

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

  // Helper: lookup color by name
  const getColorByName = (name: string): ColorMapItem | undefined =>
    colors.find(c => c.name === name);

  // ── Toggle a color selection ──
  const toggleColor = (colorName: string) => {
    const newSelected = selectedNames.includes(colorName)
      ? selectedNames.filter(n => n !== colorName)
      : [...selectedNames, colorName];

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
          const colorItem = getColorByName(name);
          return (
            <div
              key={name}
              className="w-4 h-4 rounded-full shrink-0 border border-white/50 shadow-sm"
              style={{ backgroundColor: colorItem?.hex || '#9CA3AF' }}
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
          const colorItem = getColorByName(name);
          const hex = colorItem?.hex || '#9CA3AF';
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
                className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                style={{ backgroundColor: hex }}
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
            const isSelected = selectedNames.includes(color.name);
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
