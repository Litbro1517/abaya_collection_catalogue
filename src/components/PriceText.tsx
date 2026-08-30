'use client';

/**
 * PriceText — Composant d'affichage de prix avec isolation bidirectionnelle.
 *
 * VG36.5 Fix 1: Le composant est désormais direction-aware (sensible à la locale).
 *
 * Comportement :
 *   - FR/EN (default) : dir="ltr" + unicodeBidi: "isolate" — l'isolation LTR
 *     force l'affichage "230 Dhs" (montant à gauche, symbole à droite) quel
 *     que soit le contexte parent. Nécessaire pour empêcher l'inversion
 *     "Dhs 230" dans un hôte RTL.
 *   - AR (locale='ar') : dir="rtl" + unicodeBidi: "isolate" — laisse le parent
 *     RTL diriger naturellement le flux BiDi. La chaîne source "280 درهم"
 *     (amount first) est réordonnée par l'algorithme BiDi : le nombre (weak
 *     directional) va à droite, درهم (strong RTL) va à gauche.
 *     Résultat visuel : درهم 280 → l'œil arabe lit "280 Dirham" de droite à gauche.
 *
 * Utilisation :
 *   <PriceText locale={locale}>{formatPrice(price)}</PriceText>
 *   <PriceText strikethrough locale={locale}>{formatPrice(compareAtPrice)}</PriceText>
 */

import { type ReactNode, type CSSProperties } from 'react';
import type { Locale } from '@/lib/i18n';

interface PriceTextProps {
  children: ReactNode;
  /** Applique une barrure (line-through) — utilisé pour le prix original (compareAtPrice). */
  strikethrough?: boolean;
  /** Classe CSS additionnelle (peut surcharger les styles). */
  className?: string;
  /** Style inline additionnel ( fusionné avec les styles d'isolation). */
  style?: CSSProperties;
  /** VG36.5 Fix 1: locale visiteur. Quand 'ar', le span utilise dir="rtl". */
  locale?: Locale;
}

export function PriceText({
  children,
  strikethrough = false,
  className,
  style,
  locale,
}: PriceTextProps) {
  const isArabic = locale === 'ar';

  return (
    <span
      dir={isArabic ? 'rtl' : 'ltr'}
      className={className}
      style={{
        unicodeBidi: 'isolate',
        textDecoration: strikethrough ? 'line-through' : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
