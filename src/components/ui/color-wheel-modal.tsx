'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeColorName, isValidHex } from '@/lib/color-utils';
import { Loader2, Plus, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ColorWheelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback when a color is successfully created */
  onColorCreated?: (color: { id: string; name: string; slug: string; hex: string }) => void;
  /** Pre-fill the name field (e.g. from an unknown imported color) */
  initialName?: string;
  /** Pre-fill the hex field */
  initialHex?: string;
}

// ─── Quick Palette Presets ──────────────────────────────────────────────────

const QUICK_PALETTE = [
  { name: 'Noir',     hex: '#1A1A1A' },
  { name: 'Blanc',    hex: '#FFFFFF' },
  { name: 'Gris',     hex: '#808080' },
  { name: 'Beige',    hex: '#F5F0E8' },
  { name: 'Rose',     hex: '#F48FB1' },
  { name: 'Bordeaux', hex: '#800020' },
  { name: 'Vert',     hex: '#1A3C34' },
  { name: 'Bleu',     hex: '#1A3C6D' },
  { name: 'Doré',     hex: '#C9A84C' },
  { name: 'Kaki',     hex: '#8B7355' },
];

// ─── Brand ──────────────────────────────────────────────────────────────────

const GRIS_NOIR = '#2D2D2D';
const NOIR_CHARBONNE = '#1A1A1A';
const BRAND_GOLD = '#C9A84C';

// ─── Component ──────────────────────────────────────────────────────────────

export function ColorWheelModal({
  open,
  onOpenChange,
  onColorCreated,
  initialName = '',
  initialHex = '#1A1A1A',
}: ColorWheelModalProps) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialName);
  const [hex, setHex] = useState(initialHex);
  const [creating, setCreating] = useState(false);

  // ─── Reset form when modal opens ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setName(initialName);
      setHex(initialHex);
    }
  }, [open, initialName, initialHex]);

  // ─── Computed ───────────────────────────────────────────────────────────
  const normalizedName = normalizeColorName(name);
  const hexValid = isValidHex(hex);
  const nameValid = normalizedName.length > 0;
  const canCreate = nameValid && hexValid && !creating;

  // ─── Handle create ──────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!canCreate) return;

    const upperHex = hex.toUpperCase();
    setCreating(true);

    try {
      const res = await fetch('/api/colormap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalizedName, hex: upperHex }),
      });

      if (res.ok) {
        const json = await res.json();
        const created = json.data as { id: string; name: string; slug: string; hex: string };

        toast.success(`Couleur "${created.name}" créée`);

        // Close the modal
        onOpenChange(false);

        // Notify parent via callback
        if (onColorCreated) {
          onColorCreated(created);
        }
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de la création');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setCreating(false);
    }
  }, [canCreate, hex, normalizedName, onColorCreated, onOpenChange]);

  // ─── Handle quick palette select ────────────────────────────────────────
  const handlePaletteSelect = useCallback((preset: { name: string; hex: string }) => {
    setHex(preset.hex);
    if (!name.trim()) {
      setName(preset.name);
    }
  }, [name]);

  // ─── Handle hex input change ────────────────────────────────────────────
  const handleHexInputChange = useCallback((value: string) => {
    // Auto-prefix with # if missing
    let sanitized = value.trim();
    if (sanitized && !sanitized.startsWith('#')) {
      sanitized = '#' + sanitized;
    }
    setHex(sanitized.toUpperCase());
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-base"
            style={{ color: NOIR_CHARBONNE }}
          >
            <Palette className="w-4.5 h-4.5" style={{ color: BRAND_GOLD }} />
            Créer une couleur
          </DialogTitle>
        </DialogHeader>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="space-y-5 py-2">
          {/* ── Color Picker + Live Preview ────────────────────────────── */}
          <div className="flex items-start gap-5">
            {/* Large color wheel */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <Label className="text-xs" style={{ color: GRIS_NOIR }}>
                Nuancier
              </Label>
              <div className="relative">
                <input
                  type="color"
                  value={hexValid ? hex : '#000000'}
                  onChange={(e) => setHex(e.target.value.toUpperCase())}
                  className="w-20 h-20 rounded-xl cursor-pointer border-2 border-border shadow-sm p-0 bg-transparent"
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                  }}
                  title="Choisir une couleur"
                  aria-label="Sélecteur de couleur"
                />
              </div>
            </div>

            {/* Live preview circle */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <Label className="text-xs" style={{ color: GRIS_NOIR }}>
                Aperçu
              </Label>
              <div
                className={cn(
                  'w-20 h-20 rounded-full border-2 shadow-sm transition-colors duration-200',
                  'flex items-center justify-center'
                )}
                style={{
                  backgroundColor: hexValid ? hex : '#CCCCCC',
                  borderColor: isLightColor(hexValid ? hex : '#CCCCCC')
                    ? 'rgba(0,0,0,0.12)'
                    : 'rgba(0,0,0,0.06)',
                }}
              >
                {normalizedName && (
                  <span
                    className="text-[10px] font-semibold text-center leading-tight px-1 max-w-full break-words"
                    style={{
                      color: isLightColor(hexValid ? hex : '#CCCCCC')
                        ? NOIR_CHARBONNE
                        : '#FFFFFF',
                    }}
                  >
                    {normalizedName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Hex Input ─────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="color-hex" className="text-xs" style={{ color: GRIS_NOIR }}>
              Code hex
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="color-hex"
                value={hex}
                onChange={(e) => handleHexInputChange(e.target.value)}
                placeholder="#1A1A1A"
                className={cn(
                  'h-9 text-sm font-mono flex-1',
                  !hexValid && hex.length > 0 && 'border-red-300 focus-visible:border-red-400'
                )}
                maxLength={7}
                aria-invalid={!hexValid && hex.length > 0}
              />
              {!hexValid && hex.length > 0 && (
                <span className="text-[11px] text-red-500 shrink-0">Invalide</span>
              )}
            </div>
          </div>

          {/* ── Name Input + Normalized Preview ───────────────────────── */}
          <div className="space-y-1.5">
            <Label htmlFor="color-name" className="text-xs" style={{ color: GRIS_NOIR }}>
              Nom de la couleur
            </Label>
            <Input
              id="color-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Bleu-Nuit"
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) handleCreate();
              }}
            />
            {name.trim() && (
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 border"
                  style={{
                    backgroundColor: hexValid ? hex : '#CCCCCC',
                    borderColor: 'rgba(0,0,0,0.1)',
                  }}
                />
                <span className="text-xs" style={{ color: GRIS_NOIR }}>
                  Normalisé :
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: NOIR_CHARBONNE }}
                >
                  {normalizedName || '—'}
                </span>
                {name.trim() !== normalizedName && normalizedName && (
                  <span className="text-[10px] text-muted-foreground">
                    (auto-corrigé)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Quick Palette ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-xs" style={{ color: GRIS_NOIR }}>
              Palette rapide
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              {QUICK_PALETTE.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={cn(
                    'rounded-full transition-all duration-200 shrink-0',
                    'hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
                  )}
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: preset.hex,
                    border: isLightColor(preset.hex)
                      ? '1.5px solid rgba(0,0,0,0.15)'
                      : '1.5px solid rgba(0,0,0,0.06)',
                    ...(hex.toUpperCase() === preset.hex.toUpperCase()
                      ? { ringColor: NOIR_CHARBONNE, outline: `2px solid ${NOIR_CHARBONNE}`, outlineOffset: '2px' }
                      : {}),
                  }}
                  onClick={() => handlePaletteSelect(preset)}
                  title={preset.name}
                  aria-label={`Sélectionner ${preset.name}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="text-sm"
          >
            Annuler
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-sm"
            style={{ backgroundColor: BRAND_GOLD, color: '#FFFFFF' }}
            disabled={!canCreate}
            onClick={handleCreate}
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * isLightColor — Determine if a hex color is light (needs a border / dark text)
 */
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.85;
}
