'use client';

import { useEffect, useState } from 'react';

/**
 * MANDAT 4P — Fix TTFB : déplacer la lecture de la locale hors du Server Component.
 *
 * Problème : `await headers()` dans layout.tsx est une Dynamic API sous Next 16.
 * Elle force le rendu dynamique de TOUTES les routes (ƒ Dynamic), neutralisant
 * l'ISR (revalidate=300) → TTFB 2.2-5.7s + x-vercel-cache: MISS.
 *
 * Solution : ce Client Component lit la préférence navigateur après hydratation
 * et applique `lang`/`dir` sur <html>. Le Server Component layout.tsx n'utilise
 * plus `headers()` → l'ISR devient actif → TTFB < 0.5s.
 *
 * ━━ MANDAT 4P — FIX CLS (post-É12) : alignement des priorités ━━
 * Depuis le fix CLS, le layout SSR rend déjà `lang`/`dir` depuis le défaut BDD
 * (defaultCatalogLanguage) et un script inline no-flash dans <head> applique la
 * préférence visiteur (localStorage > cookie) AVANT le premier paint.
 * Ce composant reste le filet de sécurité post-hydration : il résout la locale
 * avec la MÊME priorité que le store (localStorage `abaya_clientLocale` >
 * cookie `abaya_locale`) pour rester idempotent avec le script no-flash —
 * sinon un visiteur avec localStorage=fr + cookie=ar aurait un re-flip
 * post-hydration (source de CLS résiduelle).
 * Si aucune préférence n'existe, il ne fait RIEN (le SSR a déjà la bonne valeur).
 */

const VALID_LOCALES = ['fr', 'en', 'ar'] as const;
type Locale = (typeof VALID_LOCALES)[number];

export function LocaleDirectionSync() {
  const [locale, setLocale] = useState<Locale | null>(null);

  useEffect(() => {
    try {
      // Priorité 1 : localStorage (choix manuel persisté par le store)
      const ls = localStorage.getItem('abaya_clientLocale');
      if (ls && (VALID_LOCALES as readonly string[]).includes(ls)) {
        setLocale(ls as Locale);
        return;
      }
      // Priorité 2 : cookie (legacy / partagé inter-onglets)
      const match = document.cookie.match(/abaya_locale=([^;]+)/);
      if (match) {
        const val = match[1] as Locale;
        if ((VALID_LOCALES as readonly string[]).includes(val)) {
          setLocale(val);
        }
      }
      // Aucune préférence → null → n'écrase pas le SSR (défaut BDD déjà appliqué)
    } catch {
      // Storage/cookie inaccessibles — ne rien faire (SSR correct)
    }
  }, []);

  useEffect(() => {
    if (!locale) return;
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  return null;
}
