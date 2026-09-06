/**
 * MANDAT 4P — Web Tunnel Attribution & Legal
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Source unique de la base URL publique du site.
 *
 * Constat audit tunnel-web : 8 fallbacks hardcodés vers vercel.app dans
 * layout.tsx, robots.ts, sitemap.ts, page.tsx, product-meta/[slug]/page.tsx.
 * NEXT_PUBLIC_BASE_URL est correctement configurée sur Vercel mais
 * AUCUN fichier ne l'utilise (ce helper n'existait pas — supprimé par
 * rollback 952e079).
 *
 * Correctif : le fallback code-side devient le DOMAINE OFFICIEL
 * https://catalogue.abayacollection.store. Garantit que canonical/og/
 * sitemap/JSON-LD pointent vers le domaine officiel MÊME SI la variable
 * Vercel est omise ou si la DB __seo_metadata__ contient l'URL vercel.app.
 *
 * Priorité globale : NEXT_PUBLIC_BASE_URL (env) > DB __seo_metadata__.canonicalUrl
 * (validée, rejet vercel.app/labellect) > domaine officiel.
 */

export const DEFAULT_SITE_URL = 'https://catalogue.abayacollection.store';

// Domaines techniques à rejeter absolument (fuites)
const BLOCKED_DOMAINS = ['vercel.app', 'labellect'];

/**
 * Valide qu'une URL n'est pas un domaine technique (vercel.app, labellect).
 * Retourne true si l'URL est un domaine officiel valide.
 */
function isOfficialDomain(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    for (const blocked of BLOCKED_DOMAINS) {
      if (u.hostname.endsWith(blocked)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Base URL publique : NEXT_PUBLIC_BASE_URL validée > sinon domaine officiel.
 * Robuste aux valeurs malformées → fallback domaine officiel.
 */
export function getPublicBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env && isOfficialDomain(env)) {
    return new URL(env).origin;
  }
  return DEFAULT_SITE_URL;
}

/**
 * Valide et filtre une URL DB (canonicalUrl de __seo_metadata__).
 * Si l'URL DB pointe vers un domaine technique (vercel.app, labellect),
 * elle est REJETÉE et le domaine officiel est retourné.
 * Utilisée par layout.tsx, robots.ts, sitemap.ts, page.tsx pour valider
 * la valeur DB avant de l'utiliser.
 */
export function resolveCanonicalUrl(dbCanonicalUrl: string | null | undefined): string {
  if (dbCanonicalUrl && isOfficialDomain(dbCanonicalUrl)) {
    try {
      return new URL(dbCanonicalUrl).origin;
    } catch {
      // fall through to default
    }
  }
  return getPublicBaseUrl();
}
