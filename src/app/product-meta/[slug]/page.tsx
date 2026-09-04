import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveProduct } from '@/lib/products';
import { getPublicBaseUrl } from '@/lib/site-url';

// ━━ Fix V2: decode percent-encoded slugs (Arabic, etc.) before resolution ━━
// Next.js 16 passes the slug as-is from the URL, which means Arabic characters
// arrive percent-encoded (%D8%B9%D8%A8%D8%A7%D9%8A%D8%A9...). resolveProduct
// expects the decoded form. Without this, 100% of Arabic slugs return "not found".
const safeDecode = (s: string): string => {
  try { return decodeURIComponent(s); } catch { return s; }
};
/**
 * Ghost Route — SSR meta tags for social media crawlers
 *
 * This route is NEVER visible to human users. It exists solely to serve
 * Open Graph / Twitter Card meta tags when a bot (WhatsApp, Facebook, Twitter, etc.)
 * requests a product URL like /?product=abaya-chic-test
 *
 * The middleware intercepts bot requests and rewrites them here internally.
 * The visitor's URL bar always shows /?product=slug — this route is an implementation detail.
 *
 * Product resolution logic is now shared via src/lib/products.ts (resolveProduct).
 *
 * MANDAT 4P — Soft 404 fix:
 * When the slug does not resolve to a product, we now call `notFound()` which
 * makes Next.js emit a strict HTTP 404 status (instead of a 200 OK with an
 * error message body). This prevents Google Search Console from flagging
 * the route as a Soft 404 and consolidates link equity correctly.
 */

// ── Generate metadata for social crawlers ──
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await resolveProduct(safeDecode(slug));

  // Derive base URL: env var > fallback
  // MANDAT 4P — RECTIFICATIONS AUDIT 360° (P1 SEO) : fallback vercel.app →
  // getPublicBaseUrl() (env NEXT_PUBLIC_BASE_URL sinon domaine officiel).
  const baseUrl = getPublicBaseUrl();

  if (!product) {
    // MANDAT 4P: previously returned a 200 OK with a generic title, which
    // Googlebot treated as a Soft 404 (real page answering a non-existent
    // resource). Now we return a noindex metadata; the page body calls
    // notFound() which emits a strict HTTP 404.
    return {
      title: 'Produit non trouvé — Abaya Collection',
      description: 'Ce produit n\'existe pas ou a été retiré.',
      robots: { index: false, follow: true },
    };
  }

  return {
    title: `${product.title} | ${product.catalogName}`,
    description: product.description,
    keywords: product.seoKeywords || undefined,
    openGraph: {
      title: `${product.title} | ${product.catalogName}`,
      description: product.description,
      url: `${baseUrl}/?product=${encodeURIComponent(safeDecode(slug))}`,
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
  const product = await resolveProduct(safeDecode(slug));
  const baseUrl = getPublicBaseUrl();

  if (!product) {
    // MANDAT 4P: emit a strict HTTP 404 Not Found instead of a 200 OK with
    // an error message body (Soft 404). Next.js renders the dedicated
    // 404 page and sets the correct status code for crawlers.
    notFound();
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      {/* SEO Fix V2: JSON-LD BreadcrumbList — SSR, decoded slug, visible to Googlebot */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: product.catalogName, item: baseUrl },
              { "@type": "ListItem", position: 2, name: product.title, item: `${baseUrl}/?product=${encodeURIComponent(safeDecode(slug))}` },
            ],
          }),
        }}
      />
      {/* VG37.3 B1: JSON-LD structured data for Google Rich Snippets & Google Shopping */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.title,
            "description": product.description || `${product.title} — ${product.catalogName}`,
            "image": product.coverUrl ? [product.coverUrl] : [],
            "brand": {
              "@type": "Brand",
              "name": product.catalogName,
            },
            "offers": {
              "@type": "Offer",
              "price": product.price ? product.price.replace(/[^\d.]/g, '') : "0",
              "priceCurrency": "MAD",
              "availability": "https://schema.org/InStock",
              "url": `${baseUrl}/?product=${encodeURIComponent(safeDecode(slug))}`,
            },
          }),
        }}
      />
      <h1>{product.title}</h1>
      {product.price && <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{product.price}</p>}
      <p>{product.catalogName}</p>
    </div>
  );
}
