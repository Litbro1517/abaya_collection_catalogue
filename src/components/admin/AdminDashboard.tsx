'use client';

import { useAppStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import {
  Database,
  Layout,
  Settings,
  Eye,
  Users,
  Shield,
  ExternalLink,
  Sheet,
  BarChart3,
  ArrowLeft,
  LayoutDashboard,
  Loader2,
  Pencil,
  Unplug,
  LogOut,
  Cable,
  User,
  UserPlus,
  Settings2,
  Mail,
  Key,
} from 'lucide-react';

import type { AppView, Pillar, SettingsTab } from '@/types';
import { toast } from 'sonner';
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

// ── Brand Constants (fallback — CSS vars are the source of truth) ──
const BRAND = {
  vertFonce: '#1A3C34',
  dore: '#C9A84C',
  beige: '#F5F0E8',
  noir: '#1F1F1F',
  blanc: '#FFFFFF',
  bordeaux: '#800020',
} as const;

/** Resolve a CSS variable at runtime — returns fallback if var not set */
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name)?.trim() || fallback;
}

interface AdminDashboardProps {
  admin: {
    id: string;
    email: string;
    name: string | null;
    picture: string | null;
    role: string;
  };
}

export function AdminDashboard({ admin }: AdminDashboardProps) {
  const {
    setView, setPillar, setSettingsTab,
    setIsAdmin, setAdminUser,
    googleSession, setShowGoogleSheetsBrowser,
    dataSources, setActiveDataSourceId,
  } = useAppStore();
  const [stats, setStats] = useState<{
    datasources: number;
    sections: number;
    totalRows: number;
    admins: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);
  const [showGooglePanel, setShowGooglePanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({ email: '', name: '', role: 'admin', password: '' });
  const [addAdminLoading, setAddAdminLoading] = useState(false);

  useEffect(() => {
    setIsAdmin(true);
    setAdminUser(admin);
  }, [admin, setIsAdmin, setAdminUser]);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const dsRes = await fetch('/api/datasources');
        let datasources = 0;
        let totalRows = 0;

        if (dsRes.ok) {
          const dsJson = await dsRes.json();
          const dsList = dsJson.data || [];
          datasources = dsList.length;

          totalRows = dsList.reduce((sum: number, ds: { rowCount?: number }) => sum + (ds.rowCount || 0), 0);

          if (totalRows === 0 && dsList.length > 0) {
            const rowCounts = await Promise.all(
              dsList.map(async (ds: { id: string }) => {
                try {
                  const r = await fetch(`/api/datasources/${ds.id}/rows?limit=1`);
                  if (r.ok) {
                    const j = await r.json();
                    return j.total || j.data?.length || 0;
                  }
                } catch { /* skip */ }
                return 0;
              })
            );
            totalRows = rowCounts.reduce((a: number, b: number) => a + b, 0);
          }
        }

        const [catRes, adminsRes] = await Promise.all([
          fetch('/api/catalog'),
          fetch('/api/auth/admins'),
        ]);

        let sections = 0;
        let adminsCount = 0;

        if (catRes.ok) {
          const catJson = await catRes.json();
          sections = catJson.data?.sections?.length || 0;
        }

        if (adminsRes.ok) {
          const adminsJson = await adminsRes.json();
          adminsCount = adminsJson.data?.length || 0;
        }

        setStats({ datasources, sections, totalRows, admins: adminsCount });
      } catch {
        // Stats not critical
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // ── Smart navigation ──
  // Detects whether we're on /admin (separate page) or / (same SPA)
  const isOnAdminPage = typeof window !== 'undefined' && window.location.pathname === '/admin';

  const navigateTo = (view: AppView, opts?: { pillar?: Pillar; settingsTab?: SettingsTab }) => {
    if (isOnAdminPage) {
      // On /admin page → use URL params to pass navigation state to / page
      const params = new URLSearchParams({ view });
      if (opts?.pillar) params.set('pillar', opts.pillar);
      if (opts?.settingsTab) params.set('settingsTab', opts.settingsTab);
      window.location.href = `/?${params.toString()}`;
    } else {
      // On / page → use Zustand directly for instant SPA navigation
      setView(view);
      if (opts?.pillar) setPillar(opts.pillar);
      if (opts?.settingsTab) setSettingsTab(opts.settingsTab);
    }
  };

  // ── Google OAuth: start connection flow ──
  const handleConnectGoogle = async () => {
    setGoogleConnecting(true);
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        // API returns { data: { authUrl, state } } — navigate to Google OAuth
        if (json.data?.authUrl) {
          window.location.href = json.data.authUrl;
          return;
        }
      }
      // If we reach here, Google OAuth isn't configured
      toast.error('Google non configuré', {
        description: 'Veuillez d\'abord configurer les identifiants Google OAuth dans les paramètres.',
      });
      // Navigate to Settings > Admin where OAuth credentials can be configured
      navigateTo('builder', { pillar: 'settings', settingsTab: 'admin' });
    } catch {
      toast.error('Erreur de connexion Google');
    } finally {
      setGoogleConnecting(false);
    }
  };

  // ── Google: disconnect ──
  const handleDisconnectGoogle = async () => {
    setGoogleDisconnecting(true);
    try {
      const res = await fetch('/api/google/session', { method: 'DELETE' });
      if (res.ok) {
        useAppStore.getState().setGoogleSession(null);
        toast.success('Google déconnecté', {
          description: 'La connexion Google a été supprimée.',
        });
        setShowGooglePanel(false);
      } else {
        toast.error('Erreur lors de la déconnexion');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setGoogleDisconnecting(false);
    }
  };

  // ── Éditer: directly open the data editing interface ──
  // Like the green edit button: switches to builder mode, data pillar,
  // auto-selects the first data source so the DataTable is immediately visible
  const handleEdit = () => {
    // Auto-select first data source if none is selected
    const state = useAppStore.getState();
    if (!state.activeDataSourceId && state.dataSources.length > 0) {
      setActiveDataSourceId(state.dataSources[0].id);
    }
    navigateTo('builder', { pillar: 'data' });
  };

  // ── Google Sheets: EXCLUSIVELY for connection/configuration ──
  // Not connected → OAuth flow
  // Connected → Show connection management panel (disconnect/reconnect/configure)
  const handleGoogleSheets = () => {
    if (!googleSession) {
      // Not connected → start OAuth flow
      handleConnectGoogle();
    } else {
      // Connected → toggle the connection management panel
      setShowGooglePanel(prev => !prev);
    }
  };

  // ── Gestion des administrateurs: directly to admin management ──
  // Navigates to builder > settings > admin tab where AdminUserManager lives
  const handleAdminManagement = () => {
    navigateTo('builder', { pillar: 'settings', settingsTab: 'admin' });
  };

  // ── Add Admin: directly open the add admin modal ──
  const handleAddAdmin = async () => {
    if (!addAdminForm.email.trim()) {
      toast.error('L\'email est requis');
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
        toast.success('Administrateur ajouté avec succès');
        setAddAdminForm({ email: '', name: '', role: 'admin', password: '' });
        setAddAdminDialogOpen(false);
        // Refresh stats
        setStatsLoading(true);
        fetch('/api/auth/admins').then(r => r.ok ? r.json() : null).then(json => {
          if (json?.data) setStats(prev => prev ? { ...prev, admins: json.data.length } : null);
          setStatsLoading(false);
        });
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur lors de l\'ajout');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setAddAdminLoading(false);
    }
  };

  // ── Logout ──
  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAdmin(false);
    setAdminUser(null);
    if (isOnAdminPage) {
      window.location.href = '/';
    }
  };

  // ── Quick access cards ──
  const cards = [
    {
      title: 'Éditer',
      description: 'Édition directe des données du catalogue',
      icon: Pencil,
      action: handleEdit,
      color: BRAND.vertFonce,
    },
    {
      title: 'Aperçu',
      description: 'Visualiser le catalogue tel que le voient les visiteurs',
      icon: Eye,
      action: () => navigateTo('preview'),
      color: '#455d68',
    },
    {
      title: 'Données',
      description: 'Sources de données, colonnes, import',
      icon: Database,
      action: () => navigateTo('builder', { pillar: 'data' }),
      color: BRAND.vertFonce,
    },
    {
      title: 'Mise en page',
      description: 'Sections, configuration du catalogue',
      icon: Layout,
      action: () => navigateTo('builder', { pillar: 'layout' }),
      color: BRAND.dore,
    },
    {
      title: 'Paramètres',
      description: 'Couleurs, WhatsApp, réseaux sociaux',
      icon: Settings,
      action: () => navigateTo('builder', { pillar: 'settings', settingsTab: 'general' }),
      color: '#8B4513',
    },
    {
      title: googleSession ? 'Google Sheets' : 'Connexion Google',
      description: googleSession
        ? `Connecté : ${googleSession.email || googleSession.name || 'Compte Google'}`
        : 'Lier votre compte Google Drive/Sheets',
      icon: googleSession ? Sheet : Unplug,
      action: handleGoogleSheets,
      color: googleSession ? '#16a34a' : '#4285F4',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BRAND.beige }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b" style={{ borderColor: `${BRAND.dore}20` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Back arrow → navigates to builder */}
          <button
            onClick={() => navigateTo('builder')}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Retour au catalogue"
            title="Retour au catalogue"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: BRAND.noir }} />
          </button>

          {/* Logo + Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, var(--gold), #E8D48B, var(--gold))` }}>
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg truncate" style={{ color: BRAND.noir, fontFamily: "'Playfair Display', serif" }}>
                Dashboard
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500 truncate">
                {admin.name || admin.email} · <span className="capitalize font-medium" style={{ color: admin.role === 'owner' ? BRAND.vertFonce : '#8B4513' }}>{admin.role}</span>
              </p>
            </div>
          </div>

          {/* Quick links + User menu */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateTo('preview')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
              style={{ color: BRAND.vertFonce }}
              title="Voir le catalogue"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Catalogue</span>
            </button>

            {/* User avatar button → opens Google-style menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(prev => !prev)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="Menu utilisateur"
              >
                {admin.picture ? (
                  <img
                    src={admin.picture}
                    alt={admin.name || admin.email}
                    className="w-7 h-7 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: BRAND.vertFonce }}>
                    {(admin.name || admin.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium truncate max-w-[100px] hidden sm:inline" style={{ color: BRAND.noir }}>
                  {admin.name || admin.email.split('@')[0]}
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
                        {admin.picture ? (
                          <img
                            src={admin.picture}
                            alt={admin.name || admin.email}
                            className="w-10 h-10 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: BRAND.vertFonce }}>
                            {(admin.name || admin.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: BRAND.noir }}>
                            Bonjour {admin.name || admin.email.split('@')[0]} !
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">{admin.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu actions */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          navigateTo('builder', { pillar: 'settings', settingsTab: 'admin' });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                        style={{ color: BRAND.noir }}
                      >
                        <Settings2 className="w-4 h-4 text-gray-400" />
                        Gérer votre compte
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
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1">
        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[
            { label: 'Sources', value: stats?.datasources ?? '–', icon: Database, color: BRAND.vertFonce },
            { label: 'Sections', value: stats?.sections ?? '–', icon: Layout, color: BRAND.dore },
            { label: 'Produits', value: stats?.totalRows ?? '–', icon: BarChart3, color: '#8B4513' },
            { label: 'Admins', value: stats?.admins ?? '–', icon: Users, color: BRAND.bordeaux },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 sm:p-5 border" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium">{s.label}</span>
              </div>
              {statsLoading && !stats ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: s.color }} />
              ) : (
                <p className="text-xl sm:text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick Access Cards ── */}
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Accès rapides</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
          {cards.map(card => (
            <button
              key={card.title}
              onClick={card.action}
              className="bg-white rounded-xl p-4 sm:p-5 border text-left hover:shadow-md transition-all duration-200 group cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}10` }}>
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                {/* Show connecting spinner for Google */}
                {card.title === 'Connexion Google' && googleConnecting && (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#4285F4' }} />
                )}
              </div>
              <h3 className="font-semibold text-sm mb-0.5" style={{ color: BRAND.noir }}>{card.title}</h3>
              <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed line-clamp-2">{card.description}</p>
            </button>
          ))}
        </div>

        {/* ── Google Connection Panel (shown when Google Sheets card is clicked while connected) ── */}
        {showGooglePanel && googleSession && (
          <div className="mb-6 bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#16a34a10' }}>
                  <Sheet className="w-5 h-5" style={{ color: '#16a34a' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm" style={{ color: BRAND.noir }}>Connexion Google</h3>
                  <p className="text-[11px] text-gray-500 truncate">{googleSession.email || googleSession.name || 'Compte Google connecté'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: '#16a34a15', color: '#16a34a' }}>
                  Connecté
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setShowGooglePanel(false);
                    navigateTo('builder', { pillar: 'settings', settingsTab: 'admin' });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: 'rgba(0,0,0,0.1)', color: BRAND.noir }}
                >
                  <Cable className="w-3.5 h-3.5" />
                  Configurer OAuth
                </button>
                <button
                  onClick={() => {
                    setShowGooglePanel(false);
                    // Navigate to builder > data and auto-open Google Sheets browser
                    if (isOnAdminPage) {
                      // On /admin: use URL params with openSheets flag
                      window.location.href = '/?view=builder&pillar=data&openSheets=true';
                    } else {
                      // On /: use Zustand directly
                      if (dataSources.length > 0) setActiveDataSourceId(dataSources[0].id);
                      setView('builder');
                      setPillar('data');
                      setTimeout(() => useAppStore.getState().setShowGoogleSheetsBrowser(true), 300);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: 'rgba(0,0,0,0.1)', color: BRAND.noir }}
                >
                  <Sheet className="w-3.5 h-3.5" />
                  Importer une feuille
                </button>
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={googleDisconnecting}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {googleDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  Déconnecter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Admin Management ── */}
        {admin.role === 'owner' && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Administration</h2>
            <div
              onClick={handleAdminManagement}
              className="w-full bg-white rounded-xl p-4 sm:p-5 border text-left hover:shadow-md transition-all duration-200 flex items-center gap-4 cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.05)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.bordeaux}10` }}>
                <Shield className="w-5 h-5" style={{ color: BRAND.bordeaux }} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm" style={{ color: BRAND.noir }}>Gestion des administrateurs</h3>
                <p className="text-[11px] text-gray-500">{stats?.admins ?? 0} administrateur(s) · Ajouter, modifier, supprimer</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setAddAdminDialogOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors shrink-0"
                style={{ backgroundColor: BRAND.vertFonce }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
          </div>
        )}

        {/* ── Add Admin Dialog ── */}
        <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un administrateur</DialogTitle>
              <DialogDescription>
                Créez un nouvel accès administrateur. L&apos;utilisateur pourra se connecter avec son email et le mot de passe défini ci-dessous, ou via Google OAuth si son email correspond.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Email *</Label>
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
                <Label className="text-xs">Nom (optionnel)</Label>
                <Input
                  value={addAdminForm.name}
                  onChange={e => setAddAdminForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Prénom Nom"
                  className="h-9 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Rôle</Label>
                <Select value={addAdminForm.role} onValueChange={v => setAddAdminForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Gestion complète</SelectItem>
                    <SelectItem value="editor">Éditeur — Modification du contenu uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mot de passe (optionnel)</Label>
                <div className="relative mt-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={addAdminForm.password}
                    onChange={e => setAddAdminForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 8 caractères"
                    className="h-9 pl-10 text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Si aucun mot de passe n&apos;est défini, l&apos;utilisateur devra se connecter via Google OAuth.
                </p>
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={() => setAddAdminDialogOpen(false)}
                className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAddAdmin}
                disabled={addAdminLoading || !addAdminForm.email.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: BRAND.vertFonce }}
              >
                {addAdminLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Ajouter
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Security Notice ── */}
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(26, 60, 52, 0.03)', borderColor: 'rgba(26, 60, 52, 0.08)' }}>
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: BRAND.vertFonce }} />
            <div>
              <h3 className="font-semibold text-xs mb-0.5" style={{ color: BRAND.vertFonce }}>Accès sécurisé</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Espace réservé aux rôles <strong>owner</strong> et <strong>admin</strong>. Les éditeurs et visiteurs sont redirigés vers le catalogue.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-4 text-center" style={{ borderColor: `${BRAND.dore}20` }}>
        <p className="text-[11px] text-gray-400">
          Abaya Collection Dashboard · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
