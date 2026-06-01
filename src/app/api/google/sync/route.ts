import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { fetchPrivateSheetData, fetchPublicSheetAsCsv, generateSlug } from '@/lib/google/sheets';
import { getValidAccessToken } from '@/lib/google/auth';
import { resolveImageUrl } from '@/lib/google/drive-images';

/**
 * POST /api/google/sync
 * Import a Google Sheet as a new DataSource, or sync an existing one
 *
 * Body: {
 *   sheetId: string;         // Google Sheet ID
 *   sheetName?: string;      // Specific tab/sheet name
 *   dataSourceId?: string;   // Existing DataSource ID (for sync)
 *   googleSessionId?: string; // Google session ID for private access
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sheetId, sheetName, dataSourceId, googleSessionId, gid } = body;

    if (!sheetId) {
      return NextResponse.json(
        { data: null, error: 'sheetId is required' },
        { status: 400 }
      );
    }

    // Fetch the sheet data - try private first, fall back to public
    let sheetData: {
      headers: string[];
      rows: string[][];
      imageColumns: string[];
      columnTypes: import('@/types').ColumnType[];
    } | null = null;

    // Try private access if we have a session
    const tokenInfo = await getValidAccessToken();
    if (tokenInfo) {
      sheetData = await fetchPrivateSheetData(
        tokenInfo.accessToken,
        sheetId,
        sheetName
      );
    }

    // Fallback to public CSV access
    if (!sheetData) {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      sheetData = await fetchPublicSheetAsCsv(sheetUrl, sheetName, gid);
    }

    if (!sheetData || sheetData.headers.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Failed to fetch sheet data. The sheet may be private and not published to the web.' },
        { status: 400 }
      );
    }

    const { headers, rows, columnTypes } = sheetData;

    // Filter out empty rows
    const dataRows = rows.filter(r => r.some(c => c && c.trim().length > 0));

    let dsId = dataSourceId;
    let isNewDataSource = false;

    // If no dataSourceId, create a new DataSource
    if (!dsId) {
      // Try to get the spreadsheet name from the Google API
      let dsName = sheetName || `Google Sheet (${sheetId.slice(0, 8)})`;
      if (tokenInfo) {
        try {
          const metaRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title`,
            { headers: { Authorization: `Bearer ${tokenInfo.accessToken}` } }
          );
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            if (metaData.properties?.title) {
              dsName = metaData.properties.title;
            }
          }
        } catch {
          // Ignore - use default name
        }
      }

      const slug = generateSlug(dsName);

      // Ensure slug uniqueness
      let finalSlug = slug;
      let suffix = 1;
      while (await db.dataSource.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${suffix}`;
        suffix++;
      }

      const ds = await db.dataSource.create({
        data: {
          name: dsName,
          slug: finalSlug,
          sourceType: 'googlesheet',
          sourceUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
          sheetId,
          sheetName: sheetName || null,
          googleSessionId: googleSessionId || tokenInfo?.sessionId || null,
          syncInterval: 0,
          lastSyncedAt: new Date(),
        },
      });

      dsId = ds.id;
      isNewDataSource = true;
    }

    // If syncing an existing DataSource, clear old columns and rows
    if (!isNewDataSource) {
      await db.column.deleteMany({ where: { dataSourceId: dsId } });
      await db.row.deleteMany({ where: { dataSourceId: dsId } });
    }

    // Generate column slugs
    const columnSlugs: string[] = [];
    const slugCount: Record<string, number> = {};

    for (let c = 0; c < headers.length; c++) {
      let slug = generateSlug(headers[c]);
      if (!slug) slug = `column_${c}`;
      if (slugCount[slug] !== undefined) {
        slugCount[slug]++;
        slug = `${slug}_${slugCount[slug]}`;
      } else {
        slugCount[slug] = 0;
      }
      columnSlugs.push(slug);
    }

    // Detect image group columns (consecutive "groupe image N" columns)
    const groupePattern = /^groupe\s*image/i;
    const imageGroupIndices: number[] = [];

    for (let c = 0; c < headers.length; c++) {
      if (groupePattern.test(headers[c])) {
        imageGroupIndices.push(c);
      }
    }

    // Create columns — pass native objects for Json config fields (PostgreSQL)
    const columnsToCreate = [];
    const columnsToSkip = new Set<number>();
    let imageArraySlug: string | null = null;

    if (imageGroupIndices.length > 1) {
      imageArraySlug = 'groupe_images';
      columnsToCreate.push({
        name: 'Galerie Images',
        slug: imageArraySlug,
        type: 'IMAGE_ARRAY',
        order: headers.length,
        visible: true,
        required: false,
        config: { sourceColumns: imageGroupIndices.map(i => columnSlugs[i]) },
        dataSourceId: dsId,
      });
      imageGroupIndices.forEach(i => columnsToSkip.add(i));
    }

    for (let c = 0; c < headers.length; c++) {
      const config: Record<string, unknown> = {};
      const colType = columnTypes[c];

      // Add config for specific types
      if (colType === 'CURRENCY') {
        config.currencySymbol = 'DH';
      }
      if (colType === 'SELECT' || colType === 'MULTI_SELECT') {
        const uniqueVals = new Set<string>();
        dataRows.forEach(r => {
          const val = r[c] || '';
          if (val) {
            val.split(/[,;]/).forEach(v => {
              const trimmed = v.trim();
              if (trimmed) uniqueVals.add(trimmed);
            });
          }
        });
        config.options = Array.from(uniqueVals);
      }

      columnsToCreate.push({
        name: headers[c],
        slug: columnSlugs[c],
        type: columnsToSkip.has(c) ? 'IMAGE' : colType,
        order: c,
        visible: !columnsToSkip.has(c),
        required: false,
        config,
        dataSourceId: dsId,
      });
    }

    // Create columns in DB — use createMany for a single INSERT (avoids connection pool exhaustion)
    await db.column.createMany({ data: columnsToCreate });

    // Build row data — resolve URLs and group images
    const rowsToCreate: { dataSourceId: string; data: Record<string, unknown>; order: number }[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowData: Record<string, unknown> = {};
      for (let c = 0; c < headers.length; c++) {
        if (c < row.length && row[c]) {
          // Resolve Drive image URLs to proxy URLs
          const colType = columnTypes[c];
          if (colType === 'IMAGE' || colType === 'IMAGE_ARRAY') {
            rowData[columnSlugs[c]] = resolveImageUrl(row[c]);
          } else {
            rowData[columnSlugs[c]] = row[c];
          }
        }
      }

      // Build grouped image array — store as native array (not stringified)
      if (imageArraySlug && imageGroupIndices.length > 0) {
        const images: string[] = [];
        imageGroupIndices.forEach(c => {
          if (row[c] && row[c].length > 0) {
            images.push(resolveImageUrl(row[c]));
          }
        });
        if (images.length > 0) {
          rowData[imageArraySlug] = images;
        }
      }

      rowsToCreate.push({
        dataSourceId: dsId,
        data: rowData,
        order: i,
      });
    }

    // Insert rows in batches using createMany (single INSERT per batch — avoids connection pool issues)
    const batchSize = 50;
    for (let i = 0; i < rowsToCreate.length; i += batchSize) {
      const batch = rowsToCreate.slice(i, i + batchSize);
      await db.row.createMany({ data: batch });
    }

    // Update lastSyncedAt
    await db.dataSource.update({
      where: { id: dsId },
      data: { lastSyncedAt: new Date() },
    });

    // Get the updated data source with counts
    const ds = await db.dataSource.findUnique({
      where: { id: dsId },
      include: { _count: { select: { columns: true, rows: true } } },
    });

    return NextResponse.json({
      data: {
        dataSourceId: dsId,
        isNew: isNewDataSource,
        name: ds?.name,
        rowsCreated: dataRows.length,
        columnsCreated: columnsToCreate.length,
        imageColumns: sheetData.imageColumns,
        columnTypes: Object.fromEntries(columnSlugs.map((s, i) => [s, columnTypes[i]])),
        lastSyncedAt: ds?.lastSyncedAt,
      },
      error: null,
    }, { status: isNewDataSource ? 201 : 200 });
  } catch (e) {
    console.error('Google sync error:', e);
    return NextResponse.json(
      { data: null, error: 'Google sync failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
