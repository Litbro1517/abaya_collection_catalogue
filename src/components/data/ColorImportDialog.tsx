'use client';

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Palette, Loader2, Check, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ColorImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataSourceId: string;
  columns: { id: string; name: string; slug: string }[];
  rows: { data: Record<string, unknown> }[];
  onImportComplete: () => void;
}

interface ColorMapItem {
  id: string;
  name: string;
  slug: string;
  hex: string;
  ordre: number;
  visible: boolean;
  isActive: boolean;
}

interface NewColorEntry {
  originalRaw: string;
  name: string;
  hex: string;
  included: boolean;
}

// ━━━ Normalization (same as the API) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeColorName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/-/g, '§HYPHEN§')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(word => word.replace(/§HYPHEN§/g, '-'))
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ━━━ Color helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// ━━━ Step indicator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STEPS = [
  { label: 'Source', description: 'Colonne source' },
  { label: 'Aperçu', description: 'Validation' },
  { label: 'Import', description: 'Confirmation' },
] as const;

// ━━━ Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ColorImportDialog({
  open,
  onOpenChange,
  dataSourceId,
  columns,
  rows,
  onImportComplete,
}: ColorImportDialogProps) {
  // ── Step state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // ── Step 1: Source selection ────────────────────────────────────────────
  const [selectedColumnSlug, setSelectedColumnSlug] = useState<string>('');

  // ── Step 2: Scan results ────────────────────────────────────────────────
  const [colorMap, setColorMap] = useState<ColorMapItem[]>([]);
  const [knownColors, setKnownColors] = useState<string[]>([]);
  const [newColors, setNewColors] = useState<NewColorEntry[]>([]);
  const [loadingColorMap, setLoadingColorMap] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [knownSectionOpen, setKnownSectionOpen] = useState(true);
  const [newSectionOpen, setNewSectionOpen] = useState(true);

  // ── Step 3: Import ──────────────────────────────────────────────────────
  const [importing, setImporting] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────
  const [validationError, setValidationError] = useState('');

  // ── Reset on close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setStep(0);
      setSelectedColumnSlug('');
      setColorMap([]);
      setKnownColors([]);
      setNewColors([]);
      setLoadingColorMap(false);
      setScanning(false);
      setKnownSectionOpen(true);
      setNewSectionOpen(true);
      setImporting(false);
      setValidationError('');
    }
  }, [open]);

  // ── Load ColorMap on open ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoadingColorMap(true);
    fetch('/api/colormap')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load colormap');
        return r.json();
      })
      .then(json => {
        const data = json.data ?? json ?? [];
        setColorMap(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        toast.error('Impossible de charger la carte des couleurs');
        setColorMap([]);
      })
      .finally(() => setLoadingColorMap(false));
  }, [open]);

  // ── Step 1 → Step 2: Scan & Parse ──────────────────────────────────────
  const handleScan = useMemo(() => {
    return () => {
      if (!selectedColumnSlug) return;
      setScanning(true);
      setValidationError('');

      // Collect all non-empty values from the selected column
      const rawValues = new Set<string>();
      for (const row of rows) {
        const val = row.data[selectedColumnSlug];
        if (val === null || val === undefined || val === '') continue;
        const strVal = String(val).trim();
        if (strVal) rawValues.add(strVal);
      }

      // Normalize each value
      const normalizedMap = new Map<string, string>(); // normalized → original raw (first seen)
      for (const raw of rawValues) {
        const normalized = normalizeColorName(raw);
        if (normalized && !normalizedMap.has(normalized)) {
          normalizedMap.set(normalized, raw);
        }
      }

      // Build slug lookup from existing ColorMap
      const existingSlugSet = new Set(colorMap.map(c => c.slug.toLowerCase()));
      const existingNameSet = new Set(colorMap.map(c => c.name.toLowerCase()));

      const known: string[] = [];
      const newEntries: NewColorEntry[] = [];

      for (const [normalized, originalRaw] of normalizedMap) {
        // Check by slug (name lowercased, spaces → hyphens) or by exact name match
        const slug = normalized.toLowerCase().replace(/\s+/g, '-');
        if (existingSlugSet.has(slug) || existingNameSet.has(normalized.toLowerCase())) {
          known.push(normalized);
        } else {
          newEntries.push({
            originalRaw,
            name: normalized,
            hex: '',
            included: true,
          });
        }
      }

      setKnownColors(known);
      setNewColors(newEntries);
      setScanning(false);
      setStep(1);
    };
  }, [selectedColumnSlug, rows, colorMap]);

  // ── Toggle all new colors included ──────────────────────────────────────
  const handleToggleAll = (included: boolean) => {
    setNewColors(prev => prev.map(c => ({ ...c, included })));
  };

  // ── Update a single new color entry ─────────────────────────────────────
  const updateNewColor = (index: number, field: 'name' | 'hex' | 'included', value: string | boolean) => {
    setNewColors(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    // Clear validation error when user edits
    if (field === 'hex' && typeof value === 'string' && isValidHex(value)) {
      setValidationError('');
    }
  };

  // ── Validate before import ──────────────────────────────────────────────
  const includedNewColors = useMemo(() => newColors.filter(c => c.included), [newColors]);

  const canProceedToImport = useMemo(() => {
    if (includedNewColors.length === 0) return false;
    return includedNewColors.every(c => isValidHex(c.hex));
  }, [includedNewColors]);

  const handleValidateAndProceed = () => {
    if (includedNewColors.length === 0) {
      setValidationError('Aucune nouvelle couleur sélectionnée pour l\'import.');
      return;
    }

    const missingHex = includedNewColors.filter(c => !isValidHex(c.hex));
    if (missingHex.length > 0) {
      setValidationError(
        `${missingHex.length} couleur(s) sans code hex valide. Chaque nouvelle couleur doit avoir un code hex (#RRGGBB).`
      );
      return;
    }

    setValidationError('');
    setStep(2);
  };

  // ── Step 3: Execute import ──────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    try {
      const colors = includedNewColors.map(c => ({
        name: c.name,
        hex: c.hex,
      }));

      const res = await fetch('/api/colormap/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Erreur lors de l\'import');
      }

      const result = await res.json();
      const count = result.data?.created ?? colors.length;
      toast.success(`${count} couleur(s) importée(s) avec succès`);
      onImportComplete();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'import des couleurs');
    } finally {
      setImporting(false);
    }
  };

  // ── Hex input auto-format: add # prefix ─────────────────────────────────
  const handleHexInput = (index: number, rawValue: string) => {
    let hex = rawValue.trim();
    // Auto-add # if user types without it
    if (hex && !hex.startsWith('#')) {
      hex = '#' + hex;
    }
    // Limit to 7 chars (#RRGGBB)
    if (hex.length > 7) {
      hex = hex.substring(0, 7);
    }
    updateNewColor(index, 'hex', hex.toUpperCase());
  };

  // ━━━ Render ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#C9A84C]" />
            Importer des Couleurs
          </DialogTitle>
          <DialogDescription>
            Importez les couleurs de votre source de données dans la carte des couleurs.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step Indicator ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-1 py-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors',
                  step === i
                    ? 'bg-[#C9A84C] text-white'
                    : step > i
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {step > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className={cn(
                  'text-xs font-medium truncate',
                  step >= i ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {s.label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{s.description}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-px mx-1',
                  step > i ? 'bg-emerald-400' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
          {/* ━━━ Step 1: Source Selection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {step === 0 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Colonne contenant les couleurs
                </Label>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez la colonne de votre source de données qui contient les noms de couleurs à importer.
                </p>
                {loadingColorMap ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement de la carte des couleurs…
                  </div>
                ) : (
                  <Select value={selectedColumnSlug} onValueChange={setSelectedColumnSlug}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choisir une colonne…" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col.id} value={col.slug}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedColumnSlug && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-foreground">
                    Aperçu rapide
                  </p>
                  {(() => {
                    const samples = rows
                      .map(r => String(r.data[selectedColumnSlug] ?? '').trim())
                      .filter(Boolean)
                      .slice(0, 6);
                    const uniqueSamples = [...new Set(samples)];
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {uniqueSamples.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Aucune valeur trouvée</span>
                        ) : (
                          uniqueSamples.map((val, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {normalizeColorName(val)}
                            </Badge>
                          ))
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-muted-foreground">
                    {rows.filter(r => String(r.data[selectedColumnSlug] ?? '').trim()).length} valeur(s) non vide(s) dans cette colonne
                  </p>
                </div>
              )}

              {colorMap.length > 0 && (
                <div className="rounded-lg border border-border bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {colorMap.length} couleur(s) déjà enregistrée(s) dans la carte
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ━━━ Step 2: Preview & Validate ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              {/* Summary bar */}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  {knownColors.length} connue(s)
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {newColors.length} nouvelle(s)
                </span>
              </div>

              {/* ── Known Colors Section ──────────────────────────────────── */}
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/10 overflow-hidden">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors"
                  onClick={() => setKnownSectionOpen(!knownSectionOpen)}
                >
                  {knownSectionOpen ? (
                    <ChevronDown className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Couleurs connues
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 ml-auto">
                    {knownColors.length}
                  </Badge>
                </button>
                {knownSectionOpen && (
                  <div className="px-3 pb-3">
                    {knownColors.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-1">
                        Aucune couleur connue dans cette colonne.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {knownColors.map(name => {
                          const existing = colorMap.find(
                            c => c.name.toLowerCase() === name.toLowerCase() ||
                              c.slug === name.toLowerCase().replace(/\s+/g, '-')
                          );
                          return (
                            <Badge
                              key={name}
                              variant="secondary"
                              className="text-[10px] gap-1.5 bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/50"
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-white/50"
                                style={{ backgroundColor: existing?.hex || '#ccc' }}
                              />
                              {name}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── New Colors Section ────────────────────────────────────── */}
              <div className="rounded-lg border border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/10 overflow-hidden">
                <button
                  type="button"
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
                  onClick={() => setNewSectionOpen(!newSectionOpen)}
                >
                  {newSectionOpen ? (
                    <ChevronDown className="w-4 h-4 text-amber-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Nouvelles couleurs
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 ml-auto">
                    {newColors.filter(c => c.included).length}/{newColors.length}
                  </Badge>
                </button>

                {newSectionOpen && (
                  <div className="px-3 pb-3 space-y-3">
                    {newColors.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-1">
                        Toutes les couleurs de cette colonne sont déjà connues.
                      </p>
                    ) : (
                      <>
                        {/* Toggle all row */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100/50"
                            onClick={() => handleToggleAll(true)}
                          >
                            Tout sélectionner
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            onClick={() => handleToggleAll(false)}
                          >
                            Tout désélectionner
                          </Button>
                        </div>

                        {/* New color entries */}
                        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                          {newColors.map((entry, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'flex items-center gap-2 rounded-lg border px-3 py-2 transition-all',
                                entry.included
                                  ? 'border-amber-200 dark:border-amber-700/40 bg-white dark:bg-background/80'
                                  : 'border-border/50 bg-muted/30 opacity-50'
                              )}
                            >
                              {/* Include toggle */}
                              <button
                                type="button"
                                className={cn(
                                  'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                                  entry.included
                                    ? 'bg-[#C9A84C] border-[#C9A84C] text-white'
                                    : 'border-muted-foreground/40 hover:border-[#C9A84C]/50'
                                )}
                                onClick={() => updateNewColor(idx, 'included', !entry.included)}
                                aria-label={entry.included ? 'Exclure cette couleur' : 'Inclure cette couleur'}
                              >
                                {entry.included && <Check className="w-2.5 h-2.5" />}
                              </button>

                              {/* Color preview circle */}
                              <div
                                className="w-6 h-6 rounded-full shrink-0 border border-border/50"
                                style={{
                                  backgroundColor: isValidHex(entry.hex) ? entry.hex : 'transparent',
                                  backgroundImage: !isValidHex(entry.hex)
                                    ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)'
                                    : undefined,
                                  backgroundSize: !isValidHex(entry.hex) ? '6px 6px' : undefined,
                                  backgroundPosition: !isValidHex(entry.hex) ? '0 0, 3px 3px' : undefined,
                                }}
                                title={entry.hex || 'Aucun code hex'}
                              />

                              {/* Name input */}
                              <Input
                                value={entry.name}
                                onChange={e => updateNewColor(idx, 'name', e.target.value)}
                                className="h-7 text-xs flex-1 min-w-[100px]"
                                placeholder="Nom de la couleur"
                                disabled={!entry.included}
                              />

                              {/* Hex input */}
                              <div className="relative">
                                <Input
                                  value={entry.hex}
                                  onChange={e => handleHexInput(idx, e.target.value)}
                                  className={cn(
                                    'h-7 text-xs font-mono w-[90px] pl-1 pr-1',
                                    entry.included && entry.hex && !isValidHex(entry.hex)
                                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                                      : entry.included && isValidHex(entry.hex)
                                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200'
                                        : ''
                                  )}
                                  placeholder="#RRGGBB"
                                  disabled={!entry.included}
                                  maxLength={7}
                                />
                              </div>

                              {/* Validation icon */}
                              {entry.included && (
                                <span className="shrink-0">
                                  {isValidHex(entry.hex) ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : entry.hex ? (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                  ) : (
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── Validation error ──────────────────────────────────────── */}
              {validationError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20 p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{validationError}</p>
                </div>
              )}
            </div>
          )}

          {/* ━━━ Step 3: Confirm Import ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4 space-y-3">
                <p className="text-sm font-medium">
                  Résumé de l&apos;import
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white dark:bg-background/60 border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{knownColors.length}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Couleurs connues</p>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-background/60 border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{includedNewColors.length}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Nouvelles couleurs</p>
                  </div>
                </div>

                {/* Preview of colors to be imported */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Couleurs qui seront ajoutées :</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {includedNewColors.map((c, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px] gap-1.5"
                        style={{
                          backgroundColor: c.hex + '20',
                          borderColor: c.hex,
                          color: isLightColor(c.hex) ? '#1a1a1a' : c.hex,
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-white/50"
                          style={{ backgroundColor: c.hex }}
                        />
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Les couleurs seront ajoutées à la carte des couleurs et seront disponibles pour tous les produits.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer with actions ──────────────────────────────────────────── */}
        <DialogFooter className="flex-shrink-0 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 w-full sm:justify-between">
            {/* Left side: Back button */}
            <div>
              {step > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep((prev) => (prev - 1) as 0 | 1 | 2);
                    setValidationError('');
                  }}
                  disabled={importing}
                >
                  Retour
                </Button>
              )}
            </div>

            {/* Right side: Next / Import */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={importing}
              >
                Annuler
              </Button>

              {step === 0 && (
                <Button
                  onClick={handleScan}
                  disabled={!selectedColumnSlug || scanning || loadingColorMap}
                  className="bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-white"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyse…
                    </>
                  ) : (
                    <>
                      Analyser
                    </>
                  )}
                </Button>
              )}

              {step === 1 && (
                <Button
                  onClick={handleValidateAndProceed}
                  disabled={canProceedToImport === false && includedNewColors.length === 0}
                  className="bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-white"
                >
                  Valider
                </Button>
              )}

              {step === 2 && (
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importation…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirmer l&apos;import
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
