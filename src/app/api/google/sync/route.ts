import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { fetchPrivateSheetData, fetchPublicSheetAsCsv, generateSlug } from '@/lib/google/sheets';
import { getValidAccessToken } from '@/lib/google/auth';
import { resolveImageUrl } from '@/lib/google/drive-images';
import { STATUS_OPTIONS } from '@/lib/status-config';

/**
 * syncCategoriesFromRows
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Auto-upsert Category & SubCategory records from imported row data.
 * Scans all rows for a given dataSourceId, collects unique __category__
 * and __sub_category__ values, and upserts them into the dedicated
 * Category / SubCategory Prisma tables.
 *
 * Rules:
 * - NEVER overwrite an existing category's label or visibility (admin sovereignty)
 * - If a row has __category__ but no __sub_category__, just create the category
 * - If a row has both, create the category first, then the sub-category linked to it
 * - Sub-category slugs are prefixed with parent: `${parentSlug}-${subSlug}`
 * - Skip empty/whitespace-only values
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
async function syncCategoriesFromRows(dataSourceId: string): Promise<void> {
  const rows = await db.row.findMany({ where: { dataSourceId } });

  // Collect unique category values and map sub-categories to their parent categories
  const uniqueCategories = new Set<string>();
  // Map: sub-category label → parent category label (first occurrence wins)
  const subToParent = new Map<string, string>();

  for (const row of rows) {
    const data = row.data as Record<string, unknown>;
    const categoryVal = String(data.__category__ ?? '').trim();
    const subCategoryVal = String(data.__sub_category__ ?? '').trim();

    if (categoryVal) {
      uniqueCategories.add(categoryVal);
      if (subCategoryVal && !subToParent.has(subCategoryVal)) {
        subToParent.set(subCategoryVal, categoryVal);
      }
    }
  }

  if (uniqueCategories.size === 0) {
    console.log('📂 syncCategoriesFromRows: No category values found in rows — skipping');
    return;
  }

  // Get current max ordre for auto-increment
  const existingCategories = await db.category.findMany({ orderBy: { ordre: 'desc' }, take: 1 });
  let nextOrdre = existingCategories.length > 0 ? existingCategories[0].ordre + 1 : 1;

  let categoriesUpserted = 0;
  let subCategoriesUpserted = 0;

  // Upsert categories first
  for (const catLabel of uniqueCategories) {
    const catSlug = generateSlug(catLabel);
    if (!catSlug) continue;

    await db.category.upsert({
      where: { slug: catSlug },
      update: {}, // NEVER update label/visibility — admin's choice is sovereign
      create: {
        slug: catSlug,
        label: catLabel,
        visible: true,
        ordre: nextOrdre,
      },
    });
    nextOrdre++;
    categoriesUpserted++;
  }

  // Upsert sub-categories (linked to their parent category)
  if (subToParent.size > 0) {
    const existingSubCategories = await db.subCategory.findMany({ orderBy: { ordre: 'desc' }, take: 1 });
    let nextSubOrdre = existingSubCategories.length > 0 ? existingSubCategories[0].ordre + 1 : 1;

    for (const [subLabel, parentLabel] of subToParent) {
      const parentSlug = generateSlug(parentLabel);
      const subSlug = generateSlug(subLabel);
      if (!parentSlug || !subSlug) continue;

      // Find the parent category to get its id
      const parentCategory = await db.category.findUnique({ where: { slug: parentSlug } });
      if (!parentCategory) {
        console.warn(`📂 syncCategoriesFromRows: Parent category "${parentLabel}" (slug: ${parentSlug}) not found — skipping sub-category "${subLabel}"`);
        continue;
      }

      const compositeSlug = `${parentSlug}-${subSlug}`;

      await db.subCategory.upsert({
        where: { slug: compositeSlug },
        update: {}, // NEVER update label/visibility — admin's choice is sovereign
        create: {
          slug: compositeSlug,
          label: subLabel,
          categoryId: parentCategory.id,
          visible: true,
          ordre: nextSubOrdre,
        },
      });
      nextSubOrdre++;
      subCategoriesUpserted++;
    }
  }

  console.log(`📂 syncCategoriesFromRows: Auto-upserted ${categoriesUpserted} categorie(s) and ${subCategoriesUpserted} sub-categorie(s) from DataSource ${dataSourceId}`);
}

/**
 * POST /api/google/sync
 * Import a Google Sheet as a new DataSource, or DELTA-sync an existing one
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DELTA SYNC ENGINE — "Table par Table" Strict Rules:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. Each sync targets ONE table only (by dataSourceId) — strict isolation
 * 2. Compare ONLY the "N ordre" column between Google Sheet and catalogue
 *    ⚠️ Do NOT confuse with the "#" system column. Only "N ordre" is authoritative.
 * 3. Only INSERT missing entries (rows absent from catalogue by "N ordre" value)
 * 4. NEVER overwrite existing data — preserve admin modifications
 * 5. Auto-initialize new rows: Statut="Courant", Disponibilité=OFF ("Épuisé"), Visibilité="Visible"
 * 6. Diagnostic console log BEFORE execution
 * 7. A sync on Table A must NEVER affect Table B (guaranteed by dataSourceId scoping)
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

    // ━━━ FIND THE "N ORDRE" COLUMN — PRIMARY IDENTIFIER ━━━━━━━━━━
    // "N ordre" is the authoritative business identifier for delta comparison.
    // ⚠️ Do NOT confuse with the "#" system column generated by Glide.
    let idMetierColIndex = -1;
    let idMetierSlug = '';

    // PRIMARY: Find "N ordre" column in the Google Sheet headers
    for (let c = 0; c < headers.length; c++) {
      const headerLower = headers[c].toLowerCase().trim();
      if (headerLower === 'n ordre' || headerLower === 'n°' || headerLower === 'nordre') {
        idMetierColIndex = c;
        idMetierSlug = columnSlugs[c];
        break;
      }
    }

    // FALLBACK: Try "#" if "N ordre" not found
    if (idMetierColIndex < 0) {
      for (let c = 0; c < headers.length; c++) {
        if (headers[c].trim() === '#') {
          idMetierColIndex = c;
          idMetierSlug = columnSlugs[c];
          break;
        }
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
      // ━━━ PRESERVE native columns before deletion ━━━
      // Native columns like __statut__ (STATUS), Disponibilité (BOOLEAN/Switch),
      // Stock (NUMBER) must survive a re-import because they are NOT in the Google Sheet.
      let nativeColumnsToPreserve: { name: string; slug: string; type: string; order: number; visible: boolean; required: boolean; config: unknown }[] = [];

      // ━━━ PRESERVE __stock__ VALUES before deletion (scoped outside if block) ━━━
      // Stock values are managed locally in the app and must NEVER be overwritten
      // by a Google Sheet sync. Save them keyed by N ordre for restoration after re-import.
      const preservedStockValues = new Map<string, { stock: number; disponibilite: string; statut: string; statutLocked: boolean; isVisible: boolean; category: string; subCategory: string; colors: string }>();

      if (!isNewDataSource) {
        // 1. Save native/special columns that are NOT from the Google Sheet
        const existingCols = await db.column.findMany({ where: { dataSourceId: dsId } });
        const sheetHeaderSet = new Set(headers.map(h => h.toLowerCase().trim()));

        nativeColumnsToPreserve = existingCols
          .filter(col => {
            // Always preserve __statut__ STATUS column (native)
            if (col.slug === '__statut__' || col.type === 'STATUS') return true;
            // Preserve columns whose name doesn't match any sheet header
            // (manually added or native columns like Stock, Disponibilité)
            if (!sheetHeaderSet.has(col.name.toLowerCase().trim())) return true;
            return false;
          })
          .map(col => ({
            name: col.name,
            slug: col.slug,
            type: col.type,
            order: col.order,
            visible: col.visible,
            required: col.required,
            config: col.config,
          }));

        console.log(`📦 Preserving ${nativeColumnsToPreserve.length} native column(s) before re-import: [${nativeColumnsToPreserve.map(c => c.name).join(', ')}]`);

        // 2. ━━━ PRESERVE __stock__ VALUES before deletion ━━━
        const existingRows = await db.row.findMany({ where: { dataSourceId: dsId } });

        // Find the N ordre column slug in existing columns
        let idMetierSlugForStockPreservation = '';
        for (const col of existingCols) {
          const nameLower = col.name.toLowerCase().trim();
          if (nameLower === 'n ordre' || nameLower === 'n°' || nameLower === 'nordre' || col.name.trim() === '#') {
            idMetierSlugForStockPreservation = col.slug;
            break;
          }
        }

        for (const row of existingRows) {
          const data = row.data as Record<string, unknown>;
          const keyValue = idMetierSlugForStockPreservation ? String(data[idMetierSlugForStockPreservation] ?? '').trim() : '';
          if (keyValue || !idMetierSlugForStockPreservation) {
            const key = keyValue || row.id; // fallback to row ID if no N ordre found
            preservedStockValues.set(key, {
              stock: typeof data.__stock__ === 'number' ? data.__stock__ : parseInt(String(data.__stock__)) || 0,
              disponibilite: String(data.__disponibilite__ ?? 'false'),
              statut: String(data.__statut__ ?? 'Courant'),
              statutLocked: !!data.__statut_locked__,
              isVisible: data.__is_visible__ !== false,
              category: String(data.__category__ ?? ''),
              subCategory: String(data.__sub_category__ ?? ''),
              colors: String(data.__colors__ ?? ''),
            });
          }
        }
        console.log(`🔒 Preserved ${preservedStockValues.size} stock/disponibilité/statut values before deletion`);

        // 3. Delete all columns and rows
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

      // ━━━ Identify sheet columns that overlap with NATIVE columns ━━━
      // The 6 native columns (__colors__, __statut__, __disponibilite__, __stock__, __category__, __sub_category__) are ALWAYS
      // created by the app. If the Google Sheet has similarly-named columns,
      // we SKIP them from import and map their data to the native slugs instead.
      const nativeNamePatterns: { slug: string; names: string[] }[] = [
        { slug: '__colors__', names: ['couleur', 'color'] },
        { slug: '__disponibilite__', names: ['disponibilité', 'disponibilite', 'disponible'] },
        { slug: '__stock__', names: ['stock', 'quantité', 'quantite'] },
        { slug: '__category__', names: ['catégorie', 'categorie', 'category'] },
        { slug: '__sub_category__', names: ['sous-catégorie', 'sous-categorie', 'subcategory'] },
        // ━━ DEBT-9 production repair : 18 variantes pour __compare_at_price__ ━━
        { slug: '__compare_at_price__', names: [
          'ancien_prix', 'ancien prix', 'ancienprix',
          'prix_ancien', 'prix ancien',
          'prix_barre', 'prix_barré', 'prixbarré',
          'prix original', 'prix_original', 'originalprice', 'original price',
          'compare_at_price', 'compareatprice', 'compare at price',
          'old price', 'oldprice',
          'prix de référence', 'prix_reference',
        ] },
      ];

      // Map: sheet column index → native slug (for data mapping)
      const sheetColToNativeSlug = new Map<number, string>();

      for (let c = 0; c < headers.length; c++) {
        const hl = headers[c].toLowerCase().trim();
        for (const { slug, names } of nativeNamePatterns) {
          if (names.includes(hl)) {
            sheetColToNativeSlug.set(c, slug);
            break;
          }
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

      // Also skip sheet columns that overlap with native columns
      for (const [idx] of sheetColToNativeSlug) {
        columnsToSkip.add(idx);
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

      // ━━━ RESTORE native columns after sheet column creation ━━━
      // These 6 columns are ALWAYS guaranteed to exist — they are native to the app
      // and NOT present in Google Sheets. They must survive every import/sync.

      // 0. __colors__ — COLOR column (native color picker)
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__colors__' } },
        update: {},
        create: {
          name: 'Couleur',
          slug: '__colors__',
          type: 'COLOR',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: {},
          order: -6,
        },
      });

      // 1. __statut__ — STATUS column (badge + lock)
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__statut__' } },
        update: {},
        create: {
          name: 'Statut',
          slug: '__statut__',
          type: 'STATUS',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: { options: STATUS_OPTIONS.map(o => o.value) },
          order: -1,
        },
      });

      // 2. Disponibilité — BOOLEAN Switch column (Disponible/Épuisé)
      // ALWAYS create this native column regardless of whether the Google Sheet
      // has a similarly-named column. If the Sheet does have one, we map its data
      // to this native slug instead of creating a duplicate.
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__disponibilite__' } },
        update: {},
        create: {
          name: 'Disponibilité',
          slug: '__disponibilite__',
          type: 'BOOLEAN',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: { labels: { true: 'Disponible', false: 'Épuisé' } },
          order: -2,
        },
      });

      // 3. Stock — NUMBER counter column
      // ALWAYS create this native column regardless of whether the Google Sheet
      // has a similarly-named column.
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__stock__' } },
        update: {},
        create: {
          name: 'Stock',
          slug: '__stock__',
          type: 'NUMBER',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: { isCounter: true, min: 0 },
          order: -3,
        },
      });

      // 4. __category__ — TEXT column for product category
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__category__' } },
        update: {},
        create: {
          name: 'Catégorie',
          slug: '__category__',
          type: 'TEXT',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: {},
          order: -4,
        },
      });

      // 5. __sub_category__ — TEXT column for product sub-category
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__sub_category__' } },
        update: {},
        create: {
          name: 'Sous-catégorie',
          slug: '__sub_category__',
          type: 'TEXT',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: {},
          order: -5,
        },
      });

      // 6. __compare_at_price__ — CURRENCY column for discount (prix barré)
      // DEBT-9 production repair : 7ème colonne native garantie côté sync Google
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__compare_at_price__' } },
        update: {},
        create: {
          name: 'Prix barré',
          slug: '__compare_at_price__',
          type: 'CURRENCY',
          dataSourceId: dsId,
          visible: true,
          required: false,
          config: {},
          order: 7,
        },
      });

      // Restore other preserved native columns from before the deletion
      for (const nc of nativeColumnsToPreserve) {
        // Skip the 7 native columns we already upserted above
        // DEBT-9 production repair : __compare_at_price__ ajouté à la skip-list
        if (nc.slug === '__colors__' || nc.slug === '__statut__' || nc.slug === '__disponibilite__' || nc.slug === '__stock__' || nc.slug === '__category__' || nc.slug === '__sub_category__' || nc.slug === '__compare_at_price__') continue;

        await db.column.upsert({
          where: { dataSourceId_slug: { dataSourceId: dsId, slug: nc.slug } },
          update: {},
          create: {
            name: nc.name,
            slug: nc.slug,
            type: nc.type,
            dataSourceId: dsId,
            visible: nc.visible,
            required: nc.required,
            config: nc.config as Record<string, unknown>,
            order: nc.order,
          },
        });
      }

      console.log(`✅ Native columns ALWAYS guaranteed: __colors__(COLOR), __statut__(STATUS), __disponibilite__(BOOLEAN/Switch), __stock__(NUMBER/Counter), __category__(TEXT), __sub_category__(TEXT)${sheetColToNativeSlug.size > 0 ? ` — ${sheetColToNativeSlug.size} sheet column(s) mapped to native slugs` : ''}${nativeColumnsToPreserve.filter(c => c.slug !== '__colors__' && c.slug !== '__statut__' && c.slug !== '__disponibilite__' && c.slug !== '__stock__' && c.slug !== '__category__' && c.slug !== '__sub_category__').map(c => `, ${c.name} (${c.type})`).join('')}`);

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

        // ━━━ Map sheet columns to native slugs ━━━
        // If the sheet had "Disponibilité"/"Stock"/"Catégorie"/"Sous-catégorie" columns,
        // their data goes to the native slugs respectively (not duplicate columns)
        let sheetColorsValue: string | null = null;
        let sheetDisponibiliteValue: string | null = null;
        let sheetStockValue: string | null = null;
        let sheetCategoryValue: string | null = null;
        let sheetSubCategoryValue: string | null = null;

        for (const [sheetIdx, nativeSlug] of sheetColToNativeSlug) {
          const rawVal = sheetIdx < row.length ? (row[sheetIdx] || '').trim() : '';
          if (nativeSlug === '__colors__') {
            sheetColorsValue = rawVal;
          } else if (nativeSlug === '__disponibilite__') {
            // Parse: "true"/"1"/"oui"/"disponible" → true, anything else → false
            const isAvailable = ['true', '1', 'oui', 'disponible', 'en stock', 'yes'].includes(rawVal.toLowerCase());
            sheetDisponibiliteValue = String(isAvailable);
          } else if (nativeSlug === '__stock__') {
            const num = parseInt(rawVal);
            sheetStockValue = isNaN(num) ? '0' : String(num);
          } else if (nativeSlug === '__category__') {
            sheetCategoryValue = rawVal;
          } else if (nativeSlug === '__sub_category__') {
            sheetSubCategoryValue = rawVal;
          }
        }

        // ━━━ Auto-initialization defaults for first import ━━━
        // Couleur = empty by default
        // If sheet has Couleur data, use it; otherwise default to ''
        rowData.__colors__ = sheetColorsValue ?? '';
        // Statut = Courant (blue badge)
        rowData.__statut__ = 'Courant';
        rowData.__statut_locked__ = false;
        // Visibility = Visible 👁️
        rowData.__is_visible__ = true;

        // Disponibilité = Switch OFF → "Épuisé" by default
        // If sheet has Disponibilité data, use it; otherwise default to OFF
        rowData.__disponibilite__ = sheetDisponibiliteValue ?? 'false';

        // Stock = 0 by default (for first import / new data sources only)
        // If sheet has Stock data, use it; otherwise default to 0
        // NOTE: For re-imports, preserved stock values will be restored AFTER row creation
        rowData.__stock__ = sheetStockValue ? parseInt(sheetStockValue) : 0;

        // Catégorie = empty by default
        // If sheet has Catégorie data, use it; otherwise default to ''
        // NOTE: For re-imports, preserved category values will be restored AFTER row creation
        rowData.__category__ = sheetCategoryValue ?? '';

        // Sous-catégorie = empty by default
        // If sheet has Sous-catégorie data, use it; otherwise default to ''
        // NOTE: For re-imports, preserved sub-category values will be restored AFTER row creation
        rowData.__sub_category__ = sheetSubCategoryValue ?? '';

        // ━━━ Business Rule: CASCADE Stock → Disponibilité ━━━
        // Stock > 0 → Disponibilité = ON (Disponible)
        // Stock = 0 → Disponibilité = OFF (Épuisé)
        // This ensures the switch always reflects the stock state on import.
        const stockNum = typeof rowData.__stock__ === 'number' ? rowData.__stock__ : parseInt(String(rowData.__stock__)) || 0;
        if (stockNum > 0) {
          rowData.__disponibilite__ = 'true'; // CASCADE: stock positif → Disponible
        } else {
          rowData.__disponibilite__ = 'false'; // CASCADE: stock nul → Épuisé
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

      // ━━━ RESTORE PRESERVED __stock__ VALUES after row creation ━━━
      // If this was a re-import (not new data source), restore the stock/disponibilité/statut
      // values that were saved before deletion. This ensures admin modifications are NEVER lost.
      if (!isNewDataSource && preservedStockValues.size > 0) {
        // Find the N ordre column slug in the newly created columns
        const newCols = await db.column.findMany({ where: { dataSourceId: dsId } });
        let newIdMetierSlug = '';
        for (const col of newCols) {
          const nameLower = col.name.toLowerCase().trim();
          if (nameLower === 'n ordre' || nameLower === 'n°' || nameLower === 'nordre' || col.name.trim() === '#') {
            newIdMetierSlug = col.slug;
            break;
          }
        }

        const newRows = await db.row.findMany({ where: { dataSourceId: dsId } });
        let restoredCount = 0;
        for (const newRow of newRows) {
          const data = newRow.data as Record<string, unknown>;
          const keyValue = newIdMetierSlug ? String(data[newIdMetierSlug] ?? '').trim() : '';
          const lookupKey = keyValue || newRow.id;
          const preserved = preservedStockValues.get(lookupKey);

          if (preserved) {
            const updatedData = { ...data };
            updatedData.__stock__ = preserved.stock;
            // ━━━ PRESERVED ROW RESTORATION: Respect admin sovereignty ━━━
            // When restoring previously existing rows after a re-import:
            //   stock > 0 → ALWAYS Disponible (true anomaly fix)
            //   stock = 0 → PRESERVE the admin's choice (Sur commande or Épuisé)
            // The admin's __disponibilite__ choice is sovereign. If they manually
            // toggled a stock=0 product to "Sur commande", it MUST survive re-import.
            if (preserved.stock > 0) {
              updatedData.__disponibilite__ = 'true'; // Safety: stock positif → Disponible
            } else {
              // Restore the EXACT disponibilite value the admin set — could be
              // 'true' (Sur commande) or 'false' (Épuisé) — both are legitimate
              updatedData.__disponibilite__ = preserved.disponibilite;
            }
            updatedData.__statut__ = preserved.statut;
            updatedData.__statut_locked__ = preserved.statutLocked;
            updatedData.__is_visible__ = preserved.isVisible;
            // Preserve category/sub-category values from admin edits
            updatedData.__category__ = preserved.category;
            updatedData.__sub_category__ = preserved.subCategory;
            // Preserve color values from admin edits
            updatedData.__colors__ = preserved.colors;
            await db.row.update({
              where: { id: newRow.id },
              data: { data: updatedData },
            });
            restoredCount++;
          }
        }
        console.log(`🔒 Restored ${restoredCount} preserved stock/disponibilité/statut/category/colors values after re-import`);
      }

      await db.dataSource.update({
        where: { id: dsId },
        data: { lastSyncedAt: new Date() },
      });

      const ds = await db.dataSource.findUnique({
        where: { id: dsId },
        include: { _count: { select: { columns: true, rows: true } } },
      });

      // ━━━ AUTO-UPSERT CATEGORIES FROM ROW DATA ━━━━━━━━━━━━━━━━━━━
      // Scan all imported rows for __category__/__sub_category__ values
      // and auto-create corresponding Category/SubCategory records so the
      // pill filter appears without manual admin configuration.
      await syncCategoriesFromRows(dsId);

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

    // ━━━ ENSURE ALL 6 NATIVE COLUMNS EXIST ━━━━━━━━━━━━━━━━━━━━━━━━━
    // Native columns (__colors__, __statut__, __disponibilite__, __stock__, __category__,
    // __sub_category__) may have been lost during a previous full import.
    // Always restore them before delta sync.
    const hasColorsColumn = existingDs.columns.some(c => c.slug === '__colors__');
    const hasStatutColumn = existingDs.columns.some(c => c.slug === '__statut__' || c.type === 'STATUS');
    const hasDisponibiliteColumn = existingDs.columns.some(c => c.slug === '__disponibilite__');
    const hasStockColumn = existingDs.columns.some(c => c.slug === '__stock__');
    const hasCategoryColumn = existingDs.columns.some(c => c.slug === '__category__');
    const hasSubCategoryColumn = existingDs.columns.some(c => c.slug === '__sub_category__');

    // Also check if the Google Sheet has these columns natively
    // (for data mapping purposes — native columns are ALWAYS created regardless)
    const sheetHasDisponibiliteDelta = headers.some(h => {
      const hl = h.toLowerCase().trim();
      return hl === 'disponibilité' || hl === 'disponibilite' || hl === 'disponible';
    });
    const sheetHasStockDelta = headers.some(h => {
      const hl = h.toLowerCase().trim();
      return hl === 'stock' || hl === 'quantité' || hl === 'quantite';
    });

    // ━━━ Map sheet columns to native slugs (same logic as Full Import) ━━━
    const deltaNativeNamePatterns: { slug: string; names: string[] }[] = [
      { slug: '__colors__', names: ['couleur', 'color'] },
      { slug: '__disponibilite__', names: ['disponibilité', 'disponibilite', 'disponible'] },
      { slug: '__stock__', names: ['stock', 'quantité', 'quantite'] },
      { slug: '__category__', names: ['catégorie', 'categorie', 'category'] },
      { slug: '__sub_category__', names: ['sous-catégorie', 'sous-categorie', 'subcategory'] },
      // ━━ DEBT-9 production repair : 18 variantes pour __compare_at_price__ (delta sync) ━━
      { slug: '__compare_at_price__', names: [
        'ancien_prix', 'ancien prix', 'ancienprix',
        'prix_ancien', 'prix ancien',
        'prix_barre', 'prix_barré', 'prixbarré',
        'prix original', 'prix_original', 'originalprice', 'original price',
        'compare_at_price', 'compareatprice', 'compare at price',
        'old price', 'oldprice',
        'prix de référence', 'prix_reference',
      ] },
    ];
    const deltaSheetColToNativeSlug = new Map<number, string>();
    for (let c = 0; c < headers.length; c++) {
      const hl = headers[c].toLowerCase().trim();
      for (const { slug, names } of deltaNativeNamePatterns) {
        if (names.includes(hl)) {
          deltaSheetColToNativeSlug.set(c, slug);
          break;
        }
      }
    }

    // 0. __colors__ (COLOR) — ALWAYS ensure it exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__colors__' } },
      update: {},
      create: {
        name: 'Couleur',
        slug: '__colors__',
        type: 'COLOR',
        dataSourceId: dsId,
        visible: true,
        required: false,
        config: {},
        order: -6,
      },
    });
    if (!hasColorsColumn) console.log('🔧 Restored missing __colors__ COLOR column during delta sync');

    // 1. __statut__ (STATUS) — ALWAYS ensure it exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__statut__' } },
      update: {},
      create: {
        name: 'Statut',
        slug: '__statut__',
        type: 'STATUS',
        dataSourceId: dsId,
        visible: true,
        required: false,
        config: { options: ['Nouveau', 'Courant'] },
        order: -1,
      },
    });
    if (!hasStatutColumn) console.log('🔧 Restored missing __statut__ STATUS column during delta sync');

    // 2. __disponibilite__ (BOOLEAN/Switch) — ALWAYS ensure it exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__disponibilite__' } },
      update: {},
      create: {
        name: 'Disponibilité',
        slug: '__disponibilite__',
        type: 'BOOLEAN',
        dataSourceId: dsId,
        visible: true,
        required: false,
        config: { labels: { true: 'Disponible', false: 'Épuisé' } },
        order: -2,
      },
    });
    if (!hasDisponibiliteColumn) console.log('🔧 Restored missing __disponibilite__ BOOLEAN/Switch column during delta sync');

    // 3. __stock__ (NUMBER/Counter) — ALWAYS ensure it exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__stock__' } },
      update: {},
      create: {
        name: 'Stock',
        slug: '__stock__',
        type: 'NUMBER',
        dataSourceId: dsId,
        visible: true,
        required: false,
        config: { isCounter: true, min: 0 },
        order: -3,
      },
    });
    if (!hasStockColumn) console.log('🔧 Restored missing __stock__ NUMBER/Counter column during delta sync');

    // 4. __category__ (TEXT) — ALWAYS ensure it exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__category__' } },
      update: {},
      create: {
        name: 'Catégorie',
        slug: '__category__',
        type: 'TEXT',
        dataSourceId: dsId,
        visible: true,
        required: false,
        config: {},
        order: -4,
      },
    });
    if (!hasCategoryColumn) console.log('🔧 Restored missing __category__ TEXT column during delta sync');

    // 5. __sub_category__ (TEXT) — ALWAYS ensure it exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: dsId, slug: '__sub_category__' } },
      update: {},
      create: {
        name: 'Sous-catégorie',
        slug: '__sub_category__',
        type: 'TEXT',
        dataSourceId: dsId,
        visible: true,
        required: false,
        config: {},
        order: -5,
      },
    });
    if (!hasSubCategoryColumn) console.log('🔧 Restored missing __sub_category__ TEXT column during delta sync');

    // Reload columns to include any newly created ones
    const refreshedCols = await db.column.findMany({ where: { dataSourceId: dsId } });
    (existingDs as Record<string, unknown>).columns = refreshedCols;

    // ━━━ DIAGNOSTIC: Load existing rows ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const existingRows = await db.row.findMany({
      where: { dataSourceId: dsId },
    });

    // ━━━ FIND THE "N ORDRE" COLUMN IN EXISTING DB ━━━━━━━━━━━━━━━━
    // PRIMARY identifier is "N ordre" — NOT the "#" system column
    let dbIdMetierSlug = '';
    let dbIdMetierColName = '';

    // PRIMARY: Find "N ordre" column
    for (const col of existingDs.columns) {
      const nameLower = col.name.toLowerCase().trim();
      if (
        nameLower === 'n ordre' ||
        nameLower === 'n°' ||
        nameLower === 'nordre'
      ) {
        dbIdMetierSlug = col.slug;
        dbIdMetierColName = col.name;
        break;
      }
    }

    // FALLBACK: Try "#", "ID Métier", "Référence" etc.
    if (!dbIdMetierSlug) {
      for (const col of existingDs.columns) {
        const nameLower = col.name.toLowerCase().trim();
        if (
          col.name.trim() === '#' ||
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

    // Also try to find "N ordre" or "#" column in the Google Sheet headers
    let sheetIdMetierIndex = -1;
    let sheetIdMetierSlug = '';

    // PRIMARY: Find "N ordre" in sheet headers
    for (let c = 0; c < headers.length; c++) {
      const headerLower = headers[c].toLowerCase().trim();
      if (headerLower === 'n ordre' || headerLower === 'n°' || headerLower === 'nordre') {
        sheetIdMetierIndex = c;
        sheetIdMetierSlug = columnSlugs[c];
        break;
      }
    }

    // FALLBACK: Try "#" in sheet headers
    if (sheetIdMetierIndex < 0) {
      for (let c = 0; c < headers.length; c++) {
        if (headers[c].trim() === '#') {
          sheetIdMetierIndex = c;
          sheetIdMetierSlug = columnSlugs[c];
          break;
        }
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
    console.log('🔍 DELTA SYNC ENGINE — TABLE PAR TABLE — DIAGNOSTIC');
    console.log('━'.repeat(60));
    console.log(`📊 DataSource: "${existingDs.name}" (${dsId})`);
    console.log(`📋 Existing products in catalogue: ${existingRows.length}`);
    console.log(`📄 Google Sheet rows: ${dataRows.length}`);
    console.log(`🔑 Identifier column: ${dbIdMetierSlug ? `"${dbIdMetierColName}" (slug: ${dbIdMetierSlug})` : '⚠️ NOT FOUND — "N ordre" nor "#" detected'}`);
    console.log(`🔑 Existing "N ordre" values: ${existingIdMetierValues.size}`);
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
        // This is the core guarantee of the Delta Sync Engine: existing rows'
        // data (stock, disponibilite, statut, category, sub_category, etc.) is
        // NEVER modified. Only NEW rows are inserted. This ensures admin
        // modifications (Sur commande toggles, manual category edits, etc.) are
        // always preserved across re-syncs.
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
    // BUT skip columns that overlap with native columns (Disponibilité/Stock)
    const nativeNameSet = new Set(['disponibilité', 'disponibilite', 'disponible', 'stock', 'quantité', 'quantite', 'catégorie', 'categorie', 'category', 'sous-catégorie', 'sous-categorie', 'subcategory']);
    const newColumnsFiltered = newColumnsInSheet.filter(h => !nativeNameSet.has(h.toLowerCase().trim()));

    if (newColumnsFiltered.length > 0) {
      const maxOrder = Math.max(...existingDs.columns.map(c => c.order), 0);

      for (let i = 0; i < newColumnsFiltered.length; i++) {
        const headerName = newColumnsFiltered[i];
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

      console.log(`✅ Added ${newColumnsFiltered.length} new column(s) to DataSource`);
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

      // ━━━ Map sheet columns to native slugs ━━━
      let deltaSheetDisponibiliteValue: string | null = null;
      let deltaSheetStockValue: string | null = null;
      let deltaSheetCategoryValue: string | null = null;
      let deltaSheetSubCategoryValue: string | null = null;

      for (const [sheetIdx, nativeSlug] of deltaSheetColToNativeSlug) {
        const rawVal = sheetIdx < row.length ? (row[sheetIdx] || '').trim() : '';
        if (nativeSlug === '__disponibilite__') {
          const isAvailable = ['true', '1', 'oui', 'disponible', 'en stock', 'yes'].includes(rawVal.toLowerCase());
          deltaSheetDisponibiliteValue = String(isAvailable);
        } else if (nativeSlug === '__stock__') {
          const num = parseInt(rawVal);
          deltaSheetStockValue = isNaN(num) ? '0' : String(num);
        } else if (nativeSlug === '__category__') {
          deltaSheetCategoryValue = rawVal;
        } else if (nativeSlug === '__sub_category__') {
          deltaSheetSubCategoryValue = rawVal;
        }
      }

      // ━━━ AUTO-INITIALIZATION (Strict defaults) ━━━━━━━━━━━━━━━━━
      // Statut = "Courant" (blue badge)
      rowData.__statut__ = 'Courant';
      rowData.__statut_locked__ = false;

      // Visibilité = Visible (👁️)
      rowData.__is_visible__ = true;

      // Disponibilité = Switch OFF → "Épuisé"
      // Use sheet data if available, otherwise default OFF
      rowData.__disponibilite__ = deltaSheetDisponibiliteValue ?? 'false';

      // Stock = 0 (counter default)
      // Use sheet data if available, otherwise default 0
      rowData.__stock__ = deltaSheetStockValue ? parseInt(deltaSheetStockValue) : 0;

      // Catégorie = empty by default
      // Use sheet data if available, otherwise default ''
      rowData.__category__ = deltaSheetCategoryValue ?? '';

      // Sous-catégorie = empty by default
      // Use sheet data if available, otherwise default ''
      rowData.__sub_category__ = deltaSheetSubCategoryValue ?? '';

      // ━━━ Business Rule: CASCADE Stock → Disponibilité ━━━
      // Stock > 0 → Disponibilité = ON (Disponible)
      // Stock = 0 → Disponibilité = OFF (Épuisé)
      const deltaStockNum = typeof rowData.__stock__ === 'number' ? rowData.__stock__ : parseInt(String(rowData.__stock__)) || 0;
      if (deltaStockNum > 0) {
        rowData.__disponibilite__ = 'true'; // CASCADE: stock positif → Disponible
      } else {
        rowData.__disponibilite__ = 'false'; // CASCADE: stock nul → Épuisé
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

    // ━━━ BACKFILL: Ensure existing rows have native column values ━━━
    // If __disponibilite__ or __stock__ columns were just created, existing rows
    // won't have values for them. Backfill now.
    let backfilledCount = 0;
    for (const row of existingRows) {
      const data = row.data as Record<string, unknown>;
      let needsUpdate = false;
      const updatedData = { ...data };

      // Always ensure __disponibilite__ exists
      if (data.__disponibilite__ === undefined) {
        // Check if the sheet had a Disponibilité column and map its value
        let dispoValue = 'false';
        for (const [sheetIdx, nativeSlug] of deltaSheetColToNativeSlug) {
          if (nativeSlug === '__disponibilite__') {
            const colSlug = columnSlugs[sheetIdx];
            const rawVal = String(data[colSlug] ?? '').trim().toLowerCase();
            const isAvailable = ['true', '1', 'oui', 'disponible', 'en stock', 'yes'].includes(rawVal);
            dispoValue = String(isAvailable);
            break;
          }
        }
        updatedData.__disponibilite__ = dispoValue;
        needsUpdate = true;
      }

      // Always ensure __stock__ exists
      if (data.__stock__ === undefined) {
        let stockValue = 0;
        for (const [sheetIdx, nativeSlug] of deltaSheetColToNativeSlug) {
          if (nativeSlug === '__stock__') {
            const colSlug = columnSlugs[sheetIdx];
            const rawVal = String(data[colSlug] ?? '').trim();
            const num = parseInt(rawVal);
            stockValue = isNaN(num) ? 0 : num;
            break;
          }
        }
        updatedData.__stock__ = stockValue;
        needsUpdate = true;
      }

      if (data.__statut__ === undefined) {
        updatedData.__statut__ = 'Courant';
        updatedData.__statut_locked__ = false;
        needsUpdate = true;
      }
      if (data.__is_visible__ === undefined) {
        updatedData.__is_visible__ = true;
        needsUpdate = true;
      }

      // Always ensure __category__ exists
      if (data.__category__ === undefined) {
        let categoryValue = '';
        for (const [sheetIdx, nativeSlug] of deltaSheetColToNativeSlug) {
          if (nativeSlug === '__category__') {
            const colSlug = columnSlugs[sheetIdx];
            const rawVal = String(data[colSlug] ?? '').trim();
            categoryValue = rawVal;
            break;
          }
        }
        updatedData.__category__ = categoryValue;
        needsUpdate = true;
      }

      // Always ensure __sub_category__ exists
      if (data.__sub_category__ === undefined) {
        let subCategoryValue = '';
        for (const [sheetIdx, nativeSlug] of deltaSheetColToNativeSlug) {
          if (nativeSlug === '__sub_category__') {
            const colSlug = columnSlugs[sheetIdx];
            const rawVal = String(data[colSlug] ?? '').trim();
            subCategoryValue = rawVal;
            break;
          }
        }
        updatedData.__sub_category__ = subCategoryValue;
        needsUpdate = true;
      }

      // ━━━ CASCADE Business Rule: Stock → Disponibilité ━━━
      // Stock > 0 → Disponibilité = ON (Disponible)
      // Stock = 0 → Disponibilité = OFF (Épuisé)
      // Only apply cascade if __disponibilite__ was just backfilled (undefined before)
      // to avoid overwriting manual Sur Commande overrides on existing rows.
      const existingStock = typeof updatedData.__stock__ === 'number' ? updatedData.__stock__ : parseInt(String(updatedData.__stock__)) || 0;
      // If __disponibilite__ was backfilled (was undefined), apply full cascade
      if (data.__disponibilite__ === undefined) {
        if (existingStock > 0) {
          updatedData.__disponibilite__ = 'true'; // CASCADE: stock positif → Disponible
        } else {
          updatedData.__disponibilite__ = 'false'; // CASCADE: stock nul → Épuisé
        }
      }
      // For existing rows, only force OFF if stock=0 and disponibilité is somehow 'true'
      // (but respect Sur Commande — only cascade on backfill)
      if (existingStock === 0 && updatedData.__disponibilite__ !== 'false' && data.__disponibilite__ === undefined) {
        updatedData.__disponibilite__ = 'false';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.row.update({
          where: { id: row.id },
          data: { data: updatedData },
        });
        backfilledCount++;
      }
    }

    if (backfilledCount > 0) {
      console.log(`✅ BACKFILLED ${backfilledCount} existing row(s) with native column defaults (Statut/Disponibilité/Stock/Catégorie/Sous-catégorie)`);
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

    // ━━━ AUTO-UPSERT CATEGORIES FROM ROW DATA ━━━━━━━━━━━━━━━━━━━━━
    // Scan all rows (existing + newly inserted) for __category__/__sub_category__
    // values and auto-create corresponding Category/SubCategory records so the
    // pill filter appears without manual admin configuration.
    await syncCategoriesFromRows(dsId);

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
