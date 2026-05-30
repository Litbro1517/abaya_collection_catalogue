'use client';

import type { DataSource } from '@/types';
import { cn } from '@/lib/utils';
import { Table, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

interface Props {
  dataSources: DataSource[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}

export function DataSourceList({ dataSources, activeId, onSelect, onRefresh }: Props) {
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/datasources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Table supprimée');
        if (activeId === id) onSelect(null);
        onRefresh();
      }
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  if (dataSources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Table className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-xs">Aucune table</p>
        <p className="text-[10px] mt-1">Créez ou importez une table</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {dataSources.map(ds => (
        <div
          key={ds.id}
          className={cn(
            'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
            activeId === ds.id
              ? 'bg-gold/10 border border-gold/20'
              : 'hover:bg-muted border border-transparent'
          )}
          onClick={() => onSelect(ds.id)}
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: ds.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{ds.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(ds as DataSource & { columnCount?: number; rowCount?: number }).rowCount ?? 0} lignes
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer &laquo; {ds.name} &raquo; ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera la table et toutes ses données. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(ds.id)} className="bg-destructive text-white hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}
