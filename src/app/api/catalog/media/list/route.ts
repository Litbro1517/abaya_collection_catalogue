import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { detectImageSource, extractDriveFileId } from '@/lib/media-utils';

/**
 * GET /api/catalog/media/list?dataSourceId=...&orphansOnly=true
 * Returns the media library: one entry per row × image URL.
 *
 * Each entry: {
 *   order: number,           // Row.order (stable BDD index 1..N)
 *   rowId: string,
 *   productTitle: string,    // from titleColumn (best-effort: __title__ or first TEXT col)
 *   images: Array<{
 *     url: string,
 *     source: 'drive' | 'cdn' | 'unknown',
 *     fileId: string | null,
 *     assetStatus: string | null,  // MediaAsset.status ('cdn' | 'drive' | null)
 *   }>,
 *   hasMediaAsset: boolean,  // true if a MediaAsset record exists (CDN-migrated)
 * }
 *
 * orphansOnly=true: returns only entries where the URL is CDN but no active
 *   Row references it (orphaned CDN files to clean up).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataSourceId = searchParams.get('dataSourceId');
    const orphansOnly = searchParams.get('orphansOnly') === 'true';

    if (!dataSourceId) {
      return NextResponse.json(
        { error: 'dataSourceId is required' },
        { status: 400 },
      );
    }

    // Fetch columns to find IMAGE/IMAGE_ARRAY columns
    const columns = await db.column.findMany({
      where: { dataSourceId, visible: true },
      orderBy: { order: 'asc' },
      select: { slug: true, type: true, name: true },
    });

    const imageColumns = columns.filter(
      (c) => c.type === 'IMAGE' || c.type === 'IMAGE_ARRAY',
    );

    if (imageColumns.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // Fetch rows
    const rows = await db.row.findMany({
      where: { dataSourceId },
      orderBy: { order: 'asc' },
      select: { id: true, data: true, order: true },
    });

    // Fetch all MediaAssets for this datasource
    const assets = await db.mediaAsset.findMany({
      where: { dataSourceId },
      select: { fileId: true, rowId: true, columnSlug: true, status: true, cdnUrl: true },
    });
    const assetMap = new Map(assets.map((a) => [`${a.fileId}:${a.columnSlug}`, a]));

    // Determine title column (best-effort)
    const titleCol = columns.find((c) => c.slug === '__title__' || c.type === 'TEXT');

    const entries = rows.map((row) => {
      const data = (row.data as Record<string, unknown>) || {};
      const productTitle = titleCol ? String(data[titleCol.slug] || '') : '';

      const images: Array<{
        url: string;
        source: 'drive' | 'cdn' | 'unknown';
        fileId: string | null;
        assetStatus: string | null;
      }> = [];

      for (const col of imageColumns) {
        const cellValue = String(data[col.slug] || '').trim();
        if (!cellValue) continue;
        const urls = col.type === 'IMAGE_ARRAY'
          ? cellValue.split(/[,;]\s*/).filter(Boolean)
          : [cellValue];
        for (const url of urls) {
          const fileId = extractDriveFileId(url);
          const source = detectImageSource(url);
          const assetKey = fileId ? `${fileId}:${col.slug}` : null;
          const asset = assetKey ? assetMap.get(assetKey) : null;
          images.push({
            url,
            source,
            fileId,
            assetStatus: asset?.status ?? null,
          });
        }
      }

      return {
        order: row.order,
        rowId: row.id,
        productTitle,
        images,
        hasMediaAsset: images.some((img) => img.assetStatus !== null),
      };
    });

    // Filter: entries with at least one image
    let filtered = entries.filter((e) => e.images.length > 0);

    if (orphansOnly) {
      // Orphans = CDN URLs with no active Row reference.
      // In this context: MediaAsset with status='cdn' but the row no longer
      // references the cdnUrl (cell was cleared or changed).
      const cdnAssetUrls = new Set(
        assets
          .filter((a) => a.status === 'cdn' && a.cdnUrl)
          .map((a) => a.cdnUrl!),
      );
      const activeCdnUrls = new Set(
        entries.flatMap((e) => e.images.map((img) => img.url)),
      );
      const orphanUrls = [...cdnAssetUrls].filter((u) => !activeCdnUrls.has(u));

      // Return orphan entries as synthetic rows
      filtered = orphanUrls.map((url, idx) => ({
        order: -(idx + 1), // negative to mark as orphan
        rowId: 'orphan',
        productTitle: '(orpheline)',
        images: [{
          url,
          source: 'cdn' as const,
          fileId: extractDriveFileId(url),
          assetStatus: 'cdn',
        }],
        hasMediaAsset: true,
      }));
    }

    return NextResponse.json({ data: filtered, error: null });
  } catch (error) {
    console.error('Media list error:', error);
    return NextResponse.json(
      { error: 'Failed to list media' },
      { status: 500 },
    );
  }
}
