'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────
interface ColorMapItem {
  id: string;
  name: string;
  slug: string;
  hex: string;
  ordre: number;
  visible: boolean;
  isActive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return true;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function normalizeHex(value: string): string {
  let h = value.trim();
  if (!h.startsWith('#')) h = '#' + h;
  return h;
}

function generateSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Component ────────────────────────────────────────────────────────────
export function ColorMapManager() {
  const [colors, setColors] = useState<ColorMapItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'hex' | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Delete safety: track which colors are in-use
  const [colorUsage, setColorUsage] = useState<Record<string, number>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Load colors ──────────────────────────────────────────────────────
  const loadColors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/colormap');
      if (res.ok) {
        const json = await res.json();
        const items: ColorMapItem[] = json.data || [];
        // Sort by ordre
        items.sort((a, b) => a.ordre - b.ordre);
        setColors(items);
      } else {
        toast.error('Erreur lors du chargement des couleurs');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Load color usage counts ─────────────────────────────────────────
  const loadColorUsage = useCallback(async () => {
    try {
      const dsRes = await fetch('/api/datasources');
      if (!dsRes.ok) return;
      const dsJson = await dsRes.json();
      const dsList: { id: string }[] = dsJson.data || [];

      const counts: Record<string, number> = {};

      for (const ds of dsList) {
        const rowsRes = await fetch(`/api/datasources/${ds.id}/rows?limit=1000`);
        if (!rowsRes.ok) continue;
        const rowsJson = await rowsRes.json();
        const rows: { data: unknown }[] = rowsJson.data || [];

        for (const row of rows) {
          const data = row.data as Record<string, unknown> | null;
          if (data) {
            // The native COLOR column stores a comma-separated list of color
            // NAMES (e.g. "Noir, Beige, Caramel"). Read it and tally each
            // individual name so the "used by N products" badge is accurate.
            // NOTE: the slug is `__colors__` (plural) — the previous
            // `__color__` (singular) read was a typo that always returned
            // undefined, so every counter showed 0.
            const raw = data.__colors__;
            if (typeof raw === 'string' && raw.trim()) {
              const names = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
              for (const name of names) {
                counts[name] = (counts[name] || 0) + 1;
              }
            }
          }
        }
      }

      setColorUsage(counts);
    } catch {
      // Silent fail for usage counts
    }
  }, []);

  useEffect(() => {
    loadColors();
    loadColorUsage();
  }, [loadColors, loadColorUsage]);

  // ─── Add color ───────────────────────────────────────────────────────
  const addColor = async () => {
    const trimmedName = newName.trim();
    const hex = normalizeHex(newHex);

    if (!trimmedName) {
      toast.error('Le nom de la couleur est requis');
      return;
    }
    if (!isValidHex(hex)) {
      toast.error('Code hex invalide (format: #RRGGBB)');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/colormap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          hex: hex.toUpperCase(),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setColors(prev => [...prev, json.data].sort((a, b) => a.ordre - b.ordre));
        setNewName('');
        setNewHex('#');
        setShowAddForm(false);
        toast.success(`Couleur "${trimmedName}" ajoutée`);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de l\'ajout');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setAdding(false);
    }
  };

  // ─── Update color (inline edit) ──────────────────────────────────────
  const saveEdit = async (id: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditingField(null);
      return;
    }

    const field = editingField;
    const updatePayload: Record<string, unknown> = { id };

    if (field === 'name') {
      updatePayload.name = trimmed;
      // Optimistic
      setColors(prev =>
        prev.map(c => (c.id === id ? { ...c, name: trimmed } : c))
      );
    } else if (field === 'hex') {
      const hex = normalizeHex(trimmed);
      if (!isValidHex(hex)) {
        toast.error('Code hex invalide (format: #RRGGBB)');
        return;
      }
      updatePayload.hex = hex.toUpperCase();
      // Optimistic
      setColors(prev =>
        prev.map(c => (c.id === id ? { ...c, hex: hex.toUpperCase() } : c))
      );
    }

    setEditingId(null);
    setEditingField(null);

    try {
      const res = await fetch('/api/colormap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      if (res.ok) {
        toast.success(field === 'name' ? 'Nom mis à jour' : 'Code hex mis à jour');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        loadColors(); // Revert
      }
    } catch {
      toast.error('Erreur de connexion');
      loadColors(); // Revert
    }
  };

  // ─── Toggle visibility ───────────────────────────────────────────────
  const toggleVisible = async (id: string, visible: boolean) => {
    // Optimistic
    setColors(prev =>
      prev.map(c => (c.id === id ? { ...c, visible } : c))
    );
    try {
      const res = await fetch('/api/colormap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visible }),
      });
      if (res.ok) {
        toast.success(visible ? 'Couleur visible dans le catalogue' : 'Couleur masquée du catalogue');
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        loadColors();
      }
    } catch {
      toast.error('Erreur de connexion');
      loadColors();
    }
  };

  // ─── Delete color ────────────────────────────────────────────────────
  const deleteColor = async (id: string) => {
    const color = colors.find(c => c.id === id);
    if (!color) return;

    // Check if color is used by products
    const usageCount = colorUsage[color.slug] || colorUsage[color.name] || 0;
    if (usageCount > 0) {
      toast.error(
        `Impossible de supprimer "${color.name}" — utilisée par ${usageCount} produit${usageCount > 1 ? 's' : ''}`,
        { duration: 5000 }
      );
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/colormap?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setColors(prev => prev.filter(c => c.id !== id));
        toast.success(`Couleur "${color.name}" supprimée`);
        loadColorUsage();
      } else {
        const json = await res.json();
        if (res.status === 403 || res.status === 409) {
          toast.error(json.error || 'Impossible de supprimer : des produits sont associés à cette couleur');
          loadColorUsage();
        } else {
          toast.error(json.error || 'Erreur');
        }
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Start inline edit ───────────────────────────────────────────────
  const startEdit = (id: string, field: 'name' | 'hex', currentValue: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditingValue('');
  };

  // ─── Preview hex for add form ────────────────────────────────────────
  const previewHex = normalizeHex(newHex);
  const previewValid = isValidHex(previewHex);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <Card className="border-[#1A1A1A]/8 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#C9A84C15' }}>
              <Palette className="w-4 h-4" style={{ color: '#C9A84C' }} />
            </div>
            <div>
              <CardTitle className="text-sm" style={{ color: '#1A1A1A' }}>
                Bibliothèque de Couleurs
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gérez les couleurs disponibles pour vos produits
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs font-medium border-0 shadow-none"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
            onClick={() => setShowAddForm(prev => !prev)}
          >
            {showAddForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                Annuler
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Add Color Form ─────────────────────────────────────────── */}
        {showAddForm && (
          <div
            className="p-4 rounded-lg border border-dashed transition-colors"
            style={{
              borderColor: '#C9A84C40',
              backgroundColor: '#FAF8F5',
            }}
          >
            <p className="text-xs font-medium mb-3" style={{ color: '#1A1A1A' }}>
              Nouvelle couleur
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  Nom de la couleur
                </label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="ex: Or Rose"
                  className="h-9 text-sm bg-white"
                  onKeyDown={e => {
                    if (e.key === 'Enter') addColor();
                  }}
                />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  Code Hex (#XXXXXX)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newHex}
                    onChange={e => setNewHex(e.target.value)}
                    placeholder="#C9A84C"
                    className="h-9 text-sm font-mono bg-white"
                    onKeyDown={e => {
                      if (e.key === 'Enter') addColor();
                    }}
                  />
                  {/* Preview circle */}
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full shrink-0 border-2 transition-all duration-200',
                      previewValid ? 'border-transparent shadow-sm' : 'border-dashed border-muted-foreground/30'
                    )}
                    style={{
                      backgroundColor: previewValid ? previewHex : 'transparent',
                    }}
                  >
                    {!previewValid && (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                        <Palette className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 h-9 text-xs font-medium shrink-0 border-0 shadow-none"
                style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
                onClick={addColor}
                disabled={adding || !newName.trim() || !isValidHex(normalizeHex(newHex))}
              >
                {adding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Ajouter
              </Button>
            </div>
          </div>
        )}

        {/* ── Loading State ──────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : colors.length === 0 ? (
          /* ── Empty State ────────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: '#FAF8F5' }}
            >
              <Palette className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aucune couleur configurée
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Ajoutez votre première couleur pour commencer
            </p>
          </div>
        ) : (
          /* ── Color List ─────────────────────────────────────────────── */
          <div className="space-y-1">
            {colors.map((color) => {
              const light = isLightColor(color.hex);
              const usageCount = colorUsage[color.slug] || colorUsage[color.name] || 0;
              const isEditingThis = editingId === color.id;
              const isEditingName = isEditingThis && editingField === 'name';
              const isEditingHex = isEditingThis && editingField === 'hex';

              return (
                <div
                  key={color.id}
                  className={cn(
                    'group flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200',
                    'hover:border-[#C9A84C30] hover:bg-[#FAF8F580]',
                    !color.visible && 'opacity-45',
                    isEditingThis && 'border-[#C9A84C50] bg-[#FAF8F5]'
                  )}
                >
                  {/* Order number */}
                  <span className="text-[10px] text-muted-foreground w-5 text-center font-mono shrink-0">
                    {color.ordre}
                  </span>

                  {/* Color circle */}
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full shrink-0 shadow-sm transition-transform duration-200',
                      'group-hover:scale-110',
                      light && 'border border-[#1A1A1A15]'
                    )}
                    style={{ backgroundColor: color.hex }}
                    title={color.hex}
                  />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => saveEdit(color.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(color.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="h-7 text-sm flex-1"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onMouseDown={e => {
                            e.preventDefault();
                            saveEdit(color.id);
                          }}
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onMouseDown={e => {
                            e.preventDefault();
                            cancelEdit();
                          }}
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity select-none truncate block"
                        style={{ color: '#1A1A1A' }}
                        onDoubleClick={() => startEdit(color.id, 'name', color.name)}
                        title="Double-cliquer pour modifier le nom"
                      >
                        {color.name}
                      </span>
                    )}
                  </div>

                  {/* Hex code */}
                  <div className="shrink-0">
                    {isEditingHex ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => saveEdit(color.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(color.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="h-7 text-xs font-mono w-24"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onMouseDown={e => {
                            e.preventDefault();
                            saveEdit(color.id);
                          }}
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onMouseDown={e => {
                            e.preventDefault();
                            cancelEdit();
                          }}
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="text-xs font-mono text-muted-foreground cursor-pointer hover:opacity-70 transition-opacity select-none"
                        onDoubleClick={() => startEdit(color.id, 'hex', color.hex)}
                        title="Double-cliquer pour modifier le code hex"
                      >
                        {color.hex}
                      </span>
                    )}
                  </div>

                  {/* Usage badge */}
                  {usageCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-5 px-1.5 shrink-0 font-normal"
                    >
                      {usageCount} prod.
                    </Badge>
                  )}

                  {/* Visible toggle */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {color.visible ? (
                      <Eye className="w-3 h-3 text-muted-foreground/50" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-muted-foreground/40" />
                    )}
                    <Switch
                      checked={color.visible}
                      onCheckedChange={v => toggleVisible(color.id, v)}
                      className="scale-75 origin-center"
                    />
                  </div>

                  {/* Edit button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground/60 hover:text-[#C9A84C] hover:bg-[#C9A84C10] opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(color.id, 'name', color.name)}
                    title="Modifier"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-7 w-7 shrink-0 transition-all',
                      usageCount > 0
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : 'text-red-400/70 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                    )}
                    onClick={() => deleteColor(color.id)}
                    disabled={usageCount > 0 || deletingId === color.id}
                    title={usageCount > 0 ? `Utilisée par ${usageCount} produit${usageCount > 1 ? 's' : ''}` : 'Supprimer'}
                  >
                    {deletingId === color.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer hint ─────────────────────────────────────────────── */}
        {colors.length > 0 && (
          <p className="text-[11px] text-muted-foreground/60 text-center pt-2">
            Double-cliquez sur un nom ou un code hex pour le modifier
          </p>
        )}
      </CardContent>
    </Card>
  );
}
