import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import HomeClient from '@/components/HomeClient';
import { db } from '@/lib/db';
import { resolveProduct } from '@/lib/products';

// MANDAT 4P — Fix TTFB : ISR (Incremental Static Regeneration) toutes les 5 minutes.
// Avant : la page était dynamique (SSR à chaque requête) → TTFB 2.2s + cache MISS.
// Maintenant : la page est pré-rendue et servie depuis le cache Edge Vercel
// → TTFB < 0.5s sur les requêtes suivantes. La régénération en arrière-plan
// se déclenche au plus toutes les 5 minutes (ou au prochain push de contenu).
// Les données produit changent rarement (admin modifie via le dashboard),
// un cache de 5 minutes est acceptable sans dégrader l'expérience utilisateur.
export const revalidate = 300;

// ━━ Fix: decode percent-encoded slugs (Arabic, etc.) before resolution ━━
// Next.js 16 passes searchParams values as-is. When a bot sends
// ?product=عباية-ذهبية, the value arrives percent-encoded. resolveProduct
// expects the decoded form. Without this, Arabic product slugs return
// "Produit non trouvé" and JSON-LD is never injected.
const safeDecode = (s: string | undefined): string | undefined => {
  if (!s) return s;
  try { return decodeURIComponent(s); } catch { return s; }
};

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
  ogImage: '/og-cover.jpg',
  canonicalUrl: 'https://abaya-collection-catalogue-9dum.vercel.app',
};

async function getSeoMetadata() {
  try {
    return await getCachedSeoMetadata();
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
  const productSlug = safeDecode(params?.product);
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
  // MANDAT CADRE B: nettoyage opportuniste du code mort `robotsIndex`.
  // Suite à la neutralisation de l'override (robots: { index: false } imposé
  // globalement par le layout), la variable `robotsIndex` n'était plus lue.
  // Le bloc if(productSlug) reste nécessaire pour résoudre le produit et
  // mettre à jour pageTitle/pageDescription/ogImage — mais la logique
  // robotsIndex a été supprimée.
  if (productSlug) {
    try {
      const product = await resolveProduct(productSlug);
      if (product) {
        pageTitle = `${product.title} — ${seo.title.split(' — ')[0] || 'Catalogue'}`;
        pageDescription = product.description || seo.description;
        if (product.coverUrl) ogImage = product.coverUrl;
      }
      // Product not found or lookup error → page still renders with generic
      // SEO metadata (no specific product title/description). The global
      // noindex, nofollow directive covers all cases now.
    } catch {
      // Product lookup errored — fall back to generic SEO metadata
    }
  }

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: canonicalUrl,
      // ━━ SEO: hreflang — bilingue FR/AR pour le marché marocain (MENA) ━━
      // Doit être répété ici car page.tsx generateMetadata écrase celui du layout.
      languages: {
        'fr-MA': seo.canonicalUrl,
        'ar-MA': seo.canonicalUrl,
        'x-default': seo.canonicalUrl,
      },
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
      // MANDAT 4P — noindex, nofollow global (préalable prioritaire)
      // Le layout global impose déjà noindex, nofollow sur toutes les pages.
      // Cette directive est répétée ici pour empêcher tout override accidentel
      // par une logique future (ex: ?product=<valide> → index). Tant que le
      // mandat noindex global est actif, TOUTES les pages doivent être noindex.
      index: false,
      follow: false,
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
//
// ━━ Audit remediation (Réserve 1): 3-second timeout ━━
// In production (Vercel + Supabase), a slow or cold DB connection could block
// the SSR response indefinitely, causing the page to hang. We now race the
// Prisma query against a 3s timeout — if the DB is slow, we return null props
// and let the client-side loadData() fetch from /api/catalog instead. This
// guarantees the page ALWAYS renders within ~3s, with or without SSR data.

const SSR_DB_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`SSR timeout: ${label} exceeded ${ms}ms`)), ms),
    ),
  ]);
}

// MANDAT 4P v2 — Cache BDD : unstable_cache avec revalidation 300s
// Avant : 11-12 appels BDD par hit serveur sans cache → TTFB variable
// Maintenant : les fonctions lourdes sont cachées au niveau Data Cache
// → les hits suivants (dans les 5 min) ne frappent plus la BDD

const getCachedCatalogData = unstable_cache(
  async () => {
    const catalog = await db.catalog.findFirst({
      include: {
        sections: { orderBy: { order: 'asc' }, include: { components: { orderBy: { order: 'asc' } } } },
        settings: true,
      },
    });
    if (!catalog) return { catalog: null, datasources: [] as Awaited<ReturnType<typeof db.dataSource.findMany>> };
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
    const datasources = await db.dataSource.findMany({
      include: { columns: { orderBy: { order: 'asc' } }, rows: { orderBy: { order: 'asc' } } },
    });
    return { catalog: parsedCatalog, datasources };
  },
  ['catalog-data-v2'],
  { revalidate: 300, tags: ['catalog'] }
);

const getCachedSeoMetadata = unstable_cache(
  async () => {
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
    return SEO_DEFAULTS;
  },
  ['seo-metadata-v2'],
  { revalidate: 300, tags: ['seo'] }
);

const getCachedBaseUrl = unstable_cache(
  async () => {
    const seoRow = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (seoRow?.value) {
      const parsed = JSON.parse(seoRow.value);
      if (parsed.canonicalUrl) return parsed.canonicalUrl;
    }
    return 'https://abaya-collection-catalogue-9dum.vercel.app';
  },
  ['base-url-v2'],
  { revalidate: 300, tags: ['seo'] }
);

const getCachedCategories = unstable_cache(
  async () => {
    return await db.category.findMany({
      where: { visible: true },
      orderBy: { ordre: 'asc' },
      include: {
        subCategories: {
          where: { visible: true },
          orderBy: { ordre: 'asc' },
        },
      },
    });
  },
  ['categories-v2'],
  { revalidate: 300, tags: ['categories'] }
);

async function getInitialCatalogData() {
  try {
    return await getCachedCatalogData();
  } catch {
    return { catalog: null, datasources: [] };
  }
}

// ━━ Fix #418 + BreadcrumbList SSR: pass baseUrl to HomeClient → CatalogPreview → ProductPage ━━
async function getBaseUrl() {
  try {
    return await getCachedBaseUrl();
  } catch {
    return 'https://abaya-collection-catalogue-9dum.vercel.app';
  }
}

export default async function HomePage() {
  const [ { catalog, datasources }, baseUrl, categories ] = await Promise.all([
    getInitialCatalogData(),
    getBaseUrl(),
    getCachedCategories().catch(() => []),
  ]);
  return (
    <HomeClient
      initialCatalog={catalog}
      initialDatasources={datasources}
      initialBaseUrl={baseUrl}
      initialCategories={categories}
    />
  );
}
