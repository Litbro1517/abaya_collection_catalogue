import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * POST /api/catalog/media/delete
 * Physically deletes a media file from the CDN (Supabase Storage or local).
 *
 * Body: { cdnUrl: string }  OR  { mediaAssetId: string }
 *
 * Safety check: before deletion, verifies that NO active Row still references
 * the cdnUrl. If any row references it, the deletion is BLOCKED (409 Conflict).
 *
 * On success: removes the file from storage + deletes the MediaAsset record.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cdnUrl, mediaAssetId } = body as { cdnUrl?: string; mediaAssetId?: string };

    if (!cdnUrl && !mediaAssetId) {
      return NextResponse.json(
        { error: 'cdnUrl or mediaAssetId is required' },
        { status: 400 },
      );
    }

    // Find the MediaAsset
    let asset = null as Awaited<ReturnType<typeof db.mediaAsset.findUnique>> | null;
    if (mediaAssetId) {
      asset = await db.mediaAsset.findUnique({ where: { id: mediaAssetId } });
    } else if (cdnUrl) {
      asset = await db.mediaAsset.findFirst({ where: { cdnUrl } });
    }

    if (!asset) {
      return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 });
    }

    const targetCdnUrl = asset.cdnUrl;
    if (!targetCdnUrl) {
      return NextResponse.json(
        { error: 'Asset has no CDN URL (still on Drive — nothing to delete)' },
        { status: 400 },
      );
    }

    // ── Safety check: is the cdnUrl still referenced by any Row? ──
    // Scan all rows in the datasource for the cdnUrl in any IMAGE cell.
    const rows = await db.row.findMany({
      where: { dataSourceId: asset.dataSourceId },
      select: { data: true },
    });
    const stillReferenced = rows.some((row) => {
      const data = JSON.stringify(row.data || {});
      return data.includes(targetCdnUrl);
    });

    if (stillReferenced) {
      return NextResponse.json(
        { error: 'Deletion blocked: this CDN URL is still referenced by a product. Clear the cell first.' },
        { status: 409 },
      );
    }

    // ── Delete from storage ──
    if (asset.fileName) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Supabase path: media/{fileId}.webp
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

    // ── Delete the MediaAsset record ──
    await db.mediaAsset.delete({ where: { id: asset.id } });

    return NextResponse.json({
      data: { deleted: true, cdnUrl: targetCdnUrl },
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
