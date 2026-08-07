import { Metadata } from 'next';
import { resolveProduct } from '@/lib/products';

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
 */

// ── Generate metadata for social crawlers ──
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await resolveProduct(slug);

  // Derive base URL: env var > fallback
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://abaya-collection-catalogue-9dum.vercel.app';

  if (!product) {
    return {
      title: 'Produit non trouvé — Abaya Collection',
      description: 'Ce produit n\'existe pas ou a été retiré.',
      openGraph: {
        title: 'Abaya Collection',
        description: 'Découvrez notre collection exclusive d\'abayas, robes et ensembles.',
        url: baseUrl,
        siteName: 'Abaya Collection',
        type: 'website',
        locale: 'fr_MA',
      },
    };
  }

  return {
    title: `${product.title} | ${product.catalogName}`,
    description: product.description,
    keywords: product.seoKeywords || undefined,
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://abaya-collection-catalogue-9dum.vercel.app';

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
              "url": `${baseUrl}/?product=${slug}`,
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
