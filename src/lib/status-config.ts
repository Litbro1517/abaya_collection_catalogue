/**
 * Centralized marketing-status configuration for the product card
 * "pied d'image" ribbon (VG28 Axe 2 → VG29 Ribbon Redesign).
 *
 * Each status maps to bilingual labels (FR / AR / EN) + a vibrant ribbon color.
 * The ribbon text is rendered in ITALIC + Sentence case (first letter uppercase
 * only in French — NO UPPERCASE) per the charte graphique.
 *
 * The "Courant" status is the NULL case: no ribbon is displayed.
 *
 * Source of truth: row.data.__statut__ (free string). Unknown values resolve
 * to null (no ribbon), same as "Courant".
 *
 * VG29 changes:
 * - "Nouveau" officially replaced by "Nouveauté" throughout the project.
 * - Color palette revised per mandate (cyan, orange corail, rouge carmin,
 *   jaune solaire, vert émeraude, violet magenta).
 * - STATUS_OPTIONS export: single source of truth for the admin dropdown
 *   (DataTable.tsx) + column-creation config.options.
 * - resolveAdminStatusBadge(): admin table badge resolver (always FR).
 */

import type { Locale } from '@/lib/i18n/dictionaries';

export type StatusKey =
  | 'nouveaute'
  | 'stock_limite'
  | 'offre_limite'
  | 'top_vente'
  | 'livraison_gratuite'
  | 'prix_choc';

export interface StatusConfig {
  /** Canonical BDD value (exact case as stored in row.data.__statut__). */
  bddValue: string;
  /** Raw value(s) that resolve to this status (case-insensitive, trimmed). */
  aliases: string[];
  /** French label — Sentence case (first letter uppercase only). */
  fr: string;
  /** Arabic label. */
  ar: string;
  /** English label — Sentence case. */
  en: string;
  /** Vibrant ribbon background color. Text is always white for contrast. */
  color: string;
}

export const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  nouveaute: {
    bddValue: 'Nouveauté',
    aliases: ['nouveauté', 'nouveau', 'new', 'جديد'],
    fr: 'Nouveauté',
    ar: 'جديد',
    en: 'New',
    color: '#06B6D4', // cyan-500
  },
  stock_limite: {
    bddValue: 'Stock limité',
    aliases: ['stock limité', 'stock limite', 'limited stock', 'كمية محدودة'],
    fr: 'Stock limité',
    ar: 'كمية محدودة',
    en: 'Limited stock',
    color: '#F97316', // orange-500 (corail)
  },
  offre_limite: {
    bddValue: 'Offre limitée',
    aliases: ['offre limitée', 'offre limite', 'limited offer', 'عرض محدود'],
    fr: 'Offre limitée',
    ar: 'عرض محدود',
    en: 'Limited offer',
    color: '#EF4444', // red-500 (carmin)
  },
  top_vente: {
    bddValue: 'Top Vente',
    aliases: ['top vente', 'top seller', 'best seller', 'bestseller', 'الأكثر مبيعاً'],
    fr: 'Top Vente',
    ar: 'الأكثر مبيعاً',
    en: 'Top seller',
    color: '#EAB308', // yellow-500 (solaire)
  },
  livraison_gratuite: {
    bddValue: 'Livraison Gratuite',
    aliases: ['livraison gratuite', 'free shipping', 'توصيل مجاني'],
    fr: 'Livraison Gratuite',
    ar: 'توصيل مجاني',
    en: 'Free shipping',
    color: '#10B981', // emerald-500
  },
  prix_choc: {
    bddValue: 'Prix Choc',
    aliases: ['prix choc', 'flash price', 'تخفيض استثنائي'],
    fr: 'Prix Choc',
    ar: 'تخفيض استثنائي',
    en: 'Flash price',
    color: '#D946EF', // fuchsia-500 (magenta)
  },
};

/** The null status — no ribbon displayed. */
export const STATUS_NULL = 'Courant';

/**
 * Admin dropdown options (single source of truth).
 * Used by DataTable.tsx <select> + column-creation config.options.
 * Order: Courant first (default), then marketing statuses.
 */
export const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Courant', label: 'Courant' },
  ...(Object.keys(STATUS_CONFIG) as StatusKey[]).map((key) => ({
    value: STATUS_CONFIG[key].bddValue,
    label: STATUS_CONFIG[key].fr,
  })),
];

export interface ResolvedStatus {
  key: StatusKey;
  /** Canonical BDD value. */
  bddValue: string;
  /** Localized label for the current locale. */
  label: string;
  /** Vibrant ribbon background color. */
  color: string;
}

// Pre-compute a flat alias → StatusKey lookup (lowercased, trimmed).
const ALIAS_INDEX: Array<{ alias: string; key: StatusKey }> = (Object.keys(STATUS_CONFIG) as StatusKey[])
  .flatMap((key) => STATUS_CONFIG[key].aliases.map((alias) => ({ alias: alias.toLowerCase().trim(), key })));

/**
 * Resolve a raw __statut__ value to a marketing status config (storefront).
 * Returns null for "Courant" or any unrecognized value (no ribbon displayed).
 */
export function resolveMarketingStatus(rawStatut: unknown, locale: Locale): ResolvedStatus | null {
  if (!rawStatut || typeof rawStatut !== 'string') return null;
  const value = rawStatut.toLowerCase().trim();
  if (!value || value === STATUS_NULL.toLowerCase()) return null;

  const match = ALIAS_INDEX.find((entry) => entry.alias === value);
  if (!match) return null;

  const cfg = STATUS_CONFIG[match.key];
  const label = locale === 'ar' ? cfg.ar : locale === 'en' ? cfg.en : cfg.fr;
  return { key: match.key, bddValue: cfg.bddValue, label, color: cfg.color };
}

// ── Admin badge resolver (always FR — used by DataTable.tsx) ──────────────

export interface AdminStatusBadge {
  /** Display label (FR). */
  label: string;
  /** Background color (empty string for the null/Courant case → gray badge). */
  color: string;
  /** True for Courant / null / unrecognized → gray badge. */
  isNull: boolean;
}

/**
 * Resolve a raw __statut__ value for admin table badge display (always FR).
 * Returns { isNull: true, label: 'Courant' } for the null case.
 */
export function resolveAdminStatusBadge(rawStatut: unknown): AdminStatusBadge {
  if (!rawStatut || typeof rawStatut !== 'string') {
    return { label: 'Courant', color: '', isNull: true };
  }
  const value = rawStatut.toLowerCase().trim();
  if (!value || value === STATUS_NULL.toLowerCase()) {
    return { label: 'Courant', color: '', isNull: true };
  }
  const match = ALIAS_INDEX.find((entry) => entry.alias === value);
  if (!match) {
    return { label: 'Courant', color: '', isNull: true };
  }
  const cfg = STATUS_CONFIG[match.key];
  return { label: cfg.fr, color: cfg.color, isNull: false };
}
