'use client';

import { useState } from 'react';
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
  LogOut,
  BookOpen,
  Sheet,
  LayoutDashboard,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export function BuilderShell() {
  const { pillar, setPillar, view, setView, catalog, sidebarCollapsed, setSidebarCollapsed, setIsAdmin, setAdminUser, adminUser, googleSession, setShowGoogleSheetsBrowser, setSettingsTab, setActiveDataSourceId, dataSources } = useAppStore();
  const { toast } = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAdmin(false);
    setAdminUser(null);
    toast({ title: 'Déconnecté', description: 'Vous avez été déconnecté' });
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        // API returns { data: { authUrl, state } }
        if (json.data?.authUrl) {
          window.location.href = json.data.authUrl;
        }
      } else {
        toast({ title: 'Google non configuré', description: 'Veuillez configurer les identifiants Google dans Paramètres > Admin' });
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de se connecter à Google' });
    }
  };

  // ── Éditer: navigate to data pillar and open Google Sheets browser ──
  const handleEdit = () => {
    // Auto-select first data source if none is selected
    const state = useAppStore.getState();
    if (!state.activeDataSourceId && state.dataSources.length > 0) {
      setActiveDataSourceId(state.dataSources[0].id);
    }
    setPillar('data');
    // Open Google Sheets browser after a short delay to ensure DataPillar has mounted
    setTimeout(() => {
      useAppStore.getState().setShowGoogleSheetsBrowser(true);
    }, 300);
  };

  const pillars = [
    { id: 'data' as const, icon: Database, label: 'Données' },
    { id: 'layout' as const, icon: Layout, label: 'Mise en page' },
    { id: 'settings' as const, icon: Settings, label: 'Paramètres' },
  ];

  // Get display name and picture for user menu (prefer adminUser, fallback to googleSession)
  const displayName = adminUser?.name || adminUser?.email?.split('@')[0] || googleSession?.name || googleSession?.email || '';
  const displayEmail = adminUser?.email || googleSession?.email || '';
  const displayPicture = adminUser?.picture || googleSession?.picture || null;

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

        {/* Google session indicator → Google-style user menu */}
        {(googleSession || adminUser) ? (
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors"
              onClick={() => setShowUserMenu(prev => !prev)}
            >
              <Avatar className="w-6 h-6">
                {displayPicture && <AvatarImage src={displayPicture} alt={displayName} />}
                <AvatarFallback className="text-[10px] bg-green-100 text-green-700">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground hidden sm:inline max-w-[120px] truncate">
                {displayName}
              </span>
            </button>

            {/* Google-style dropdown menu */}
            {showUserMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border z-50 overflow-hidden"
                  style={{ borderColor: 'rgba(0,0,0,0.08)' }}
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center gap-3">
                      {displayPicture ? (
                        <img
                          src={displayPicture}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#1A3C34' }}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: '#1F1F1F' }}>
                          Bonjour {displayName} !
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{displayEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu actions */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setPillar('settings');
                        setSettingsTab('admin');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                      style={{ color: '#1F1F1F' }}
                    >
                      <Settings2 className="w-4 h-4 text-gray-400" />
                      Gérer votre compte
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleConnectGoogle();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                      style={{ color: '#1F1F1F' }}
                    >
                      <UserPlus className="w-4 h-4 text-gray-400" />
                      Ajouter un compte
                    </button>
                  </div>

                  {/* Divider + Sign out */}
                  <div className="border-t py-1" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left text-red-600"
                    >
                      <LogOut className="w-4 h-4" />
                      Se déconnecter
                    </button>
                  </div>

                  {/* Footer links */}
                  <div className="border-t px-4 py-2 flex items-center gap-2 text-[10px] text-gray-400" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <span>Règles de confidentialité</span>
                    <span>·</span>
                    <span>Conditions d&apos;utilisation</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={handleConnectGoogle}
              >
                <Sheet className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Connecter Google</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Connecter votre compte Google Sheets</TooltipContent>
          </Tooltip>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={view === 'builder' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 text-xs gap-1.5', view === 'builder' && 'shadow-sm')}
            onClick={handleEdit}
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
          {/* Dashboard button at top */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setView('dashboard')}
                className="w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[9px] leading-none">Dashboard</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Retour au Dashboard</TooltipContent>
          </Tooltip>

          <div className="w-8 border-t border-border my-1" />

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
