/**
 * Centralized marketing-status configuration for the product card
 * "pied d'image" band (Axe 2 — Catalog UI & Reorder).
 *
 * Each status maps to bilingual labels (FR / AR / EN) + a vibrant band color.
 * The band text is rendered in ITALIC + Sentence case (first letter uppercase
 * only in French — NO UPPERCASE) per the charte graphique.
 *
 * The "Courant" status is the NULL case: no band is displayed.
 *
 * Source of truth: row.data.__statut__ (free string). Unknown values resolve
 * to null (no band), same as "Courant".
 */

import type { Locale } from '@/lib/i18n/dictionaries';

export type StatusKey =
  | 'nouveau'
  | 'stock_limite'
  | 'offre_limite'
  | 'top_vente'
  | 'livraison_gratuite'
  | 'prix_choc';

export interface StatusConfig {
  /** Raw value(s) stored in row.data.__statut__ that resolve to this status (case-insensitive). */
  aliases: string[];
  /** French label — Sentence case (first letter uppercase only). */
  fr: string;
  /** Arabic label. */
  ar: string;
  /** English label — Sentence case. */
  en: string;
  /** Vibrant band background color. Text is always white for contrast. */
  color: string;
}

export const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  nouveau: {
    aliases: ['nouveau', 'new', 'جديد'],
    fr: 'Nouveau',
    ar: 'جديد',
    en: 'New',
    color: '#16A34A', // green-600 — fresh / vibrant
  },
  stock_limite: {
    aliases: ['stock limite', 'stock limité', 'limited stock', 'كمية محدودة'],
    fr: 'Stock limité',
    ar: 'كمية محدودة',
    en: 'Limited stock',
    color: '#EA580C', // orange-600 — urgency
  },
  offre_limite: {
    aliases: ['offre limite', 'offre limitée', 'limited offer', 'عرض محدود'],
    fr: 'Offre limitée',
    ar: 'عرض محدود',
    en: 'Limited offer',
    color: '#DC2626', // red-600 — alert
  },
  top_vente: {
    aliases: ['top vente', 'top seller', 'best seller', 'bestseller', 'الأكثر مبيعاً'],
    fr: 'Top vente',
    ar: 'الأكثر مبيعاً',
    en: 'Top seller',
    color: '#7C3AED', // violet-600 — premium
  },
  livraison_gratuite: {
    aliases: ['livraison gratuite', 'free shipping', 'توصيل مجاني'],
    fr: 'Livraison gratuite',
    ar: 'توصيل مجاني',
    en: 'Free shipping',
    color: '#0891B2', // cyan-600 — info
  },
  prix_choc: {
    aliases: ['prix choc', 'flash price', 'تخفيض استثنائي'],
    fr: 'Prix choc',
    ar: 'تخفيض استثنائي',
    en: 'Flash price',
    color: '#DB2777', // pink-600 — striking
  },
};

/** The null status — no band displayed. */
export const STATUS_NULL = 'courant';

export interface ResolvedStatus {
  key: StatusKey;
  /** Localized label for the current locale. */
  label: string;
  /** Vibrant band background color. */
  color: string;
}

// Pre-compute a flat alias → StatusKey lookup (lowercased, trimmed).
const ALIAS_INDEX: Array<{ alias: string; key: StatusKey }> = (Object.keys(STATUS_CONFIG) as StatusKey[])
  .flatMap((key) => STATUS_CONFIG[key].aliases.map((alias) => ({ alias: alias.toLowerCase().trim(), key })));

/**
 * Resolve a raw __statut__ value to a marketing status config.
 * Returns null for "Courant" or any unrecognized value (no band displayed).
 */
export function resolveMarketingStatus(rawStatut: unknown, locale: Locale): ResolvedStatus | null {
  if (!rawStatut || typeof rawStatut !== 'string') return null;
  const value = rawStatut.toLowerCase().trim();
  if (!value || value === STATUS_NULL) return null;

  const match = ALIAS_INDEX.find((entry) => entry.alias === value);
  if (!match) return null;

  const cfg = STATUS_CONFIG[match.key];
  const label = locale === 'ar' ? cfg.ar : locale === 'en' ? cfg.en : cfg.fr;
  return { key: match.key, label, color: cfg.color };
}
