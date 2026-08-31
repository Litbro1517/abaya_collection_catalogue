import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/catalog/media/unlink
 * Break the link between a media asset and its product (Row.data cell).
 * The CDN file is NOT touched — it stays on the CDN and becomes "orphan"
 * (status='orphan', rowId=null, originalRowId preserves the product memory).
 *
 * Body: { mediaAssetId?: string, cdnUrl?: string, rowId?: string, columnSlug?: string }
 *
 * Supports bulk mode: { items: Array<{ mediaAssetId | cdnUrl }> }
 *
 * Behavior:
 * 1. Find the MediaAsset (by id or cdnUrl).
 * 2. Remove the cdnUrl from the Row.data cell (IMAGE: clear; IMAGE_ARRAY: filter out).
 * 3. Set MediaAsset.rowId = null, originalRowId = previous rowId, status = 'orphan'.
 * 4. The file remains on the CDN for future Relink.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mediaAssetId, cdnUrl, items } = body as {
      mediaAssetId?: string;
      cdnUrl?: string;
      items?: Array<{ mediaAssetId?: string; cdnUrl?: string }>;
    };

    // Normalize to array for bulk support
    const targets = items && Array.isArray(items) && items.length > 0
      ? items
      : [{ mediaAssetId, cdnUrl }];

    if (targets.length === 0 || (!targets[0].mediaAssetId && !targets[0].cdnUrl)) {
      return NextResponse.json(
        { error: 'mediaAssetId or cdnUrl is required (or items[] array)' },
        { status: 400 },
      );
    }

    let unlinkedCount = 0;
    const errors: string[] = [];

    for (const target of targets) {
      try {
        // Find the asset
        let asset = null as Awaited<ReturnType<typeof db.mediaAsset.findUnique>> | null;
        if (target.mediaAssetId) {
          asset = await db.mediaAsset.findUnique({ where: { id: target.mediaAssetId } });
        } else if (target.cdnUrl) {
          asset = await db.mediaAsset.findFirst({ where: { cdnUrl: target.cdnUrl } });
        }

        if (!asset) {
          errors.push(`Asset not found for ${target.mediaAssetId || target.cdnUrl}`);
          continue;
        }

        if (!asset.rowId) {
          // Already unlinked/orphan — skip
          continue;
        }

        // Remove the cdnUrl from the Row.data cell
        const row = await db.row.findUnique({
          where: { id: asset.rowId },
          select: { data: true },
        });

        if (row) {
          const data = (row.data as Record<string, unknown>) || {};
          const cellValue = String(data[asset.columnSlug] || '').trim();
          const cdnUrlToRemove = asset.cdnUrl || '';

          if (cdnUrlToRemove) {
            // Check if the cell contains this URL
            const urls = cellValue.split(/[,;]\s*/).filter(Boolean);
            const filtered = urls.filter((u) => u !== cdnUrlToRemove && u.trim() !== cdnUrlToRemove.trim());

            if (filtered.length !== urls.length) {
              // URL was found — update the cell
              data[asset.columnSlug] = filtered.length > 0 ? filtered.join(', ') : '';
              await db.row.update({
                where: { id: asset.rowId },
                data: { data },
              });
            }
          }
        }

        // Set the asset to orphan state (preserve originalRowId for Relink)
        await db.mediaAsset.update({
          where: { id: asset.id },
          data: {
            rowId: null,
            originalRowId: asset.rowId,
            status: 'orphan',
          },
        });

        unlinkedCount++;
      } catch (e) {
        errors.push(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      data: { unlinked: unlinkedCount, errors: errors.length > 0 ? errors : undefined },
      error: null,
    });
  } catch (error) {
    console.error('Media unlink error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink media' },
      { status: 500 },
    );
  }
}
