'use client';

import { useEffect, useCallback, useState, ComponentType } from 'react';
import { useAppStore } from '@/lib/store';
import { BuilderShell } from '@/components/BuilderShell';
import { CatalogPreview } from '@/components/preview/CatalogPreview';
import { LoginModal } from '@/components/LoginModal';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    setIsAdmin,
    setAdminUser,
    setDataSources,
    setCatalog,
    setSettings,
    setLoading,
    setGoogleSession,
  } = useAppStore();

  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

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
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load data sources
      const dsRes = await fetch('/api/datasources');
      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        if (dsJson.data) {
          setDataSources(dsJson.data);
        }
      }

      // Load catalog
      const catRes = await fetch('/api/catalog');
      if (catRes.ok) {
        const catJson = await catRes.json();
        if (catJson.data) {
          setCatalog(catJson.data);
          if (catJson.data.settings) {
            setSettings(catJson.data.settings);
          }
        }
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

  // Admin builder mode — only for authenticated admins
  if (isAdmin && view === 'builder') {
    return <BuilderShell />;
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
