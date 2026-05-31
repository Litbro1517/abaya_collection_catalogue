'use client';

import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { BuilderShell } from '@/components/BuilderShell';
import { CatalogPreview } from '@/components/preview/CatalogPreview';
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

  // Check auth on mount (non-blocking — catalog loads regardless)
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
        // Not authenticated — fine for public visitors
      }
    };
    checkAuth();
  }, [setIsAdmin]);

  // Check Google session on mount (admin-only feature)
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
        // No Google session — fine for public visitors
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

  // Load initial data (catalog is public — always needed)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load data sources (admin feature, but harmless to preload)
      const dsRes = await fetch('/api/datasources');
      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        if (dsJson.data) {
          setDataSources(dsJson.data);
        }
      }

      // Load catalog — always needed for public view
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

  // ── PUBLIC VISITOR: show catalog preview (never a login wall) ──
  // Admin sees builder by default; visitors always see the catalog.
  if (!isAdmin) {
    return <CatalogPreview />;
  }

  // Admin mode: toggle between builder and preview
  if (view === 'preview') {
    return <CatalogPreview />;
  }

  return <BuilderShell />;
}
