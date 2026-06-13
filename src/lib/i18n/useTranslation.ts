'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { t, isRTL, type Locale, formatPriceWithCurrency } from './dictionaries';

/**
 * Hook that provides translation function and locale utilities
 * based on the current settings.language from the Zustand store.
 */
export function useTranslation() {
  const settings = useAppStore(s => s.settings);
  const locale: Locale = (settings?.language as Locale) || 'fr';
  const currency = settings?.currency || 'MAD';

  const translate = useMemo(() => {
    return (key: string): string => t(key, locale);
  }, [locale]);

  const rtl = isRTL(locale);

  /**
   * Format a price using the catalog's currency setting
   */
  const formatPrice = useMemo(() => {
    return (price: number | string): string => formatPriceWithCurrency(price, currency);
  }, [currency]);

  return {
    t: translate,
    locale,
    rtl,
    currency,
    formatPrice,
    dir: rtl ? 'rtl' : 'ltr',
  } as const;
}
