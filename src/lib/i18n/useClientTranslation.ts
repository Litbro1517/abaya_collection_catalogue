'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { t, isRTL, resolveTranslation, type Locale, formatPriceWithCurrency } from './dictionaries';

/**
 * Hook for PUBLIC catalog translations.
 * Reads from `clientLocale` in Zustand (stored in localStorage) — completely
 * independent of the admin's settings.language.
 *
 * Use this in: CatalogPreview, ProductPage, CodForm, Merci page, SocialStickyTickets
 * Do NOT use in: BuilderShell, SettingsPillar, AdminDashboard (those use useTranslation)
 */
export function useClientTranslation() {
  const clientLocale = useAppStore(s => s.clientLocale);
  const settings = useAppStore(s => s.settings);
  const locale: Locale = (clientLocale as Locale) || 'fr';
  const currency = settings?.currency || 'MAD';

  const translate = useMemo(() => {
    return (key: string): string => t(key, locale);
  }, [locale]);

  const rtl = isRTL(locale);

  const formatPrice = useMemo(() => {
    return (price: number | string): string => formatPriceWithCurrency(price, currency);
  }, [currency]);

  return {
    t: translate,
    locale,
    rtl,
    currency,
    formatPrice,
    dir: rtl ? 'rtl' : 'ltr' as const,
    resolveTranslation: (translations: Record<string, string> | null | undefined, fallback?: string) =>
      resolveTranslation(translations, locale, fallback),
  } as const;
}
