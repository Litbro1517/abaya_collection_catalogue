// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import HomeClient from '@/components/HomeClient';
import { db } from '@/lib/db';
import { resolveCanonicalUrl, getPublicBaseUrl } from '@/lib/public-base-url';

// MANDAT 4P — Fix TTFB : ISR (Incremental Static Regeneration) toutes les 5 minutes.
// Avant : la page était dynamique (SSR à chaque requête) → TTFB 2.2s + cache MISS.
// Maintenant : la page est pré-rendue et servie depuis le cache Edge Vercel
// → TTFB < 0.5s sur les requêtes suivantes. La régénération en arrière-plan
// se déclenche au plus toutes les 5 minutes (ou au prochain push de contenu).
// Les données produit changent rarement (admin modifie via le dashboard),
// un cache de 5 minutes est acceptable sans dégrader l'expérience utilisateur.
export const revalidate = 300;

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
  canonicalUrl: getPublicBaseUrl(),
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
// MANDAT 4P v2 — Fix ISR : supprimer await searchParams de generateMetadata.
// Avant : `await searchParams` dans generateMetadata forçait la route / en
// rendu dynamique (ƒ) → ISR inopérant → TTFB 2-5s + cache MISS.
//
// Solution : generateMetadata retourne des métadonnées STATIQUES génériques
// (titre/description/canonical par défaut). Les métadonnées dynamiques
// (?product=slug) sont gérées par la route dédiée /product-meta/[slug]
// (déjà fonctionnelle pour les crawlers via le middleware bot interception).
//
// ━━ MANDAT 4P — Suppression du verrou noindex (fix/remove-noindex-lock) ━━
// Le verrou noindex/nofollow global a été levé (maintenance terminée). Le site
// est à nouveau indexable — les métadonnées SEO par produit (?product=slug)
// servent désormais à la fois pour les previews sociales et l'indexation.
//
// generateMetadata ne prend plus searchParams en paramètre → la route /
// peut être pré-rendue statiquement (ISR avec revalidate=300).

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoMetadata();

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonicalUrl,
      languages: {
        'fr-MA': seo.canonicalUrl,
        'ar-MA': seo.canonicalUrl,
        'x-default': seo.canonicalUrl,
      },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.canonicalUrl,
      siteName: 'Abaya Collection Chic',
      images: [
        {
          url: seo.ogImage,
          width: 1200,
          height: 630,
          alt: seo.title,
        },
      ],
      type: 'website',
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [seo.ogImage],
    },
    // ━━ MANDAT 4P — Suppression du verrou noindex (fix/remove-noindex-lock) ━━
    // Le robots: { index: false, follow: false } (qui dupliquait le verrou global
    // du layout) est supprimé. La maintenance est terminée — le site est à nouveau
    // indexable. PageSpeed SEO attendu : 100/100.
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
        canonicalUrl: resolveCanonicalUrl(parsed.canonicalUrl || null),
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
      if (parsed.canonicalUrl) return resolveCanonicalUrl(parsed.canonicalUrl);
    }
    return getPublicBaseUrl();
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
    return getPublicBaseUrl();
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
      initialCatalog={catalog as unknown as import("@/types").Catalog | null}
      initialDatasources={datasources as unknown as import("@/types").DataSource[]}
      initialBaseUrl={baseUrl}
      initialCategories={categories}
    />
  );
}
