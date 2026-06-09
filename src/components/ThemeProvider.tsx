'use client';

import { useEffect, useRef, useCallback } from 'react';
import { computeThemeVariables, THEME_DEFAULTS } from '@/lib/theme.config';
import type { ThemePivots, ThemeExceptions } from '@/lib/theme.config';

interface ThemeProviderProps {
  /** Pivot colors from CatalogSettings */
  pivots: Partial<ThemePivots> | null;
  /** Exception colors from CatalogSettings */
  exceptions: Partial<ThemeExceptions> | null;
  /** Custom CSS to inject */
  customCSS?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * ACTIVE THEME PROVIDER
 * ═══════════════════════════════════════════════════════════════
 * Reads 7 editable colors from DB → computes ~85 derived CSS vars
 * → injects ALL into :root via document.documentElement.style
 *
 * This ensures EVERY color in the app is driven by the Theme Panel.
 */
export function ThemeProvider({ pivots, exceptions, customCSS }: ThemeProviderProps) {
  const styleElRef = useRef<HTMLStyleElement | null>(null);

  const injectTheme = useCallback(() => {
    const vars = computeThemeVariables(pivots || {}, exceptions || {});

    // Build CSS text for injection into :root
    let cssText = ':root {\n';
    for (const [key, value] of Object.entries(vars)) {
      cssText += `  ${key}: ${value};\n`;
    }
    cssText += '}\n';

    // Add custom CSS if provided
    if (customCSS?.trim()) {
      cssText += `\n/* Custom CSS */\n${customCSS}\n`;
    }

    // Inject or update the <style> tag
    if (!styleElRef.current) {
      const el = document.createElement('style');
      el.id = 'active-theme-override';
      el.textContent = cssText;
      document.head.appendChild(el);
      styleElRef.current = el;
    } else {
      styleElRef.current.textContent = cssText;
    }

    // Also set individual CSS custom properties on :root for immediate access
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, [pivots, exceptions, customCSS]);

  useEffect(() => {
    injectTheme();
  }, [injectTheme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (styleElRef.current) {
        styleElRef.current.remove();
        styleElRef.current = null;
      }
    };
  }, []);

  return null; // No DOM output — pure side effect
}

/**
 * Server-side helper: generates the CSS variables as a style string
 * for initial SSR render (prevents flash of wrong colors)
 */
export function generateThemeCSS(
  pivots: Partial<ThemePivots>,
  exceptions: Partial<ThemeExceptions>
): string {
  const vars = computeThemeVariables(pivots, exceptions);
  let css = ':root {\n';
  for (const [key, value] of Object.entries(vars)) {
    css += `  ${key}: ${value};\n`;
  }
  css += '}\n';
  return css;
}
