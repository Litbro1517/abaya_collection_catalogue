import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════════════
// SITEMAP.XML — Dynamic generation via Prisma
// ═══════════════════════════════════════════════════════════════════════
// Reads the canonical base URL from Settings.__seo_metadata__ or uses
// the default production URL. Includes all known static routes.

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

  return [
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
}
