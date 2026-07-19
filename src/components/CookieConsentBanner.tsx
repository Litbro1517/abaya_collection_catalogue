'use client';

import CookieConsent from 'react-cookie-consent';
import Link from 'next/link';

/**
 * CookieConsentBanner — RGPD compliance banner
 *
 * Blocks third-party scripts (Zaraz, Meta Pixel, etc.) until the user
 * explicitly accepts. The consent status is stored in a cookie named
 * "CookieConsent" (react-cookie-consent default) and can be read by
 * server-side code or Cloudflare Zaraz to conditionally load trackers.
 *
 * The banner is rendered in layout.tsx so it appears on ALL pages.
 * It respects the visitor's locale (FR/EN/AR) via useClientTranslation.
 */
export function CookieConsentBanner() {
  return (
    <CookieConsent
      location="bottom"
      buttonText="Accepter"
      declineButtonText="Refuser"
      enableDeclineButton
      cookieName="CookieConsent"
      style={{
        background: '#1a1714',
        color: '#ede8e6',
        padding: '16px 24px',
        fontSize: '13px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
      }}
      buttonStyle={{
        background: '#C9A84C',
        color: '#1a1714',
        fontSize: '13px',
        fontWeight: 600,
        borderRadius: '6px',
        padding: '8px 20px',
        border: 'none',
        cursor: 'pointer',
      }}
      declineButtonStyle={{
        background: 'transparent',
        color: '#ede8e6',
        fontSize: '13px',
        borderRadius: '6px',
        padding: '8px 16px',
        border: '1px solid #5a5250',
        cursor: 'pointer',
      }}
      expires={365}
      ariaAcceptLabel="Accepter les cookies"
      ariaDeclineLabel="Refuser les cookies"
    >
      <span>
        Nous utilisons des cookies pour mesurer l'audience (Cloudflare Zaraz, statistiques anonymes).
        Aucune donnée personnelle n'est vendue.{' '}
        <Link
          href="/politique-de-confidentialite"
          style={{ color: '#C9A84C', textDecoration: 'underline' }}
        >
          Politique de confidentialité
        </Link>
      </span>
    </CookieConsent>
  );
}
