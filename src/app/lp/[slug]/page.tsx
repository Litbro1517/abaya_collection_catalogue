import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { LandingPageRender } from '@/components/landing/LandingPageRender';

// ── generateMetadata: SEO for landing pages ──
// MANDAT 4P — Soft 404 fix:
// When the slug does not resolve to an active landing page, the page body
// now calls `notFound()` (strict HTTP 404). Here in generateMetadata we emit
// a `noindex` robots directive so that even if a crawler reads the metadata
// before the body executes, the page is excluded from the index.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await db.landingPage.findUnique({ where: { slug } });

  if (!page || !page.active) {
    return {
      title: 'Page non trouvée',
      robots: { index: false, follow: true },
    };
  }

  return {
    title: page.title,
    description: `Landing page: ${page.title}`,
    openGraph: {
      title: page.title,
      type: 'website',
      images: page.desktopImageUrl ? [page.desktopImageUrl] : [],
    },
  };
}

// ── Page component ──
export default async function LandingPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await db.landingPage.findUnique({ where: { slug } });

  if (!page || !page.active) {
    // MANDAT 4P: emit a strict HTTP 404 Not Found instead of a 200 OK with
    // an error message body (Soft 404). Next.js renders the dedicated 404
    // page and sets the correct status code for crawlers.
    notFound();
  }

  // VG40.2: Null guard — skip Prisma query entirely if productId is null.
  // Without this guard, prisma.row.findUnique({ where: { id: null } }) throws
  // PrismaClientValidationError, crashing the SSR render.
  const row = page.productId
    ? await db.row.findUnique({
        where: { id: page.productId },
        include: { dataSource: true },
      })
    : null;

  let productTitle = 'Produit';
  let productPrice = '';
  if (row && row.dataSource) {
    const data = row.data as Record<string, unknown>;
    const columns = await db.column.findMany({
      where: { dataSourceId: row.dataSourceId, visible: true },
      orderBy: { order: 'asc' },
    });
    const titleCol = columns.find(c => c.slug === 'titre' || c.type === 'TEXT');
    const priceCol = columns.find(c => c.slug === 'prix-test' || c.type === 'CURRENCY');
    if (titleCol) productTitle = String(data[titleCol.slug] || 'Produit');
    if (priceCol) productPrice = String(data[priceCol.slug] || '');
  }

  return (
    <LandingPageRender
      page={JSON.parse(JSON.stringify(page))}
      productTitle={productTitle}
      productPrice={productPrice}
      productId={page.productId}
    />
  );
}
