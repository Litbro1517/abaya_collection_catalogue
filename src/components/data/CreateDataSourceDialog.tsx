'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#C9A84C',
  '#E57373',
  '#4CAF50',
  '#42A5F5',
  '#AB47BC',
  '#FF7043',
];

interface CreateDataSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateDataSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDataSourceDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState('manual');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSourceType('manual');
    setColor(PRESET_COLORS[0]);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          sourceType,
          color,
        }),
      });

      if (res.ok) {
        toast.success('Table créée avec succès');
        resetForm();
        onOpenChange(false);
        onCreated();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de la création');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle Table</DialogTitle>
          <DialogDescription>
            Créez une nouvelle table de données pour votre catalogue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="ds-name">Nom *</Label>
            <Input
              id="ds-name"
              placeholder="Ex: Produits, Catégories..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="ds-desc">Description</Label>
            <Textarea
              id="ds-desc"
              placeholder="Description optionnelle..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Source type */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Saisie manuelle</SelectItem>
                <SelectItem value="csv">Import CSV</SelectItem>
                <SelectItem value="googlesheet">Google Sheet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-luxury',
                    color === c
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { resetForm(); onOpenChange(false); }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
