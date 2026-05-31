import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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

    for (let c = 0; c < headers.length; c++) {
      const values = dataRows.map(r => r[c] || '');
      const type = detectColumnType(values);
      columnTypes.push(type);

      let slug = slugify(headers[c]);
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
    const columnsToCreate = [];
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
          dataSourceId: id,
        },
      });
    }

    // Create rows — pass native objects for Json fields (PostgreSQL)
    const batchSize = 50;
    for (let i = 0; i < dataRows.length; i += batchSize) {
      const batch = dataRows.slice(i, i + batchSize);
      const createPromises = batch.map((row, idx) => {
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

        return db.row.create({
          data: {
            dataSourceId: id,
            data: rowData,
            order: i + idx,
          },
        });
      });

      await Promise.all(createPromises);
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
        columnTypes: Object.fromEntries(columnSlugs.map((s, i) => [s, columnTypes[i]])),
      },
      error: null,
    }, { status: 201 });
  } catch (e) {
    console.error('Import error:', e);
    return NextResponse.json({ data: null, error: 'Import failed: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
