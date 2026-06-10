'use client';

import { useEffect, useCallback, useState, ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { CatalogPreview } from '@/components/preview/CatalogPreview';

// ── Code Splitting: Admin components lazy-loaded ──
// These are ONLY needed for authenticated admins, never for public visitors.
// dynamic() with ssr:false ensures zero admin code in the public bundle.
const BuilderShell = dynamic(
  () => import('@/components/BuilderShell').then(m => m.BuilderShell),
  { ssr: false, loading: () => null }
);
const AdminDashboard = dynamic(
  () => import('@/components/admin/AdminDashboard').then(m => m.AdminDashboard),
  { ssr: false, loading: () => null }
);
const LoginModal = dynamic(
  () => import('@/components/LoginModal').then(m => m.LoginModal),
  { ssr: false, loading: () => null }
);
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Pillar, AppView, SettingsTab } from '@/types';

// ── Error Boundary Wrapper ────────────────────────────────────────────────
function withErrorBoundary<P extends object>(Component: ComponentType<P>, fallbackTitle: string) {
  return function ErrorBoundaried(props: P) {
    const [error, setError] = useState<Error | null>(null);

    if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold">{fallbackTitle}</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {error.message || 'Une erreur inattendue s\'est produite.'}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4" /> Recharger la page
          </Button>
        </div>
      );
    }

    try {
      return <Component {...props} />;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────

function HomeContent() {
  const {
    view,
    isAdmin,
    adminUser,
    setIsAdmin,
    setAdminUser,
    setDataSources,
    setCatalog,
    setSettings,
    setLoading,
    setGoogleSession,
    setView,
    setPillar,
    setSettingsTab,
  } = useAppStore();

  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // ── Read URL params and set Zustand state on mount ──
  // This allows navigation from /admin via ?view=builder&pillar=data&settingsTab=admin etc.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as AppView | null;
    const pillarParam = params.get('pillar') as Pillar | null;
    const settingsTabParam = params.get('settingsTab') as SettingsTab | null;
    const openSheets = params.get('openSheets');

    if (viewParam && ['builder', 'preview', 'dashboard'].includes(viewParam)) {
      setView(viewParam);
    }
    if (pillarParam && ['data', 'layout', 'settings'].includes(pillarParam)) {
      setPillar(pillarParam);
    }
    if (settingsTabParam && ['general', 'appearance', 'conversion', 'display', 'admin'].includes(settingsTabParam)) {
      setSettingsTab(settingsTabParam);
    }

    // Auto-open Google Sheets browser when navigating from Dashboard
    if (openSheets === 'true') {
      // Small delay to ensure the DataPillar has mounted
      setTimeout(() => {
        useAppStore.getState().setShowGoogleSheetsBrowser(true);
      }, 300);
    }

    // Clean up URL params after reading them
    if (viewParam || pillarParam || settingsTabParam || openSheets) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setView, setPillar, setSettingsTab]);

  // Check auth on mount (non-blocking — catalog is always visible)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth');
        if (res.ok) {
          const json = await res.json();
          if (json.authenticated && json.admin) {
            setIsAdmin(true);
            setAdminUser(json.admin);
          }
        }
      } catch {
        // Not authenticated — that's fine, public visitor
      }
    };
    checkAuth();
  }, [setIsAdmin, setAdminUser]);

  // Check Google session on mount
  useEffect(() => {
    const checkGoogleSession = async () => {
      try {
        const res = await fetch('/api/google/session');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.connected) {
            setGoogleSession({
              id: json.data.id,
              email: json.data.email,
              name: json.data.name,
              picture: json.data.picture,
              scope: json.data.scope || '',
              createdAt: json.data.createdAt,
              updatedAt: json.data.updatedAt,
            });
          }
        }
      } catch {
        // No Google session
      }
    };
    checkGoogleSession();
  }, [setGoogleSession]);

  // Handle Google OAuth callback redirect from server
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleConnected = params.get('google_connected');
    const googleError = params.get('google_error');

    if (googleConnected === 'true') {
      const googleAdmin = params.get('admin');

      // Server already handled token exchange and stored session
      // Fetch the session from the API to update the UI
      const fetchGoogleSession = async () => {
        try {
          const res = await fetch('/api/google/session');
          if (res.ok) {
            const json = await res.json();
            if (json.data?.connected) {
              setGoogleSession({
                id: json.data.id,
                email: json.data.email,
                name: json.data.name,
                picture: json.data.picture,
                scope: json.data.scope || '',
                createdAt: json.data.createdAt,
                updatedAt: json.data.updatedAt,
              });
            }
          }
        } catch {
          // Failed to fetch session
        }

        // If Google login also granted admin access, set admin state
        if (googleAdmin === 'true') {
          setIsAdmin(true);
          try {
            const authRes = await fetch('/api/auth');
            if (authRes.ok) {
              const authJson = await authRes.json();
              if (authJson.admin) setAdminUser(authJson.admin);
            }
          } catch {
            // Failed to fetch admin info
          }
        }

        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      };
      fetchGoogleSession();
    } else if (googleError) {
      // Show error and clean up URL
      console.error('Google OAuth error:', googleError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setGoogleSession]);

  // Load initial data (always, for both public and admin)
  // Promise.all: both requests fire simultaneously → ~2× faster than sequential
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dsRes, catRes] = await Promise.all([
        fetch('/api/datasources'),
        fetch('/api/catalog'),
      ]);
      const [dsJson, catJson] = await Promise.all([
        dsRes.ok ? dsRes.json() : Promise.resolve(null),
        catRes.ok ? catRes.json() : Promise.resolve(null),
      ]);
      if (dsJson?.data) setDataSources(dsJson.data);
      if (catJson?.data) {
        setCatalog(catJson.data);
        if (catJson.data.settings) setSettings(catJson.data.settings);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, [setDataSources, setCatalog, setSettings, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show loading screen while initializing
  if (initializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-gold animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  // Admin builder mode — only for authenticated admins with owner/admin role
  const canAccessBuilder = isAdmin && adminUser && (adminUser.role === 'owner' || adminUser.role === 'admin' || adminUser.role === 'super_admin');
  if (canAccessBuilder && view === 'builder') {
    return <BuilderShell />;
  }

  // Admin dashboard — central navigation hub
  if (canAccessBuilder && view === 'dashboard' && adminUser) {
    return <AdminDashboard admin={adminUser} />;
  }

  // Login modal overlay — only when explicitly requested
  if (showLogin && !isAdmin) {
    return (
      <LoginModal
        onLoginSuccess={async () => {
          setIsAdmin(true);
          setShowLogin(false);
          // Fetch admin user info
          try {
            const authRes = await fetch('/api/auth');
            if (authRes.ok) {
              const authJson = await authRes.json();
              if (authJson.admin) setAdminUser(authJson.admin);
            }
          } catch {
            // Failed to fetch admin info
          }
        }}
        onCancel={() => setShowLogin(false)}
      />
    );
  }

  // Default: Catalog preview (public + admin)
  return <CatalogPreview onAdminLogin={() => setShowLogin(true)} />;
}

export default function Home() {
  return <HomeContent />;
}
