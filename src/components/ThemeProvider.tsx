'use client';

import { useEffect, useRef, useCallback } from 'react';
import { computeThemeVariables, computeClientVariables, THEME_DEFAULTS } from '@/lib/theme.config';
import type { ThemePivots, ThemeExceptions } from '@/lib/theme.config';

interface ThemeProviderProps {
  /** Pivot colors from CatalogSettings */
  pivots: Partial<ThemePivots> | null;
  /** Exception colors from CatalogSettings */
  exceptions: Partial<ThemeExceptions> | null;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Client-side overrides for --client-* variables */
  clientOverrides?: Record<string, string> | null;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * ACTIVE THEME PROVIDER — v2 (Admin/Client Separation)
 * ═══════════════════════════════════════════════════════════════
 * Reads 7 editable colors from DB → computes ~85 admin CSS vars
 * + ~45 client CSS vars (--client-* namespace)
 * → injects ALL into :root via document.documentElement.style
 *
 * Client vars inherit from admin vars by default (auto mode),
 * but can be overridden individually via clientOverrides (custom mode).
 */
export function ThemeProvider({ pivots, exceptions, customCSS, clientOverrides }: ThemeProviderProps) {
  const styleElRef = useRef<HTMLStyleElement | null>(null);

  const injectTheme = useCallback(() => {
    // 1. Compute admin-derived variables
    const adminVars = computeThemeVariables(pivots || {}, exceptions || {});

    // 2. Compute client variables (auto/custom inheritance)
    const clientVars = computeClientVariables(adminVars, clientOverrides || null);

    // 3. Merge all variables
    const allVars = { ...adminVars, ...clientVars };

    // Build CSS text for injection into :root
    let cssText = ':root {\n';
    for (const [key, value] of Object.entries(allVars)) {
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
    for (const [key, value] of Object.entries(allVars)) {
      root.style.setProperty(key, value);
    }
  }, [pivots, exceptions, customCSS, clientOverrides]);

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
  exceptions: Partial<ThemeExceptions>,
  clientOverrides?: Record<string, string> | null
): string {
  const adminVars = computeThemeVariables(pivots, exceptions);
  const clientVars = computeClientVariables(adminVars, clientOverrides || null);
  const allVars = { ...adminVars, ...clientVars };

  let css = ':root {\n';
  for (const [key, value] of Object.entries(allVars)) {
    css += `  ${key}: ${value};\n`;
  }
  css += '}\n';
  return css;
}
