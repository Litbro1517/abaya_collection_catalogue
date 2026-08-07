'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { DataPillar } from '@/components/data/DataPillar';
import { LayoutPillar } from '@/components/layout/LayoutPillar';
import { SettingsPillar } from '@/components/settings/SettingsPillar';
import { OrdersPillar } from '@/components/orders/OrdersPillar';
import { LandingPagesPillar } from '@/components/landing/LandingPagesPillar';
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
  Mail,
  Key,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  ShoppingBag,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

// ── Brand Constants ──
const BRAND = {
  vertFonce: '#1A3C34',
  noir: '#1F1F1F',
} as const;

export function BuilderShell() {
  const { pillar, setPillar, view, setView, catalog, sidebarCollapsed, setSidebarCollapsed, dataPanelCollapsed, setDataPanelCollapsed, setIsAdmin, setAdminUser, adminUser, googleSession, setShowGoogleSheetsBrowser, setSettingsTab, setActiveDataSourceId, dataSources } = useAppStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({ email: '', name: '', role: 'admin', password: '' });
  const [addAdminLoading, setAddAdminLoading] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAdmin(false);
    setAdminUser(null);
    toast({ title: t('builder.disconnected'), description: t('builder.disconnectedMsg') });
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        if (json.data?.authUrl) {
          window.location.href = json.data.authUrl;
        }
      } else {
        toast({ title: t('builder.googleNotConfigured'), description: t('builder.googleConfigRequired') });
      }
    } catch {
      toast({ title: t('builder.error'), description: t('builder.googleConnectError') });
    }
  };

  // ── Éditer: navigate to data pillar and open Google Sheets browser ──
  const handleEdit = () => {
    const state = useAppStore.getState();
    if (!state.activeDataSourceId && state.dataSources.length > 0) {
      setActiveDataSourceId(state.dataSources[0].id);
    }
    setPillar('data');
    setTimeout(() => {
      useAppStore.getState().setShowGoogleSheetsBrowser(true);
    }, 300);
  };

  // ── Add Admin: directly open the add admin modal ──
  const handleAddAdmin = async () => {
    if (!addAdminForm.email.trim()) {
      sonnerToast.error(t('builder.emailRequired'));
      return;
    }
    setAddAdminLoading(true);
    try {
      const res = await fetch('/api/auth/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addAdminForm.email.trim(),
          name: addAdminForm.name.trim() || undefined,
          role: addAdminForm.role,
          password: addAdminForm.password || undefined,
        }),
      });
      if (res.ok) {
        sonnerToast.success(t('builder.adminAdded'));
        setAddAdminForm({ email: '', name: '', role: 'admin', password: '' });
        setAddAdminDialogOpen(false);
      } else {
        const json = await res.json();
        sonnerToast.error(json.error || t('builder.addError'));
      }
    } catch {
      sonnerToast.error(t('builder.connectionError'));
    } finally {
      setAddAdminLoading(false);
    }
  };

  const pillars = [
    { id: 'data' as const, icon: Database, label: t('builder.data') },
    { id: 'layout' as const, icon: Layout, label: t('builder.layout') },
    { id: 'settings' as const, icon: Settings, label: t('builder.settings') },
    { id: 'orders' as const, icon: ShoppingBag, label: t('builder.orders') },
    { id: 'landing-pages' as const, icon: FileText, label: 'Landing Pages' },
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
            <h1 className="text-sm font-semibold leading-none">{catalog?.name || t('builder.myCatalog')}</h1>
            <p className="text-[11px] text-muted-foreground">{t('builder.builder')}</p>
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
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: BRAND.vertFonce }}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: BRAND.noir }}>
                          {t('builder.hello')} {displayName} !
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
                      style={{ color: BRAND.noir }}
                    >
                      <Settings2 className="w-4 h-4 text-gray-400" />
                      {t('builder.manageAccount')}
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setAddAdminDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                      style={{ color: BRAND.noir }}
                    >
                      <UserPlus className="w-4 h-4 text-gray-400" />
                      {t('builder.addAccount')}
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
                      {t('builder.logout')}
                    </button>
                  </div>

                  {/* Footer links */}
                  <div className="border-t px-4 py-2 flex items-center gap-2 text-[10px] text-gray-400" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    <span>{t('builder.privacyPolicy')}</span>
                    <span>·</span>
                    <span>{t('builder.termsOfUse')}</span>
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
                <span className="text-xs hidden sm:inline">{t('builder.connectGoogle')}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('builder.connectGoogleTooltip')}</TooltipContent>
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
            <span className="hidden sm:inline">{t('builder.edit')}</span>
          </Button>
          <Button
            variant={view === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 text-xs gap-1.5', view === 'preview' && 'shadow-sm')}
            onClick={() => setView('preview')}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('builder.preview')}</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('builder.disconnect')}</TooltipContent>
        </Tooltip>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Pillar selector */}
        <aside className={cn(
          'border-r border-border bg-card flex flex-col shrink-0 transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-14' : 'w-52'
        )}>
          {/* Toggle button at top */}
          <div className={cn(
            'flex items-center shrink-0 h-10 border-b border-border/50',
            sidebarCollapsed ? 'justify-center px-0' : 'justify-end px-3'
          )}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              title={sidebarCollapsed ? t('builder.expandSidebar') : t('builder.collapseSidebar')}
            >
              {sidebarCollapsed
                ? <ChevronsRight className="w-4 h-4" />
                : <ChevronsLeft className="w-4 h-4" />
              }
            </button>
          </div>

          {/* Navigation items */}
          <div className="flex flex-col py-2 gap-0.5 flex-1 overflow-y-auto overflow-x-hidden">
            {/* Dashboard button */}
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView('dashboard')}
                    className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <LayoutDashboard className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('builder.dashboard')}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center gap-3 h-10 px-3 mx-2 rounded-lg transition-all text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard className="w-5 h-5 shrink-0" />
                <span className="text-sm truncate">{t('builder.dashboard')}</span>
              </button>
            )}

            <div className={cn('border-t border-border mx-3 my-1.5')} />

            {pillars.map((p) => (
              sidebarCollapsed ? (
                <Tooltip key={p.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setPillar(p.id)}
                      className={cn(
                        'w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all',
                        pillar === p.id
                          ? 'bg-gold/10 text-gold shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <p.icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{p.label}</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  key={p.id}
                  onClick={() => setPillar(p.id)}
                  className={cn(
                    'flex items-center gap-3 h-10 px-3 mx-2 rounded-lg transition-all',
                    pillar === p.id
                      ? 'bg-gold/10 text-gold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <p.icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm truncate">{p.label}</span>
                </button>
              )
            ))}

            {/* Panel collapse toggle (Data & Layout pillars have sub-panels) */}
            {(pillar === 'data' || pillar === 'layout') && (
              <>
                <div className={cn('border-t border-border mx-3 my-1.5')} />
                {sidebarCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDataPanelCollapsed(!dataPanelCollapsed)}
                        className={cn(
                          'w-10 h-10 mx-auto rounded-lg flex items-center justify-center transition-all',
                          dataPanelCollapsed
                            ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        )}
                      >
                        {pillar === 'data'
                          ? <Database className="w-4 h-4" />
                          : <Layout className="w-4 h-4" />
                        }
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {dataPanelCollapsed
                        ? (pillar === 'data' ? t('builder.showTables') : t('builder.showSections'))
                        : (pillar === 'data' ? t('builder.hideTables') : t('builder.hideSections'))
                      }
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => setDataPanelCollapsed(!dataPanelCollapsed)}
                    className={cn(
                      'flex items-center gap-3 h-9 px-3 mx-2 rounded-lg transition-all text-xs',
                      dataPanelCollapsed
                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    {pillar === 'data'
                      ? <Database className="w-4 h-4 shrink-0" />
                      : <Layout className="w-4 h-4 shrink-0" />
                    }
                    <span className="truncate">
                      {dataPanelCollapsed
                        ? (pillar === 'data' ? t('builder.showTablesShort') : t('builder.showSectionsShort'))
                        : (pillar === 'data' ? t('builder.hideTablesShort') : t('builder.hideSectionsShort'))
                      }
                    </span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* ABAYA branding at bottom */}
          <div className={cn(
            'shrink-0 py-2 flex items-center justify-center transition-opacity duration-300',
            sidebarCollapsed ? 'opacity-0' : 'opacity-100'
          )}>
            <span className="text-[9px] font-bold tracking-[0.2em] text-muted-foreground/40">
              ABAYA
            </span>
          </div>
        </aside>

        {/* Pillar content */}
        <main className="flex-1 overflow-hidden">
          {pillar === 'data' && <DataPillar />}
          {pillar === 'layout' && <LayoutPillar />}
          {pillar === 'settings' && <SettingsPillar />}
          {pillar === 'orders' && <OrdersPillar />}
          {pillar === 'landing-pages' && <LandingPagesPillar />}
        </main>
      </div>

      {/* ── Add Admin Dialog ── */}
      <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('builder.addAdmin')}</DialogTitle>
            <DialogDescription>
              {t('builder.addAdminDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{t('builder.emailStar')}</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={addAdminForm.email}
                  onChange={e => setAddAdminForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@exemple.com"
                  className="h-9 pl-10 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('builder.nameOptional')}</Label>
              <Input
                value={addAdminForm.name}
                onChange={e => setAddAdminForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Prénom Nom"
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{t('builder.role')}</Label>
              <Select value={addAdminForm.role} onValueChange={v => setAddAdminForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('builder.roleAdmin')}</SelectItem>
                  <SelectItem value="editor">{t('builder.roleEditor')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('builder.passwordOptional')}</Label>
              <div className="relative mt-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={addAdminForm.password}
                  onChange={e => setAddAdminForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={t('builder.min8Chars')}
                  className="h-9 pl-10 text-xs"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('builder.noPasswordHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setAddAdminDialogOpen(false)}
              className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50 transition-colors"
            >
              {t('builder.cancel')}
            </button>
            <button
              onClick={handleAddAdmin}
              disabled={addAdminLoading || !addAdminForm.email.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: BRAND.vertFonce }}
            >
              {addAdminLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {t('builder.add')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
