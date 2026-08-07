import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { LandingPageRender } from '@/components/landing/LandingPageRender';

// ── generateMetadata: SEO for landing pages ──
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await db.landingPage.findUnique({ where: { slug } });

  if (!page || !page.active) {
    return { title: 'Page non trouvée' };
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
    return (
      <div style={{ padding: '4rem', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1>404 — Page non trouvée</h1>
        <p>Cette landing page n'existe pas ou n'est plus active.</p>
      </div>
    );
  }

  // Resolve product info from the catalog
  const row = await db.row.findUnique({
    where: { id: page.productId },
    include: { dataSource: true },
  });

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
