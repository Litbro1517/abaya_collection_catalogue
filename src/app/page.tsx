'use client';

import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { BuilderShell } from '@/components/BuilderShell';
import { CatalogPreview } from '@/components/preview/CatalogPreview';
import { LoginModal } from '@/components/LoginModal';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const {
    view,
    isAdmin,
    setIsAdmin,
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
          if (json.authenticated) {
            setIsAdmin(true);
          }
        }
      } catch {
        // Not authenticated — that's fine, public visitor
      }
    };
    checkAuth();
  }, [setIsAdmin]);

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

  // Handle Google OAuth callback (if redirected back with code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code) {
      const handleOAuthCallback = async () => {
        try {
          const res = await fetch('/api/google/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              setGoogleSession({
                id: json.data.id,
                email: json.data.email,
                name: json.data.name,
                picture: json.data.picture,
                scope: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        } catch {
          // OAuth callback failed
        } finally {
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      };
      handleOAuthCallback();
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
        onLoginSuccess={() => {
          setIsAdmin(true);
          setShowLogin(false);
        }}
        onCancel={() => setShowLogin(false)}
      />
    );
  }

  // Default: Catalog preview (public + admin)
  return <CatalogPreview onAdminLogin={() => setShowLogin(true)} />;
}
