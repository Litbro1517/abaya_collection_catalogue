'use client';

import type { LandingPage } from '@/types';
import { LandingCTAButton } from './LandingCTAButton';

export function CanvaImagePage({ page }: { page: LandingPage }) {
  return (
    <div className="lp-canva-wrapper">
      {/* Responsive image: <picture> loads only the matching viewport image */}
      <picture>
        {page.mobileImageUrl && (
          <source media="(max-width: 768px)" srcSet={page.mobileImageUrl} />
        )}
        {page.desktopImageUrl && (
          <source media="(min-width: 769px)" srcSet={page.desktopImageUrl} />
        )}
        <img
          src={page.desktopImageUrl || page.mobileImageUrl || ''}
          alt={page.title}
          className="lp-canva-image"
          loading="eager"
        />
      </picture>

      {/* CTA Buttons superposés avec extincteurs (ON/OFF) */}
      <div className="lp-cta-overlay lp-cta-overlay-top">
        {page.showCtaTop && (
          <LandingCTAButton text={page.ctaTopText || 'Commander Maintenant'} />
        )}
      </div>
      <div className="lp-cta-overlay lp-cta-overlay-middle">
        {page.showCtaMiddle && (
          <LandingCTAButton text={page.ctaMiddleText || "Profiter de l'Offre"} />
        )}
      </div>
      <div className="lp-cta-overlay lp-cta-overlay-bottom">
        {page.showCtaBottom && (
          <LandingCTAButton text={page.ctaBottomText || 'Valider ma Commande'} />
        )}
      </div>
    </div>
  );
}
