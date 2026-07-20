'use client';

/**
 * PriceText — Composant d'affichage de prix avec isolation bidirectionnelle (DEBT-8 repair)
 *
 * Problème : en locale arabe (RTL), le navigateur inverse visuellement l'ordre
 * du prix formaté "230 Dhs" → affiche "Dhs 230" à l'écran, même si le texte
 * source est correct. Cela s'applique aussi bien à "230 Dhs" qu'à "399 €" ou
 * "$299" — l'algorithme bidirectionnel Unicode réordonne les runs de caractères.
 *
 * Solution : envelopper le prix dans un <span> avec :
 *   - dir="ltr" : force la direction LTR du contenu
 *   - unicodeBidi: "isolate" : isole le run bidirectionnel du parent RTL
 *
 * Le prix affiché est donc TOUJOURS "230 Dhs" (montant à gauche, symbole à
 * droite), quelle que soit la langue de l'interface (FR, EN, AR) et quelle
 * que soit la direction du texte environnant.
 *
 * Utilisation :
 *   <PriceText>{formatPrice(price)}</PriceText>
 *   <PriceText strikethrough>{formatPrice(compareAtPrice)}</PriceText>
 */

import { type ReactNode, type CSSProperties } from 'react';

interface PriceTextProps {
  children: ReactNode;
  /** Applique une barrure (line-through) — utilisé pour le prix original (compareAtPrice). */
  strikethrough?: boolean;
  /** Classe CSS additionnelle (peut surcharger les styles). */
  className?: string;
  /** Style inline additionnel ( fusionné avec les styles d'isolation). */
  style?: CSSProperties;
}

export function PriceText({
  children,
  strikethrough = false,
  className,
  style,
}: PriceTextProps) {
  return (
    <span
      dir="ltr"
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
