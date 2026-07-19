import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
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

const DEFAULT_BASE_URL = 'https://abaya-collection-catalogue-9dum.vercel.app';

async function getBaseUrl(): Promise<string> {
  try {
    const row = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (parsed.canonicalUrl) return parsed.canonicalUrl;
    }
  } catch {
    // DB not available — use default
  }
  return DEFAULT_BASE_URL;
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
  ];

  // ── Dynamic product routes ──
  // Each visible product gets a sitemap entry: /?product=<slug>
  const products = await resolveAllProducts();
  const productEntries: MetadataRoute.Sitemap = products.map(product => ({
    url: `${baseUrl}/?product=${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
