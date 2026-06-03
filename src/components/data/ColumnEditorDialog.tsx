'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { COLUMN_TYPE_OPTIONS } from '@/types';
import type { Column, ColumnType, ColumnConfig, Row } from '@/types';
import { toast } from 'sonner';
import {
  X, Plus, Type, Hash, Banknote, Image as ImageIcon, Images,
  ChevronDown, ListChecks, Link2, Layers, ToggleRight, ExternalLink,
  Pencil, Trash2, Check, GripVertical, Database, Eye, EyeOff,
  Upload, Globe, FileSpreadsheet, AlertTriangle,
} from 'lucide-react';

// Visual column type config
const COLUMN_TYPES: { value: ColumnType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  { value: 'TEXT', label: 'Texte', description: 'Texte simple, une ligne', icon: <Type className="w-4 h-4" />, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'NUMBER', label: 'Nombre', description: 'Valeur numérique', icon: <Hash className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'CURRENCY', label: 'Prix', description: 'Valeur monétaire', icon: <Banknote className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  { value: 'IMAGE', label: 'Image', description: 'URL d\'une image', icon: <ImageIcon className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'IMAGE_ARRAY', label: 'Galerie', description: 'Plusieurs images (JSON ou URLs)', icon: <Images className="w-4 h-4" />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300' },
  { value: 'SELECT', label: 'Sélection', description: 'Choix unique parmi des options', icon: <ChevronDown className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  { value: 'MULTI_SELECT', label: 'Multi-sélection', description: 'Plusieurs choix possibles', icon: <ListChecks className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'RELATION', label: 'Relation', description: 'Lien vers une autre table', icon: <Link2 className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  { value: 'ARRAY', label: 'Groupe', description: 'Regroupement de colonnes', icon: <Layers className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  { value: 'BOOLEAN', label: 'Oui/Non', description: 'Valeur vrai ou faux', icon: <ToggleRight className="w-4 h-4" />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300' },
  { value: 'URL', label: 'Lien', description: 'URL ou lien externe', icon: <ExternalLink className="w-4 h-4" />, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300' },
];

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
  const [activeTab, setActiveTab] = useState('properties');

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

  // Column data editing state
  const [editingCellValues, setEditingCellValues] = useState<Record<string, string>>({});
  const [hasDataChanges, setHasDataChanges] = useState(false);

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
        setGalleryUrlPrefix((editingColumn.config as ColumnConfig)?.galleryUrlPrefix as string || '');
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
      setActiveTab('properties');
      setEditingCellValues({});
      setHasDataChanges(false);
      setShowTypeChangeDialog(false);
    }
  }, [open, editingColumn]);

  // Check if we should warn about type change before saving
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
      // Build enhanced config
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
          // Save cell data changes if any
          if (hasDataChanges && rows) {
            const slug = editingColumn.slug;
            const updatePromises = Object.entries(editingCellValues).map(([rowId, value]) => {
              const row = rows.find(r => r.id === rowId);
              if (!row) return Promise.resolve();
              const data = { ...(row.data as Record<string, unknown>) };
              // Try to parse JSON values (arrays, objects), otherwise keep as string
              try {
                data[slug] = JSON.parse(value);
              } catch {
                data[slug] = value;
              }
              return fetch(`/api/datasources/${dataSourceId}/rows/${rowId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
              });
            });
            await Promise.all(updatePromises);
          }
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

  // Handle cell value change in data tab
  const handleCellDataChange = (rowId: string, value: string) => {
    setEditingCellValues(prev => ({ ...prev, [rowId]: value }));
    setHasDataChanges(true);
  };

  // Get current cell value (edited or original)
  const getCellValue = (row: Row, slug: string) => {
    if (row.id in editingCellValues) return editingCellValues[row.id];
    const val = (row.data as Record<string, unknown>)[slug];
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return JSON.stringify(val);
    return String(val);
  };

  const otherColumns = columns.filter(c => c.id !== editingColumn?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingColumn ? (
              <>
                <Pencil className="w-4 h-4" />
                Modifier la colonne
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Nouvelle colonne
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="properties" className="flex-1 gap-1.5">
              <Type className="w-3.5 h-3.5" /> Propriétés
            </TabsTrigger>
            <TabsTrigger value="data" className="flex-1 gap-1.5" disabled={!editingColumn}>
              <Database className="w-3.5 h-3.5" /> Données
            </TabsTrigger>
          </TabsList>

          {/* ── PROPERTIES TAB ──────────────────────────────────────────────── */}
          <TabsContent value="properties" className="mt-4">
            <ScrollArea className="max-h-[55vh] pr-1">
              <div className="space-y-5">
                {/* Type change compatibility warning */}
                {typeChanged && editingColumn && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Changement de type détecté
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        Vous passez de <strong>{COLUMN_TYPES.find(ct => ct.value === originalType)?.label}</strong> à <strong>{COLUMN_TYPES.find(ct => ct.value === type)?.label}</strong>.
                        Les données existantes pourraient ne pas être compatibles avec le nouveau type. Certaines valeurs peuvent être perdues ou affichées incorrectement.
                      </p>
                    </div>
                  </div>
                )}
                {/* Column Name */}
                <div>
                  <Label className="mb-1.5 text-sm font-medium">Nom de la colonne</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Prix, Description, Images..."
                    className="h-9"
                  />
                  {editingColumn && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Slug : <code className="bg-muted px-1 rounded">{editingColumn.slug}</code>
                    </p>
                  )}
                </div>

                {/* Column Type - Visual Selector */}
                <div>
                  <Label className="mb-2 text-sm font-medium">Type de colonne</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLUMN_TYPES.map(ct => (
                      <button
                        key={ct.value}
                        type="button"
                        className={`
                          flex items-start gap-2.5 p-2.5 rounded-lg border-2 transition-all text-left
                          ${type === ct.value
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/30 hover:bg-muted/50'
                          }
                        `}
                        onClick={() => setType(ct.value)}
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ct.color}`}>
                          {ct.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-tight">{ct.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{ct.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Type-specific configuration */}
                {(type === 'SELECT' || type === 'MULTI_SELECT') && (
                  <div>
                    <Label className="mb-2 text-sm font-medium">Options de sélection</Label>
                    <div className="space-y-2">
                      {(config.options || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                          <Input value={opt} onChange={e => updateOption(i, e.target.value)} className="h-8 text-sm" placeholder={`Option ${i + 1}`} />
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeOption(i)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addOption} className="h-7 text-xs gap-1">
                        <Plus className="w-3 h-3" /> Ajouter option
                      </Button>
                    </div>
                  </div>
                )}

                {type === 'ARRAY' && (
                  <div>
                    <Label className="mb-2 text-sm font-medium">Colonnes à regrouper</Label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Sélectionnez les colonnes dont les valeurs seront regroupées dans ce champ.
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                      {otherColumns.map(col => (
                        <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={(config.sourceColumns || []).includes(col.slug)}
                            onChange={() => toggleSourceColumn(col.slug)}
                            className="rounded"
                          />
                          <span className="truncate">{col.name}</span>
                          <Badge variant="outline" className="text-[8px] ml-auto">{COLUMN_TYPES.find(ct => ct.value === col.type)?.label}</Badge>
                        </label>
                      ))}
                      {otherColumns.length === 0 && (
                        <p className="text-[11px] text-muted-foreground text-center py-2">Aucune autre colonne</p>
                      )}
                    </div>
                  </div>
                )}

                {type === 'CURRENCY' && (
                  <div>
                    <Label className="mb-1.5 text-sm font-medium">Symbole monétaire</Label>
                    <div className="flex gap-2">
                      {['DH', '€', '$', '£'].map(sym => (
                        <button
                          key={sym}
                          type="button"
                          className={`w-12 h-9 rounded-md border-2 text-sm font-medium transition-all
                            ${(config.currencySymbol || 'DH') === sym
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/30'
                            }`}
                          onClick={() => setConfig({ ...config, currencySymbol: sym })}
                        >
                          {sym}
                        </button>
                      ))}
                      <Input
                        value={config.currencySymbol || 'DH'}
                        onChange={e => setConfig({ ...config, currencySymbol: e.target.value })}
                        className="h-9 w-20 text-sm"
                        placeholder="DH"
                      />
                    </div>
                  </div>
                )}

                {type === 'BOOLEAN' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 text-sm">Label Vrai</Label>
                      <Input
                        value={config.trueLabel || 'Oui'}
                        onChange={e => setConfig({ ...config, trueLabel: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 text-sm">Label Faux</Label>
                      <Input
                        value={config.falseLabel || 'Non'}
                        onChange={e => setConfig({ ...config, falseLabel: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* IMAGE / IMAGE_ARRAY source configuration */}
                {(type === 'IMAGE' || type === 'IMAGE_ARRAY') && (
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 text-sm font-medium flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5" />
                        Source des données image
                      </Label>
                      <p className="text-[11px] text-muted-foreground mb-3">
                        Configurez d&apos;où proviennent les images de cette colonne.
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all
                            ${gallerySource === 'manual'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                            }`}
                          onClick={() => setGallerySource('manual')}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium">Saisie manuelle</p>
                            <p className="text-[10px] text-muted-foreground">URL saisies directement</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all
                            ${gallerySource === 'column'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                            }`}
                          onClick={() => setGallerySource('column')}
                        >
                          <Database className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium">Depuis une colonne</p>
                            <p className="text-[10px] text-muted-foreground">Utiliser les données d&apos;une autre colonne</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all
                            ${gallerySource === 'googlesheet'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                            }`}
                          onClick={() => setGallerySource('googlesheet')}
                        >
                          <FileSpreadsheet className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-xs font-medium">Google Sheets</p>
                            <p className="text-[10px] text-muted-foreground">Import depuis Google Drive</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all
                            ${gallerySource === 'url'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                            }`}
                          onClick={() => setGallerySource('url')}
                        >
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium">URL avec préfixe</p>
                            <p className="text-[10px] text-muted-foreground">Préfixe + nom de fichier</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Source: column */}
                    {gallerySource === 'column' && (
                      <div>
                        <Label className="mb-1.5 text-sm">Colonne source</Label>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Les données de la colonne sélectionnée seront utilisées comme source pour cette galerie.
                        </p>
                        <div className="border rounded-lg overflow-hidden">
                          {otherColumns
                            .filter(c => c.type === 'TEXT' || c.type === 'URL' || c.type === 'IMAGE' || c.type === 'IMAGE_ARRAY')
                            .map(col => (
                              <button
                                key={col.id}
                                type="button"
                                className={`w-full flex items-center gap-2 p-2 text-left text-sm transition-colors
                                  ${gallerySourceColumn === col.slug
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted'
                                  }`}
                                onClick={() => setGallerySourceColumn(col.slug)}
                              >
                                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
                                  {COLUMN_TYPES.find(ct => ct.value === col.type)?.icon}
                                </div>
                                <span className="flex-1 truncate">{col.name}</span>
                                <Badge variant="outline" className="text-[8px]">{COLUMN_TYPES.find(ct => ct.value === col.type)?.label}</Badge>
                                {gallerySourceColumn === col.slug && <Check className="w-3 h-3 text-primary" />}
                              </button>
                            ))
                          }
                          {otherColumns.filter(c => c.type === 'TEXT' || c.type === 'URL' || c.type === 'IMAGE' || c.type === 'IMAGE_ARRAY').length === 0 && (
                            <p className="text-[11px] text-muted-foreground text-center py-3">Aucune colonne compatible (Texte, URL, Image, Galerie)</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Source: URL prefix */}
                    {gallerySource === 'url' && (
                      <div>
                        <Label className="mb-1.5 text-sm">Préfixe d&apos;URL</Label>
                        <Input
                          value={galleryUrlPrefix}
                          onChange={e => setGalleryUrlPrefix(e.target.value)}
                          placeholder="https://drive.google.com/uc?id="
                          className="h-8 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Ce préfixe sera ajouté devant chaque valeur de cellule pour former l&apos;URL complète.
                        </p>
                      </div>
                    )}

                    {/* Source: Google Sheets */}
                    {gallerySource === 'googlesheet' && (
                      <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileSpreadsheet className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium">Google Sheets</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Les images seront importées automatiquement depuis votre Google Sheet connecté.
                          Utilisez la fonctionnalité de synchronisation pour mettre à jour les données.
                        </p>
                      </div>
                    )}

                    {/* Separator for IMAGE_ARRAY */}
                    {type === 'IMAGE_ARRAY' && (
                      <div>
                        <Label className="mb-1.5 text-sm">Séparateur d&apos;images</Label>
                        <div className="flex gap-2">
                          {[
                            { value: ',', label: 'Virgule (,)' },
                            { value: ';', label: 'Point-virgule (;)' },
                            { value: '|', label: 'Pipe (|)' },
                            { value: '\n', label: 'Nouvelle ligne' },
                          ].map(sep => (
                            <button
                              key={sep.value}
                              type="button"
                              className={`px-2.5 py-1.5 rounded-md border-2 text-[11px] transition-all
                                ${gallerySeparator === sep.value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:border-primary/30'
                                }`}
                              onClick={() => setGallerySeparator(sep.value)}
                            >
                              {sep.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          Si les URLs d&apos;images sont séparées par ce caractère au lieu d&apos;être en format JSON.
                        </p>
                      </div>
                    )}

                    {/* Image URL prefix for IMAGE type */}
                    {type === 'IMAGE' && (
                      <div>
                        <Label className="mb-1.5 text-sm">Préfixe d&apos;URL (optionnel)</Label>
                        <Input
                          value={config.imagePrefix || ''}
                          onChange={e => setConfig({ ...config, imagePrefix: e.target.value })}
                          placeholder="https://example.com/images/"
                          className="h-8 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Ce préfixe sera ajouté devant chaque valeur de cellule.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {type === 'RELATION' && (
                  <div className="bg-cyan-50 dark:bg-cyan-950/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4 text-cyan-600" />
                      <span className="text-sm font-medium">Relation</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Les relations se configurent dans le gestionnaire de relations accessible depuis le panneau de données.
                    </p>
                  </div>
                )}

                <Separator />

                {/* Visibility & Required */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Switch checked={visible} onCheckedChange={setVisible} />
                    <div className="flex items-center gap-1.5">
                      {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Visible
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Switch checked={required} onCheckedChange={setRequired} />
                    <span>Requis</span>
                  </label>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── DATA TAB ────────────────────────────────────────────────────── */}
          <TabsContent value="data" className="mt-4">
            {editingColumn && rows ? (
              <ScrollArea className="max-h-[55vh]">
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Modifiez directement les données de la colonne <strong>{editingColumn.name}</strong> pour chaque ligne.
                    Les changements seront sauvegardés lors de la mise à jour.
                  </p>

                  {/* Data editing table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 border-b">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-8">#</span>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-1">Valeur</span>
                    </div>
                    {rows.slice(0, 100).map((row, idx) => {
                      const cellValue = getCellValue(row, editingColumn.slug);
                      const isLongValue = cellValue.length > 100;
                      const isImageUrl = cellValue.startsWith('http') && (editingColumn.type === 'IMAGE' || editingColumn.type === 'IMAGE_ARRAY');
                      const isJsonArray = cellValue.startsWith('[');

                      return (
                        <div key={row.id} className="px-3 py-1.5 flex items-start gap-2 border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <span className="text-[10px] text-muted-foreground w-8 pt-1.5 shrink-0">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            {isLongValue || isJsonArray ? (
                              <Textarea
                                value={cellValue}
                                onChange={e => handleCellDataChange(row.id, e.target.value)}
                                className="min-h-[60px] text-xs font-mono"
                                rows={3}
                              />
                            ) : (
                              <Input
                                value={cellValue}
                                onChange={e => handleCellDataChange(row.id, e.target.value)}
                                className="h-7 text-xs"
                              />
                            )}
                            {/* Image preview */}
                            {isImageUrl && cellValue.startsWith('http') && (
                              <div className="mt-1 flex items-center gap-1">
                                <div className="w-8 h-8 rounded bg-muted overflow-hidden">
                                  <img
                                    src={`/api/google/image-proxy?url=${encodeURIComponent(cellValue)}`}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                                <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">
                                  {cellValue.substring(0, 60)}...
                                </span>
                              </div>
                            )}
                            {/* JSON array preview */}
                            {isJsonArray && (
                              <div className="mt-1">
                                <Badge variant="secondary" className="text-[9px]">
                                  {(() => {
                                    try {
                                      const arr = JSON.parse(cellValue);
                                      return Array.isArray(arr) ? `${arr.length} éléments` : 'JSON';
                                    } catch { return 'JSON invalide'; }
                                  })()}
                                </Badge>
                              </div>
                            )}
                          </div>
                          {cellValue && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 mt-1"
                              onClick={() => handleCellDataChange(row.id, '')}
                            >
                              <Trash2 className="w-2.5 h-2.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {rows.length > 100 && (
                      <div className="px-3 py-2 text-[11px] text-muted-foreground text-center bg-muted/20">
                        Affichage des 100 premières lignes sur {rows.length}
                      </div>
                    )}
                  </div>

                  {hasDataChanges && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-300">
                        <Pencil className="w-2.5 h-2.5" /> Modifications en attente
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Cliquez sur &quot;Mettre à jour&quot; pour sauvegarder les changements de données.
                      </span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sauvegardez d&apos;abord la colonne pour modifier ses données</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          {editingColumn && (
            <Button
              variant="destructive"
              size="sm"
              className="mr-auto"
              onClick={async () => {
                if (confirm(`Supprimer la colonne "${editingColumn.name}" ? Cette action est irréversible.`)) {
                  try {
                    await fetch(`/api/datasources/${dataSourceId}/columns/${editingColumn.id}`, { method: 'DELETE' });
                    toast.success('Colonne supprimée');
                    onSaved();
                    onOpenChange(false);
                  } catch {
                    toast.error('Erreur de suppression');
                  }
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
            </Button>
          )}
          <Button onClick={handleSaveClick} disabled={!name.trim() || saving}>
            {saving ? 'Sauvegarde...' : editingColumn ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogFooter>

        {/* Type change confirmation dialog */}
        <AlertDialog open={showTypeChangeDialog} onOpenChange={setShowTypeChangeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Confirmer le changement de type
              </AlertDialogTitle>
              <AlertDialogDescription>
                Vous êtes sur le point de changer le type de la colonne de{' '}
                <strong>{COLUMN_TYPES.find(ct => ct.value === originalType)?.label}</strong> vers{' '}
                <strong>{COLUMN_TYPES.find(ct => ct.value === type)?.label}</strong>.
                Les données existantes pourraient ne pas être compatibles avec le nouveau type.
                Certaines valeurs peuvent être perdues ou affichées incorrectement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => {
                  setShowTypeChangeDialog(false);
                  handleSave();
                }}
              >
                Confirmer le changement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
