import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { resolveCanonicalUrl } from '@/lib/public-base-url';
import { resolveAllProducts } from '@/lib/products';

// ═══════════════════════════════════════════════════════════════════════
// SITEMAP.XML — Dynamic generation via Prisma + product extraction
// ═══════════════════════════════════════════════════════════════════════
// Reads the canonical base URL from Settings.__seo_metadata__ or uses
// the default production URL. Includes:
//   - Static routes (/, /mentions-legales, /politique-de-confidentialite, /conditions-generales)
//   - Dynamic product URLs (/?product=<slug>) for every visible product in the catalog
//
// Revalidation: the sitemap is regenerated every 3600 seconds (1 hour)
// to pick up new products without requiring a full rebuild.

export const revalidate = 3600;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getBaseUrl();
  const now = new Date();

  // ── Static routes ──
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/politique-de-confidentialite`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/conditions-generales`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/politique-de-retour`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // ── Dynamic product routes ──
  // Each visible product gets a sitemap entry: /?product=<slug>
  // ━━ Fix: try/catch around resolveAllProducts() — DB failure should NOT crash
  // the /sitemap.xml route (HTTP 500). If the DB is unavailable, we return at
  // minimum the static routes so search engines still get a valid sitemap.
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await resolveAllProducts();
    productEntries = products.map(product => ({
      // ━━ Fix: encode Arabic slugs properly in sitemap URLs ━━
      // Previously: raw product.slug was concatenated → Mojibake (double UTF-8 encoding)
      // when the sitemap XML was serialized. Now: encodeURIComponent ensures proper
      // percent-encoding for non-ASCII characters (Arabic), which XML parsers and
      // Googlebot handle correctly.
      url: `${baseUrl}/?product=${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('[sitemap] resolveAllProducts failed, returning static routes only:', error);
  }

  return [...staticEntries, ...productEntries];
}
