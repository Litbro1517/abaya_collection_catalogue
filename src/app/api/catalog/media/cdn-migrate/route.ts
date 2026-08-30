import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { extractDriveFileId } from '@/lib/media-utils';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * POST /api/catalog/media/cdn-migrate
 * Migrates Google Drive images to the CDN (Supabase Storage → local fallback).
 *
 * Body: {
 *   dataSourceId: string,
 *   columnSlug: string,
 *   columnType: 'IMAGE' | 'IMAGE_ARRAY',
 *   rowIds?: string[],       // specific rows (bulk selection) — if omitted, all rows
 * }
 *
 * Algorithm:
 * 1. For each row, extract Drive file_ids from the cell.
 * 2. Uniqueness check: if a file_id is already attached to ANOTHER row
 *    (different rowId) via MediaAsset, BLOCK the migration for that image
 *    and report a conflict.
 * 3. Download from Drive (throttle 100ms between requests).
 * 4. Convert to .webp via Sharp.
 * 5. Upload to Supabase Storage (or local /public/uploads/ fallback).
 * 6. Update Row.data with the new CDN URL + MediaAsset record (status='cdn').
 */

const THROTTLE_MS = 100;
const DRIVE_DOWNLOAD_BASE = 'https://lh3.googleusercontent.com/d/';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataSourceId, columnSlug, columnType, rowIds } = body as {
      dataSourceId?: string;
      columnSlug?: string;
      columnType?: 'IMAGE' | 'IMAGE_ARRAY';
      rowIds?: string[];
    };

    if (!dataSourceId || !columnSlug) {
      return NextResponse.json(
        { error: 'dataSourceId and columnSlug are required' },
        { status: 400 },
      );
    }

    // Verify DataSource
    const ds = await db.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!ds) {
      return NextResponse.json({ error: 'DataSource not found' }, { status: 404 });
    }

    // Fetch target rows
    const whereClause = rowIds && rowIds.length > 0
      ? { id: { in: rowIds }, dataSourceId }
      : { dataSourceId };
    const rows = await db.row.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      select: { id: true, data: true },
    });

    const results: Array<{
      rowId: string;
      fileId: string;
      status: 'migrated' | 'conflict' | 'skipped' | 'failed';
      cdnUrl?: string;
      conflictRowId?: string;
    }> = [];

    let migratedCount = 0;
    let conflictCount = 0;
    const supabase = getSupabaseAdmin();

    for (const row of rows) {
      const data = (row.data as Record<string, unknown>) || {};
      const cellValue = String(data[columnSlug] || '').trim();
      if (!cellValue) continue;

      // Collect Drive file_ids from the cell
      const urls = columnType === 'IMAGE_ARRAY'
        ? cellValue.split(/[,;]\s*/).filter(Boolean)
        : [cellValue];

      const newUrls: string[] = [];
      let cellChanged = false;

      for (const url of urls) {
        const fileId = extractDriveFileId(url);
        if (!fileId) {
          // Not a Drive URL — passthrough (already CDN or unknown)
          newUrls.push(url);
          continue;
        }

        // ── Cross-column deduplication (VG33.3): is this file_id already migrated
        //    in ANY column? If yes, reuse the existing CDN URL — no re-download.
        //    Previous code checked fileId+columnSlug (per-column), causing double
        //    downloads when the same image appears in both individual IMAGE columns
        //    and the IMAGE_ARRAY gallery (40 downloads for 20 images).
        const existingAsset = await db.mediaAsset.findFirst({
          where: {
            fileId,
            status: 'cdn',
            cdnUrl: { not: null },
            rowId: { not: row.id },
          },
          select: { rowId: true, status: true, cdnUrl: true, columnSlug: true, id: true },
        });

        if (existingAsset && existingAsset.cdnUrl) {
          // File already on CDN (possibly in another column) — reuse the URL.
          // This is NOT a conflict: the same image can legitimately appear in
          // multiple columns of the same product. We just avoid re-downloading.
          newUrls.push(existingAsset.cdnUrl);
          results.push({ rowId: row.id, fileId, status: 'skipped', cdnUrl: existingAsset.cdnUrl });
          continue;
        }

        // Check if this file_id is already attached to ANOTHER row (true conflict)
        const conflictAsset = await db.mediaAsset.findFirst({
          where: {
            fileId,
            rowId: { not: row.id, not: null },
          },
          select: { rowId: true, status: true, cdnUrl: true },
        });

        if (conflictAsset) {
          results.push({
            rowId: row.id,
            fileId,
            status: 'conflict',
            conflictRowId: conflictAsset.rowId,
          });
          conflictCount++;
          newUrls.push(url); // keep the Drive URL
          continue;
        }

        // ── Download from Drive (throttled) ──
        await sleep(THROTTLE_MS);
        let downloadUrl = `${DRIVE_DOWNLOAD_BASE}${fileId}=w1200`;
        let driveRes = await fetch(downloadUrl);
        if (!driveRes.ok) {
          // Retry with proxy-style URL
          downloadUrl = `${DRIVE_DOWNLOAD_BASE}${fileId}`;
          driveRes = await fetch(downloadUrl);
        }
        if (!driveRes.ok || !driveRes.body) {
          results.push({ rowId: row.id, fileId, status: 'failed' });
          newUrls.push(url);
          continue;
        }

        const arrayBuffer = await driveRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // ── Convert to WebP via Sharp ──
        let webpBuffer: Buffer;
        try {
          const sharp = (await import('sharp')).default;
          webpBuffer = await sharp(buffer).webp({ quality: 82 }).toBuffer();
        } catch {
          // Sharp failed — use original buffer
          webpBuffer = buffer;
        }

        const fileName = `media/${fileId}.webp`;
        let cdnUrl: string;

        if (supabase) {
          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, webpBuffer, {
              contentType: 'image/webp',
              upsert: true,
            });
          if (uploadError) {
            results.push({ rowId: row.id, fileId, status: 'failed' });
            newUrls.push(url);
            continue;
          }
          const { data: pubData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(fileName);
          cdnUrl = pubData.publicUrl;
        } else {
          // Local fallback — write to public/uploads/media/
          const fs = await import('fs/promises');
          const path = await import('path');
          const localDir = path.join(process.cwd(), 'public', 'uploads', 'media');
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, `${fileId}.webp`), webpBuffer);
          cdnUrl = `/uploads/media/${fileId}.webp`;
        }

        // Update MediaAsset record
        await db.mediaAsset.upsert({
          where: { fileId_columnSlug: { fileId, columnSlug } },
          update: {
            rowId: row.id,
            dataSourceId,
            cdnUrl,
            fileName: `${fileId}.webp`,
            mimeType: 'image/webp',
            sizeBytes: webpBuffer.length,
            status: 'cdn',
          },
          create: {
            fileId,
            rowId: row.id,
            dataSourceId,
            columnSlug,
            originalUrl: url,
            cdnUrl,
            fileName: `${fileId}.webp`,
            mimeType: 'image/webp',
            sizeBytes: webpBuffer.length,
            status: 'cdn',
          },
        });

        newUrls.push(cdnUrl);
        cellChanged = true;
        migratedCount++;
        results.push({ rowId: row.id, fileId, status: 'migrated', cdnUrl });
      }

      // Update the cell if any URL changed.
      // VG33.3: IMAGE_ARRAY cells are stored as JSON.stringify (strict JSON array)
      // to preserve the gallery format. Previous code used join(', ') which broke
      // the carousel (badge showed "1 image" instead of "X images").
      if (cellChanged) {
        if (columnType === 'IMAGE_ARRAY') {
          data[columnSlug] = JSON.stringify(newUrls);
        } else {
          data[columnSlug] = newUrls[0];
        }
        await db.row.update({ where: { id: row.id }, data: { data } });
      }
    }

    return NextResponse.json({
      data: {
        migrated: migratedCount,
        conflicts: conflictCount,
        total: results.length,
        results,
      },
      error: null,
    });
  } catch (error) {
    console.error('CDN migrate error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate to CDN' },
      { status: 500 },
    );
  }
}
