'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { BuilderShell } from '@/components/BuilderShell';
import { CatalogPreview } from '@/components/preview/CatalogPreview';
import { LoginModal } from '@/components/LoginModal';

export default function Home() {
  const {
    view,
    isAdmin,
    setIsAdmin,
    pillar,
    setDataSources,
    setCatalog,
    setSettings,
    setLoading,
    setGoogleSession,
  } = useAppStore();

  // Check auth on mount
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
        // Not authenticated
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

  // Load initial data
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
    }
  }, [setDataSources, setCatalog, setSettings, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show login if not admin
  if (!isAdmin) {
    return <LoginModal />;
  }

  // Preview mode
  if (view === 'preview') {
    return <CatalogPreview />;
  }

  // Builder mode
  return <BuilderShell />;
}
