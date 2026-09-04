import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { STATUS_OPTIONS } from '@/lib/status-config';
import { extractDriveFileId } from '@/lib/media-utils';
import { toPrismaJson } from '@/lib/prisma-json';

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(cell.trim());
        cell = '';
      } else if (ch === '\t') {
        current.push(cell.trim());
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(cell.trim());
        if (current.some(c => c.length > 0)) lines.push(current);
        current = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }
  current.push(cell.trim());
  if (current.some(c => c.length > 0)) lines.push(current);

  return lines;
}

function detectColumnType(values: string[]): string {
  const nonEmpty = values.filter(v => v && v.length > 0);
  if (nonEmpty.length === 0) return 'TEXT';

  // Check if all values are URLs ending in image extensions or containing image indicators
  const imagePatterns = /\.(jpg|jpeg|png|gif|webp|svg|bmp)/i;
  const drivePattern = /drive\.google\.com\/uc/i;
  const allImages = nonEmpty.every(v => imagePatterns.test(v) || drivePattern.test(v));
  if (allImages) return 'IMAGE';

  // Check if all values are numbers
  const allNumbers = nonEmpty.every(v => !isNaN(parseFloat(v.replace(/[^\d.,-]/g, '').replace(',', '.'))));
  const hasCurrency = nonEmpty.some(v => /[€$£د.مDHدرهم]/.test(v));
  if (allNumbers && hasCurrency) return 'CURRENCY';
  if (allNumbers) return 'NUMBER';

  return 'TEXT';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const csvText = formData.get('csvText') as string | null;

    let text = '';
    if (file) {
      text = await file.text();
    } else if (csvText) {
      text = csvText;
    } else {
      return NextResponse.json({ data: null, error: 'No file or CSV text provided' }, { status: 400 });
    }

    const rows = parseCSV(text);
    if (rows.length < 2) {
      return NextResponse.json({ data: null, error: 'CSV must have at least a header row and one data row' }, { status: 400 });
    }

    // First row = headers
    const headers = rows[0];
    const dataRows = rows.slice(1).filter(r => r.some(c => c && c.length > 0));

    // Detect column types from data
    const columnTypes: string[] = [];
    const columnSlugs: string[] = [];
    const slugCount: Record<string, number> = {};

    // ━━━ Map CSV columns to native slugs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // If the CSV has columns named "Catégorie"/"Sous-catégorie", map them to native slugs
    const NATIVE_SLUG_MAP: Record<string, string> = {
      'categorie': '__category__',
      'catégorie': '__category__',
      'category': '__category__',
      'sous_categorie': '__sub_category__',
      'sous-categorie': '__sub_category__',
      'sous-catégorie': '__sub_category__',
      'subcategory': '__sub_category__',
      'disponibilite': '__disponibilite__',
      'disponibilité': '__disponibilite__',
      'stock': '__stock__',
      'couleur': '__colors__',
      'color': '__colors__',
      'statut': '__statut__',
      // ━━ DEBT-9 : Colonne native discount (prix barré) ━━
      // Mapping multilingue : "Ancien_prix", "ancien_prix", "prix_barre", "compare_at_price"
      // La variante "Ancien_prix" (avec A majuscule, exactement comme saisie par l'admin)
      // est gérée par le .toLowerCase() appliqué à l'en-tête — mais on l'ajoute
      // explicitement ici pour robustesse et documentation.
      'ancien_prix': '__compare_at_price__',
      'ancien prix': '__compare_at_price__',
      'ancienprix': '__compare_at_price__',
      'prix_ancien': '__compare_at_price__',
      'prix ancien': '__compare_at_price__',
      'prix_barre': '__compare_at_price__',
      'prix_barré': '__compare_at_price__',
      'prixbarré': '__compare_at_price__',
      'prix original': '__compare_at_price__',
      'prix_original': '__compare_at_price__',
      'originalprice': '__compare_at_price__',
      'original price': '__compare_at_price__',
      'compare_at_price': '__compare_at_price__',
      'compareatprice': '__compare_at_price__',
      'compare at price': '__compare_at_price__',
      'old price': '__compare_at_price__',
      'oldprice': '__compare_at_price__',
      'prix de référence': '__compare_at_price__',
      'prix_reference': '__compare_at_price__',
    };
    const sheetColToNativeSlug = new Map<number, string>(); // col index → native slug

    for (let c = 0; c < headers.length; c++) {
      const values = dataRows.map(r => r[c] || '');
      const type = detectColumnType(values);
      columnTypes.push(type);

      // Check if this CSV column maps to a native slug
      const headerLower = headers[c].toLowerCase().trim();
      const nativeSlug = NATIVE_SLUG_MAP[headerLower];
      if (nativeSlug) {
        sheetColToNativeSlug.set(c, nativeSlug);
      }

      let slug = nativeSlug || slugify(headers[c]);
      if (!slug) slug = `column_${c}`;
      if (slugCount[slug] !== undefined) {
        slugCount[slug]++;
        slug = `${slug}_${slugCount[slug]}`;
      } else {
        slugCount[slug] = 0;
      }
      columnSlugs.push(slug);
    }

    // Group image columns: detect consecutive "groupe image N" columns
    let imageArraySlug: string | null = null;
    const imageGroupIndices: number[] = [];
    const groupePattern = /^groupe\s*image/i;

    for (let c = 0; c < headers.length; c++) {
      if (groupePattern.test(headers[c])) {
        imageGroupIndices.push(c);
      }
    }

    // Create columns
    // MANDAT 4P — tsc : tableau explicitement typé (était `[]` → never[],
    // TS2345 sur les push suivants). config en Record<string,unknown> puis
    // narrowé via toPrismaJson au point d'insertion Prisma.
    const columnsToCreate: {
      name: string; slug: string; type: string; order: number;
      visible: boolean; required: boolean; config: Record<string, unknown>;
    }[] = [];
    const columnsToSkip = new Set<number>();

    if (imageGroupIndices.length > 1) {
      // Create an IMAGE_ARRAY column for the grouped images
      imageArraySlug = 'groupe_images';
      columnsToCreate.push({
        name: 'Galerie Images',
        slug: imageArraySlug,
        type: 'IMAGE_ARRAY',
        order: headers.length,
        visible: true,
        required: false,
        config: { sourceColumns: imageGroupIndices.map(i => columnSlugs[i]) },
      });
      // Mark individual image group columns as hidden
      imageGroupIndices.forEach(i => columnsToSkip.add(i));
    }

    for (let c = 0; c < headers.length; c++) {
      // Skip columns that map to native slugs — they'll be handled by the native column block
      if (sheetColToNativeSlug.has(c)) {
        columnsToSkip.add(c);
        continue;
      }
      if (columnsToSkip.has(c)) {
        // Create as hidden individual columns (for data storage)
        columnsToCreate.push({
          name: headers[c],
          slug: columnSlugs[c],
          type: columnTypes[c],
          order: c,
          visible: false,
          required: false,
          config: {},
        });
      } else {
        const config: Record<string, unknown> = {};
        if (columnTypes[c] === 'CURRENCY') config.currencySymbol = 'DH';
        if (columnTypes[c] === 'SELECT' || columnTypes[c] === 'MULTI_SELECT') {
          const uniqueVals = new Set<string>();
          dataRows.forEach(r => {
            const val = r[c] || '';
            if (val) val.split(/[,;]/).forEach(v => uniqueVals.add(v.trim()));
          });
          config.options = Array.from(uniqueVals);
        }
        columnsToCreate.push({
          name: headers[c],
          slug: columnSlugs[c],
          type: columnTypes[c],
          order: c,
          visible: true,
          required: false,
          config,
        });
      }
    }

    // Create columns in DB
    for (const col of columnsToCreate) {
      await db.column.create({
        data: {
          ...col,
          // MANDAT 4P — tsc : narrowing JSON-safe → InputJsonObject
          config: toPrismaJson(col.config) ?? {},
          dataSourceId: id,
        },
      });
    }

    // ━━━ Guarantee native system columns ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Always ensure the 7 native columns exist (same as Google Sync does)
    // These are required for the DataTable's special cell rendering
    // DEBT-9 production repair : __compare_at_price__ ajouté en 7ème position (type CURRENCY)
    const nativeColumns = [
      { slug: '__colors__', name: 'Couleur', type: 'COLOR', order: -6, config: {} },
      { slug: '__category__', name: 'Catégorie', type: 'SELECT', order: -5, config: {} },
      { slug: '__sub_category__', name: 'Sous-catégorie', type: 'SELECT', order: -4, config: {} },
      { slug: '__disponibilite__', name: 'Disponibilité', type: 'BOOLEAN', order: -3, config: { labels: { true: 'Disponible', false: 'Épuisé' } } },
      { slug: '__stock__', name: 'Stock', type: 'NUMBER', order: -2, config: { isCounter: true, min: 0 } },
      { slug: '__statut__', name: 'Statut', type: 'STATUS', order: -1, config: { options: STATUS_OPTIONS.map(o => o.value) } },
      { slug: '__compare_at_price__', name: 'Prix barré', type: 'CURRENCY', order: 7, config: {} },
    ];

    for (const nc of nativeColumns) {
      await db.column.upsert({
        where: { dataSourceId_slug: { dataSourceId: id, slug: nc.slug } },
        update: {},
        create: {
          dataSourceId: id,
          slug: nc.slug,
          name: nc.name,
          type: nc.type,
          order: nc.order,
          visible: true,
          required: false,
          config: nc.config,
        },
      });
    }

    // ━━━ VG33.3: Auto-reassociation — fetch existing CDN assets for this datasource.
    // When a table is reimported (after delete+reimport), Drive file_ids in the new
    // data that already have a CDN URL in MediaAsset are automatically replaced
    // with the CDN URL — no re-download needed.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const existingCdnAssets = await db.mediaAsset.findMany({
      where: { dataSourceId: id, status: 'cdn', cdnUrl: { not: null } },
      select: { fileId: true, cdnUrl: true },
    });
    const cdnAssetMap = new Map(existingCdnAssets.map((a) => [a.fileId, a.cdnUrl!]));
    let reassocCount = 0;

    // Create rows — sequential to avoid connection pool exhaustion with pgbouncer
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowData: Record<string, unknown> = {};
      for (let c = 0; c < headers.length; c++) {
        if (c < row.length && row[c]) {
          rowData[columnSlugs[c]] = row[c];
        }
      }

      // Build the grouped image array — store as native array (not stringified)
      if (imageArraySlug && imageGroupIndices.length > 0) {
        const images: string[] = [];
        imageGroupIndices.forEach(c => {
          if (row[c] && row[c].length > 0) images.push(row[c]);
        });
        if (images.length > 0) {
          rowData[imageArraySlug] = images;
        }
      }

      // ━━━ VG33.3: Auto-reassociation — replace Drive URLs with CDN URLs ━━━
      // Scan every cell value for Drive file_ids. If a CDN asset exists, replace
      // the Drive URL with the CDN URL automatically (no re-download on next migrate).
      for (const key of Object.keys(rowData)) {
        const val = rowData[key];
        if (typeof val === 'string') {
          const fileId = extractDriveFileId(val);
          if (fileId && cdnAssetMap.has(fileId)) {
            rowData[key] = cdnAssetMap.get(fileId);
            reassocCount++;
          }
        } else if (Array.isArray(val)) {
          const replaced = val.map((u: unknown) => {
            if (typeof u === 'string') {
              const fid = extractDriveFileId(u);
              if (fid && cdnAssetMap.has(fid)) {
                reassocCount++;
                return cdnAssetMap.get(fid);
              }
            }
            return u;
          });
          rowData[key] = replaced;
        }
      }

      // ━━━ Native row data defaults ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Ensure every row has the native system fields initialized
      if (rowData.__colors__ === undefined) rowData.__colors__ = '';
      if (rowData.__category__ === undefined) rowData.__category__ = '';
      if (rowData.__sub_category__ === undefined) rowData.__sub_category__ = '';
      if (rowData.__stock__ === undefined) rowData.__stock__ = '0';
      if (rowData.__disponibilite__ === undefined) rowData.__disponibilite__ = 'false';
      if (rowData.__statut__ === undefined) rowData.__statut__ = 'Courant';
      if (rowData.__statut_locked__ === undefined) rowData.__statut_locked__ = false;
      if (rowData.__is_visible__ === undefined) rowData.__is_visible__ = true;
      // Cascade: if stock > 0 → Disponible
      const stockVal = parseInt(String(rowData.__stock__)) || 0;
      if (stockVal > 0) rowData.__disponibilite__ = 'true';

      await db.row.create({
        data: {
          dataSourceId: id,
          // MANDAT 4P — tsc : narrowing JSON-safe → InputJsonObject
          data: toPrismaJson(rowData) ?? {},
          order: i,
        },
      });
    }

    const ds = await db.dataSource.findUnique({
      where: { id },
      include: { _count: { select: { columns: true, rows: true } } },
    });

    return NextResponse.json({
      data: {
        dataSourceId: id,
        rowsCreated: dataRows.length,
        columnsCreated: columnsToCreate.length,
        imageGroupCreated: imageArraySlug !== null,
        cdnReassociated: reassocCount,
        columnTypes: Object.fromEntries(columnSlugs.map((s, i) => [s, columnTypes[i]])),
      },
      error: null,
    }, { status: 201 });
  } catch (e) {
    console.error('Import error:', e);
    return NextResponse.json({ data: null, error: 'Import failed: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
