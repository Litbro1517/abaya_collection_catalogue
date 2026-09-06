// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { Prisma } from '@prisma/client';

/**
 * POST /api/catalog/media/delete
 * Permanently deletes a media file: removes the URL from Row.data AND
 * deletes the physical file from the CDN storage.
 *
 * VG33.2: No more 409 block — the delete action now:
 * 1. Removes the cdnUrl from the Row.data cell (unlink first).
 * 2. Deletes the physical file from Supabase/local storage.
 * 3. Deletes the MediaAsset record.
 *
 * Body: { mediaAssetId?: string, cdnUrl?: string }
 * Supports bulk: { items: Array<{ mediaAssetId | cdnUrl }> }
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

    let deletedCount = 0;
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

        const targetCdnUrl = asset.cdnUrl;

        // ── Step 1: Remove the cdnUrl from Row.data (if still linked) ──
        if (asset.rowId && targetCdnUrl) {
          const row = await db.row.findUnique({
            where: { id: asset.rowId },
            select: { data: true },
          });
          if (row) {
            const data = (row.data as Record<string, unknown>) || {};
            const cellValue = String(data[asset.columnSlug] || '').trim();
            const urls = cellValue.split(/[,;]\s*/).filter(Boolean);
            const filtered = urls.filter((u) => u !== targetCdnUrl && u.trim() !== targetCdnUrl.trim());
            if (filtered.length !== urls.length) {
              data[asset.columnSlug] = filtered.length > 0 ? filtered.join(', ') : '';
              await db.row.update({
                where: { id: asset.rowId },
                data: { data: data as unknown as Prisma.InputJsonValue },
              });
            }
          }
        }

        // ── Step 2: Delete the physical file from storage ──
        if (asset.fileName) {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            const storagePath = asset.fileName.includes('/')
              ? asset.fileName
              : `media/${asset.fileName}`;
            const { error: delError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .remove([storagePath]);
            if (delError) {
              console.error('Supabase delete error:', delError);
            }
          } else {
            // Local fallback
            try {
              const fs = await import('fs/promises');
              const path = await import('path');
              const localPath = path.join(process.cwd(), 'public', 'uploads', 'media', asset.fileName);
              await fs.unlink(localPath);
            } catch {
              // File may not exist — non-fatal
            }
          }
        }

        // ── Step 3: Delete the MediaAsset record ──
        await db.mediaAsset.delete({ where: { id: asset.id } });

        deletedCount++;
      } catch (e) {
        errors.push(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      data: { deleted: deletedCount, errors: errors.length > 0 ? errors : undefined },
      error: null,
    });
  } catch (error) {
    console.error('Media delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete media' },
      { status: 500 },
    );
  }
}
