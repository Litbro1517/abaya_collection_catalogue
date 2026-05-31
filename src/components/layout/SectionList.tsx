'use client';

import type { Section } from '@/types';
import { cn } from '@/lib/utils';
import { LayoutGrid, Star, Type, Image, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
  sections: Section[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}

const sectionIcons: Record<string, React.ElementType> = {
  collection: LayoutGrid,
  hero: Image,
  featured: Star,
  text: Type,
};

const sectionLabels: Record<string, string> = {
  collection: 'Collection',
  hero: 'Bannière',
  featured: 'Vedette',
  text: 'Texte',
};

export function SectionList({ sections, activeId, onSelect, onRefresh }: Props) {
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/catalog/sections/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Section supprimée');
        onRefresh();
      }
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  const handleToggleVisible = async (section: Section) => {
    try {
      await fetch(`/api/catalog/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !section.visible }),
      });
      onRefresh();
    } catch {}
  };

  if (sections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-xs">Aucune section</p>
        <p className="text-[10px] mt-1">Ajoutez une section pour commencer</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sections.map(section => {
        const Icon = sectionIcons[section.type] || LayoutGrid;
        return (
          <div
            key={section.id}
            className={cn(
              'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
              activeId === section.id
                ? 'bg-gold/10 border border-gold/20'
                : 'hover:bg-muted border border-transparent',
              !section.visible && 'opacity-50'
            )}
            onClick={() => onSelect(section.id)}
          >
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{section.title || sectionLabels[section.type] || section.type}</p>
              <p className="text-[10px] text-muted-foreground">{sectionLabels[section.type]}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Switch
                checked={section.visible}
                onCheckedChange={() => handleToggleVisible(section)}
                className="scale-75"
                onClick={e => e.stopPropagation()}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette section ?</AlertDialogTitle>
                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(section.id)}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}
