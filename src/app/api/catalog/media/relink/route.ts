import { toPrismaJson } from '@/lib/prisma-json';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/catalog/media/relink
 * Restore the link between an orphaned media asset and its original product.
 * Reinjects the CDN URL into the Row.data cell using originalRowId.
 *
 * Body: { mediaAssetId?: string, cdnUrl?: string }
 * Supports bulk: { items: Array<{ mediaAssetId | cdnUrl }> }
 *
 * Behavior:
 * 1. Find the MediaAsset (by id or cdnUrl).
 * 2. Read originalRowId — if null, cannot relink (no product memory).
 * 3. Verify the original Row still exists.
 * 4. Reinject the cdnUrl into Row.data[columnSlug]:
 *    - IMAGE: set the cell to cdnUrl (if currently empty).
 *    - IMAGE_ARRAY: append cdnUrl if not already present.
 * 5. Set MediaAsset.rowId = originalRowId, status = 'cdn'.
 *
 * Safety: uniqueness check — if another row already references this cdnUrl,
 * block the relink (409 Conflict) to prevent cross-product duplicates.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mediaAssetId, cdnUrl, items } = body as {
      mediaAssetId?: string;
      cdnUrl?: string;
      items?: Array<{ mediaAssetId?: string; cdnUrl?: string }>;
    };

    const targets = items && Array.isArray(items) && items.length > 0
      ? items
      : [{ mediaAssetId, cdnUrl }];

    if (targets.length === 0 || (!targets[0].mediaAssetId && !targets[0].cdnUrl)) {
      return NextResponse.json(
        { error: 'mediaAssetId or cdnUrl is required (or items[] array)' },
        { status: 400 },
      );
    }

    let relinkedCount = 0;
    let conflictCount = 0;
    const errors: string[] = [];

    for (const target of targets) {
      try {
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

        if (asset.rowId) {
          // Already linked — skip
          continue;
        }

        if (!asset.originalRowId) {
          errors.push(`No originalRowId for asset ${asset.id} — cannot relink`);
          continue;
        }

        const cdnUrlToRelink = asset.cdnUrl || '';
        if (!cdnUrlToRelink) {
          errors.push(`Asset ${asset.id} has no cdnUrl`);
          continue;
        }

        // ── Uniqueness check: is cdnUrl already referenced by ANOTHER row? ──
        const allRows = await db.row.findMany({
          where: { dataSourceId: asset.dataSourceId },
          select: { id: true, data: true },
        });
        const conflictingRow = allRows.find((r) => {
          if (r.id === asset.originalRowId) return false;
          const data = JSON.stringify(r.data || {});
          return data.includes(cdnUrlToRelink);
        });

        if (conflictingRow) {
          conflictCount++;
          errors.push(`CDN URL already referenced by row ${conflictingRow.id}`);
          continue;
        }

        // Verify the original row still exists
        const originalRow = await db.row.findUnique({
          where: { id: asset.originalRowId },
          select: { id: true, data: true },
        });

        if (!originalRow) {
          errors.push(`Original row ${asset.originalRowId} no longer exists`);
          continue;
        }

        // Reinject the cdnUrl into the cell
        const data = (originalRow.data as Record<string, unknown>) || {};
        const cellValue = String(data[asset.columnSlug] || '').trim();
        const existingUrls = cellValue.split(/[,;]\s*/).filter(Boolean);

        if (!existingUrls.includes(cdnUrlToRelink)) {
          existingUrls.push(cdnUrlToRelink);
        }

        data[asset.columnSlug] = existingUrls.join(', ');
        await db.row.update({
          where: { id: originalRow.id },
          data: { data: toPrismaJson(data) ?? {} }, // MANDAT 4P — tsc : narrowing JSON
        });

        // Restore the link
        await db.mediaAsset.update({
          where: { id: asset.id },
          data: {
            rowId: asset.originalRowId,
            status: 'cdn',
          },
        });

        relinkedCount++;
      } catch (e) {
        errors.push(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      data: { relinked: relinkedCount, conflicts: conflictCount, errors: errors.length > 0 ? errors : undefined },
      error: null,
    });
  } catch (error) {
    console.error('Media relink error:', error);
    return NextResponse.json(
      { error: 'Failed to relink media' },
      { status: 500 },
    );
  }
}
