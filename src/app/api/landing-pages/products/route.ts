import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/landing-pages/products — List all products for the select dropdown ──
export async function GET() {
  try {
    const dataSources = await db.dataSource.findMany({
      include: {
        columns: { where: { visible: true }, orderBy: { order: 'asc' } },
      },
    });

    const products: { id: string; title: string; price: string; dataSourceName: string }[] = [];

    for (const ds of dataSources) {
      const titleCol = ds.columns.find(c => c.slug === 'titre' || c.type === 'TEXT');
      const priceCol = ds.columns.find(c => c.type === 'CURRENCY');

      const rows = await db.row.findMany({
        where: { dataSourceId: ds.id },
        select: { id: true, data: true },
        orderBy: { order: 'asc' },
        take: 500,
      });

      for (const row of rows) {
        const data = row.data as Record<string, unknown>;
        const title = titleCol ? String(data[titleCol.slug] || '') : '';
        const price = priceCol ? String(data[priceCol.slug] || '') : '';

        if (title) {
          products.push({ id: row.id, title, price, dataSourceName: ds.name });
        }
      }
    }

    return NextResponse.json({ data: products, error: null });
  } catch (error) {
    console.error('[GET /api/landing-pages/products] Error:', error);
    return NextResponse.json({ data: [], error: 'Failed to fetch products' }, { status: 500 });
  }
}
