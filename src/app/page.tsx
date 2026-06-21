import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';
import { db } from '@/lib/db';

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

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoMetadata();

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonicalUrl,
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
    robots: {
      index: true,
      follow: true,
    },
  };
}

// ── Server Component Root ──
// This is a server component that renders the client-side HomeContent.
// Google Bot can index the metadata above; client hydration handles interactivity.
export default function HomePage() {
  return <HomeClient />;
}
