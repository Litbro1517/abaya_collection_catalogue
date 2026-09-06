import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { resolveCanonicalUrl } from '@/lib/public-base-url';

// ═══════════════════════════════════════════════════════════════════════
// ROBOTS.TXT — Dynamic generation via Prisma
// ═══════════════════════════════════════════════════════════════════════
// Reads the canonical base URL from Settings.__seo_metadata__ or uses
// the default production URL.

// MANDAT 4P — domaine officiel via public-base-url.ts

async function getBaseUrl(): Promise<string> {
  try {
    const row = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed.canonicalUrl) return resolveCanonicalUrl(parsed.canonicalUrl);
    }
  } catch {
    // DB not available — use default
  }
  return resolveCanonicalUrl(null);
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getBaseUrl();

  return {
    rules: [
      {
        // ━━ MANDAT 4P — Suppression du verrou noindex (fix/remove-noindex-lock) ━━
        // La maintenance est terminée — le verrou Disallow: / (qui bloquait le
        // crawling de TOUTES les routes) est supprimé. Les robots d'exploration
        // peuvent à nouveau crawler et indexer le site. Le sitemap.xml est
        // déclaré pour guider le crawling.
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
