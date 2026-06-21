import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════════════
// ROBOTS.TXT — Dynamic generation via Prisma
// ═══════════════════════════════════════════════════════════════════════
// Reads the canonical base URL from Settings.__seo_metadata__ or uses
// the default production URL.

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

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getBaseUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
