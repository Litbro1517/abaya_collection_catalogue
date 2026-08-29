'use client';

import { useEffect, useCallback, useState, useRef, ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { CatalogPreview } from '@/components/preview/CatalogPreview';
import { useClientTranslation } from '@/lib/i18n';
import {
  readCache,
  writeCache,
  sanitizeCatalog,
  sanitizeDatasources,
  isCacheFresh,
  CACHE_KEYS,
} from '@/lib/cache';
import type { Catalog, DataSource } from '@/types';

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
    const { t } = useClientTranslation();

    if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold">{fallbackTitle}</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {error.message || t('error.unexpected')}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
          >
            <RefreshCw className="w-4 h-4" /> {t('error.reload')}
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

// ── Module-level cache hydration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Runs ONCE when the JS bundle loads, BEFORE React hydration.
// Populates Zustand directly — by the time components render, data is ready.
// This eliminates the blocking spinner on all subsequent page loads.
let _cacheHydrated = false;
if (typeof window !== 'undefined' && !_cacheHydrated) {
  _cacheHydrated = true;
  try {
    const cachedCatalog = readCache(CACHE_KEYS.catalog);
    const cachedDatasources = readCache(CACHE_KEYS.datasources);
    if (cachedCatalog) {
      useAppStore.getState().setCatalog(cachedCatalog as any);
      if ((cachedCatalog as any)?.settings) {
        useAppStore.getState().setSettings((cachedCatalog as any).settings);
      }
    }
    if (cachedDatasources) {
      useAppStore.getState().setDataSources(cachedDatasources as any);
    }
    // ━━━ Admin state hydration — instant restore, 0 network fetch ━━━
    const adminStateRaw = localStorage.getItem('abaya_admin_state');
    if (adminStateRaw) {
      const adminState = JSON.parse(adminStateRaw);
      // Only restore if less than 24h old (session cookie likely still valid)
      if (Date.now() - adminState.timestamp < 24 * 60 * 60 * 1000) {
        if (adminState.isAdmin) useAppStore.getState().setIsAdmin(true);
        if (adminState.adminUser) useAppStore.getState().setAdminUser(adminState.adminUser);
        if (adminState.googleSession) useAppStore.getState().setGoogleSession(adminState.googleSession);
      } else {
        // Stale admin state — clear it
        localStorage.removeItem('abaya_admin_state');
      }
    }

    // ━━━ Public-catalog override when returning from /merci ━━━━━━━━━━━━
    // The Thank You page back button (href="/") sets a sessionStorage flag
    // to signal that the visitor wants the PUBLIC catalog, even if they happen
    // to be authenticated as an admin. Without this, an admin's restored
    // `isAdmin: true` combined with the default Zustand `view: 'builder'`
    // would hijack the navigation into the admin BuilderShell on first render
    // (before useEffect has a chance to read URL params).
    // We read AND clear the flag here so it only applies to the immediate
    // return trip, not to subsequent navigations.
    try {
      if (sessionStorage.getItem('merci_return') === '1') {
        sessionStorage.removeItem('merci_return');
        useAppStore.getState().setView('preview');
      }
    } catch {
      // sessionStorage unavailable (private mode, etc.) — skip override
    }
  } catch {
    // Cache hydration failure — will fall back to network
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────

// ━━ Lot 2: SSR Props ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The server component (src/app/page.tsx) now fetches catalog + datasources
// via Prisma and passes them as initial props. These hydrate the Zustand
// store BEFORE first paint, so the catalog HTML is present in the SSR
// response (no "Chargement..." spinner). After hydration, the client-side
// cache-first logic revalidates the data (FROZEN_MODE) as before.
interface HomeClientProps {
  initialCatalog?: Catalog | null;
  initialDatasources?: DataSource[];
}

function HomeContent({ initialCatalog, initialDatasources }: HomeClientProps) {
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
    googleSession,
    setGoogleSession,
    setView,
    setPillar,
    setSettingsTab,
  } = useAppStore();
  const settings = useAppStore(s => s.settings);
  const clientLocale = useAppStore(s => s.clientLocale);
  const setClientLocale = useAppStore(s => s.setClientLocale);

  // ━━ Lot 2: Hydrate Zustand store from SSR props on first render ━━━━━━━
  // This runs synchronously on the FIRST client render (before paint), so the
  // store is populated with SSR data when React hydrates — no loading spinner.
  // We use a ref guard to only run once, and we do NOT call setCatalog inside
  // a useEffect (that would cause a flash). Instead we hydrate during render
  // via useMemo/useRef on the initial props.
  const ssrHydrated = useRef(false);
  if (!ssrHydrated.current) {
    ssrHydrated.current = true;
    // Only hydrate if store is empty (no localStorage cache already loaded at
    // module level). This prevents SSR data from overriding a fresher client
    // cache after the module-level hydration already ran.
    const currentState = useAppStore.getState();
    if (initialCatalog && !currentState.catalog) {
      currentState.setCatalog(initialCatalog);
      if (initialCatalog.settings) currentState.setSettings(initialCatalog.settings);
    }
    if (initialDatasources && initialDatasources.length > 0 && currentState.dataSources.length === 0) {
      currentState.setDataSources(initialDatasources);
    }
  }

  // ── Seed visitor locale from DB default (first visit only) ──
  // If the visitor has no localStorage AND no cookie (truly first visit),
  // and the admin configured a non-FR default, seed clientLocale from it.
  // This runs ONCE per session, after settings are hydrated.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!settings?.defaultCatalogLanguage) return;
    seededRef.current = true;
    const hasPreference = typeof window !== 'undefined'
      && (localStorage.getItem('abaya_clientLocale') || document.cookie.match(/abaya_locale=/));
    if (hasPreference) return;
    const dbDefault = settings.defaultCatalogLanguage;
    if (['fr', 'en', 'ar'].includes(dbDefault) && dbDefault !== clientLocale) {
      setClientLocale(dbDefault);
    }
  }, [settings?.defaultCatalogLanguage, clientLocale, setClientLocale]);

  const { t } = useClientTranslation();

  // ━━━ Offline-First: Skip spinner if cache was hydrated at module level ━━━
  // If catalog or datasources exist in Zustand (from cache hydration), no spinner needed.
  const catalogFromStore = useAppStore(s => s.catalog);
  const datasourcesFromStore = useAppStore(s => s.dataSources);
  const hasCachedData = !!(catalogFromStore || datasourcesFromStore.length > 0);

  const [initializing, setInitializing] = useState(!hasCachedData);
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
    if (pillarParam && ['data', 'layout', 'settings', 'orders', 'landing-pages'].includes(pillarParam)) {
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

  // ━━━ PHASE 1: Auth locked — NO automatic fetch on mount ━━━━━━━━━━━
  // Admin state is hydrated from localStorage at module level (instant, 0ms).
  // Public visitors get 0 auth fetch. Returning admins are restored instantly.
  //
  // Lazy session verification: ONLY if admin was restored from cache,
  // verify the session is still valid server-side (non-blocking, background).
  // If session expired → gracefully clear admin state.
  useEffect(() => {
    // Skip verification for public visitors (isAdmin=false after hydration)
    if (!isAdmin) return;
    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth');
        if (res.ok) {
          const json = await res.json();
          if (json.authenticated && json.admin) {
            // Session still valid — update admin user info
            setAdminUser(json.admin);
          } else {
            // Session expired — clear admin state gracefully
            setIsAdmin(false);
            setAdminUser(null);
            localStorage.removeItem('abaya_admin_state');
          }
        } else {
          // Auth endpoint error — session likely expired
          setIsAdmin(false);
          setAdminUser(null);
          localStorage.removeItem('abaya_admin_state');
        }
      } catch {
        // Network error — keep current admin state (offline-first)
      }
    };
    verifySession();
  }, []);

  // ━━━ Re-validate Google session on mount (if restored from localStorage) ━━━
  // Prevents "ghost connected" state where the DB session was deleted
  // (by another admin, token revocation, etc.) but localStorage still has it.
  // Uses a ref to read the initial value — runs ONCE on mount only.
  const googleSessionRef = useRef(googleSession);
  googleSessionRef.current = googleSession;

  useEffect(() => {
    // Read from ref to avoid dependency on googleSession (prevents re-trigger loops)
    if (!googleSessionRef.current) return;
    const verifyGoogleSession = async () => {
      try {
        const res = await fetch('/api/google/session');
        if (res.ok) {
          const json = await res.json();
          if (json.data?.connected) {
            // Session still valid — update with fresh data
            setGoogleSession({
              id: json.data.id,
              email: json.data.email,
              name: json.data.name,
              picture: json.data.picture,
              scope: json.data.scope || '',
              createdAt: json.data.createdAt,
              updatedAt: json.data.updatedAt,
            });
          } else {
            // Session no longer valid in DB — clear ghost state
            setGoogleSession(null);
          }
        } else {
          // API error — session likely gone
          setGoogleSession(null);
        }
      } catch {
        // Network error — keep current state (offline-first)
      }
    };
    verifyGoogleSession();
  }, []);

  // ━━━ Persist admin state to localStorage on change ━━━
  useEffect(() => {
    if (isAdmin && adminUser) {
      localStorage.setItem('abaya_admin_state', JSON.stringify({
        isAdmin: true,
        adminUser: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: adminUser.role },
        googleSession: useAppStore.getState().googleSession || null,
        timestamp: Date.now(),
      }));
    } else if (!isAdmin) {
      localStorage.removeItem('abaya_admin_state');
    }
  }, [isAdmin, adminUser]);

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

  // ━━━ Cache-first data loading (FROZEN MODE) ━━━━━━━━━━━━━━━━━━━━━━━━━
  // FROZEN_MODE: isCacheFresh() returns true whenever data exists (no TTL expiry).
  // Network fetch only happens on FIRST visit (no cache) or after admin Force Refresh.
  // This eliminates the "silent sync" that re-fetched every 2 minutes.
  const loadData = useCallback(async () => {
    // ── If BOTH catalog and datasources are fresh, skip network fetch entirely ──
    const catalogFresh = isCacheFresh(CACHE_KEYS.catalog);
    const dsFresh = isCacheFresh(CACHE_KEYS.datasources);
    if (catalogFresh && dsFresh && hasCachedData) {
      setInitializing(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Always fetch both — catalog/datasources are admin-modifiable (2min TTL)
      // so we re-validate on every page load within the TTL window
      const [dsRes, catRes] = await Promise.all([
        fetch('/api/datasources'),
        fetch('/api/catalog'),
      ]);
      const [dsJson, catJson] = await Promise.all([
        dsRes.ok ? dsRes.json() : Promise.resolve(null),
        catRes.ok ? catRes.json() : Promise.resolve(null),
      ]);
      if (dsJson?.data) {
        setDataSources(dsJson.data);
        writeCache(CACHE_KEYS.datasources, dsJson.data, sanitizeDatasources);
      }
      if (catJson?.data) {
        setCatalog(catJson.data);
        if (catJson.data.settings) setSettings(catJson.data.settings);
        writeCache(CACHE_KEYS.catalog, catJson.data, sanitizeCatalog);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }, [setDataSources, setCatalog, setSettings, setLoading, hasCachedData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show loading screen ONLY on first visit (no cache)
  if (initializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-gold animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">{t('catalog.loading')}</p>
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

export default function HomeClient(props: HomeClientProps = {}) {
  return <HomeContent {...props} />;
}
