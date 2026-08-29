import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import { db } from '@/lib/db';
import { resolveProduct } from '@/lib/products';

// ═══════════════════════════════════════════════════════════════════════
// SEO METADATA — Dynamic via Prisma (slug technique: __seo_metadata__)
// ═══════════════════════════════════════════════════════════════════════
// Reads the Settings table with key='__seo_metadata__'.
// Value is a JSON string: { title, description, ogImage, canonicalUrl }
// FALLBACK: If the slug doesn't exist or DB is unreachable, static
// defaults are used — the Vercel build is NEVER blocked.

const SEO_DEFAULTS = {
  title: 'Abaya Collection Chic — Catalogue',
  description: "Découvrez notre collection exclusive d'abayas, robes et ensembles. Commandez via WhatsApp, Messenger et plus.",
  ogImage: '/logo.svg',
  canonicalUrl: 'https://abaya-collection-catalogue-9dum.vercel.app',
};

async function getSeoMetadata() {
  try {
    const row = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return {
        title: parsed.title || SEO_DEFAULTS.title,
        description: parsed.description || SEO_DEFAULTS.description,
        ogImage: parsed.ogImage || SEO_DEFAULTS.ogImage,
        canonicalUrl: parsed.canonicalUrl || SEO_DEFAULTS.canonicalUrl,
      };
    }
  } catch {
    // DB not available or JSON parse error — use static defaults
  }
  return SEO_DEFAULTS;
}

// ── Lot 2: PageProps for searchParams ──
// Next.js 16: searchParams is now a Promise and must be awaited.
interface PageProps {
  searchParams?: Promise<{ product?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const seo = await getSeoMetadata();

  // ━━ Lot 2: Dynamic canonical per product ━━
  // When ?product=<slug> is present, build a product-specific canonical URL.
  // Previously the canonical was ALWAYS the base URL — all product pages
  // canonicalized to the homepage, preventing independent indexing.
  // Now each product gets its own canonical: https://domain/?product=<slug>
  // Next.js 16: searchParams is a Promise — unwrap with await before reading.
  const params = await searchParams;
  const productSlug = params?.product;
  const canonicalUrl = productSlug
    ? `${seo.canonicalUrl}/?product=${encodeURIComponent(productSlug)}`
    : seo.canonicalUrl;

  // ━━ Lot 2: Product-specific title/description when ?product= is set ━━
  // On a product detail view (?product=slug), the page title + description
  // should reflect the product itself, not the generic catalog title.
  // This helps Googlebot index each product with its own rich metadata.
  let pageTitle = seo.title;
  let pageDescription = seo.description;
  let ogImage = seo.ogImage;
  if (productSlug) {
    try {
      const product = await resolveProduct(productSlug);
      if (product) {
        pageTitle = `${product.title} — ${seo.title.split(' — ')[0] || 'Catalogue'}`;
        pageDescription = product.description || seo.description;
        if (product.coverUrl) ogImage = product.coverUrl;
      }
    } catch {
      // Product not found — fall back to generic SEO metadata
    }
  }

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      siteName: 'Abaya Collection Chic',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
      type: 'website',
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Lot 2 — SSR (Server-Side Rendering) for the public catalog
// ═══════════════════════════════════════════════════════════════════════
// Problem (audit): the page server component delegated 100% of the rendering
// to <HomeClient/>, showing a "Chargement..." spinner at first HTTP render.
// Googlebot received an empty HTML page → degraded LCP + poor indexing.
//
// Fix: this Server Component now queries Prisma directly (catalog + settings)
// and passes the data as `initialCatalog` / `initialDatasources` props to
// <HomeClient/>. The client component hydrates the Zustand store from these
// props BEFORE first paint → the catalog HTML is present in the initial SSR
// response. No more "Chargement..." spinner on first visit.
//
// Interactivity is preserved: after hydration, <HomeClient/> revalidates the
// data client-side (cache-first FROZEN_MODE) — the SSR payload is a seed,
// not a replacement for the client data layer.
//
// Helper: getInitialCatalogData() mirrors what /api/catalog returns (same
// Prisma query + JSON-field parsing) so the SSR payload is byte-identical to
// what the client would fetch. This guarantees no hydration mismatch.

async function getInitialCatalogData() {
  try {
    const catalog = await db.catalog.findFirst({
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            components: { orderBy: { order: 'asc' } },
          },
        },
        settings: true,
      },
    });

    if (!catalog) return { catalog: null, datasources: [] };

    // SQLite returns JSON fields as strings — parse them for client compat
    const parsedCatalog = {
      ...catalog,
      sections: catalog.sections.map(section => ({
        ...section,
        config: typeof section.config === 'string' ? JSON.parse(section.config) : section.config,
        components: section.components.map(comp => ({
          ...comp,
          config: typeof comp.config === 'string' ? JSON.parse(comp.config) : comp.config,
        })),
      })),
    };

    // Datasources: needed by CatalogPreview for column resolution
    const datasources = await db.dataSource.findMany({
      include: {
        columns: { orderBy: { order: 'asc' } },
        rows: { orderBy: { order: 'asc' } },
      },
    });

    return { catalog: parsedCatalog, datasources };
  } catch {
    // DB not available (first deploy, build-time, etc.) — client will fetch
    return { catalog: null, datasources: [] };
  }
}

export default async function HomePage() {
  const { catalog, datasources } = await getInitialCatalogData();
  return (
    <HomeClient
      initialCatalog={catalog}
      initialDatasources={datasources}
    />
  );
}
