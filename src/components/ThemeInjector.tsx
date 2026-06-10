'use client';

import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEME_DEFAULTS } from '@/lib/theme.config';
import type { ThemePivots, ThemeExceptions } from '@/lib/theme.config';

/**
 * ThemeInjector — Fetches theme settings from DB and passes to ThemeProvider.
 * This is the bridge between the database and the CSS variable injection.
 * Separated from layout.tsx to keep layout as a server component.
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
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch theme data whenever refreshKey changes (initial load + updates)
  useEffect(() => {
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
            });
          }
        }
      } catch {
        // Use defaults on error — globals.css provides fallbacks
      }
    }
    fetchTheme();
    return () => { cancelled = true; };
  }, [refreshKey]);

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
