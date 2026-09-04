/**
 * Import Google Sheet Data to Production Supabase via API
 * Uses sequential API calls to avoid connection pool timeout issues
 */

const BASE_URL = 'https://abaya-collection-catalogue.vercel.app';
// MANDAT 4P — P2 hygiène secrets : mot de passe en clair retiré (audit DUEL 360° réserve D1).
// Rotation recommandée côté prod — l'ancien valeur ne doit PLUS être considérée sûre.
const PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!PASSWORD) { console.error('❌ ADMIN_PASSWORD manquant — exportez-le avant de lancer ce script.'); process.exit(1); }
const SHEET_ID = '12R09MIIyYtH8Jovdqsk_sSmUGyeGFINcbztLDl1Iu6c';
const GID = '2087043853';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

let authToken = '';

// Cookie jar
let cookies = {};

function parseCookies(setCookieHeaders) {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const h of headers) {
    const match = h.match(/^([^=]+)=([^;]+)/);
    if (match) cookies[match[1]] = match[2];
  }
}

function getCookieString() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      ...(Object.keys(cookies).length ? { 'Cookie': getCookieString() } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, opts);
  
  // Capture cookies
  const setCookie = res.headers.getSetCookie?.();
  if (setCookie) parseCookies(setCookie);
  
  const data = await res.json();
  return { status: res.status, data };
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

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('═'.repeat(60));
  console.log('  ABAYA IMPORT - VIA VERCEL API (Sequential)');
  console.log('═'.repeat(60));

  // Step 1: Authenticate
  console.log('\n[1/7] Authenticating...');
  const authRes = await api('POST', '/api/auth', { password: PASSWORD });
  console.log(`  Auth: ${authRes.data.data?.authenticated ? '✓' : '✗'} (cookie: ${getCookieString().substring(0, 40)}...)`);

  // Step 2: Fetch CSV
  console.log('\n[2/7] Fetching CSV from Google Sheets...');
  const csvRes = await fetch(CSV_URL, {
    headers: { 'Accept': 'text/csv', 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  });
  if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
  const csvText = await csvRes.text();
  if (csvText.trimStart().startsWith('<')) throw new Error('Got HTML, not CSV');
  
  const allRows = parseCSV(csvText);
  const headers = allRows[0];
  const dataRows = allRows.slice(1).filter(r => r.some(c => c && c.trim().length > 0));
  console.log(`  ✓ ${csvText.length.toLocaleString()} bytes, ${headers.length} cols, ${dataRows.length} rows`);

  // Generate slugs
  const columnSlugs = [];
  const slugCount = {};
  for (let c = 0; c < headers.length; c++) {
    let slug = slugify(headers[c]) || `column_${c}`;
    if (slugCount[slug] !== undefined) { slugCount[slug]++; slug = `${slug}_${slugCount[slug]}`; }
    else { slugCount[slug] = 0; }
    columnSlugs.push(slug);
  }

  // Detect image group columns
  const groupePattern = /^groupe\s*image/i;
  const imageGroupIndices = [];
  for (let c = 0; c < headers.length; c++) {
    if (groupePattern.test(headers[c])) imageGroupIndices.push(c);
  }
  console.log(`  Image group columns: ${imageGroupIndices.length}`);

  // Step 3: Clean existing data
  console.log('\n[3/7] Cleaning existing data...');
  const existingRes = await api('GET', '/api/datasources');
  if (existingRes.data.data) {
    for (const ds of existingRes.data.data) {
      console.log(`  Deleting: ${ds.name} (${ds.id})`);
      await api('DELETE', `/api/datasources/${ds.id}`);
      await delay(300);
    }
  }

  // Step 4: Create DataSource
  console.log('\n[4/7] Creating DataSource...');
  const dsRes = await api('POST', '/api/datasources', {
    name: 'Catalogue Abayas',
    sourceType: 'googlesheet',
    sourceUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
    description: 'Catalogue principal importé depuis Google Sheets',
  });
  
  if (!dsRes.data.data?.id) {
    throw new Error(`DataSource creation failed: ${JSON.stringify(dsRes.data)}`);
  }
  const dsId = dsRes.data.data.id;
  console.log(`  ✓ DataSource: ${dsId}`);

  // Step 5: Create Columns
  console.log('\n[5/7] Creating columns...');
  
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

  let imageArraySlug = 'galerie_images';
  
  // Create IMAGE_ARRAY column first
  console.log(`  Creating IMAGE_ARRAY: Galerie Images → ${imageArraySlug}`);
  await api('POST', `/api/datasources/${dsId}/columns`, {
    name: 'Galerie Images',
    type: 'IMAGE_ARRAY',
    visible: true,
    required: false,
    config: { sourceColumns: imageGroupIndices.map(i => columnSlugs[i]) },
  });
  await delay(200);

  // Create individual columns
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
      colType = 'TEXT'; visible = true;
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

    const res = await api('POST', `/api/datasources/${dsId}/columns`, {
      name: headerName,
      type: colType,
      visible,
      required: false,
      config,
    });
    
    if (res.status !== 201) {
      console.log(`  ✗ Column "${headerName}" failed: ${res.data.error}`);
    }
    
    // Small delay every 10 columns to avoid rate limiting
    if ((c + 1) % 10 === 0) {
      console.log(`  Created ${c + 1}/${headers.length} columns...`);
      await delay(300);
    }
  }
  console.log(`  ✓ All ${headers.length + 1} columns created`);

  // Step 6: Import Rows
  console.log('\n[6/7] Importing rows...');
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowData = {};

    for (let c = 0; c < headers.length; c++) {
      if (c < row.length && row[c]) {
        rowData[columnSlugs[c]] = row[c];
      }
    }

    // Build grouped image array
    if (imageGroupIndices.length > 0) {
      const images = [];
      imageGroupIndices.forEach(c => {
        if (row[c] && row[c].length > 0) {
          images.push(row[c]);
        }
      });
      if (images.length > 0) {
        rowData[imageArraySlug] = images;
      }
    }

    const res = await api('POST', `/api/datasources/${dsId}/rows`, {
      data: rowData,
      order: i,
    });

    if (res.status === 201) {
      imported++;
    } else {
      failed++;
      console.log(`  ✗ Row ${i + 1} failed: ${res.data.error}`);
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`  Imported ${i + 1}/${dataRows.length} rows...`);
    }

    // Small delay every 5 rows to be gentle with the API
    if ((i + 1) % 5 === 0) {
      await delay(200);
    }
  }
  console.log(`  ✓ Imported: ${imported}, Failed: ${failed}`);

  // Step 7: Set up catalog section
  console.log('\n[7/7] Setting up catalog section...');
  
  // Get catalog
  const catalogRes = await api('GET', '/api/catalog');
  let catalog = catalogRes.data.data;
  
  if (!catalog) {
    console.log('  Creating catalog...');
    const createRes = await api('POST', '/api/catalog', {
      name: 'Catalogue Abaya Chic',
      slug: 'catalogue-abaya-chic',
    });
    catalog = createRes.data.data;
  }
  
  if (catalog) {
    // Delete existing sections
    if (catalog.sections) {
      for (const section of catalog.sections) {
        console.log(`  Deleting old section: ${section.title || section.id}`);
        await api('DELETE', `/api/catalog/sections/${section.id}`);
        await delay(200);
      }
    }

    // Create "Notre Collection" section
    const sectionRes = await api('POST', '/api/catalog/sections', {
      catalogId: catalog.id,
      type: 'collection',
      title: 'Notre Collection',
      subtitle: 'Découvrez nos abayas et ensembles',
      config: {
        dataSourceId: dsId,
        titleColumn: 'nom_produit_docx',
        coverColumn: 'image_de_garde',
        priceColumn: 'prix_vente',
        carouselColumn: imageArraySlug,
        descriptionColumn: 'description',
        variantColumn: 'options_tailles',
        colorColumn: 'options_couleurs',
        urlColumn: 'url_complete',
        layout: 'grid',
        columns: 4,
      },
    });

    if (sectionRes.data.data?.id) {
      console.log(`  ✓ Section: ${sectionRes.data.data.title} (${sectionRes.data.data.id})`);
    } else {
      console.log(`  ✗ Section creation failed: ${sectionRes.data.error}`);
    }

    // Try to publish the catalog
    // Note: The catalog route auto-creates settings, but we need to update published status
    // There may not be a direct API for this, so let's try the settings endpoint
    const settingsRes = await api('PUT', `/api/catalog/settings`, {
      catalogId: catalog.id,
      whatsappNumber: '',
      primaryColor: '#C9A84C',
      enableZoom: true,
      enableSearch: true,
      enableSharing: true,
      conversionChannel: 'whatsapp',
    });
    console.log(`  Settings update: ${settingsRes.status}`);
  }

  // Final verification
  console.log('\n' + '═'.repeat(60));
  console.log('  VERIFICATION');
  console.log('═'.repeat(60));
  
  const verifyRes = await api('GET', '/api/datasources');
  if (verifyRes.data.data) {
    for (const ds of verifyRes.data.data) {
      console.log(`  DataSource: ${ds.name} (${ds.columnCount} cols, ${ds.rowCount} rows)`);
    }
  }
  
  const catRes = await api('GET', '/api/catalog');
  if (catRes.data.data) {
    console.log(`  Catalog: ${catRes.data.data.name} (published=${catRes.data.data.published})`);
    for (const s of catRes.data.data.sections || []) {
      console.log(`  Section: ${s.title}`);
    }
  }
  
  console.log('\n  🎉 Import complete!');
  console.log(`  Live URL: ${BASE_URL}`);
}

main().catch(e => {
  console.error('\n❌ Import failed:', e);
  process.exit(1);
});
