'use client';

import { useEffect, useState } from 'react';

/**
 * MANDAT 4P — Fix TTFB : déplacer la lecture de la locale hors du Server Component.
 *
 * Problème : `await headers()` dans layout.tsx est une Dynamic API sous Next 16.
 * Elle force le rendu dynamique de TOUTES les routes (ƒ Dynamic), neutralisant
 * l'ISR (revalidate=300) → TTFB 2.2-5.7s + x-vercel-cache: MISS.
 *
 * Solution : ce Client Component lit le cookie `abaya_locale` côté navigateur
 * après hydratation et applique `lang`/`dir` sur <html>. Le Server Component
 * layout.tsx n'utilise plus `headers()` → l'ISR devient actif → TTFB < 0.5s.
 *
 * Au premier rendu (SSR), le html a lang="fr" dir="ltr" (défaut).
 * Après hydratation, si le cookie `abaya_locale` est présent et valide,
 * le composant met à jour lang/dir. `suppressHydrationWarning` sur <html>
 * empêche React de signaler le mismatch.
 */

const VALID_LOCALES = ['fr', 'en', 'ar'] as const;
type Locale = (typeof VALID_LOCALES)[number];

export function LocaleDirectionSync() {
  const [locale, setLocale] = useState<Locale>('fr');

  useEffect(() => {
    try {
      const match = document.cookie.match(/abaya_locale=([^;]+)/);
      if (match) {
        const val = match[1] as Locale;
        if (VALID_LOCALES.includes(val)) {
          setLocale(val);
        }
      }
    } catch {
      // Cookie not accessible — keep default 'fr'
    }
  }, []);

  useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  return null;
}
