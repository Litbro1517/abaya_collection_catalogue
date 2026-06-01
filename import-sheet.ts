/**
 * Direct Google Sheet Import Script
 * Fetches clean CSV from the export URL and imports into the database
 * Bypasses the gviz/tq endpoint that mangles headers
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SHEET_ID = '12R09MIIyYtH8Jovdqsk_sSmUGyeGFINcbztLDl1Iu6c';
const GID = '2087043853';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

// Column type mapping for known columns
const KNOWN_COLUMNS: Record<string, { type: string; visible: boolean; config?: Record<string, unknown> }> = {
  'N Ordre': { type: 'NUMBER', visible: false },
  'Image de Garde': { type: 'IMAGE', visible: true },
  'Cliquer ici': { type: 'TEXT', visible: false },
  'URL_Complete': { type: 'URL', visible: false },
  'Nom_Produit_Docx': { type: 'TEXT', visible: true },
  'Nom_Store': { type: 'TEXT', visible: false },
  'Prix_Vente': { type: 'CURRENCY', visible: true, config: { currencySymbol: 'DH' } },
  'Prix_Revendeur': { type: 'CURRENCY', visible: false, config: { currencySymbol: 'DH' } },
  'Benefice': { type: 'CURRENCY', visible: false, config: { currencySymbol: 'DH' } },
  'Description': { type: 'TEXT', visible: true },
  'Options_Tailles': { type: 'SELECT', visible: true },
  'Options_Couleurs': { type: 'MULTI_SELECT', visible: true },
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

function extractDriveFileId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function resolveImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const fileId = extractDriveFileId(url);
  if (fileId) return `/api/google/image-proxy?id=${fileId}&sz=800`;
  return url;
}

function isImageUrl(url: string): boolean {
  if (!url) return false;
  if (extractDriveFileId(url)) return true;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase().split('?')[0];
  return imageExtensions.some(ext => lowerUrl.endsWith(ext));
}

// Robust CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++;
      } else if (char === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some(f => f.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

async function main() {
  console.log('🚀 Starting direct Google Sheet import...');

  // Step 1: Fetch CSV from direct export URL
  const exportUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  console.log(`📥 Fetching CSV from: ${exportUrl}`);

  const response = await fetch(exportUrl, {
    headers: {
      'Accept': 'text/csv',
      'User-Agent': 'Mozilla/5.0 (compatible; CatalogBot/1.0)',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  if (csvText.trimStart().startsWith('<')) {
    throw new Error('Got HTML instead of CSV - export URL not accessible');
  }

  console.log(`✅ CSV fetched: ${csvText.length} bytes`);

  // Step 2: Parse CSV
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) {
    throw new Error('CSV has no data rows');
  }

  const headers = allRows[0];
  const dataRows = allRows.slice(1).filter(r => r.some(c => c && c.trim().length > 0));

  console.log(`📊 Parsed: ${headers.length} columns, ${dataRows.length} data rows`);
  console.log(`📋 Headers: ${headers.slice(0, 12).join(', ')}... (+${Math.max(0, headers.length - 12)} groupe image columns)`);

  // Step 3: Generate slugs
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

  // Step 4: Detect image group columns
  const groupePattern = /^groupe\s*image/i;
  const imageGroupIndices: number[] = [];
  for (let c = 0; c < headers.length; c++) {
    if (groupePattern.test(headers[c])) {
      imageGroupIndices.push(c);
    }
  }

  console.log(`🖼️  Found ${imageGroupIndices.length} "groupe image" columns → will merge into IMAGE_ARRAY`);

  // Step 5: Delete existing DataSource if any
  const existing = await prisma.dataSource.findFirst({
    where: { sheetId: SHEET_ID },
  });
  if (existing) {
    console.log(`🗑️  Deleting existing DataSource: ${existing.name} (${existing.id})`);
    await prisma.dataSource.delete({ where: { id: existing.id } });
  }

  // Step 6: Create DataSource
  const ds = await prisma.dataSource.create({
    data: {
      name: 'Catalogue Abaya Collection',
      slug: 'catalogue-abaya-collection',
      sourceType: 'googlesheet',
      sourceUrl: SHEET_URL,
      sheetId: SHEET_ID,
      sheetName: null,
      syncInterval: 0,
      lastSyncedAt: new Date(),
    },
  });
  console.log(`✅ Created DataSource: ${ds.name} (${ds.id})`);

  // Step 7: Create Columns
  const columnsToCreate: Array<{
    name: string;
    slug: string;
    type: string;
    order: number;
    visible: boolean;
    required: boolean;
    config: Record<string, unknown>;
    dataSourceId: string;
  }> = [];

  // Add merged IMAGE_ARRAY column for groupe images
  let imageArraySlug: string | null = null;
  if (imageGroupIndices.length > 1) {
    imageArraySlug = 'galerie_images';
    columnsToCreate.push({
      name: 'Galerie Images',
      slug: imageArraySlug,
      type: 'IMAGE_ARRAY',
      order: headers.length,
      visible: true,
      required: false,
      config: { sourceColumns: imageGroupIndices.map(i => columnSlugs[i]) },
      dataSourceId: ds.id,
    });
  }

  // Add regular columns
  for (let c = 0; c < headers.length; c++) {
    const headerName = headers[c];
    const known = KNOWN_COLUMNS[headerName];
    const isImageGroup = imageGroupIndices.includes(c);

    // Determine type
    let colType: string;
    let visible: boolean;
    let config: Record<string, unknown> = {};

    if (isImageGroup) {
      colType = 'IMAGE';
      visible = false; // Hidden - merged into IMAGE_ARRAY
    } else if (known) {
      colType = known.type;
      visible = known.visible;
      config = known.config || {};
    } else {
      // Auto-detect from data
      const sampleValues = dataRows.slice(0, 20).map(r => r[c] || '').filter(Boolean);
      colType = detectType(sampleValues);
      visible = true;
    }

    // For SELECT columns, extract unique options
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
      name: headerName,
      slug: columnSlugs[c],
      type: colType,
      order: c,
      visible,
      required: false,
      config,
      dataSourceId: ds.id,
    });
  }

  for (const col of columnsToCreate) {
    await prisma.column.create({ data: col });
  }
  console.log(`✅ Created ${columnsToCreate.length} columns`);

  // Step 8: Create Rows in batches
  const batchSize = 50;
  let totalRows = 0;
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const batch = dataRows.slice(i, i + batchSize);
    const createPromises = batch.map((row, idx) => {
      const rowData: Record<string, unknown> = {};

      for (let c = 0; c < headers.length; c++) {
        if (c < row.length && row[c]) {
          const headerName = headers[c];
          const known = KNOWN_COLUMNS[headerName];
          const colType = known?.type || 'TEXT';
          const isImageGroup = imageGroupIndices.includes(c);

          if (colType === 'IMAGE' || isImageGroup) {
            const resolved = resolveImageUrl(row[c]);
            if (resolved) rowData[columnSlugs[c]] = resolved;
          } else {
            rowData[columnSlugs[c]] = row[c];
          }
        }
      }

      // Build grouped image array
      if (imageArraySlug && imageGroupIndices.length > 0) {
        const images: string[] = [];
        imageGroupIndices.forEach(c => {
          if (row[c] && row[c].length > 0) {
            // A cell might contain multiple URLs
            const urls = row[c].split(/\s+/).filter((u: string) => isImageUrl(u));
            urls.forEach((u: string) => {
              const resolved = resolveImageUrl(u);
              if (resolved) images.push(resolved);
            });
          }
        });
        if (images.length > 0) {
          rowData[imageArraySlug] = images;
        }
      }

      return prisma.row.create({
        data: {
          dataSourceId: ds.id,
          data: rowData,
          order: i + idx,
        },
      });
    });

    await Promise.all(createPromises);
    totalRows += batch.length;
  }
  console.log(`✅ Created ${totalRows} rows`);

  // Step 9: Update catalog section to display this data
  const catalog = await prisma.catalog.findFirst();
  if (catalog) {
    // Delete existing sections
    await prisma.component.deleteMany({ where: { section: { catalogId: catalog.id } } });
    await prisma.section.deleteMany({ where: { catalogId: catalog.id } });

    // Create a collection section
    const section = await prisma.section.create({
      data: {
        catalogId: catalog.id,
        type: 'collection',
        title: 'Notre Collection',
        subtitle: 'Découvrez nos abayas et ensembles',
        order: 0,
        visible: true,
        config: {
          dataSourceId: ds.id,
          titleColumn: 'nom_produit_docx',
          coverColumn: 'image_de_garde',
          priceColumn: 'prix_vente',
          carouselColumn: imageArraySlug || 'image_de_garde',
          descriptionColumn: 'description',
          variantColumn: 'options_tailles',
          colorColumn: 'options_couleurs',
          urlColumn: 'url_complete',
          layout: 'grid',
          columns: 4,
        },
      },
    });
    console.log(`✅ Created catalog section: ${section.title}`);

    // Publish the catalog
    await prisma.catalog.update({
      where: { id: catalog.id },
      data: { published: true },
    });
    console.log(`✅ Catalog published`);
  }

  console.log('\n🎉 Import complete!');
  console.log(`   DataSource ID: ${ds.id}`);
  console.log(`   Columns: ${columnsToCreate.length}`);
  console.log(`   Rows: ${totalRows}`);

  // Print column summary
  console.log('\n📋 Column Summary:');
  for (const col of columnsToCreate) {
    if (col.visible) {
      console.log(`   ✅ ${col.name} (${col.type}) → ${col.slug}`);
    } else {
      console.log(`   ⬜ ${col.name} (${col.type}) → ${col.slug} [hidden]`);
    }
  }
}

function detectType(sampleValues: string[]): string {
  if (sampleValues.length === 0) return 'TEXT';
  
  let imageCount = 0;
  let numberCount = 0;
  let currencyCount = 0;
  let urlCount = 0;
  
  const currencySymbols = ['€', '$', '£', 'MAD', 'DH', 'درهم'];
  
  for (const val of sampleValues) {
    if (!val) continue;
    const trimmed = val.trim().toLowerCase();
    
    if (isImageUrl(trimmed)) { imageCount++; continue; }
    if (currencySymbols.some(s => trimmed.includes(s.toLowerCase()))) { currencyCount++; continue; }
    if (/^\d+([.,]\d+)?$/.test(trimmed.replace(/\s/g, ''))) { numberCount++; continue; }
    if (trimmed.startsWith('http')) { urlCount++; continue; }
  }
  
  const total = sampleValues.filter(v => v).length;
  const threshold = total * 0.5;
  
  if (imageCount >= threshold) return 'IMAGE';
  if (currencyCount >= threshold) return 'CURRENCY';
  if (numberCount >= threshold) return 'NUMBER';
  if (urlCount >= threshold) return 'URL';
  return 'TEXT';
}

main()
  .catch(e => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
