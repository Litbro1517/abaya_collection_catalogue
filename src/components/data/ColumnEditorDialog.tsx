'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Column, ColumnType, ColumnConfig, Row, DataSource } from '@/types';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  X, Plus, Type, Hash, Banknote, Image as ImageIcon, Images,
  ChevronDown, ChevronRight, ListChecks, Link2, Layers, ToggleRight, ExternalLink,
  Pencil, Trash2, Check, Eye, EyeOff,
  AlertTriangle, Activity, ArrowRight, Palette,
} from 'lucide-react';

// ── Column type visual config ──────────────────────────────────────────────
const COLUMN_TYPES: { value: ColumnType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'TEXT', label: 'Texte', description: 'Texte simple, une ligne', icon: <Type className="w-4 h-4" /> },
  { value: 'NUMBER', label: 'Nombre', description: 'Valeur numérique', icon: <Hash className="w-4 h-4" /> },
  { value: 'CURRENCY', label: 'Prix', description: 'Valeur monétaire', icon: <Banknote className="w-4 h-4" /> },
  { value: 'IMAGE', label: 'Image', description: 'URL d\'une image', icon: <ImageIcon className="w-4 h-4" /> },
  { value: 'IMAGE_ARRAY', label: 'Galerie', description: 'Plusieurs images', icon: <Images className="w-4 h-4" /> },
  { value: 'SELECT', label: 'Sélection', description: 'Choix unique', icon: <ChevronDown className="w-4 h-4" /> },
  { value: 'MULTI_SELECT', label: 'Multi-sélection', description: 'Plusieurs choix', icon: <ListChecks className="w-4 h-4" /> },
  { value: 'BOOLEAN', label: 'Oui/Non', description: 'Valeur vrai ou faux', icon: <ToggleRight className="w-4 h-4" /> },
  { value: 'RELATION', label: 'Relation', description: 'Bientôt disponible (V2)', icon: <Link2 className="w-4 h-4" />, frozen: true as const },
  { value: 'ARRAY', label: 'Groupe', description: 'Regroupement de colonnes', icon: <Layers className="w-4 h-4" /> },
  { value: 'URL', label: 'Lien', description: 'URL ou lien externe', icon: <ExternalLink className="w-4 h-4" /> },
  { value: 'STATUS', label: 'Statut', description: 'Statut avec verrouillage', icon: <Activity className="w-4 h-4" /> },
  { value: 'COLOR', label: 'Couleur', description: 'Sélection de couleurs', icon: <Palette className="w-4 h-4" /> },
];

// Category grouping — Glide-style: Basic / Computed / Structure
const TYPE_CATEGORIES: { label: string; icon: React.ReactNode; types: ColumnType[] }[] = [
  { label: 'Base', icon: <Type className="w-3.5 h-3.5" />, types: ['TEXT', 'NUMBER', 'CURRENCY', 'URL'] },
  { label: 'Média', icon: <Images className="w-3.5 h-3.5" />, types: ['IMAGE', 'IMAGE_ARRAY'] },
  { label: 'Sélection', icon: <ListChecks className="w-3.5 h-3.5" />, types: ['SELECT', 'MULTI_SELECT', 'BOOLEAN', 'COLOR'] },
  { label: 'Structure', icon: <Layers className="w-3.5 h-3.5" />, types: ['RELATION', 'ARRAY', 'STATUS'] },
];

// Types that show a CONFIGURATION section
const CONFIG_TYPES: ColumnType[] = ['SELECT', 'MULTI_SELECT', 'IMAGE_ARRAY', 'ARRAY', 'CURRENCY', 'BOOLEAN', 'RELATION', 'IMAGE'];

type DataSourceType = 'manual' | 'googlesheet' | 'url' | 'column';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dataSourceId: string;
  columns: Column[];
  rows?: Row[];
  onSaved: () => void;
  editingColumn?: Column | null;
}

export function ColumnEditorDialog({ open, onOpenChange, dataSourceId, columns, rows, onSaved, editingColumn }: Props) {
  const [name, setName] = useState(editingColumn?.name || '');
  const [type, setType] = useState<ColumnType>(editingColumn?.type || 'TEXT');
  const [visible, setVisible] = useState(editingColumn?.visible ?? true);
  const [required, setRequired] = useState(editingColumn?.required ?? false);
  const [config, setConfig] = useState<ColumnConfig>(editingColumn?.config || {});
  const [saving, setSaving] = useState(false);

  // Access all data sources from global store for RELATION target table selector
  const dataSources = useAppStore(state => state.dataSources);

  // Track original type for compatibility warning
  const [originalType, setOriginalType] = useState<ColumnType | null>(null);
  const [showTypeChangeDialog, setShowTypeChangeDialog] = useState(false);
  const typeChanged = originalType !== null && type !== originalType;

  // Gallery data source state
  const [gallerySource, setGallerySource] = useState<DataSourceType>(
    (editingColumn?.config as ColumnConfig)?.gallerySource as DataSourceType || 'manual'
  );
  const [gallerySourceColumn, setGallerySourceColumn] = useState(
    (editingColumn?.config as ColumnConfig)?.gallerySourceColumn as string || ''
  );
  const [gallerySeparator, setGallerySeparator] = useState(
    (editingColumn?.config as ColumnConfig)?.gallerySeparator as string || ','
  );
  const [galleryUrlPrefix, setGalleryUrlPrefix] = useState(
    (editingColumn?.config as ColumnConfig)?.galleryUrlPrefix as string || ''
  );

  // Type popover state
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingColumn) {
        setName(editingColumn.name);
        setType(editingColumn.type);
        setOriginalType(editingColumn.type);
        setVisible(editingColumn.visible);
        setRequired(editingColumn.required);
        setConfig(editingColumn.config);
        setGallerySource((editingColumn.config as ColumnConfig)?.gallerySource as DataSourceType || 'manual');
        setGallerySourceColumn((editingColumn.config as ColumnConfig)?.gallerySourceColumn as string || '');
        setGallerySeparator((editingColumn.config as ColumnConfig)?.gallerySeparator as string || ',');
        setGalleryUrlPrefix((editingColumn?.config as ColumnConfig)?.galleryUrlPrefix as string || '');
      } else {
        setName('');
        setType('TEXT');
        setOriginalType(null);
        setVisible(true);
        setRequired(false);
        setConfig({});
        setGallerySource('manual');
        setGallerySourceColumn('');
        setGallerySeparator(',');
        setGalleryUrlPrefix('');
      }
      setShowTypeChangeDialog(false);
      setTypePopoverOpen(false);
      setHoveredCategory(null);
    }
  }, [open, editingColumn]);

  // ── Save logic ────────────────────────────────────────────────────────────
  const handleSaveClick = () => {
    if (!name.trim()) return;
    if (typeChanged) {
      setShowTypeChangeDialog(true);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const enhancedConfig = { ...config };
      if (type === 'IMAGE_ARRAY') {
        enhancedConfig.gallerySource = gallerySource;
        enhancedConfig.gallerySourceColumn = gallerySourceColumn;
        enhancedConfig.gallerySeparator = gallerySeparator;
        enhancedConfig.galleryUrlPrefix = galleryUrlPrefix;
      }

      if (editingColumn) {
        const res = await fetch(`/api/datasources/${dataSourceId}/columns/${editingColumn.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, visible, required, config: enhancedConfig }),
        });
        if (res.ok) {
          toast.success('Colonne mise à jour');
          onSaved();
          onOpenChange(false);
        } else {
          const json = await res.json();
          toast.error(json.error || 'Erreur de mise à jour');
        }
      } else {
        const res = await fetch(`/api/datasources/${dataSourceId}/columns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, visible, required, config: enhancedConfig }),
        });
        if (res.ok) {
          toast.success('Colonne créée');
          onSaved();
          onOpenChange(false);
        } else {
          const json = await res.json();
          toast.error(json.error || 'Erreur de création');
        }
      }
    } catch {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Config helpers ────────────────────────────────────────────────────────
  const addOption = () => {
    const options = [...(config.options || []), ''];
    setConfig({ ...config, options });
  };

  const removeOption = (index: number) => {
    const options = (config.options || []).filter((_, i) => i !== index);
    setConfig({ ...config, options });
  };

  const updateOption = (index: number, value: string) => {
    const options = [...(config.options || [])];
    options[index] = value;
    setConfig({ ...config, options });
  };

  const toggleSourceColumn = (slug: string) => {
    const sourceColumns = [...(config.sourceColumns || [])];
    const idx = sourceColumns.indexOf(slug);
    if (idx >= 0) sourceColumns.splice(idx, 1);
    else sourceColumns.push(slug);
    setConfig({ ...config, sourceColumns });
  };

  const otherColumns = columns.filter(c => c.id !== editingColumn?.id);
  const showConfig = CONFIG_TYPES.includes(type);
  const currentTypeConfig = COLUMN_TYPES.find(ct => ct.value === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        {/* ── Header: gold + icon, clean ── */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center">
              {editingColumn
                ? <Pencil className="w-3.5 h-3.5 text-gold" />
                : <Plus className="w-3.5 h-3.5 text-gold" />
              }
            </div>
            {editingColumn ? 'Modifier la colonne' : 'Nouvelle colonne'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Body: single flow, no tabs ── */}
        <div className="px-5 pt-4 pb-2 space-y-4">
          {/* Type change warning */}
          {typeChanged && editingColumn && (
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Passage de <strong>{COLUMN_TYPES.find(ct => ct.value === originalType)?.label}</strong> à <strong>{currentTypeConfig?.label}</strong>. Les données existantes peuvent être converties ou perdues.
              </p>
            </div>
          )}

          {/* ── Field 1: Name ── */}
          <div>
            <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nom
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Prix, Couleur, Référence…"
              className="h-9 text-sm border-border/60 focus:border-gold focus:ring-gold/20"
              autoFocus
            />
            {editingColumn && (
              <p className="text-[9px] text-muted-foreground/50 mt-1 ml-0.5">
                slug: <code className="bg-muted/50 px-1 rounded text-[9px]">{editingColumn.slug}</code>
              </p>
            )}
          </div>

          {/* ── Field 2: Type — Glide-style Popover ── */}
          <div>
            <Label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </Label>
            <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between h-9 px-3 rounded-lg border border-border/60 bg-background text-sm hover:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gold">{currentTypeConfig?.icon}</span>
                    <span className="text-foreground">{currentTypeConfig?.label}</span>
                    <span className="text-muted-foreground/50 text-[10px]">{currentTypeConfig?.description}</span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/50 transition-transform", typePopoverOpen && "rotate-180")} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[340px] p-0 shadow-lg border-border/40 rounded-lg overflow-hidden"
                sideOffset={4}
              >
                {/* Category list on the left, types fly out on the right */}
                <div className="flex min-h-[260px]">
                  {/* Left: Categories */}
                  <div className="w-[120px] border-r border-border/30 bg-muted/20 py-1">
                    {TYPE_CATEGORIES.map(cat => {
                      const isHovered = hoveredCategory === cat.label;
                      const hasSelectedType = cat.types.includes(type);
                      return (
                        <button
                          key={cat.label}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left",
                            isHovered
                              ? "bg-gold/10 text-gold font-medium"
                              : hasSelectedType
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted/50"
                          )}
                          onMouseEnter={() => setHoveredCategory(cat.label)}
                          onClick={() => setHoveredCategory(cat.label)}
                        >
                          <span className={cn(isHovered ? "text-gold" : "text-muted-foreground/60")}>{cat.icon}</span>
                          {cat.label}
                          <ChevronRight className={cn("w-3 h-3 ml-auto transition-opacity", isHovered ? "opacity-100" : "opacity-30")} />
                        </button>
                      );
                    })}
                  </div>
                  {/* Right: Type items for hovered category */}
                  <div className="flex-1 py-1">
                    {(hoveredCategory
                      ? TYPE_CATEGORIES.find(c => c.label === hoveredCategory)?.types || []
                      : TYPE_CATEGORIES[0].types
                    ).map(typeVal => {
                      const ct = COLUMN_TYPES.find(c => c.value === typeVal);
                      if (!ct) return null;
                      const isSelected = type === ct.value;
                      const isFrozen = 'frozen' in ct && ct.frozen;
                      return (
                        <button
                          key={ct.value}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                            isFrozen
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                                ? "bg-primary text-white"
                                : "hover:bg-muted/40 text-foreground"
                          )}
                          onClick={() => {
                            if (isFrozen) return; // V1 FREEZE: RELATION type disabled
                            setType(ct.value);
                            setTypePopoverOpen(false);
                          }}
                        >
                          <span className={isSelected && !isFrozen ? "text-gold" : "text-gold/60"}>{ct.icon}</span>
                          <div className="flex-1 text-left">
                            <span className="text-xs font-medium">{ct.label}</span>
                            <span className={cn("text-[10px] ml-1.5", isSelected && !isFrozen ? "text-white/50" : "text-muted-foreground/50")}>
                              {ct.description}
                            </span>
                          </div>
                          {isFrozen && <Badge variant="secondary" className="text-[8px] px-1 py-0">V2</Badge>}
                          {isSelected && !isFrozen && <Check className="w-3.5 h-3.5 text-gold" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* ── DYNAMIC CONFIGURATION ZONE ── */}
          {showConfig && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Divider + label */}
              <div className="flex items-center gap-3 pt-1 pb-2">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  Configuration
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              <div className="space-y-3">
                {/* SELECT / MULTI_SELECT → Options */}
                {(type === 'SELECT' || type === 'MULTI_SELECT') && (
                  <div className="space-y-2">
                    {(config.options || []).map((opt, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          value={opt}
                          onChange={e => updateOption(i, e.target.value)}
                          className="h-8 text-xs border-border/40 focus:border-gold focus:ring-gold/20"
                          placeholder={`Option ${i + 1}`}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground/40 hover:text-destructive" onClick={() => removeOption(i)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addOption} className="h-7 text-[10px] gap-1 border-dashed border-gold/30 text-gold hover:bg-gold/5 hover:text-gold">
                      <Plus className="w-3 h-3" /> Ajouter
                    </Button>
                  </div>
                )}

                {/* IMAGE_ARRAY → Gallery source checkboxes */}
                {type === 'IMAGE_ARRAY' && (
                  <div className="space-y-2.5">
                    <p className="text-[10px] text-muted-foreground">
                      Fusionner plusieurs colonnes d'images en une seule galerie.
                    </p>
                    <div className="space-y-1 border rounded-lg p-1.5 max-h-32 overflow-y-auto">
                      {otherColumns
                        .filter(c => c.type === 'IMAGE' || c.type === 'IMAGE_ARRAY' || c.type === 'TEXT' || c.type === 'URL')
                        .map(col => (
                          <label key={col.id} className="flex items-center gap-2 text-xs cursor-pointer py-1 px-1.5 rounded hover:bg-muted/40 transition-colors">
                            <Checkbox
                              checked={(config.sourceColumns || []).includes(col.slug)}
                              onCheckedChange={() => toggleSourceColumn(col.slug)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-gold/60">{COLUMN_TYPES.find(ct => ct.value === col.type)?.icon}</span>
                            <span className="truncate flex-1">{col.name}</span>
                          </label>
                        ))
                      }
                      {otherColumns.filter(c => c.type === 'IMAGE' || c.type === 'IMAGE_ARRAY' || c.type === 'TEXT' || c.type === 'URL').length === 0 && (
                        <p className="text-[10px] text-muted-foreground/40 text-center py-2">Aucune colonne compatible</p>
                      )}
                    </div>
                    {/* Separator config */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">Séparateur</span>
                      <div className="flex gap-1">
                        {[{ v: ',', l: ',' }, { v: ';', l: ';' }, { v: '|', l: '|' }].map(sep => (
                          <button
                            key={sep.v}
                            type="button"
                            className={cn(
                              "w-7 h-6 rounded text-[10px] font-mono transition-all border",
                              gallerySeparator === sep.v
                                ? "border-gold bg-gold/10 text-gold"
                                : "border-border/40 text-muted-foreground/50 hover:border-gold/30"
                            )}
                            onClick={() => setGallerySeparator(sep.v)}
                          >
                            {sep.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* IMAGE → URL prefix */}
                {type === 'IMAGE' && (
                  <div>
                    <Label className="mb-1 text-[10px] text-muted-foreground/60">Préfixe d'URL (optionnel)</Label>
                    <Input
                      value={config.imagePrefix || ''}
                      onChange={e => setConfig({ ...config, imagePrefix: e.target.value })}
                      placeholder="https://example.com/images/"
                      className="h-8 text-xs border-border/40 focus:border-gold"
                    />
                  </div>
                )}

                {/* ARRAY → Group columns */}
                {type === 'ARRAY' && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">Colonnes à regrouper dans ce champ.</p>
                    <div className="space-y-0.5 border rounded-lg p-1.5 max-h-28 overflow-y-auto">
                      {otherColumns.map(col => (
                        <label key={col.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5 px-1.5 rounded hover:bg-muted/40">
                          <Checkbox
                            checked={(config.sourceColumns || []).includes(col.slug)}
                            onCheckedChange={() => toggleSourceColumn(col.slug)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="truncate">{col.name}</span>
                          <Badge variant="outline" className="text-[7px] ml-auto h-3.5 px-1">{COLUMN_TYPES.find(ct => ct.value === col.type)?.label}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* CURRENCY → Symbol */}
                {type === 'CURRENCY' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/60">Devise</span>
                    <div className="flex gap-1">
                      {['DH', '€', '$', '£'].map(sym => (
                        <button
                          key={sym}
                          type="button"
                          className={cn(
                            "h-7 px-2.5 rounded text-xs font-medium transition-all border",
                            (config.currencySymbol || 'DH') === sym
                              ? "border-gold bg-gold/10 text-gold"
                              : "border-border/40 text-muted-foreground/60 hover:border-gold/30"
                          )}
                          onClick={() => setConfig({ ...config, currencySymbol: sym })}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOOLEAN → Labels */}
                {type === 'BOOLEAN' && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="mb-0.5 text-[10px] text-muted-foreground/60">Vrai</Label>
                      <Input value={config.trueLabel || 'Oui'} onChange={e => setConfig({ ...config, trueLabel: e.target.value })} className="h-7 text-xs border-border/40 focus:border-gold" />
                    </div>
                    <div className="flex-1">
                      <Label className="mb-0.5 text-[10px] text-muted-foreground/60">Faux</Label>
                      <Input value={config.falseLabel || 'Non'} onChange={e => setConfig({ ...config, falseLabel: e.target.value })} className="h-7 text-xs border-border/40 focus:border-gold" />
                    </div>
                  </div>
                )}

                {/* RELATION → V1 FROZEN — show notice instead of config */}
                {type === 'RELATION' && (
                  <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gold">🔒 Fonctionnalité gelée (V1)</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Les colonnes de type Relation sont désactivées pour la version actuelle.
                      Elles seront disponibles en V2 avec une meilleure résolution des pivots.
                    </p>
                  </div>
                )}
                {/* RELATION config fields — HIDDEN for V1 freeze (uncomment for V2) */}
                {/*type === 'RELATION' && (
                  <RelationConfigFields
                    config={config}
                    onConfigChange={setConfig}
                    columns={columns}
                    dataSourceId={dataSourceId}
                    dataSources={dataSources}
                  />
                )*/}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: clean, minimal ── */}
        <div className="px-5 py-3 border-t border-border/30 flex items-center justify-between">
          {/* Left: Visibility toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <Switch checked={visible} onCheckedChange={setVisible} className="scale-75" />
              {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </label>
            {editingColumn && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-destructive/60 hover:text-destructive hover:bg-destructive/5 px-1.5"
                onClick={() => {
                  fetch(`/api/datasources/${dataSourceId}/columns/${editingColumn.id}`, { method: 'DELETE' })
                    .then(res => { if (res.ok) { onSaved(); onOpenChange(false); toast.success('Colonne supprimée'); } })
                    .catch(() => toast.error('Erreur'));
                }}
              >
                <Trash2 className="w-3 h-3" /> Supprimer
              </Button>
            )}
          </div>
          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-gold hover:bg-gold/90 text-white"
              disabled={!name.trim() || saving}
              onClick={handleSaveClick}
            >
              {saving ? (
                <span className="animate-pulse">…</span>
              ) : editingColumn ? (
                <>Mettre à jour</>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> Créer
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Type change confirmation dialog ── */}
        <AlertDialog open={showTypeChangeDialog} onOpenChange={setShowTypeChangeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Changer le type ?</AlertDialogTitle>
              <AlertDialogDescription>
                Vous passez de <strong>{COLUMN_TYPES.find(ct => ct.value === originalType)?.label}</strong> à <strong>{currentTypeConfig?.label}</strong>.
                Cette action peut convertir ou perdre des données existantes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className="bg-gold hover:bg-gold/90 text-white" onClick={handleSave}>
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// ━━━ RelationConfigFields — 4-field RELATION configuration ━━━━━━━━━━━━━━━━
// Separated into its own component so it can fetch target-table columns
// without re-rendering the entire dialog on each keystroke.
function RelationConfigFields({
  config,
  onConfigChange,
  columns,
  dataSourceId,
  dataSources,
}: {
  config: ColumnConfig;
  onConfigChange: (c: ColumnConfig) => void;
  columns: Column[];
  dataSourceId: string;
  dataSources: DataSource[];
}) {
  // ── Fetch target table columns when targetTableId changes ──
  const [targetColumns, setTargetColumns] = useState<Column[]>([]);
  const [loadingTargetCols, setLoadingTargetCols] = useState(false);

  const selectedTargetDsId = (config.targetTableId as string) || (config.targetTable as string) || '';

  const fetchTargetColumns = useCallback(async (dsId: string) => {
    if (!dsId || dsId === 'self') {
      // Self-referencing: use current table's columns
      setTargetColumns(columns);
      return;
    }
    setLoadingTargetCols(true);
    try {
      // 1. Try localStorage cache first (zero-latency)
      const colsCacheKey = `abaya_cache_admin_cols_${dsId}`;
      const cached = localStorage.getItem(colsCacheKey);
      if (cached) {
        try {
          setTargetColumns(JSON.parse(cached) as Column[]);
        } catch { /* malformed */ }
      }
      // 2. Always fetch fresh from API to guarantee accuracy
      const res = await fetch(`/api/datasources/${dsId}?mode=meta`);
      if (res.ok) {
        const json = await res.json();
        const freshCols: Column[] = json?.data?.columns || [];
        setTargetColumns(freshCols);
        // Update cache for future use
        try {
          localStorage.setItem(colsCacheKey, JSON.stringify(freshCols));
          localStorage.setItem(`${colsCacheKey}_ts`, String(Date.now()));
        } catch { /* quota */ }
      }
    } catch {
      // API failed — if cache was set, we still have it
    } finally {
      setLoadingTargetCols(false);
    }
  }, [columns]);

  useEffect(() => {
    if (selectedTargetDsId) {
      fetchTargetColumns(selectedTargetDsId);
    } else {
      setTargetColumns([]);
    }
  }, [selectedTargetDsId, fetchTargetColumns]);

  // Reset targetColumnId when target table changes
  const handleTargetTableChange = (v: string) => {
    onConfigChange({
      ...config,
      targetTableId: v,
      targetTable: v,
      targetColumnId: '',  // reset — must re-select for new table
    });
  };

  const isSelfRef = !selectedTargetDsId || selectedTargetDsId === 'self';

  // Auto-select first TEXT column as default pivot when target table changes
  const autoSelectDefaultPivot = (freshCols: Column[]) => {
    if ((config.targetColumnId as string)) return; // already selected
    const firstTextCol = freshCols.find(c => c.type === 'TEXT' && c.visible && !c.slug.startsWith('__'));
    if (firstTextCol) {
      onConfigChange({ ...config, targetColumnId: firstTextCol.slug });
    }
  };

  // When target columns are fetched, auto-select default pivot
  useEffect(() => {
    if (targetColumns.length > 0 && !(config.targetColumnId as string)) {
      autoSelectDefaultPivot(targetColumns);
    }
  }, [targetColumns]);

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
        <Link2 className="w-3 h-3 text-gold/50" />
        Configurez la relation entre les tables
      </p>
      {/* Source column (pivot local) */}
      <div>
        <Label className="mb-0.5 text-[10px] text-muted-foreground/60">Colonne source (pivot local)</Label>
        <Select value={config.sourceColumn as string || ''} onValueChange={v => onConfigChange({ ...config, sourceColumn: v })}>
          <SelectTrigger className="h-7 text-xs border-border/40">
            <SelectValue placeholder="Choisir le pivot local…" />
          </SelectTrigger>
          <SelectContent>
            {columns.map(col => (
              <SelectItem key={col.id} value={col.slug}>
                <span className="flex items-center gap-1.5">
                  <span className="text-gold/60">{COLUMN_TYPES.find(ct => ct.value === col.type)?.icon}</span>
                  {col.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Target table */}
      <div>
        <Label className="mb-0.5 text-[10px] text-muted-foreground/60">Table cible</Label>
        <Select value={selectedTargetDsId} onValueChange={handleTargetTableChange}>
          <SelectTrigger className="h-7 text-xs border-border/40">
            <SelectValue placeholder="Sélectionner la table cible…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self">Table actuelle (auto-référence)</SelectItem>
            {dataSources
              .filter(ds => ds.id !== dataSourceId)
              .map(ds => (
                <SelectItem key={ds.id} value={ds.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ds.color || 'var(--gold)' }} />
                    {ds.name}
                  </span>
                </SelectItem>
              ))
            }
            {dataSources.filter(ds => ds.id !== dataSourceId).length === 0 && (
              <SelectItem value="_none" disabled>Aucune autre table disponible</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      {/* Colonne Pivot Cible — the key dropdown replacing useless 'Nom de la relation' */}
      {selectedTargetDsId && (
        <div>
          <Label className="mb-0.5 text-[10px] text-muted-foreground/60">
            Colonne Pivot Cible
            {loadingTargetCols && <span className="ml-1 animate-pulse">⏳</span>}
          </Label>
          <Select
            value={(config.targetColumnId as string) || ''}
            onValueChange={v => onConfigChange({ ...config, targetColumnId: v })}
          >
            <SelectTrigger className="h-7 text-xs border-border/40">
              <SelectValue placeholder={isSelfRef ? "Choisir le pivot dans cette table…" : "Choisir le pivot dans la table cible…"} />
            </SelectTrigger>
            <SelectContent>
              {targetColumns
                .filter(c => !c.slug.startsWith('__'))
                .map(col => (
                  <SelectItem key={col.id} value={col.slug}>
                    <span className="flex items-center gap-1.5">
                      <span className="text-gold/60">{COLUMN_TYPES.find(ct => ct.value === col.type)?.icon}</span>
                      {col.name}
                      <span className="text-muted-foreground/40 text-[9px]">({col.slug})</span>
                    </span>
                  </SelectItem>
                ))
              }
              {targetColumns.filter(c => !c.slug.startsWith('__')).length === 0 && !loadingTargetCols && (
                <SelectItem value="_none" disabled>Aucune colonne disponible</SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground/40 mt-0.5">
            La valeur de cette colonne (ex: « Noir », « 1 ») sera utilisée comme clé de correspondance entre la cellule source et la ligne cible.
          </p>
        </div>
      )}
    </div>
  );
}
