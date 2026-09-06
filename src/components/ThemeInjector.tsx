'use client';

import { useEffect, useRef, useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEME_DEFAULTS } from '@/lib/theme.config';
import type { ThemePivots, ThemeExceptions } from '@/lib/theme.config';
import { isRTL, type Locale } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

/**
 * ThemeInjector — Fetches theme settings from DB and passes to ThemeProvider.
 * This is the bridge between the database and the CSS variable injection.
 * Separated from layout.tsx to keep layout as a server component.
 *
 * Also handles:
 * - Language/direction: Sets `dir` and `lang` on <html> for RTL support
 * - Currency: Not injected here (use useTranslation hook in components)
 *
 * Listens for 'theme-updated' custom events to re-fetch settings
 * when the admin saves changes in the Style panel (live preview).
 */
export function ThemeInjector() {
  const [themeData, setThemeData] = useState<{
    pivots: ThemePivots;
    exceptions: ThemeExceptions;
    customCSS: string;
    clientOverrides: Record<string, string> | null;
    language: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch theme data whenever refreshKey changes (initial load + updates)
  // ━━ MANDAT 4P — TBT Fix D: Skip fetch for public catalog ━━
  // Le thème est maintenant injecté en SSR (layout.tsx <style>) — le fetch
  // client-side est redondant pour le visiteur public. Il reste nécessaire
  // pour l'admin (live-preview des changements de thème via SettingsPillar).
  // Skip pour le public = -1 requête réseau + 0 re-render post-hydratation
  // (les 8 animations non composées du rapport PSI étaient causées par le
  // changement de couleurs post-hydratation).
  const isAdmin = useAppStore(s => s.isAdmin);
  useEffect(() => {
    // Public visitor: theme is SSR-injected, skip fetch
    if (!isAdmin) return;
    let cancelled = false;
    async function fetchTheme() {
      try {
        const res = await fetch('/api/catalog/settings');
        if (res.ok && !cancelled) {
          const { data } = await res.json();
          if (data && !cancelled) {
            setThemeData({
              pivots: {
                primaryColor: data.primaryColor || THEME_DEFAULTS.primaryColor,
                secondaryColor: data.secondaryColor || THEME_DEFAULTS.secondaryColor,
                accentColor: data.accentColor || THEME_DEFAULTS.accentColor,
                backgroundColor: data.backgroundColor || THEME_DEFAULTS.backgroundColor,
              },
              exceptions: {
                brandGreenColor: data.brandGreenColor || THEME_DEFAULTS.brandGreenColor,
                destructiveColor: data.destructiveColor || THEME_DEFAULTS.destructiveColor,
                borderColor: data.borderColor || THEME_DEFAULTS.borderColor,
              },
              customCSS: data.customCSS || '',
              clientOverrides: data.clientOverrides || null,
              language: data.language || 'fr',
            });
          }
        }
      } catch {
        // Use defaults on error — globals.css provides fallbacks
      }
    }
    fetchTheme();
    return () => { cancelled = true; };
  }, [refreshKey, isAdmin]);

  // ── Apply dir and lang to <html> when language changes ──
  // For the public catalog (preview view), use clientLocale;
  // for admin views, use the admin settings.language.
  const clientLocale = useAppStore(s => s.clientLocale);
  const view = useAppStore(s => s.view);
  // ━━ MANDAT 4P — FIX CLS : marqueur du premier run (fenêtre pré-seed) ━━
  const firstDirRunRef = useRef(true);

  useEffect(() => {
    // Determine which locale to use:
    // - For non-admin users (always seeing catalog) → clientLocale
    // - For admin in preview mode → clientLocale
    // - For admin in builder/dashboard → admin settings.language
    const isAdmin = useAppStore.getState().isAdmin;
    const effectiveLocale = (!isAdmin || view === 'preview')
      ? (clientLocale as Locale) || 'fr'
      : (themeData?.language as Locale) || 'fr';

    const html = document.documentElement;

    // ━━ MANDAT 4P — FIX CLS : garde pré-seed ━━
    // Depuis le fix CLS, le layout SSR rend `lang`/`dir` depuis le défaut BDD
    // (defaultCatalogLanguage, ex. 'ar') et un script inline no-flash applique
    // la préférence visiteur avant le premier paint. Pour un visiteur SANS
    // préférence, le store démarre encore à clientLocale='fr' (module-init) et
    // le seed HomeClient ne le passera à 'ar' qu'après hydratation. Si cet
    // effet tournait AVANT le seed avec la valeur d'init 'fr', il écraserait
    // le dir=rtl SSR → double flip → CLS. Garde : si la locale effective est
    // encore la valeur d'init 'fr' MAIS que le SSR a posé une autre langue
    // (html.lang ≠ 'fr'), on n'écrase pas — le seed (ou la préférence réelle)
    // déclenchera le re-run de cet effet avec la valeur correcte.
    // IMPORTANT : cette garde ne s'applique qu'au PREMIER run (hydratation).
    // Les runs suivants = interactions utilisateur réelles (sélecteur de langue,
    // seed, admin) → toujours appliquées — sinon la sélection FR d'un visiteur
    // sur une page SSR-ar serait bloquée (régression fonctionnelle).
    if (firstDirRunRef.current) {
      firstDirRunRef.current = false;
      if ((!isAdmin || view === 'preview') && effectiveLocale === 'fr' && html.lang !== 'fr') return;
    }

    const rtl = isRTL(effectiveLocale);

    html.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    html.setAttribute('lang', effectiveLocale);

    // Add/remove RTL class for CSS targeting
    if (rtl) {
      html.classList.add('rtl');
    } else {
      html.classList.remove('rtl');
    }
  }, [themeData?.language, clientLocale, view]);

  // Listen for theme-updated events (from SettingsPillar save)
  useEffect(() => {
    function handleThemeUpdate() {
      setRefreshKey(k => k + 1);
    }
    window.addEventListener('theme-updated', handleThemeUpdate);
    return () => window.removeEventListener('theme-updated', handleThemeUpdate);
  }, []);

  if (!themeData) return null;

  return (
    <ThemeProvider
      pivots={themeData.pivots}
      exceptions={themeData.exceptions}
      customCSS={themeData.customCSS}
      clientOverrides={themeData.clientOverrides}
    />
  );
}
