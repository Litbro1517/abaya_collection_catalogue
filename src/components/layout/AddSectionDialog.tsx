'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid, Star, Image, Type } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalogId?: string;
  onCreated: () => void;
}

const sectionTypes = [
  { value: 'collection', label: 'Collection de produits', icon: LayoutGrid, desc: 'Grille de produits avec images et détails' },
  { value: 'hero', label: 'Bannière', icon: Image, desc: 'Image de couverture avec texte' },
  { value: 'featured', label: 'Produits vedettes', icon: Star, desc: 'Mise en avant de produits sélectionnés' },
  { value: 'text', label: 'Section texte', icon: Type, desc: 'Bloc de texte personnalisé' },
];

export function AddSectionDialog({ open, onOpenChange, catalogId, onCreated }: Props) {
  const [type, setType] = useState('collection');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/catalog/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId,
          type,
          title: title || null,
          config: {},
        }),
      });
      if (res.ok) {
        toast.success('Section créée');
        onCreated();
        onOpenChange(false);
        setTitle('');
        setType('collection');
      }
    } catch {
      toast.error('Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une section</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="mb-2 block">Type de section</Label>
            <div className="grid grid-cols-2 gap-2">
              {sectionTypes.map(st => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.value}
                    className={`p-3 rounded-lg border text-left transition-all ${type === st.value ? 'border-gold bg-gold/5' : 'border-border hover:bg-muted'}`}
                    onClick={() => setType(st.value)}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <p className="text-sm font-medium">{st.label}</p>
                    <p className="text-[10px] text-muted-foreground">{st.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Titre (optionnel)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Nos Abayas" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Création...' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
