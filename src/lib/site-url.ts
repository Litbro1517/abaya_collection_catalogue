/**
 * MANDAT 4P — RECTIFICATIONS AUDIT 360° (P1 SEO / Sitemap)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Source unique de la base URL publique du site.
 *
 * Constat audit DUEL 360° (P1) : les 52 URLs du sitemap.xml, les canonical,
 * hreflang et JSON-LD pointaient vers l'URL Vercel (abaya-collection-catalogue-
 * 9dum.vercel.app) parce que NEXT_PUBLIC_BASE_URL n'était PAS configurée en
 * production et que le fallback était hardcodé sur l'URL Vercel dans 9 sites
 * du code (sitemap.ts, robots.ts, layout.tsx, page.tsx, product-meta, …).
 *
 * Correctif : le fallback code-side devient le DOMAINE OFFICIEL
 * https://catalogue.abayacollection.store — garantit que sitemap/canonical/
 * JSON-LD pointent vers le domaine officiel MÊME SI la variable Vercel est
 * omise. Si NEXT_PUBLIC_BASE_URL est définie (ops Vercel), elle prend la
 * priorité (contrôle opérationnel conservé).
 *
 * Priorité globale effective : NEXT_PUBLIC_BASE_URL (env) > domaine officiel.
 * (Les override admin via __seo_metadata__.canonicalUrl en DB gardent leur
 * priorité AU-DESSUS de ce helper dans les sites qui la lisent déjà —
 * comportement inchangé, seul le fallback par défaut change.)
 */

export const DEFAULT_SITE_URL = 'https://catalogue.abayacollection.store';

/**
 * Base URL publique : NEXT_PUBLIC_BASE_URL validée, sinon domaine officiel.
 * Robuste aux valeurs malformées (pas une URL, protocole non-http) → fallback.
 * Robuste aux slashes traînants (normalisation).
 */
export function getPublicBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env && typeof env === 'string') {
    try {
      const u = new URL(env);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return u.origin;
      }
    } catch {
      // pas une URL absolue valide → fallback domaine officiel
    }
  }
  return DEFAULT_SITE_URL;
}
