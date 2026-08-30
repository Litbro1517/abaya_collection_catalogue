/**
 * Product resolution module — shared logic for product discovery
 *
 * Extracted from src/app/product-meta/[slug]/page.tsx to enable reuse
 * by both the ghost route (OG meta) and the dynamic sitemap.
 *
 * Public API:
 *   - resolveProduct(slug):  find a single product by its slugified title
 *   - resolveAllProducts():  list ALL products across all catalogs/sections
 *
 * No client-side code — this module is server-only (uses Prisma directly).
 */

import { db } from '@/lib/db';

// ── Types ──

export interface ResolvedProduct {
  slug: string;
  title: string;
  price: string;       // formatted with currency (e.g. "290 MAD")
  priceRaw: string;    // raw price value (e.g. "290")
  coverUrl: string;    // direct CDN URL for social crawlers
  catalogName: string;
  description: string; // SEO description (custom or auto-generated)
  seoKeywords: string;
  updatedAt: Date;     // for sitemap lastModified
}

// ── Slugify: generates URL-safe slugs preserving ALL scripts (Latin, Arabic, etc.) ──
// Uses Unicode property escapes (\p{L} for letters, \p{N} for numbers) to
// preserve Arabic characters instead of stripping them. Spaces and
// punctuation become hyphens. Accents are stripped for Latin scripts only
// (NFD normalization + combining marks removal — no effect on Arabic).
//
// Examples:
//   "Abaya Chic Noir" → "abaya-chic-noir"        (FR — unchanged)
//   "عباية راقية"     → "عباية-راقية"             (AR — preserved)
//   "Ensemble 3 pièces" → "ensemble-3-pièces"     (FR — note: "è" stays
//     because NFD strips the combining accent but "e" remains, so "è" → "e")
//   "خمار 3 قطع"      → "خمار-3-قطع"              (AR + digits — preserved)
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip Latin combining accents (no effect on Arabic)
    .replace(/[^\p{L}\p{N}]+/gu, '-') // non-letter/non-number → hyphen (Unicode-aware)
    .replace(/^-+|-+$/g, '')          // trim leading/trailing hyphens
    .slice(0, 80);                    // reasonable max length
}

// ── Extract first image URL from a raw cell value ──
function extractFirstImageUrl(raw: string): string {
  if (!raw) return '';

  // Try JSON parse (stored as JSON array of URLs)
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed)) {
        const first = parsed.find((u): u is string => typeof u === 'string' && u.length > 0);
        if (first) return resolveImageUrl(first);
      }
    } catch { /* not JSON */ }
  }

  // Direct absolute URL (http/https)
  if (raw.startsWith('http')) return resolveImageUrl(raw);

  // Relative proxy URL: /api/google/image-proxy?id=FILE_ID&sz=N
  // Convert to direct lh3 CDN URL for social crawlers (no proxy needed)
  const proxyMatch = raw.match(/^\/api\/google\/image-proxy\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (proxyMatch) {
    return `https://lh3.googleusercontent.com/d/${proxyMatch[1]}=w1200`;
  }

  // Comma/semicolon/pipe-separated URLs
  const parts = raw.split(/[,;|]/).map(s => s.trim()).filter(s => s.startsWith('http'));
  if (parts.length > 0) return resolveImageUrl(parts[0]);

  return '';
}

// ── Resolve any image URL (Google Drive, CDN, or direct) ──
function resolveImageUrl(url: string): string {
  const cdnUrl = resolveDriveUrl(url);
  if (cdnUrl !== url) return cdnUrl;

  const proxyMatch = url.match(/\/api\/google\/image-proxy\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (proxyMatch) {
    return `https://lh3.googleusercontent.com/d/${proxyMatch[1]}=w1200`;
  }

  return url;
}

function resolveDriveUrl(url: string): string {
  if (url.includes('lh3.googleusercontent.com')) {
    return url.replace(/=w\d+/, '=w1200');
  }

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=w1200`;
    }
  }

  return url;
}

// ── Core: iterate all catalogs → sections → rows ──
// Shared by both resolveProduct and resolveAllProducts.
// Returns an async generator to avoid loading everything in memory at once
// when called by resolveProduct (early exit on match).
async function* iterateProducts(): AsyncGenerator<{
  row: { id: string; data: Record<string, unknown>; order: number; updatedAt: Date };
  config: Record<string, unknown>;
  catalog: { name: string; settings: { currency: string } | null };
}> {
  const catalogs = await db.catalog.findMany({
    include: {
      sections: {
        where: { visible: true },
        orderBy: { order: 'asc' },
      },
      settings: true,
    },
  });

  for (const catalog of catalogs) {
    for (const section of catalog.sections) {
      const config = section.config as Record<string, unknown> | null;
      if (!config) continue;

      const dataSourceId = config.dataSourceId as string | undefined;
      if (!dataSourceId) continue;

      const rows = await db.row.findMany({
        where: { dataSourceId },
        take: 200,
        orderBy: { order: 'asc' },
      });

      for (const row of rows) {
        const data = row.data as Record<string, unknown>;
        if (data.__is_visible__ === false) continue;

        yield {
          row: { id: row.id, data, order: row.order, updatedAt: row.updatedAt },
          config,
          catalog: { name: catalog.name, settings: catalog.settings },
        };
      }
    }
  }
}

// ── Build a ResolvedProduct from a raw row + config ──
function buildProduct(
  rowData: Record<string, unknown>,
  rowUpdatedAt: Date,
  config: Record<string, unknown>,
  catalogName: string,
  currency: string,
): ResolvedProduct | null {
  const titleCol = config.titleColumn as string | undefined;
  if (!titleCol) return null;

  const title = String(rowData[titleCol] || '').trim();
  if (!title) return null;

  const slug = slugify(title);

  const priceCol = config.priceColumn as string | undefined;
  const coverCol = config.coverColumn as string | undefined;

  const priceRaw = priceCol ? String(rowData[priceCol] || '') : '';
  const coverRaw = coverCol ? rowData[coverCol] : null;

  let coverUrl = '';
  if (typeof coverRaw === 'string' && coverRaw.trim()) {
    coverUrl = extractFirstImageUrl(coverRaw);
  } else if (Array.isArray(coverRaw) && coverRaw.length > 0) {
    coverUrl = extractFirstImageUrl(String(coverRaw[0]));
  }

  // SEO Hybrid Logic
  const seoDescription = String(rowData.seo_description || '').trim();
  const seoKeywords = String(rowData.seo_keywords || '').trim();
  const autoDescription = `${title}${priceRaw ? ` — ${priceRaw} ${currency}` : ''} | ${catalogName}`;
  const finalDescription = seoDescription || autoDescription;

  return {
    slug,
    title,
    price: priceRaw ? `${priceRaw} ${currency}` : '',
    priceRaw,
    coverUrl,
    catalogName,
    description: finalDescription,
    seoKeywords,
    updatedAt: rowUpdatedAt,
  };
}

// ── resolveProduct: find a single product by slug ──
export async function resolveProduct(slug: string): Promise<ResolvedProduct | null> {
  for await (const { row, config, catalog } of iterateProducts()) {
    const currency = catalog.settings?.currency || 'MAD';
    const catalogName = catalog.name || 'Abaya Collection';

    const product = buildProduct(row.data, row.updatedAt, config, catalogName, currency);
    if (product && product.slug === slug) {
      return product;
    }
  }

  return null;
}

// ── resolveAllProducts: list ALL visible products ──
// Used by the dynamic sitemap to generate URLs for every product.
export async function resolveAllProducts(): Promise<ResolvedProduct[]> {
  const products: ResolvedProduct[] = [];

  for await (const { row, config, catalog } of iterateProducts()) {
    const currency = catalog.settings?.currency || 'MAD';
    const catalogName = catalog.name || 'Abaya Collection';

    const product = buildProduct(row.data, row.updatedAt, config, catalogName, currency);
    if (product) {
      products.push(product);
    }
  }

  return products;
}
