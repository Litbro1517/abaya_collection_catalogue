import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { fetchPrivateSheetData, fetchPublicSheetAsCsv, generateSlug } from '@/lib/google/sheets';
import { getValidAccessToken } from '@/lib/google/auth';
import { resolveImageUrl } from '@/lib/google/drive-images';

/**
 * POST /api/google/sync
 * Import a Google Sheet as a new DataSource, or DELTA-sync an existing one
 *
 * Body: {
 *   sheetId: string;         // Google Sheet ID
 *   sheetName?: string;      // Specific tab/sheet name
 *   dataSourceId?: string;   // Existing DataSource ID (for delta sync)
 *   googleSessionId?: string; // Google session ID for private access
 *   mode?: 'full' | 'delta'; // Sync mode (auto-detected: 'delta' if dataSourceId provided)
 * }
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DELTA SYNC ENGINE — Strict Rules:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. Compare ONLY the "#" column (ID Métier) between Google Sheet and existing catalogue
 * 2. IGNORE Glide system IDs entirely
 * 3. Only INSERT missing entries (rows absent from catalogue by "#" value)
 * 4. NEVER overwrite existing data
 * 5. Auto-initialize new rows: Statut="Courant", Disponibilité=OFF ("Épuisé"), Visibilité="Visible"
 * 6. Diagnostic console log BEFORE execution
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sheetId, sheetName, dataSourceId, googleSessionId, gid, mode } = body;

    if (!sheetId) {
      return NextResponse.json(
        { data: null, error: 'sheetId is required' },
        { status: 400 }
      );
    }

    // Determine sync mode: delta if dataSourceId is provided (re-sync), full for new imports
    const isDeltaSync = !!dataSourceId && mode !== 'full';

    // ━━━ FETCH GOOGLE SHEET DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let sheetData: {
      headers: string[];
      rows: string[][];
      imageColumns: string[];
      columnTypes: import('@/types').ColumnType[];
    } | null = null;

    const tokenInfo = await getValidAccessToken();
    if (tokenInfo) {
      sheetData = await fetchPrivateSheetData(
        tokenInfo.accessToken,
        sheetId,
        sheetName
      );
    }

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

    // ━━━ GENERATE COLUMN SLUGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

    // ━━━ FIND THE "#" COLUMN (ID MÉTIER) ━━━━━━━━━━━━━━━━━━━━━━━━━━
    // The "#" column is the unique business identifier used for delta comparison
    let idMetierColIndex = -1;
    let idMetierSlug = '';

    for (let c = 0; c < headers.length; c++) {
      if (headers[c].trim() === '#') {
        idMetierColIndex = c;
        idMetierSlug = columnSlugs[c];
        break;
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // BRANCH 1: FULL IMPORT (New DataSource — first-time import)
    // ═══════════════════════════════════════════════════════════════
    if (!isDeltaSync) {
      let dsId = dataSourceId;
      let isNewDataSource = false;

      if (!dsId) {
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

      // Full import: clear old data and recreate
      if (!isNewDataSource) {
        await db.column.deleteMany({ where: { dataSourceId: dsId } });
        await db.row.deleteMany({ where: { dataSourceId: dsId } });
      }

      // Detect image group columns
      const groupePattern = /^groupe\s*image/i;
      const imageGroupIndices: number[] = [];
      for (let c = 0; c < headers.length; c++) {
        if (groupePattern.test(headers[c])) {
          imageGroupIndices.push(c);
        }
      }

      // Create columns
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

      await db.column.createMany({ data: columnsToCreate });

      // Build row data with auto-initialization for first import
      const rowsToCreate: { dataSourceId: string; data: Record<string, unknown>; order: number }[] = [];
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowData: Record<string, unknown> = {};
        for (let c = 0; c < headers.length; c++) {
          if (c < row.length && row[c]) {
            const colType = columnTypes[c];
            if (colType === 'IMAGE' || colType === 'IMAGE_ARRAY') {
              rowData[columnSlugs[c]] = resolveImageUrl(row[c]);
            } else {
              rowData[columnSlugs[c]] = row[c];
            }
          }
        }

        // Grouped image array
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

        // Auto-initialization defaults for first import
        rowData.__statut__ = 'Courant';
        rowData.__statut_locked__ = false;
        rowData.__is_visible__ = true;

        // Find BOOLEAN "Disponibilité" column and set to false (Épuisé)
        for (let c = 0; c < headers.length; c++) {
          const colName = headers[c].toLowerCase();
          if ((colName.includes('disponible') || colName.includes('disponibilite')) && columnTypes[c] === 'BOOLEAN') {
            rowData[columnSlugs[c]] = 'false';
          }
        }

        rowsToCreate.push({
          dataSourceId: dsId,
          data: rowData,
          order: i,
        });
      }

      const batchSize = 50;
      for (let i = 0; i < rowsToCreate.length; i += batchSize) {
        const batch = rowsToCreate.slice(i, i + batchSize);
        await db.row.createMany({ data: batch });
      }

      await db.dataSource.update({
        where: { id: dsId },
        data: { lastSyncedAt: new Date() },
      });

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
          syncMode: 'full',
        },
        error: null,
      }, { status: isNewDataSource ? 201 : 200 });
    }

    // ═══════════════════════════════════════════════════════════════
    // BRANCH 2: DELTA SYNC ENGINE (Existing DataSource re-sync)
    // ═══════════════════════════════════════════════════════════════
    const dsId = dataSourceId as string;

    // Verify the DataSource exists
    const existingDs = await db.dataSource.findUnique({
      where: { id: dsId },
      include: { columns: true },
    });

    if (!existingDs) {
      return NextResponse.json(
        { data: null, error: 'DataSource not found' },
        { status: 404 }
      );
    }

    // ━━━ DIAGNOSTIC: Load existing rows ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const existingRows = await db.row.findMany({
      where: { dataSourceId: dsId },
    });

    // ━━━ FIND THE "#" COLUMN IN EXISTING DB ━━━━━━━━━━━━━━━━━━━━━━━
    let dbIdMetierSlug = '';
    let dbIdMetierColName = '';

    // First try to find by exact name "#"
    for (const col of existingDs.columns) {
      if (col.name.trim() === '#') {
        dbIdMetierSlug = col.slug;
        dbIdMetierColName = col.name;
        break;
      }
    }

    // Fallback: try common names like "N°", "ID Métier", "N Ordre"
    if (!dbIdMetierSlug) {
      for (const col of existingDs.columns) {
        const nameLower = col.name.toLowerCase().trim();
        if (
          nameLower === 'n°' ||
          nameLower === 'n ordre' ||
          nameLower === 'id métier' ||
          nameLower === 'id metier' ||
          nameLower === 'ref' ||
          nameLower === 'référence' ||
          nameLower === 'reference'
        ) {
          dbIdMetierSlug = col.slug;
          dbIdMetierColName = col.name;
          break;
        }
      }
    }

    // Also try to find "#" column in the Google Sheet headers
    let sheetIdMetierIndex = -1;
    let sheetIdMetierSlug = '';

    for (let c = 0; c < headers.length; c++) {
      if (headers[c].trim() === '#') {
        sheetIdMetierIndex = c;
        sheetIdMetierSlug = columnSlugs[c];
        break;
      }
    }

    // If we found "#" in the sheet but not in DB, try matching by position (column_0)
    if (sheetIdMetierIndex >= 0 && !dbIdMetierSlug) {
      // The "#" column in the sheet maps to columnSlugs[sheetIdMetierIndex]
      // Check if this slug exists in the DB columns
      const matchingCol = existingDs.columns.find(c => c.slug === columnSlugs[sheetIdMetierIndex]);
      if (matchingCol) {
        dbIdMetierSlug = matchingCol.slug;
        dbIdMetierColName = matchingCol.name;
      }
    }

    // ━━━ BUILD SET OF EXISTING ID MÉTIER VALUES ━━━━━━━━━━━━━━━━━━
    const existingIdMetierValues = new Set<string>();

    if (dbIdMetierSlug) {
      for (const row of existingRows) {
        const data = row.data as Record<string, unknown>;
        const idValue = String(data[dbIdMetierSlug] ?? '').trim();
        if (idValue) {
          existingIdMetierValues.add(idValue);
        }
      }
    }

    // ━━━ DIAGNOSTIC: Column structure comparison ━━━━━━━━━━━━━━━━━━
    const existingColumnNames = new Set(existingDs.columns.map(c => c.name));
    const sheetColumnNames = new Set(headers);
    const newColumnsInSheet = headers.filter(h => !existingColumnNames.has(h));
    const missingColumnsInSheet = existingDs.columns.filter(c => !sheetColumnNames.has(c.name));

    // If "#" column not found, we can still do delta sync using all columns as fallback
    // but warn in the diagnostic
    const canDoDeltaById = !!dbIdMetierSlug && existingIdMetierValues.size > 0;

    // ━━━ SAFETY DIAGNOSTIC LOG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━'.repeat(60));
    console.log('🔍 DELTA SYNC ENGINE — DIAGNOSTIC');
    console.log('━'.repeat(60));
    console.log(`📊 DataSource: "${existingDs.name}" (${dsId})`);
    console.log(`📋 Existing products in catalogue: ${existingRows.length}`);
    console.log(`📄 Google Sheet rows: ${dataRows.length}`);
    console.log(`🔑 ID Métier column: ${dbIdMetierSlug ? `"${dbIdMetierColName}" (slug: ${dbIdMetierSlug})` : '⚠️ NOT FOUND'}`);
    console.log(`🔑 Existing ID Métier values: ${existingIdMetierValues.size}`);
    if (existingIdMetierValues.size > 0 && existingIdMetierValues.size <= 20) {
      console.log(`   Values: [${Array.from(existingIdMetierValues).join(', ')}]`);
    }
    console.log(`📊 Column structure check:`);
    console.log(`   Existing columns: ${existingDs.columns.length}`);
    console.log(`   Sheet columns: ${headers.length}`);
    console.log(`   New columns in sheet: ${newColumnsInSheet.length}${newColumnsInSheet.length > 0 ? ` (${newColumnsInSheet.join(', ')})` : ''}`);
    console.log(`   Missing columns from sheet: ${missingColumnsInSheet.length}${missingColumnsInSheet.length > 0 ? ` (${missingColumnsInSheet.map(c => c.name).join(', ')})` : ''}`);
    console.log(`   Column structure unchanged: ${newColumnsInSheet.length === 0 && missingColumnsInSheet.length === 0 ? '✅ YES' : '⚠️ CHANGED'}`);

    // ━━━ IDENTIFY NEW ROWS TO INSERT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const newRows: { rowData: Record<string, unknown>; idMetierValue: string; sheetRowIndex: number }[] = [];
    const existingRowsSkipped: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Get the ID Métier value from this sheet row
      let rowIdMetier = '';

      if (sheetIdMetierIndex >= 0 && row[sheetIdMetierIndex]) {
        rowIdMetier = row[sheetIdMetierIndex].trim();
      } else if (dbIdMetierSlug) {
        // Fallback: try to find by matching slug position
        for (let c = 0; c < headers.length; c++) {
          if (columnSlugs[c] === dbIdMetierSlug && row[c]) {
            rowIdMetier = row[c].trim();
            break;
          }
        }
      }

      if (!rowIdMetier) {
        // Skip rows without ID Métier — they can't be compared
        continue;
      }

      if (existingIdMetierValues.has(rowIdMetier)) {
        // EXISTING row — DO NOT TOUCH (strict rule: never overwrite)
        existingRowsSkipped.push(rowIdMetier);
        continue;
      }

      // NEW row — needs to be inserted
      newRows.push({
        rowData: {},
        idMetierValue: rowIdMetier,
        sheetRowIndex: i,
      });
    }

    console.log(`📊 Delta analysis:`);
    console.log(`   Products already in catalogue (no action): ${existingRowsSkipped.length}`);
    console.log(`   New products to INSERT: ${newRows.length}`);
    if (newRows.length > 0 && newRows.length <= 20) {
      console.log(`   New ID Métier values: [${newRows.map(r => r.idMetierValue).join(', ')}]`);
    }
    console.log(`   Auto-initialization: Statut="Courant", Disponibilité=OFF (Épuisé), Visibilité=Visible 👁️`);
    console.log('━'.repeat(60));

    // ━━━ HANDLE NEW COLUMNS (if any) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // If the Google Sheet has new columns that don't exist in the DB, add them
    if (newColumnsInSheet.length > 0) {
      const maxOrder = Math.max(...existingDs.columns.map(c => c.order), 0);

      for (let i = 0; i < newColumnsInSheet.length; i++) {
        const headerName = newColumnsInSheet[i];
        const headerIndex = headers.indexOf(headerName);
        const colType = headerIndex >= 0 ? columnTypes[headerIndex] : 'TEXT';
        const config: Record<string, unknown> = {};

        if (colType === 'CURRENCY') {
          config.currencySymbol = 'DH';
        }
        if (colType === 'SELECT' || colType === 'MULTI_SELECT') {
          const uniqueVals = new Set<string>();
          dataRows.forEach(r => {
            const val = r[headerIndex] || '';
            if (val) {
              val.split(/[,;]/).forEach(v => {
                const trimmed = v.trim();
                if (trimmed) uniqueVals.add(trimmed);
              });
            }
          });
          config.options = Array.from(uniqueVals);
        }

        await db.column.create({
          data: {
            name: headerName,
            slug: columnSlugs[headerIndex],
            type: colType,
            order: maxOrder + i + 1,
            visible: true,
            required: false,
            config,
            dataSourceId: dsId,
          },
        });
      }

      console.log(`✅ Added ${newColumnsInSheet.length} new column(s) to DataSource`);
    }

    // ━━━ BUILD AND INSERT NEW ROWS WITH AUTO-INITIALIZATION ━━━━━━━
    // Find the Disponibilité column slug for auto-initialization
    let dispoColSlug = '';
    for (const col of existingDs.columns) {
      const nameLower = col.name.toLowerCase();
      if ((nameLower.includes('disponible') || nameLower.includes('disponibilite')) && col.type === 'BOOLEAN') {
        dispoColSlug = col.slug;
        break;
      }
    }
    // Also check new columns
    if (!dispoColSlug) {
      for (let c = 0; c < headers.length; c++) {
        const nameLower = headers[c].toLowerCase();
        if ((nameLower.includes('disponible') || nameLower.includes('disponibilite')) && columnTypes[c] === 'BOOLEAN') {
          dispoColSlug = columnSlugs[c];
          break;
        }
      }
    }

    // Get the max order of existing rows to append new rows at the correct position
    const maxExistingOrder = existingRows.length > 0
      ? Math.max(...existingRows.map(r => r.order))
      : -1;

    // Detect image group columns for new rows
    const groupePattern = /^groupe\s*image/i;
    const imageGroupIndices: number[] = [];
    for (let c = 0; c < headers.length; c++) {
      if (groupePattern.test(headers[c])) {
        imageGroupIndices.push(c);
      }
    }
    let imageArraySlug: string | null = null;
    for (const col of existingDs.columns) {
      if (col.type === 'IMAGE_ARRAY' && col.slug === 'groupe_images') {
        imageArraySlug = col.slug;
        break;
      }
    }

    const rowsToCreate: { dataSourceId: string; data: Record<string, unknown>; order: number }[] = [];

    for (let idx = 0; idx < newRows.length; idx++) {
      const { sheetRowIndex } = newRows[idx];
      const row = dataRows[sheetRowIndex];
      const rowData: Record<string, unknown> = {};

      // Build row data from sheet columns
      for (let c = 0; c < headers.length; c++) {
        if (c < row.length && row[c]) {
          const colType = columnTypes[c];
          if (colType === 'IMAGE' || colType === 'IMAGE_ARRAY') {
            rowData[columnSlugs[c]] = resolveImageUrl(row[c]);
          } else {
            rowData[columnSlugs[c]] = row[c];
          }
        }
      }

      // Grouped image array
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

      // ━━━ AUTO-INITIALIZATION (Strict defaults) ━━━━━━━━━━━━━━━━━
      // Statut = "Courant"
      rowData.__statut__ = 'Courant';
      rowData.__statut_locked__ = false;

      // Visibilité = Visible (👁️)
      rowData.__is_visible__ = true;

      // Disponibilité = Switch OFF → "Épuisé" (Stock 0 rule)
      if (dispoColSlug) {
        rowData[dispoColSlug] = 'false';
      }

      rowsToCreate.push({
        dataSourceId: dsId,
        data: rowData,
        order: maxExistingOrder + idx + 1,
      });
    }

    // Insert new rows in batches
    let insertedCount = 0;
    if (rowsToCreate.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < rowsToCreate.length; i += batchSize) {
        const batch = rowsToCreate.slice(i, i + batchSize);
        await db.row.createMany({ data: batch });
        insertedCount += batch.length;
      }

      console.log(`✅ INSERTED ${insertedCount} new row(s) with auto-initialization`);
    } else {
      console.log('ℹ️ No new rows to insert — catalogue is up to date');
    }

    // Update lastSyncedAt
    await db.dataSource.update({
      where: { id: dsId },
      data: { lastSyncedAt: new Date() },
    });

    // Get updated counts
    const ds = await db.dataSource.findUnique({
      where: { id: dsId },
      include: { _count: { select: { columns: true, rows: true } } },
    });

    return NextResponse.json({
      data: {
        dataSourceId: dsId,
        isNew: false,
        name: ds?.name,
        rowsCreated: insertedCount,
        rowsSkipped: existingRowsSkipped.length,
        totalRowsInSheet: dataRows.length,
        columnsCreated: newColumnsInSheet.length,
        columnStructureUnchanged: newColumnsInSheet.length === 0 && missingColumnsInSheet.length === 0,
        idMetierColumn: dbIdMetierSlug || null,
        imageColumns: sheetData.imageColumns,
        lastSyncedAt: ds?.lastSyncedAt,
        syncMode: 'delta',
        autoInitialized: insertedCount > 0 ? { statut: 'Courant', disponibilite: 'Épuisé (OFF)', visibilite: 'Visible 👁️' } : null,
      },
      error: null,
    }, { status: 200 });
  } catch (e) {
    console.error('❌ Google sync error:', e);
    return NextResponse.json(
      { data: null, error: 'Google sync failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
