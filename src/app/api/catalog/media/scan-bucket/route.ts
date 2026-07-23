import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { extractDriveFileId } from '@/lib/media-utils';

/**
 * GET /api/catalog/media/scan-bucket?dataSourceId=...
 *
 * VG33.3: Scans the ACTUAL CDN bucket (Supabase Storage or local /uploads/media/)
 * and compares it with the database to find "ghost files" — physical CDN files
 * that are NOT referenced by any Row.data cell and NOT tracked by MediaAsset.
 *
 * Returns:
 * {
 *   data: {
 *     bucketFiles: Array<{ name: string, size: number, fileId: string | null }>,
 *     ghostFiles: Array<{ name: string, size: number, fileId: string | null }>,
 *     trackedFiles: Array<{ name: string, cdnUrl: string }>,
 *   }
 * }
 *
 * ghostFiles = bucketFiles NOT in trackedFiles (by fileId or fileName).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataSourceId = searchParams.get('dataSourceId');

    if (!dataSourceId) {
      return NextResponse.json(
        { error: 'dataSourceId is required' },
        { status: 400 },
      );
    }

    // ── Step 1: List physical files on the CDN bucket ──
    let bucketFiles: Array<{ name: string; size: number; fileId: string | null }> = [];

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: fileList, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list('media', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (error) {
        console.error('Supabase bucket list error:', error);
      } else if (fileList) {
        bucketFiles = fileList
          .filter((f) => !f.id.endsWith('/')) // exclude folders
          .map((f) => ({
            name: f.name,
            size: f.metadata?.size || 0,
            fileId: f.name.replace(/\.webp$/, ''),
          }));
      }
    } else {
      // Local fallback — scan /public/uploads/media/
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const localDir = path.join(process.cwd(), 'public', 'uploads', 'media');
        const files = await fs.readdir(localDir);
        for (const fileName of files) {
          const stat = await fs.stat(path.join(localDir, fileName));
          bucketFiles.push({
            name: fileName,
            size: stat.size,
            fileId: fileName.replace(/\.webp$/, ''),
          });
        }
      } catch {
        // Directory may not exist — no local files
      }
    }

    // ── Step 2: Get all tracked CDN URLs from MediaAsset + Row.data ──
    const assets = await db.mediaAsset.findMany({
      where: { dataSourceId, status: 'cdn', cdnUrl: { not: null } },
      select: { cdnUrl: true, fileName: true, fileId: true },
    });

    const trackedFileNames = new Set(
      assets
        .map((a) => a.fileName || '')
        .filter(Boolean),
    );
    const trackedFileIds = new Set(
      assets
        .map((a) => a.fileId)
        .filter(Boolean),
    );

    // Also scan Row.data for any CDN URLs that might not have a MediaAsset
    const rows = await db.row.findMany({
      where: { dataSourceId },
      select: { data: true },
    });
    const allRowUrls = new Set<string>();
    rows.forEach((row) => {
      const data = JSON.stringify(row.data || {});
      // Extract URLs that look like CDN paths
      const matches = data.match(/https:\/\/[^"'\s]+\.webp|\/uploads\/media\/[^"'\s]+\.webp/g);
      if (matches) {
        matches.forEach((u) => allRowUrls.add(u));
      }
    });

    // Add fileIds from Row.data URLs
    allRowUrls.forEach((url) => {
      const fileId = extractDriveFileId(url);
      if (fileId) trackedFileIds.add(fileId);
      // Also extract from filename in URL
      const nameMatch = url.match(/\/([^/]+)\.webp$/);
      if (nameMatch) trackedFileNames.add(nameMatch[1] + '.webp');
    });

    // ── Step 3: Find ghost files (in bucket but not tracked) ──
    const ghostFiles = bucketFiles.filter((f) => {
      // Check by fileName
      if (trackedFileNames.has(f.name)) return false;
      // Check by fileId
      if (f.fileId && trackedFileIds.has(f.fileId)) return false;
      return true;
    });

    const trackedFiles = bucketFiles.filter((f) => !ghostFiles.includes(f));

    return NextResponse.json({
      data: {
        bucketFiles,
        ghostFiles,
        trackedFiles,
        totalBucket: bucketFiles.length,
        totalGhosts: ghostFiles.length,
        totalTracked: trackedFiles.length,
      },
      error: null,
    });
  } catch (error) {
    console.error('Bucket scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan bucket' },
      { status: 500 },
    );
  }
}
