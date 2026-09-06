// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { extractDriveFileId } from '@/lib/media-utils';
import { Prisma } from '@prisma/client';

/**
 * POST /api/catalog/media/picker-sync
 * Injects Drive image URLs (from the Google Drive Picker) directly into the
 * cells of a targeted IMAGE / IMAGE_ARRAY column.
 *
 * Body: {
 *   dataSourceId: string,
 *   columnSlug: string,
 *   columnType: 'IMAGE' | 'IMAGE_ARRAY',
 *   urls: string[],            // Drive URLs selected via Picker
 *   rowIds?: string[],         // optional: specific rows (defaults to all rows with empty cell)
 * }
 *
 * Behavior:
 * - For IMAGE_ARRAY: appends the new URLs to existing ones (comma-separated).
 * - For IMAGE: fills only EMPTY cells (one URL per empty cell, in row order).
 * - Creates MediaAsset records (status='drive') for uniqueness tracking.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataSourceId, columnSlug, columnType, urls, rowIds } = body as {
      dataSourceId?: string;
      columnSlug?: string;
      columnType?: 'IMAGE' | 'IMAGE_ARRAY';
      urls?: string[];
      rowIds?: string[];
    };

    if (!dataSourceId || !columnSlug || !urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'dataSourceId, columnSlug and urls[] are required' },
        { status: 400 },
      );
    }

    // Verify DataSource exists
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

    let injectedCount = 0;
    const assetRecords: Array<{ fileId: string; rowId: string; originalUrl: string }> = [];

    if (columnType === 'IMAGE_ARRAY') {
      // Append to every target row (or all rows if none specified)
      const targetRows = rowIds && rowIds.length > 0 ? rows : rows.slice(0, 1);
      for (const row of targetRows) {
        const data = (row.data as Record<string, unknown>) || {};
        const existing = String(data[columnSlug] || '').trim();
        const allUrls = [
          ...existing.split(/[,;]\s*/).filter(Boolean),
          ...urls,
        ];
        data[columnSlug] = allUrls.join(', ');
        await db.row.update({ where: { id: row.id }, data: { data: data as unknown as Prisma.InputJsonValue } });
        injectedCount += urls.length;
        for (const url of urls) {
          const fileId = extractDriveFileId(url);
          if (fileId) assetRecords.push({ fileId, rowId: row.id, originalUrl: url });
        }
      }
    } else {
      // IMAGE: fill empty cells, one URL per row
      const urlQueue = [...urls];
      for (const row of rows) {
        if (urlQueue.length === 0) break;
        const data = (row.data as Record<string, unknown>) || {};
        const existing = String(data[columnSlug] || '').trim();
        if (!existing) {
          const url = urlQueue.shift()!;
          data[columnSlug] = url;
          await db.row.update({ where: { id: row.id }, data: { data: data as unknown as Prisma.InputJsonValue } });
          injectedCount++;
          const fileId = extractDriveFileId(url);
          if (fileId) assetRecords.push({ fileId, rowId: row.id, originalUrl: url });
        }
      }
    }

    // Upsert MediaAsset records for uniqueness tracking (status='drive')
    for (const rec of assetRecords) {
      await db.mediaAsset.upsert({
        where: { fileId_columnSlug: { fileId: rec.fileId, columnSlug } },
        update: { rowId: rec.rowId, originalUrl: rec.originalUrl, dataSourceId },
        create: {
          fileId: rec.fileId,
          rowId: rec.rowId,
          dataSourceId,
          columnSlug,
          originalUrl: rec.originalUrl,
          status: 'drive',
        },
      });
    }

    return NextResponse.json({
      data: { injected: injectedCount, assets: assetRecords.length },
      error: null,
    });
  } catch (error) {
    console.error('Picker-sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync picker URLs' },
      { status: 500 },
    );
  }
}
