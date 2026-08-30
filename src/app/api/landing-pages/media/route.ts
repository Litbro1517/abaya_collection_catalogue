import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET /api/landing-pages/media — List all CDN images for the ImagePickerModal ──
export async function GET() {
  try {
    // Fetch all MediaAssets with a cdnUrl (migrated to CDN)
    const assets = await db.mediaAsset.findMany({
      where: { cdnUrl: { not: null } },
      select: {
        id: true,
        cdnUrl: true,
        originalUrl: true,
        fileName: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Also fetch image URLs from rows
    const columns = await db.column.findMany({
      where: { type: { in: ['IMAGE', 'IMAGE_ARRAY'] } },
      select: { slug: true, dataSourceId: true },
    });

    const rowImages: { id: string; cdnUrl: null; originalUrl: string; fileName: null }[] = [];
    if (columns.length > 0) {
      const rows = await db.row.findMany({
        where: { dataSourceId: { in: columns.map(c => c.dataSourceId) } },
        select: { data: true, dataSourceId: true },
        take: 500,
      });

      for (const row of rows) {
        const data = row.data as Record<string, unknown>;
        for (const col of columns) {
          const val = data[col.slug];
          if (typeof val === 'string' && val.startsWith('http')) {
            rowImages.push({ id: `row-${row.dataSourceId}-${col.slug}-${val.substring(0, 20)}`, cdnUrl: null, originalUrl: val, fileName: null });
          } else if (Array.isArray(val)) {
            for (const v of val) {
              if (typeof v === 'string' && v.startsWith('http')) {
                rowImages.push({ id: `row-${row.dataSourceId}-${col.slug}-${v.substring(0, 20)}`, cdnUrl: null, originalUrl: v, fileName: null });
              }
            }
          }
        }
      }
    }

    const all = [...assets, ...rowImages];
    const seen = new Set<string>();
    const deduped = all.filter(img => {
      if (seen.has(img.originalUrl)) return false;
      seen.add(img.originalUrl);
      return true;
    });

    return NextResponse.json({ data: deduped, error: null });
  } catch (error) {
    console.error('[GET /api/landing-pages/media] Error:', error);
    return NextResponse.json({ data: [], error: 'Failed to fetch media' }, { status: 500 });
  }
}
