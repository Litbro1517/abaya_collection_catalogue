import { db } from '@/lib/db';
import { Metadata } from 'next';

/**
 * Ghost Route — SSR meta tags for social media crawlers
 *
 * This route is NEVER visible to human users. It exists solely to serve
 * Open Graph / Twitter Card meta tags when a bot (WhatsApp, Facebook, Twitter, etc.)
 * requests a product URL like /?product=abaya-chic-test
 *
 * The middleware intercepts bot requests and rewrites them here internally.
 * The visitor's URL bar always shows /?product=slug — this route is an implementation detail.
 */

// ── Helper: resolve a product from the database by slug ──
async function resolveProduct(slug: string) {
  // Step 1: Find all visible sections across all catalogs
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

      // Get columns to find title/price/cover
      const columns = await db.column.findMany({
        where: { dataSourceId },
      });

      // Look for a row whose title slugifies to the requested slug
      const rows = await db.row.findMany({
        where: { dataSourceId },
        take: 200,
        orderBy: { order: 'asc' },
      });

      for (const row of rows) {
        const data = row.data as Record<string, unknown>;
        if (data.__is_visible__ === false) continue;

        // Match by title column slugified
        const titleCol = config.titleColumn as string | undefined;
        if (!titleCol) continue;

        const title = String(data[titleCol] || '').trim();
        if (!title) continue;

        const rowSlug = slugify(title);
        if (rowSlug === slug) {
          const priceCol = config.priceColumn as string | undefined;
          const coverCol = config.coverColumn as string | undefined;

          const price = priceCol ? String(data[priceCol] || '') : '';
          const coverRaw = coverCol ? data[coverCol] : null;

          // Extract first image URL
          let coverUrl = '';
          if (typeof coverRaw === 'string' && coverRaw.trim()) {
            coverUrl = extractFirstImageUrl(coverRaw);
          } else if (Array.isArray(coverRaw) && coverRaw.length > 0) {
            coverUrl = extractFirstImageUrl(String(coverRaw[0]));
          }

          const settings = catalog.settings;
          const currency = settings?.currency || 'MAD';
          const catalogName = catalog.name || 'Anakatok';

          return {
            title,
            price: price ? `${price} ${currency}` : '',
            coverUrl,
            catalogName,
            description: `${title}${price ? ` — ${price}` : ''} | ${catalogName}`,
          };
        }
      }
    }
  }

  return null;
}

// ── Slugify: same logic as the client-side version in CatalogPreview ──
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
    .slice(0, 80);                   // reasonable max length
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
  // First try to convert Google Drive URLs to direct CDN
  const cdnUrl = resolveDriveUrl(url);
  if (cdnUrl !== url) return cdnUrl;

  // Check for relative proxy URLs inside absolute-looking strings
  const proxyMatch = url.match(/\/api\/google\/image-proxy\?[^#]*id=([a-zA-Z0-9_-]+)/);
  if (proxyMatch) {
    return `https://lh3.googleusercontent.com/d/${proxyMatch[1]}=w1200`;
  }

  return url;
}

function resolveDriveUrl(url: string): string {
  // Already a CDN URL — just ensure correct width
  if (url.includes('lh3.googleusercontent.com')) {
    return url.replace(/=w\d+/, '=w1200');
  }

  // Convert Google Drive URLs to direct CDN URLs for OG images
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

// ── Generate metadata for social crawlers ──
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await resolveProduct(slug);

  // Derive base URL: env var > request origin > fallback
  // The env var is the primary source; the fallback ensures OG tags always have
  // a valid absolute URL even before the env var is configured on Vercel.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://abaya-collection-catalogue-9dum.vercel.app';

  if (!product) {
    return {
      title: 'Produit non trouvé — Anakatok',
      description: 'Ce produit n\'existe pas ou a été retiré.',
      openGraph: {
        title: 'Anakatok — Collection',
        description: 'Découvrez notre collection exclusive d\'abayas, robes et ensembles.',
        url: baseUrl,
        siteName: 'Anakatok',
        type: 'website',
        locale: 'fr_MA',
      },
    };
  }

  return {
    title: `${product.title} | ${product.catalogName}`,
    description: product.description,
    openGraph: {
      title: `${product.title} | ${product.catalogName}`,
      description: product.description,
      url: `${baseUrl}/?product=${slug}`,
      siteName: product.catalogName,
      images: product.coverUrl
        ? [{ url: product.coverUrl, width: 1200, height: 630, alt: product.title }]
        : [],
      type: 'website',
      locale: 'fr_MA',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.title} | ${product.catalogName}`,
      description: product.description,
      images: product.coverUrl ? [product.coverUrl] : [],
    },
  };
}

// ── Page component: minimal body for crawlers that don't read only <head> ──
export default async function ProductMetaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await resolveProduct(slug);

  if (!product) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Produit non trouvé</h1>
        <p>Ce produit n&apos;existe pas ou a été retiré du catalogue.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>{product.title}</h1>
      {product.price && <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{product.price}</p>}
      <p>{product.catalogName}</p>
    </div>
  );
}
