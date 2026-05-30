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
