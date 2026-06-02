'use client';

import { useAppStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import {
  Database,
  Layout,
  Settings,
  Eye,
  Pen,
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
} from 'lucide-react';
import Link from 'next/link';
import type { AppView, Pillar, SettingsTab } from '@/types';

// ── Brand Constants ──
const BRAND = {
  vertFonce: '#1A3C34',
  dore: '#C9A84C',
  beige: '#F5F0E8',
  noir: '#1F1F1F',
  blanc: '#FFFFFF',
  bordeaux: '#800020',
} as const;

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
        let admins = 0;

        if (catRes.ok) {
          const catJson = await catRes.json();
          sections = catJson.data?.sections?.length || 0;
        }

        if (adminsRes.ok) {
          const adminsJson = await adminsRes.json();
          admins = adminsJson.data?.length || 0;
        }

        setStats({ datasources, sections, totalRows, admins });
      } catch {
        // Stats not critical
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // ── Smart navigation ──
  const isOnAdminPage = typeof window !== 'undefined' && window.location.pathname === '/admin';

  const navigateTo = (view: AppView, opts?: { pillar?: Pillar; settingsTab?: SettingsTab }) => {
    if (isOnAdminPage) {
      const params = new URLSearchParams({ view });
      if (opts?.pillar) params.set('pillar', opts.pillar);
      if (opts?.settingsTab) params.set('settingsTab', opts.settingsTab);
      window.location.href = `/?${params.toString()}`;
    } else {
      setView(view);
      if (opts?.pillar) setPillar(opts.pillar);
      if (opts?.settingsTab) setSettingsTab(opts.settingsTab);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          window.location.href = json.url;
        }
      }
    } catch { /* ignore */ }
  };

  // ── Éditer: opens the data editing interface directly ──
  // Selects the first data source automatically so the DataTable is visible
  const handleEdit = () => {
    // Auto-select first data source if none is selected
    if (!useAppStore.getState().activeDataSourceId && dataSources.length > 0) {
      setActiveDataSourceId(dataSources[0].id);
    }
    navigateTo('builder', { pillar: 'data' });
  };

  // ── Google Sheets: connection/configuration only ──
  // If not connected → OAuth flow
  // If connected → navigate to Settings > Admin tab to manage Google OAuth credentials
  const handleGoogleSheets = () => {
    if (!googleSession) {
      handleConnectGoogle();
    } else {
      // Navigate to Settings > Admin tab where Google OAuth config lives
      navigateTo('builder', { pillar: 'settings', settingsTab: 'admin' });
    }
  };

  // ── Gestion des administrateurs: directly to Settings > Admin tab ──
  const handleAdminManagement = () => {
    navigateTo('builder', { pillar: 'settings', settingsTab: 'admin' });
  };

  // ── Quick access cards ──
  const cards = [
    {
      title: 'Données',
      description: 'Sources de données, colonnes, import Google Sheets',
      icon: Database,
      action: () => navigateTo('builder', { pillar: 'data' }),
      color: BRAND.vertFonce,
    },
    {
      title: 'Mise en page',
      description: 'Sections, configuration du catalogue, organisation visuelle',
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
      title: googleSession ? 'Google Sheets' : 'Connexion Google',
      description: googleSession
        ? 'Gérer la connexion Google Drive/Sheets'
        : 'Lier votre compte Google pour importer des feuilles',
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B, #C9A84C)' }}>
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

          {/* Quick link to catalog preview */}
          <Link
            href="/?view=preview"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
            style={{ color: BRAND.vertFonce }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Catalogue</span>
          </Link>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          {cards.map(card => (
            <button
              key={card.title}
              onClick={card.action}
              className="bg-white rounded-xl p-4 sm:p-5 border text-left hover:shadow-md transition-all duration-200 group cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.05)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${card.color}10` }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <h3 className="font-semibold text-sm mb-0.5" style={{ color: BRAND.noir }}>{card.title}</h3>
              <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed line-clamp-2">{card.description}</p>
            </button>
          ))}
        </div>

        {/* ── Admin Management ── */}
        {admin.role === 'owner' && (
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Administration</h2>
            <button
              onClick={handleAdminManagement}
              className="w-full bg-white rounded-xl p-4 sm:p-5 border text-left hover:shadow-md transition-all duration-200 flex items-center gap-4 cursor-pointer"
              style={{ borderColor: 'rgba(0,0,0,0.05)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.bordeaux}10` }}>
                <Shield className="w-5 h-5" style={{ color: BRAND.bordeaux }} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm" style={{ color: BRAND.noir }}>Gestion des administrateurs</h3>
                <p className="text-[11px] text-gray-500">{stats?.admins ?? 0} administrateur(s) · Ajouter, modifier, supprimer</p>
              </div>
            </button>
          </div>
        )}

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
