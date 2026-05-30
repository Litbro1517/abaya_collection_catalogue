'use client';

import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { DataPillar } from '@/components/data/DataPillar';
import { LayoutPillar } from '@/components/layout/LayoutPillar';
import { SettingsPillar } from '@/components/settings/SettingsPillar';
import {
  Database,
  Layout,
  Settings,
  Eye,
  Pen,
  ChevronLeft,
  LogOut,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export function BuilderShell() {
  const { pillar, setPillar, view, setView, catalog, sidebarCollapsed, setSidebarCollapsed, setIsAdmin } = useAppStore();
  const { toast } = useToast();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAdmin(false);
    toast({ title: 'Déconnecté', description: 'Vous avez été déconnecté' });
  };

  const pillars = [
    { id: 'data' as const, icon: Database, label: 'Données' },
    { id: 'layout' as const, icon: Layout, label: 'Mise en page' },
    { id: 'settings' as const, icon: Settings, label: 'Paramètres' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-gold" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold leading-none">{catalog?.name || 'Mon Catalogue'}</h1>
            <p className="text-[11px] text-muted-foreground">Constructeur</p>
          </div>
        </div>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={view === 'builder' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 text-xs gap-1.5', view === 'builder' && 'shadow-sm')}
            onClick={() => setView('builder')}
          >
            <Pen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Éditer</span>
          </Button>
          <Button
            variant={view === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 text-xs gap-1.5', view === 'preview' && 'shadow-sm')}
            onClick={() => setView('preview')}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aperçu</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Déconnexion</TooltipContent>
        </Tooltip>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Pillar selector */}
        <aside className={cn(
          'border-r border-border bg-card flex flex-col items-center py-3 gap-1 shrink-0 transition-all duration-200',
          sidebarCollapsed ? 'w-14' : 'w-16'
        )}>
          {pillars.map((p) => (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPillar(p.id)}
                  className={cn(
                    'w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all',
                    pillar === p.id
                      ? 'bg-gold/10 text-gold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <p.icon className="w-5 h-5" />
                  <span className="text-[9px] leading-none">{p.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{p.label}</TooltipContent>
            </Tooltip>
          ))}
        </aside>

        {/* Pillar content */}
        <main className="flex-1 overflow-hidden">
          {pillar === 'data' && <DataPillar />}
          {pillar === 'layout' && <LayoutPillar />}
          {pillar === 'settings' && <SettingsPillar />}
        </main>
      </div>
    </div>
  );
}
