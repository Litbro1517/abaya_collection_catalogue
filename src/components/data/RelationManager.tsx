'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { Relation } from '@/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Link2,
  Plus,
  Trash2,
  ArrowRight,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';

const RELATION_TYPE_LABELS: Record<string, string> = {
  manyToOne: 'Plusieurs → Un',
  oneToMany: 'Un → Plusieurs',
  manyToMany: 'Plusieurs ↔ Plusieurs',
};

export function RelationManager() {
  const {
    activeDataSourceId,
    activeDataSource,
    dataSources,
    relations,
    setRelations,
  } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSourceColumnId, setNewSourceColumnId] = useState('');
  const [newTargetTableId, setNewTargetTableId] = useState('');
  const [newType, setNewType] = useState<'manyToOne' | 'oneToMany' | 'manyToMany'>('manyToOne');
  const [submitting, setSubmitting] = useState(false);

  const currentRelations = relations.filter(
    (r) => r.sourceTableId === activeDataSourceId
  );

  const currentColumns = activeDataSource?.columns || [];
  const otherDataSources = dataSources.filter(
    (ds) => ds.id !== activeDataSourceId
  );

  const resetCreateForm = () => {
    setNewName('');
    setNewSourceColumnId('');
    setNewTargetTableId('');
    setNewType('manyToOne');
    setSubmitting(false);
  };

  const handleCreateRelation = async () => {
    if (!newName.trim()) {
      toast.error('Le nom est requis');
      return;
    }
    if (!newSourceColumnId) {
      toast.error('Sélectionnez une colonne source');
      return;
    }
    if (!newTargetTableId) {
      toast.error('Sélectionnez une table cible');
      return;
    }
    if (!activeDataSourceId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/datasources/${activeDataSourceId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          sourceColumnId: newSourceColumnId,
          targetTableId: newTargetTableId,
          type: newType,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setRelations([...relations, json.data]);
        toast.success('Relation créée');
        resetCreateForm();
        setShowCreateDialog(false);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!activeDataSourceId) return;
    try {
      const res = await fetch(
        `/api/datasources/${activeDataSourceId}/relations/${relationId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setRelations(relations.filter((r) => r.id !== relationId));
        toast.success('Relation supprimée');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  // Helper: get data source name by ID
  const getDsName = (id: string) =>
    dataSources.find((ds) => ds.id === id)?.name || id;

  // Helper: get column name by ID
  const getColName = (dsId: string, colId: string) => {
    const ds = dataSources.find((d) => d.id === dsId);
    if (!ds) return colId;
    const col = ds.columns.find((c) => c.id === colId);
    return col?.name || colId;
  };

  if (!activeDataSourceId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Sélectionnez une table pour gérer ses relations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-semibold text-foreground">Relations</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-gold hover:text-gold"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Nouvelle
        </Button>
      </div>

      {/* Relations list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {currentRelations.length === 0 && (
            <div className="text-center py-8">
              <GitBranch className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">
                Aucune relation définie
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-1 text-xs"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3 w-3" />
                Créer une relation
              </Button>
            </div>
          )}

          {currentRelations.map((rel) => (
            <div
              key={rel.id}
              className="rounded-lg border border-border p-3 space-y-2 hover:bg-muted/20 transition-luxury group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {rel.name}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la relation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Supprimer la relation &laquo; {rel.name} &raquo; ? Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white"
                        onClick={() => handleDeleteRelation(rel.id)}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Relation visual */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
                  <span className="font-medium text-foreground">
                    {getDsName(rel.sourceTableId)}
                  </span>
                  <span className="text-muted-foreground">.</span>
                  <span>{getColName(rel.sourceTableId, rel.sourceColumnId)}</span>
                </div>

                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gold" />

                <div className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
                  <span className="font-medium text-foreground">
                    {getDsName(rel.targetTableId)}
                  </span>
                </div>
              </div>

              <Badge variant="secondary" className="text-[10px]">
                {RELATION_TYPE_LABELS[rel.type] || rel.type}
              </Badge>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Create Relation Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(v) => {
          if (!v) resetCreateForm();
          setShowCreateDialog(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-gold" />
              Nouvelle Relation
            </DialogTitle>
            <DialogDescription>
              Créez une relation entre cette table et une autre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="rel-name">Nom *</Label>
              <Input
                id="rel-name"
                placeholder="Ex: produits_catégorie"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            {/* Source column */}
            <div className="space-y-2">
              <Label>Colonne source</Label>
              <Select value={newSourceColumnId} onValueChange={setNewSourceColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une colonne" />
                </SelectTrigger>
                <SelectContent>
                  {currentColumns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name} ({col.type})
                    </SelectItem>
                  ))}
                  {currentColumns.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Aucune colonne
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Target table */}
            <div className="space-y-2">
              <Label>Table cible</Label>
              <Select value={newTargetTableId} onValueChange={setNewTargetTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une table" />
                </SelectTrigger>
                <SelectContent>
                  {otherDataSources.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: ds.color || '#C9A84C' }}
                        />
                        {ds.name}
                      </span>
                    </SelectItem>
                  ))}
                  {otherDataSources.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Aucune autre table
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Relation type */}
            <div className="space-y-2">
              <Label>Type de relation</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as 'manyToOne' | 'oneToMany' | 'manyToMany')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manyToOne">Plusieurs → Un</SelectItem>
                  <SelectItem value="oneToMany">Un → Plusieurs</SelectItem>
                  <SelectItem value="manyToMany">Plusieurs ↔ Plusieurs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCreateForm(); setShowCreateDialog(false); }}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateRelation}
              disabled={submitting || !newName.trim() || !newSourceColumnId || !newTargetTableId}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
