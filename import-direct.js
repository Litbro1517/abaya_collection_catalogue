/**
 * Direct SQLite Import Script
 * Fetches clean CSV from Google Sheets export URL and inserts directly into SQLite
 * Completely bypasses Prisma and Next.js server
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'custom.db');
const SHEET_ID = '12R09MIIyYtH8Jovdqsk_sSmUGyeGFINcbztLDl1Iu6c';
const GID = '2087043853';

// Column configuration
const KNOWN_COLUMNS = {
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

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 60);
}

function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function resolveImageUrl(url) {
  if (!url) return '';
  const fileId = extractDriveFileId(url);
  if (fileId) return `/api/google/image-proxy?id=${fileId}&sz=800`;
  return url;
}

function isImageUrl(url) {
  if (!url) return false;
  if (extractDriveFileId(url)) return true;
  return false;
}

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') { currentField += '"'; i++; }
        else { inQuotes = false; }
      } else { currentField += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { currentRow.push(currentField.trim()); currentField = ''; }
      else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
        currentRow = []; currentField = '';
        if (char === '\r') i++;
      } else if (char === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
        currentRow = []; currentField = '';
      } else { currentField += char; }
    }
  }
  currentRow.push(currentField.trim());
  if (currentRow.some(f => f.length > 0)) rows.push(currentRow);
  return rows;
}

function cuid() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'c';
  for (let i = 0; i < 7; i++) id += c[Math.floor(Math.random() * c.length)];
  for (let i = 0; i < 16; i++) id += c[Math.floor(Math.random() * c.length)];
  return id;
}

async function main() {
  console.log('🚀 Starting direct SQLite import...');

  // Step 1: Fetch CSV
  const exportUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  console.log(`📥 Fetching CSV...`);
  const response = await fetch(exportUrl, {
    headers: { 'Accept': 'text/csv', 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const csvText = await response.text();
  if (csvText.trimStart().startsWith('<')) throw new Error('Got HTML instead of CSV');
  console.log(`✅ CSV fetched: ${csvText.length} bytes`);

  // Step 2: Parse
  const allRows = parseCSV(csvText);
  if (allRows.length < 2) throw new Error('No data rows');
  const headers = allRows[0];
  const dataRows = allRows.slice(1).filter(r => r.some(c => c && c.trim().length > 0));
  console.log(`📊 ${headers.length} columns, ${dataRows.length} rows`);
  console.log(`📋 Headers: ${headers.slice(0, 12).join(', ')}...`);

  // Step 3: Generate slugs
  const columnSlugs = [];
  const slugCount = {};
  for (let c = 0; c < headers.length; c++) {
    let slug = generateSlug(headers[c]) || `column_${c}`;
    if (slugCount[slug] !== undefined) { slugCount[slug]++; slug = `${slug}_${slugCount[slug]}`; }
    else { slugCount[slug] = 0; }
    columnSlugs.push(slug);
  }

  // Step 4: Detect image group columns
  const groupePattern = /^groupe\s*image/i;
  const imageGroupIndices = [];
  for (let c = 0; c < headers.length; c++) {
    if (groupePattern.test(headers[c])) imageGroupIndices.push(c);
  }
  console.log(`🖼️  Found ${imageGroupIndices.length} "groupe image" columns`);

  // Step 5: Open SQLite database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Step 6: Clean existing data
  const existingDs = db.prepare("SELECT id FROM DataSource WHERE sheetId = ?").get(SHEET_ID);
  if (existingDs) {
    console.log('🗑️  Deleting existing DataSource...');
    db.prepare("DELETE FROM Row WHERE dataSourceId = ?").run(existingDs.id);
    db.prepare("DELETE FROM Column WHERE dataSourceId = ?").run(existingDs.id);
    db.prepare("DELETE FROM DataSource WHERE id = ?").run(existingDs.id);
  }

  // Step 7: Create DataSource
  const dsId = cuid();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO DataSource (id, name, slug, description, icon, color, sourceType, sourceUrl, sheetId, sheetName, syncInterval, lastSyncedAt, googleSessionId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    dsId, 'Catalogue Abaya Collection', 'catalogue-abaya-collection', null, 'Table', '#C9A84C',
    'googlesheet', `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, SHEET_ID, null,
    0, now, null, now, now
  );
  console.log(`✅ DataSource created: ${dsId}`);

  // Step 8: Create Columns
  let imageArraySlug = null;
  const columns = [];

  // Merged IMAGE_ARRAY for groupe images
  if (imageGroupIndices.length > 1) {
    imageArraySlug = 'galerie_images';
    columns.push({
      id: cuid(), name: 'Galerie Images', slug: imageArraySlug, type: 'IMAGE_ARRAY',
      dataSourceId: dsId, order: headers.length, visible: 1, required: 0,
      config: JSON.stringify({ sourceColumns: imageGroupIndices.map(i => columnSlugs[i]) }),
      width: 150, createdAt: now, updatedAt: now,
    });
  }

  for (let c = 0; c < headers.length; c++) {
    const headerName = headers[c];
    const known = KNOWN_COLUMNS[headerName];
    const isImageGroup = imageGroupIndices.includes(c);

    let colType, visible, config = {};
    if (isImageGroup) {
      colType = 'IMAGE'; visible = false;
    } else if (known) {
      colType = known.type; visible = known.visible; config = known.config || {};
    } else {
      colType = 'IMAGE'; visible = false; // Default for unknown groupe image columns
    }

    // Extract options for SELECT/MULTI_SELECT
    if (colType === 'SELECT' || colType === 'MULTI_SELECT') {
      const uniqueVals = new Set();
      dataRows.forEach(r => {
        const val = r[c] || '';
        if (val) val.split(/[,;]/).forEach(v => { const t = v.trim(); if (t) uniqueVals.add(t); });
      });
      config.options = Array.from(uniqueVals);
    }

    columns.push({
      id: cuid(), name: headerName, slug: columnSlugs[c], type: colType,
      dataSourceId: dsId, order: c, visible: visible ? 1 : 0, required: 0,
      config: JSON.stringify(config), width: 150, createdAt: now, updatedAt: now,
    });
  }

  const insertCol = db.prepare(`INSERT INTO Column (id, name, slug, type, dataSourceId, \`order\`, visible, required, config, width, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const col of columns) {
    insertCol.run(col.id, col.name, col.slug, col.type, col.dataSourceId, col.order, col.visible, col.required, col.config, col.width, col.createdAt, col.updatedAt);
  }
  console.log(`✅ Created ${columns.length} columns`);

  // Step 9: Create Rows
  const insertRow = db.prepare(`INSERT INTO Row (id, dataSourceId, data, \`order\`, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`);
  let totalRows = 0;

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insertRow.run(row.id, row.dataSourceId, row.data, row.order, row.createdAt, row.updatedAt);
    }
  });

  const batchRows = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowData = {};

    for (let c = 0; c < headers.length; c++) {
      if (c < row.length && row[c]) {
        const known = KNOWN_COLUMNS[headers[c]];
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
      const images = [];
      imageGroupIndices.forEach(c => {
        if (row[c] && row[c].length > 0) {
          const urls = row[c].split(/\s+/).filter(u => isImageUrl(u));
          urls.forEach(u => { const r = resolveImageUrl(u); if (r) images.push(r); });
        }
      });
      if (images.length > 0) rowData[imageArraySlug] = images;
    }

    batchRows.push({
      id: cuid(), dataSourceId: dsId, data: JSON.stringify(rowData),
      order: i, createdAt: now, updatedAt: now,
    });
    totalRows++;
  }

  insertMany(batchRows);
  console.log(`✅ Created ${totalRows} rows`);

  // Step 10: Configure catalog section
  const catalog = db.prepare("SELECT id FROM Catalog LIMIT 1").get();
  if (catalog) {
    // Clean existing sections
    db.prepare("DELETE FROM Component WHERE sectionId IN (SELECT id FROM Section WHERE catalogId = ?)").run(catalog.id);
    db.prepare("DELETE FROM Section WHERE catalogId = ?").run(catalog.id);

    const sectionId = cuid();
    db.prepare(`INSERT INTO Section (id, catalogId, type, title, subtitle, config, \`order\`, visible, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      sectionId, catalog.id, 'collection', 'Notre Collection',
      'Découvrez nos abayas et ensembles',
      JSON.stringify({
        dataSourceId: dsId,
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
      }),
      0, 1, now, now
    );
    console.log(`✅ Created catalog section: Notre Collection`);

    // Publish catalog
    db.prepare("UPDATE Catalog SET published = 1 WHERE id = ?").run(catalog.id);
    console.log(`✅ Catalog published`);
  }

  db.close();

  console.log('\n🎉 Import complete!');
  console.log(`   DataSource: ${dsId}`);
  console.log(`   Columns: ${columns.length} (${columns.filter(c => c.visible).length} visible)`);
  console.log(`   Rows: ${totalRows}`);

  // Print visible columns
  console.log('\n📋 Visible columns:');
  for (const col of columns) {
    if (col.visible) {
      console.log(`   ✅ ${col.name} (${col.type}) → ${col.slug}`);
    }
  }
}

main().catch(e => { console.error('❌ Failed:', e); process.exit(1); });
