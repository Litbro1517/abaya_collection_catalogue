'use client';

import { useState, useEffect } from 'react';
import type { Section, SectionConfig, DataSource, Column, Row } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Database, ImageIcon, Layers, LayoutGrid, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  section: Section;
  dataSources: DataSource[];
  columns: Column[];
  rows: Row[];
  onUpdate: (config: SectionConfig) => void;
}

export function SectionConfigurator({ section, dataSources, columns, rows, onUpdate }: Props) {
  const config = section.config as SectionConfig;
  const [localConfig, setLocalConfig] = useState<SectionConfig>(config);
  const [saving, setSaving] = useState(false);
  const [openLevels, setOpenLevels] = useState({ level1: true, level2: true, level3: false });

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // When data source changes, load its columns
  const [dsColumns, setDsColumns] = useState<Column[]>([]);
  useEffect(() => {
    if (config.dataSourceId) {
      // Use already loaded columns if they match
      const ds = dataSources.find(d => d.id === config.dataSourceId);
      if (ds && columns.length > 0 && columns[0]?.dataSourceId === config.dataSourceId) {
        setDsColumns(columns);
      } else {
        // Fetch columns
        fetch(`/api/datasources/${config.dataSourceId}`)
          .then(r => r.json())
          .then(json => {
            if (json.data?.columns) setDsColumns(json.data.columns);
          })
          .catch(() => {});
      }
    }
  }, [config.dataSourceId, dataSources, columns]);

  const imageColumns = dsColumns.filter(c => c.type === 'IMAGE');
  const imageArrayColumns = dsColumns.filter(c => c.type === 'IMAGE_ARRAY' || c.type === 'ARRAY');
  const currencyColumns = dsColumns.filter(c => c.type === 'CURRENCY' || c.type === 'NUMBER');
  const textColumns = dsColumns.filter(c => c.type === 'TEXT' || c.type === 'SELECT');

  const handleChange = (key: string, value: unknown) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(localConfig);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-3 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">{section.title || 'Collection'}</h2>
          <p className="text-xs text-muted-foreground">Configurez l&apos;affichage de cette section</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Sauvegarder
        </Button>
      </div>

      {/* Data Source Selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold">Source de données</h3>
        </div>
        <Select
          value={localConfig.dataSourceId || ''}
          onValueChange={v => handleChange('dataSourceId', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir une table de données" />
          </SelectTrigger>
          <SelectContent>
            {dataSources.map(ds => (
              <SelectItem key={ds.id} value={ds.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ds.color }} />
                  {ds.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Level 1: Collection */}
      <Collapsible open={openLevels.level1} onOpenChange={v => setOpenLevels({ ...openLevels, level1: v })}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
            <LayoutGrid className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold flex-1 text-left">Niveau 1 — Collection</h3>
            <Badge variant="outline" className="text-[10px]">Cartes</Badge>
            {openLevels.level1 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 border-border rounded-b-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Colonne Titre</Label>
                <Select value={localConfig.titleColumn || ''} onValueChange={v => handleChange('titleColumn', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {dsColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Colonne Description</Label>
                <Select value={localConfig.descriptionColumn || ''} onValueChange={v => handleChange('descriptionColumn', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {textColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Colonne Prix</Label>
                <Select value={localConfig.priceColumn || ''} onValueChange={v => handleChange('priceColumn', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {currencyColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Colonnes par ligne</Label>
                <Select value={String(localConfig.columnsPerRow || 3)} onValueChange={v => handleChange('columnsPerRow', parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 colonnes</SelectItem>
                    <SelectItem value="3">3 colonnes</SelectItem>
                    <SelectItem value="4">4 colonnes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={localConfig.showTitle !== false} onCheckedChange={v => handleChange('showTitle', v)} />
                Afficher titre
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={localConfig.showDescription !== false} onCheckedChange={v => handleChange('showDescription', v)} />
                Afficher description
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={localConfig.showPrice !== false} onCheckedChange={v => handleChange('showPrice', v)} />
                Afficher prix
              </label>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Style de carte</Label>
              <div className="flex gap-2">
                {(['elevated', 'flat', 'bordered'] as const).map(style => (
                  <button
                    key={style}
                    className={cn(
                      'px-3 py-1.5 rounded text-xs border transition-all',
                      localConfig.cardStyle === style ? 'border-gold bg-gold/5' : 'border-border hover:bg-muted'
                    )}
                    onClick={() => handleChange('cardStyle', style)}
                  >
                    {style === 'elevated' ? 'Élevé' : style === 'flat' ? 'Plat' : 'Bordé'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Level 2: Cover */}
      <Collapsible open={openLevels.level2} onOpenChange={v => setOpenLevels({ ...openLevels, level2: v })}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
            <ImageIcon className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold flex-1 text-left">Niveau 2 — Image de couverture</h3>
            <Badge variant="outline" className="text-[10px]">Couverture</Badge>
            {openLevels.level2 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 border-border rounded-b-lg p-4 space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Colonne image de couverture</Label>
              <Select value={localConfig.coverColumn || ''} onValueChange={v => handleChange('coverColumn', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choisir la colonne couverture..." /></SelectTrigger>
                <SelectContent>
                  {imageColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  {imageArrayColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name} (galerie)</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Cette colonne fournit l&apos;image principale affichée sur chaque carte produit
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Level 3: Detail/Carousel */}
      <Collapsible open={openLevels.level3} onOpenChange={v => setOpenLevels({ ...openLevels, level3: v })}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
            <Layers className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold flex-1 text-left">Niveau 3 — Détail & Carrousel</h3>
            <Badge variant="outline" className="text-[10px]">Détail</Badge>
            {openLevels.level3 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 border-border rounded-b-lg p-4 space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Colonne carrousel (galerie d&apos;images)</Label>
              <Select value={localConfig.carouselColumn || ''} onValueChange={v => handleChange('carouselColumn', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {imageArrayColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  {imageColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Colonne contenant plusieurs images pour le carrousel de détail
              </p>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Colonne variantes (couleurs/tailles)</Label>
              <Select value={localConfig.variantColumn || ''} onValueChange={v => handleChange('variantColumn', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {textColumns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Colonnes à afficher en détail</Label>
              <div className="flex flex-wrap gap-1.5">
                {dsColumns.filter(c => c.visible).map(c => {
                  const selected = (localConfig.detailColumns || []).includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      className={cn(
                        'px-2 py-1 rounded text-[11px] border transition-all',
                        selected ? 'border-gold bg-gold/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                      onClick={() => {
                        const current = localConfig.detailColumns || [];
                        const next = selected
                          ? current.filter(s => s !== c.slug)
                          : [...current, c.slug];
                        handleChange('detailColumns', next);
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
