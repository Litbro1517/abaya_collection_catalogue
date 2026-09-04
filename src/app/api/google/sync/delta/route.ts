import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { fetchPrivateSheetData, fetchPublicSheetAsCsv, generateSlug } from '@/lib/google/sheets';
import { getValidAccessToken } from '@/lib/google/auth';
import { resolveImageUrl } from '@/lib/google/drive-images';
import { toPrismaJson } from '@/lib/prisma-json';

/**
 * POST /api/google/sync/delta
 *
 * Delta Synchronization Engine — Reconciliation mode.
 * Compares the "#" column (Business ID / ID Métier) from the Google Sheet
 * with the existing catalogue rows. Only inserts MISSING entries.
 * Existing rows are NEVER modified or deleted.
 *
 * Each new row is auto-initialized with:
 *   - Statut: "Courant"       (data.__statut__)
 *   - Disponibilité: OFF       (isAvailable = false — Stock 0 = Switch OFF)
 *   - Visibilité: Visible      (isVisible = true)
 *   - Stock: 0                 (quantityInStock = 0)
 *
 * Security: Diagnostic log is printed before any write operation.
 *
 * Body: {
 *   dataSourceId: string;   // Existing DataSource ID to sync into
 *   sheetId?: string;       // Google Sheet ID (optional, uses stored sheetId if not provided)
 *   sheetName?: string;     // Specific tab/sheet name
 *   gid?: string;           // Google Sheets GID for specific tab
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataSourceId, sheetId: bodySheetId, sheetName, gid } = body;

    if (!dataSourceId) {
      return NextResponse.json(
        { data: null, error: 'dataSourceId is required' },
        { status: 400 }
      );
    }

    // ── 1. Load the existing data source ────────────────────────────────────
    const ds = await db.dataSource.findUnique({
      where: { id: dataSourceId },
      include: {
        columns: { orderBy: { order: 'asc' } },
        rows: { orderBy: { order: 'asc' } },
      },
    });

    if (!ds) {
      return NextResponse.json(
        { data: null, error: 'Data source not found' },
        { status: 404 }
      );
    }

    const sheetId = bodySheetId || ds.sheetId;
    if (!sheetId) {
      return NextResponse.json(
        { data: null, error: 'No Google Sheet ID found. Connect a sheet first.' },
        { status: 400 }
      );
    }

    // ── 2. Fetch the Google Sheet data ──────────────────────────────────────
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
        sheetName || ds.sheetName || undefined
      );
    }

    // Fallback to public CSV access
    if (!sheetData) {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      sheetData = await fetchPublicSheetAsCsv(sheetUrl, sheetName || ds.sheetName || undefined, gid);
    }

    if (!sheetData || sheetData.headers.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Impossible de récupérer les données du Google Sheet. Vérifiez les permissions.' },
        { status: 400 }
      );
    }

    const { headers, rows: sheetRows, columnTypes } = sheetData;

    // Filter out empty rows
    const dataRows = sheetRows.filter(r => r.some(c => c && c.trim().length > 0));

    // ── 3. Find the "#" column (Business ID / ID Métier) ────────────────────
    // The "#" column is the unique reference for reconciliation.
    // We search by exact header match: "#", "N°", "N Ordre", "Numéro", "ID Métier"
    const businessIdPatterns = /^#|^[Nn][°o]?\s*(ordre|num|id)?$/i;
    let hashColIndex = -1;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].trim();
      if (header === '#' || businessIdPatterns.test(header)) {
        hashColIndex = i;
        break;
      }
    }

    // Fallback: check for common French column names
    if (hashColIndex === -1) {
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toLowerCase().trim();
        if (
          header === 'n ordre' ||
          header === 'n°' ||
          header === 'n° ordre' ||
          header === 'numero' ||
          header === 'numéro' ||
          header === 'id métier' ||
          header === 'id_metier' ||
          header === 'ref' ||
          header === 'référence' ||
          header === 'reference'
        ) {
          hashColIndex = i;
          break;
        }
      }
    }

    if (hashColIndex === -1) {
      return NextResponse.json(
        { data: null, error: `Colonne "#" (ID Métier) introuvable dans le Google Sheet. En-têtes trouvés : ${headers.join(', ')}` },
        { status: 400 }
      );
    }

    // ── 4. Find the "#" column slug in the existing DB columns ──────────────
    const hashColHeader = headers[hashColIndex];
    const hashColSlug = generateSlug(hashColHeader) || `column_${hashColIndex}`;

    // Try to find the matching column in the DB by name or slug
    const existingHashCol = ds.columns.find(
      c => c.name === hashColHeader || c.slug === hashColSlug ||
           c.name.trim() === '#' || c.name.toLowerCase().trim() === 'n ordre' ||
           c.name.toLowerCase().trim() === 'n°' || c.name.toLowerCase().trim() === 'n° ordre'
    );
    const effectiveHashSlug = existingHashCol?.slug || hashColSlug;

    // ── 5. Build set of existing "#" values from the catalogue ──────────────
    const existingHashValues = new Set<string>();
    for (const row of ds.rows) {
      const data = row.data as Record<string, unknown>;
      const hashValue = String(data[effectiveHashSlug] ?? '').trim();
      if (hashValue) {
        existingHashValues.add(hashValue);
      }
    }

    // ── 6. Filter to only NEW rows (missing from catalogue) ─────────────────
    const newRows: { sheetRowIndex: number; hashValue: string; rowData: string[] }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const hashValue = (row[hashColIndex] ?? '').trim();
      if (hashValue && !existingHashValues.has(hashValue)) {
        newRows.push({ sheetRowIndex: i, hashValue, rowData: row });
      }
    }

    // ── 7. SECURITY: Diagnostic log before any write ────────────────────────
    console.log('════════════════════════════════════════════════════════════');
    console.log('🔧 DELTA SYNC — Diagnostic de sécurité');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`  Data Source: "${ds.name}" (${ds.id})`);
    console.log(`  Google Sheet ID: ${sheetId}`);
    console.log(`  Colonne "#" : "${hashColHeader}" (index: ${hashColIndex}, slug: "${effectiveHashSlug}")`);
    console.log(`  Produits déjà présents : ${ds.rows.length} (aucune action)`);
    console.log(`  Nouveaux produits à insérer : ${newRows.length}`);
    console.log(`  Structure colonnes existantes : ${ds.columns.length} colonnes — INCHANGÉE`);
    console.log(`  Nouvelles lignes (#) : ${newRows.map(r => r.hashValue).join(', ') || 'aucune'}`);
    console.log('════════════════════════════════════════════════════════════');

    if (newRows.length === 0) {
      // No new rows — nothing to do
      return NextResponse.json({
        data: {
          dataSourceId,
          existingCount: ds.rows.length,
          newCount: 0,
          insertedCount: 0,
          columnsUnchanged: true,
          message: 'Aucun nouveau produit détecté. Le catalogue est à jour.',
        },
        error: null,
      });
    }

    // ── 8. Generate column slugs for the sheet data ─────────────────────────
    // We use the existing column slugs from the DB to map sheet data correctly.
    // This ensures data integrity — we don't create new columns.
    const columnSlugMap: Record<number, string> = {};
    const slugCount: Record<string, number> = {};

    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      // Try to match with existing column by name
      const existingCol = ds.columns.find(col => col.name === header);
      if (existingCol) {
        columnSlugMap[c] = existingCol.slug;
      } else {
        // Generate a new slug (shouldn't normally happen for delta sync)
        let slug = generateSlug(header);
        if (!slug) slug = `column_${c}`;
        if (slugCount[slug] !== undefined) {
          slugCount[slug]++;
          slug = `${slug}_${slugCount[slug]}`;
        } else {
          slugCount[slug] = 0;
        }
        columnSlugMap[c] = slug;
      }
    }

    // ── 9. Detect image group columns ───────────────────────────────────────
    const groupePattern = /^groupe\s*image/i;
    const imageGroupIndices: number[] = [];
    for (let c = 0; c < headers.length; c++) {
      if (groupePattern.test(headers[c])) {
        imageGroupIndices.push(c);
      }
    }

    // Check if there's already an IMAGE_ARRAY column for grouped images
    const existingImageArrayCol = ds.columns.find(c => c.type === 'IMAGE_ARRAY');
    const imageArraySlug = existingImageArrayCol?.slug || 'groupe_images';

    // ── 10. Build and insert new rows with auto-initialization ──────────────
    // Determine the max order value to append new rows correctly
    const maxOrder = ds.rows.length > 0
      ? Math.max(...ds.rows.map(r => r.order))
      : -1;

    // Build a map of "#" values to their intended order position
    // This respects the "#" column ordering
    const sheetHashOrder: Record<string, number> = {};
    for (let i = 0; i < dataRows.length; i++) {
      const hashValue = (dataRows[i][hashColIndex] ?? '').trim();
      if (hashValue) {
        sheetHashOrder[hashValue] = i;
      }
    }

    // Sort new rows by their "#" position in the sheet
    const sortedNewRows = [...newRows].sort(
      (a, b) => sheetHashOrder[a.hashValue] - sheetHashOrder[b.hashValue]
    );

    // MANDAT 4P — tsc : les champs d'auto-initialisation (isVisible/
    // isAvailable/quantityInStock) étaient posés sur l'INPUT Prisma —
    // RowCreateManyInput ne les connaît pas → rejet strict Prisma
    // (PrismaClientValidationError) sur ce chemin à l'exécution. Reportés
    // dans row.data via leurs slugs natifs (__disponibilite__/__stock__),
    // conformément aux conventions du sync complet (cf. sync/route.ts
    // §« Native columns ») et à l'intention des commentaires d'origine.
    // (La « visibilité » ligne n'existe pas dans le schéma Row — supprimée,
    // sans effet possible.)
    const rowsToCreate: {
      dataSourceId: string;
      data: Record<string, unknown>;
      order: number;
    }[] = [];

    for (let idx = 0; idx < sortedNewRows.length; idx++) {
      const { rowData } = sortedNewRows[idx];
      const rowDataObj: Record<string, unknown> = {};

      // Map sheet data to row data using column slugs
      for (let c = 0; c < headers.length; c++) {
        if (c < rowData.length && rowData[c]) {
          const colType = columnTypes[c];
          const slug = columnSlugMap[c];

          if (colType === 'IMAGE' || colType === 'IMAGE_ARRAY') {
            rowDataObj[slug] = resolveImageUrl(rowData[c]);
          } else {
            rowDataObj[slug] = rowData[c];
          }
        }
      }

      // Build grouped image array
      if (imageGroupIndices.length > 0) {
        const images: string[] = [];
        imageGroupIndices.forEach(c => {
          if (rowData[c] && rowData[c].length > 0) {
            images.push(resolveImageUrl(rowData[c]));
          }
        });
        if (images.length > 0) {
          rowDataObj[imageArraySlug] = images;
        }
      }

      // ═══ AUTO-INITIALIZATION ═══
      // Statut: "Courant"
      rowDataObj.__statut__ = 'Courant';
      rowDataObj.__statut_locked__ = false;
      // MANDAT 4P — tsc : cf. commentaire rowsToCreate ci-dessus — slugs natifs
      rowDataObj.__disponibilite__ = 'false'; // Switch OFF (Stock 0 = Épuisé)
      rowDataObj.__stock__ = 0;               // Stock = 0

      rowsToCreate.push({
        dataSourceId,
        data: rowDataObj,
        order: maxOrder + 1 + idx, // Append after existing rows
      });
    }

    // Insert new rows in batches
    const batchSize = 50;
    let insertedCount = 0;
    for (let i = 0; i < rowsToCreate.length; i += batchSize) {
      const batch = rowsToCreate.slice(i, i + batchSize);
      // MANDAT 4P — tsc : narrowing JSON-safe → InputJsonObject
      await db.row.createMany({ data: batch.map((b) => ({ ...b, data: toPrismaJson(b.data) ?? {} })) });
      insertedCount += batch.length;
    }

    // ── 11. Update lastSyncedAt ─────────────────────────────────────────────
    await db.dataSource.update({
      where: { id: dataSourceId },
      data: { lastSyncedAt: new Date() },
    });

    // ── 12. Final diagnostic log ────────────────────────────────────────────
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ DELTA SYNC — Terminé avec succès');
    console.log(`  ${insertedCount} nouveau(x) produit(s) inséré(s)`);
    console.log(`  Initialisation automatique : Statut=Courant, Disponibilité=OFF, Visibilité=ON, Stock=0`);
    console.log(`  Structure colonnes : INCHANGÉE (${ds.columns.length} colonnes)`);
    console.log('════════════════════════════════════════════════════════════');

    return NextResponse.json({
      data: {
        dataSourceId,
        existingCount: ds.rows.length,
        newCount: newRows.length,
        insertedCount,
        columnsUnchanged: true,
        newHashValues: newRows.map(r => r.hashValue),
        message: `${insertedCount} nouveau(x) produit(s) ajouté(s). Initialisation : Statut=Courant, Disponibilité=Épuisé, Visibilité=Visible.`,
      },
      error: null,
    }, { status: 200 });

  } catch (e) {
    console.error('❌ DELTA SYNC ERROR:', e);
    return NextResponse.json(
      { data: null, error: 'Delta sync failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
