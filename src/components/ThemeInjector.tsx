'use client';

import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEME_DEFAULTS } from '@/lib/theme.config';
import type { ThemePivots, ThemeExceptions } from '@/lib/theme.config';

/**
 * ThemeInjector — Fetches theme settings from DB and passes to ThemeProvider.
 * This is the bridge between the database and the CSS variable injection.
 * Separated from layout.tsx to keep layout as a server component.
 */
export function ThemeInjector() {
  const [themeData, setThemeData] = useState<{
    pivots: ThemePivots;
    exceptions: ThemeExceptions;
    customCSS: string;
  } | null>(null);

  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch('/api/catalog/settings');
        if (res.ok) {
          const { data } = await res.json();
          if (data) {
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
            });
          }
        }
      } catch {
        // Use defaults on error — globals.css provides fallbacks
      }
    }
    loadTheme();
  }, []);

  if (!themeData) return null;

  return (
    <ThemeProvider
      pivots={themeData.pivots}
      exceptions={themeData.exceptions}
      customCSS={themeData.customCSS}
    />
  );
}
