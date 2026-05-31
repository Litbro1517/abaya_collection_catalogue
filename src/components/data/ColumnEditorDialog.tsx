'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLUMN_TYPE_OPTIONS } from '@/types';
import type { Column, ColumnType, ColumnConfig } from '@/types';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dataSourceId: string;
  columns: Column[];
  onSaved: () => void;
  editingColumn?: Column | null;
}

export function ColumnEditorDialog({ open, onOpenChange, dataSourceId, columns, onSaved, editingColumn }: Props) {
  const [name, setName] = useState(editingColumn?.name || '');
  const [type, setType] = useState<ColumnType>(editingColumn?.type || 'TEXT');
  const [visible, setVisible] = useState(editingColumn?.visible ?? true);
  const [required, setRequired] = useState(editingColumn?.required ?? false);
  const [config, setConfig] = useState<ColumnConfig>(editingColumn?.config || {});
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      if (editingColumn) {
        setName(editingColumn.name);
        setType(editingColumn.type);
        setVisible(editingColumn.visible);
        setRequired(editingColumn.required);
        setConfig(editingColumn.config);
      } else {
        setName('');
        setType('TEXT');
        setVisible(true);
        setRequired(false);
        setConfig({});
      }
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingColumn) {
        const res = await fetch(`/api/datasources/${dataSourceId}/columns/${editingColumn.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, visible, required, config }),
        });
        if (res.ok) {
          toast.success('Colonne mise à jour');
          onSaved();
          onOpenChange(false);
        }
      } else {
        const res = await fetch(`/api/datasources/${dataSourceId}/columns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, visible, required, config }),
        });
        if (res.ok) {
          toast.success('Colonne créée');
          onSaved();
          onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingColumn ? 'Modifier la colonne' : 'Nouvelle colonne'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="mb-1">Nom de la colonne</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Prix, Description..." />
          </div>

          <div>
            <Label className="mb-1">Type</Label>
            <Select value={type} onValueChange={v => setType(v as ColumnType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type-specific config */}
          {(type === 'SELECT' || type === 'MULTI_SELECT') && (
            <div>
              <Label className="mb-1">Options</Label>
              <div className="space-y-2">
                {(config.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={opt} onChange={e => updateOption(i, e.target.value)} className="h-8 text-sm" />
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
              <Label className="mb-1">Colonnes à grouper</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {columns.filter(c => c.id !== editingColumn?.id).map(col => (
                  <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.sourceColumns || []).includes(col.slug)}
                      onChange={() => toggleSourceColumn(col.slug)}
                      className="rounded"
                    />
                    {col.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {type === 'CURRENCY' && (
            <div>
              <Label className="mb-1">Symbole</Label>
              <Input
                value={config.currencySymbol || 'DH'}
                onChange={e => setConfig({ ...config, currencySymbol: e.target.value })}
                placeholder="DH"
              />
            </div>
          )}

          {type === 'RELATION' && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              Les relations se configurent dans le gestionnaire de relations
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={visible} onCheckedChange={setVisible} />
              Visible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={required} onCheckedChange={setRequired} />
              Requis
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Sauvegarde...' : editingColumn ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
