import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { detectImageSource, extractDriveFileId } from '@/lib/media-utils';

/**
 * GET /api/catalog/media/list?dataSourceId=...&orphansOnly=true
 * Returns the media library: one entry per row × image URL + orphan assets.
 *
 * VG33.2: Each image now includes:
 * - mediaAssetId: string | null (for Unlink/Relink/Delete actions)
 * - originalRowId: string | null (for Relink display)
 * - isLinked: boolean (true = linked to a product, false = orphan)
 *
 * orphansOnly=true: returns only MediaAssets with rowId=null (unlinked/orphan).
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

    // Fetch all MediaAssets for this datasource
    const assets = await db.mediaAsset.findMany({
      where: { dataSourceId },
      select: { id: true, fileId: true, rowId: true, originalRowId: true, columnSlug: true, status: true, cdnUrl: true, fileName: true },
    });

    // Determine title column (best-effort)
    const titleCol = columns.find((c) => c.slug === '__title__' || c.type === 'TEXT');

    if (orphansOnly) {
      // Return only orphan assets (rowId=null)
      const orphanAssets = assets.filter((a) => !a.rowId && a.cdnUrl);
      const entries = orphanAssets.map((asset, idx) => ({
        order: -(idx + 1),
        rowId: 'orphan',
        productTitle: '(orpheline)',
        images: [{
          url: asset.cdnUrl!,
          source: 'cdn' as const,
          fileId: asset.fileId,
          assetStatus: asset.status,
          mediaAssetId: asset.id,
          originalRowId: asset.originalRowId,
          isLinked: false,
        }],
        hasMediaAsset: true,
      }));
      return NextResponse.json({ data: entries, error: null });
    }

    if (imageColumns.length === 0) {
      // Still return orphan assets even if no IMAGE columns
      const orphanAssets = assets.filter((a) => !a.rowId && a.cdnUrl);
      const entries = orphanAssets.map((asset, idx) => ({
        order: -(idx + 1),
        rowId: 'orphan',
        productTitle: '(orpheline)',
        images: [{
          url: asset.cdnUrl!,
          source: 'cdn' as const,
          fileId: asset.fileId,
          assetStatus: asset.status,
          mediaAssetId: asset.id,
          originalRowId: asset.originalRowId,
          isLinked: false,
        }],
        hasMediaAsset: true,
      }));
      return NextResponse.json({ data: entries, error: null });
    }

    // Fetch rows
    const rows = await db.row.findMany({
      where: { dataSourceId },
      orderBy: { order: 'asc' },
      select: { id: true, data: true, order: true },
    });

    const assetMap = new Map(assets.map((a) => [`${a.fileId}:${a.columnSlug}`, a]));

    const entries = rows.map((row) => {
      const data = (row.data as Record<string, unknown>) || {};
      const productTitle = titleCol ? String(data[titleCol.slug] || '') : '';

      const images: Array<{
        url: string;
        source: 'drive' | 'cdn' | 'unknown';
        fileId: string | null;
        assetStatus: string | null;
        mediaAssetId: string | null;
        originalRowId: string | null;
        isLinked: boolean;
      }> = [];

      for (const col of imageColumns) {
        const rawVal = data[col.slug];
        // VG33.3: IMAGE_ARRAY cells may be JSON arrays (JSON.stringify) or
        // comma-separated strings (legacy). Handle both formats.
        let urls: string[] = [];
        if (Array.isArray(rawVal)) {
          urls = rawVal.filter((u): u is string => typeof u === 'string' && u.trim());
        } else {
          const cellValue = String(rawVal || '').trim();
          if (!cellValue) continue;
          if (col.type === 'IMAGE_ARRAY') {
            // Try JSON parse first (VG33.3 format)
            if (cellValue.startsWith('[')) {
              try {
                const parsed = JSON.parse(cellValue);
                if (Array.isArray(parsed)) {
                  urls = parsed.filter((u): u is string => typeof u === 'string' && u.trim());
                }
              } catch {
                // Not valid JSON — fall back to comma split (legacy)
                urls = cellValue.split(/[,;]\s*/).filter(Boolean);
              }
            } else {
              // Legacy comma-separated format
              urls = cellValue.split(/[,;]\s*/).filter(Boolean);
            }
          } else {
            urls = [cellValue];
          }
        }
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
            mediaAssetId: asset?.id ?? null,
            originalRowId: asset?.originalRowId ?? null,
            isLinked: true,
          });
        }
      }

      return {
        order: row.order,
        rowId: row.id,
        productTitle,
        images,
        hasMediaAsset: images.some((img) => img.mediaAssetId !== null),
      };
    });

    // Also include orphan assets (rowId=null) as separate entries
    const orphanAssets = assets.filter((a) => !a.rowId && a.cdnUrl);
    const orphanEntries = orphanAssets.map((asset, idx) => ({
      order: -(idx + 1),
      rowId: 'orphan',
      productTitle: '(orpheline)',
      images: [{
        url: asset.cdnUrl!,
        source: 'cdn' as const,
        fileId: asset.fileId,
        assetStatus: asset.status,
        mediaAssetId: asset.id,
        originalRowId: asset.originalRowId,
        isLinked: false,
      }],
      hasMediaAsset: true,
    }));

    // Combine: linked entries with images + orphan entries
    const filtered = entries.filter((e) => e.images.length > 0);
    const combined = [...filtered, ...orphanEntries];

    return NextResponse.json({ data: combined, error: null });
  } catch (error) {
    console.error('Media list error:', error);
    return NextResponse.json(
      { error: 'Failed to list media' },
      { status: 500 },
    );
  }
}
