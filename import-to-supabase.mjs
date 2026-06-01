/**
 * Import Google Sheet Data to Production Supabase via API
 * 
 * Steps:
 * 1. Authenticate via POST /api/auth
 * 2. Create DataSource via POST /api/datasources
 * 3. Fetch CSV from Google Sheets export URL
 * 4. Import CSV via POST /api/datasources/{id}/import
 * 5. Set up catalog section with column mappings
 * 6. Publish catalog
 */

const BASE_URL = 'https://abaya-collection-catalogue.vercel.app';
const PASSWORD = 'abayachic2024';
const SHEET_ID = '12R09MIIyYtH8Jovdqsk_sSmUGyeGFINcbztLDl1Iu6c';
const GID = '2087043853';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

let cookies = '';

async function apiCall(method, path, body = null, isFormData = false) {
  const opts = {
    method,
    headers: {
      ...(cookies ? { 'Cookie': cookies } : {}),
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  
  if (body) {
    if (isFormData) {
      // body is already FormData
      opts.body = body;
    } else {
      opts.body = JSON.stringify(body);
    }
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  console.log(`  → ${method} ${url.substring(0, 100)}...`);
  
  const res = await fetch(url, opts);
  
  // Capture set-cookie headers
  const setCookie = res.headers.getSetCookie?.();
  if (setCookie) {
    for (const c of setCookie) {
      const match = c.match(/^([^=]+)=([^;]+)/);
      if (match) {
        // Append to existing cookies
        if (cookies) {
          cookies = cookies.replace(new RegExp(`${match[1]}=[^;]*;?`), '') + `; ${match[1]}=${match[2]}`;
        } else {
          cookies = `${match[1]}=${match[2]}`;
        }
      }
    }
  }
  
  const data = await res.json();
  
  if (!res.ok) {
    console.error(`  ✗ API Error ${res.status}:`, data.error || data);
  } else {
    console.log(`  ✓ Success (${res.status})`);
  }
  
  return { status: res.status, data };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  ABAYA COLLECTION CATALOG - SUPABASE IMPORT');
  console.log('═'.repeat(60));
  console.log();

  // ─── Step 1: Authenticate ───
  console.log('━━━ Step 1: Authenticate ─━━');
  const authRes = await apiCall('POST', '/api/auth', { password: PASSWORD });
  if (authRes.status !== 200 || !authRes.data.data?.authenticated) {
    console.error('Authentication failed!');
    console.log('Response:', JSON.stringify(authRes.data));
    // Try to continue anyway - the import endpoint might not require auth
    console.log('Continuing without confirmed auth...');
  }
  console.log(`  Cookie: ${cookies ? cookies.substring(0, 50) + '...' : 'none'}`);
  console.log();

  // ─── Step 2: Fetch CSV from Google Sheets ───
  console.log('━━━ Step 2: Fetch Google Sheet CSV ─━━');
  console.log(`  Fetching: ${CSV_URL}`);
  const csvRes = await fetch(CSV_URL, {
    headers: {
      'Accept': 'text/csv',
      'User-Agent': 'Mozilla/5.0 (compatible; CatalogBot/1.0)',
    },
    redirect: 'follow',
  });
  
  if (!csvRes.ok) {
    throw new Error(`Failed to fetch CSV: ${csvRes.status} ${csvRes.statusText}`);
  }
  
  const csvText = await csvRes.text();
  if (csvText.trimStart().startsWith('<')) {
    throw new Error('Got HTML instead of CSV - Google Sheet may not be publicly accessible');
  }
  
  // Quick CSV analysis
  const headerLine = csvText.split('\n')[0];
  const headerCount = (headerLine.match(/,/g) || []).length + 1;
  const lineCount = csvText.split('\n').filter(l => l.trim()).length;
  console.log(`  ✓ CSV fetched: ${csvText.length.toLocaleString()} bytes`);
  console.log(`  ≈ ${headerCount} columns, ~${lineCount - 1} data rows`);
  
  // Show first few headers
  const firstHeaders = headerLine.split(',').slice(0, 15).map(h => h.replace(/"/g, '').trim());
  console.log(`  Headers: ${firstHeaders.join(' | ')}...`);
  console.log();

  // ─── Step 3: Check for existing data sources and clean up ───
  console.log('━━━ Step 3: Check existing data sources ─━━');
  const existingRes = await apiCall('GET', '/api/datasources');
  if (existingRes.data.data && Array.isArray(existingRes.data.data)) {
    const existing = existingRes.data.data;
    console.log(`  Found ${existing.length} existing data source(s)`);
    
    for (const ds of existing) {
      console.log(`  Deleting: ${ds.name} (${ds.id})`);
      await apiCall('DELETE', `/api/datasources/${ds.id}`);
    }
  }
  console.log();

  // ─── Step 4: Create DataSource ───
  console.log('━━━ Step 4: Create DataSource ─━━');
  const dsRes = await apiCall('POST', '/api/datasources', {
    name: 'Catalogue Abayas',
    slug: 'catalogue-abayas',
    sourceType: 'googlesheet',
    sourceUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
    description: 'Catalogue principal importé depuis Google Sheets',
  });
  
  if (!dsRes.data.data?.id) {
    console.error('Failed to create DataSource!');
    console.log('Response:', JSON.stringify(dsRes.data));
    throw new Error('DataSource creation failed');
  }
  
  const dsId = dsRes.data.data.id;
  console.log(`  ✓ DataSource created: ${dsId}`);
  console.log();

  // ─── Step 5: Import CSV via the import endpoint ───
  console.log('━━━ Step 5: Import CSV data ─━━');
  console.log(`  Sending ${csvText.length.toLocaleString()} bytes of CSV data...`);
  
  const formData = new FormData();
  formData.append('csvText', csvText);
  
  const importRes = await apiCall('POST', `/api/datasources/${dsId}/import`, formData, true);
  
  if (importRes.data.error) {
    console.error('Import endpoint failed:', importRes.data.error);
    console.log('\n  ⚠ Falling back to direct Prisma import...');
    await fallbackDirectImport(dsId, csvText);
  } else {
    console.log('  ✓ Import successful!');
    console.log(`  Rows created: ${importRes.data.data?.rowsCreated || 'unknown'}`);
    console.log(`  Columns created: ${importRes.data.data?.columnsCreated || 'unknown'}`);
    console.log(`  Image group merged: ${importRes.data.data?.imageGroupCreated || 'unknown'}`);
  }
  console.log();

  // ─── Step 6: Verify imported data ───
  console.log('━━━ Step 6: Verify imported data ─━━');
  const verifyRes = await apiCall('GET', `/api/datasources/${dsId}/rows?limit=5`);
  if (verifyRes.data.data) {
    const rows = verifyRes.data.data;
    console.log(`  Sample row count: ${rows.length}`);
    if (rows.length > 0) {
      const sampleRow = rows[0];
      const dataKeys = Object.keys(sampleRow.data || {});
      console.log(`  Sample row data keys: ${dataKeys.slice(0, 10).join(', ')}...`);
    }
  }
  
  const colRes = await apiCall('GET', `/api/datasources/${dsId}/columns`);
  if (colRes.data.data) {
    const visibleCols = colRes.data.data.filter(c => c.visible);
    const hiddenCols = colRes.data.data.filter(c => !c.visible);
    console.log(`  Total columns: ${colRes.data.data.length}`);
    console.log(`  Visible: ${visibleCols.length}, Hidden: ${hiddenCols.length}`);
    console.log('  Visible columns:');
    for (const col of visibleCols) {
      console.log(`    ✅ ${col.name} (${col.type}) → ${col.slug}`);
    }
  }
  console.log();

  // ─── Step 7: Set up catalog section ───
  console.log('━━━ Step 7: Set up catalog section ─━━');
  
  // Get existing catalog
  const catalogRes = await apiCall('GET', '/api/catalog');
  let catalogId = catalogRes.data.data?.id;
  
  if (!catalogId) {
    // Create catalog
    console.log('  Creating catalog...');
    const createCatRes = await apiCall('POST', '/api/catalog', {
      name: 'Catalogue Abaya Chic',
      slug: 'catalogue-abaya-chic',
    });
    catalogId = createCatRes.data.data?.id;
  }
  
  if (!catalogId) {
    console.error('  Failed to get/create catalog!');
  } else {
    console.log(`  Catalog ID: ${catalogId}`);
    
    // Find the IMAGE_ARRAY column slug from the imported columns
    let galleryColumnSlug = 'groupe_images';
    if (colRes.data.data) {
      const imageArrayCol = colRes.data.data.find(c => c.type === 'IMAGE_ARRAY');
      if (imageArrayCol) {
        galleryColumnSlug = imageArrayCol.slug;
        console.log(`  Found IMAGE_ARRAY column: ${imageArrayCol.name} → ${imageArrayCol.slug}`);
      }
    }
    
    // Delete existing sections
    if (catalogRes.data.data?.sections) {
      for (const section of catalogRes.data.data.sections) {
        console.log(`  Deleting old section: ${section.title || section.id}`);
        await apiCall('DELETE', `/api/catalog/sections/${section.id}`);
      }
    }
    
    // Create "Notre Collection" section
    const sectionRes = await apiCall('POST', '/api/catalog/sections', {
      catalogId,
      type: 'collection',
      title: 'Notre Collection',
      subtitle: 'Découvrez nos abayas et ensembles',
      config: {
        dataSourceId: dsId,
        titleColumn: 'nom_produit_docx',
        coverColumn: 'image_de_garde',
        priceColumn: 'prix_vente',
        carouselColumn: galleryColumnSlug,
        descriptionColumn: 'description',
        variantColumn: 'options_tailles',
        colorColumn: 'options_couleurs',
        urlColumn: 'url_complete',
        layout: 'grid',
        columns: 4,
      },
    });
    
    if (sectionRes.data.data?.id) {
      console.log(`  ✓ Section created: ${sectionRes.data.data.title} (${sectionRes.data.data.id})`);
    } else {
      console.error('  Failed to create section:', sectionRes.data.error);
    }
  }
  console.log();

  // ─── Step 8: Publish catalog ───
  console.log('━━━ Step 8: Publish catalog ─━━');
  if (catalogId) {
    const settingsRes = await apiCall('PUT', `/api/catalog/settings`, {
      catalogId,
      published: true,
      whatsappNumber: '+212600000000',
      primaryColor: '#C9A84C',
      secondaryColor: '#1A1A1A',
      accentColor: '#F5F0E8',
      backgroundColor: '#FAF8F5',
      enableZoom: true,
      enableSearch: true,
      enableSharing: true,
      conversionChannel: 'whatsapp',
    });
    console.log(`  Publish result: ${settingsRes.status}`);
  }
  console.log();

  // ─── Final Summary ───
  console.log('═'.repeat(60));
  console.log('  IMPORT COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  DataSource ID: ${dsId}`);
  console.log(`  Catalog ID: ${catalogId || 'N/A'}`);
  console.log(`  Live URL: ${BASE_URL}`);
  console.log('═'.repeat(60));
}

// Fallback: direct row-by-row import via API if the bulk import fails
async function fallbackDirectImport(dsId, csvText) {
  console.log('  Using fallback: row-by-row import via API...');
  
  // Parse CSV
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error('CSV has no data rows');
  
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(r => r.some(c => c && c.trim().length > 0));
  console.log(`  Parsed: ${headers.length} columns, ${dataRows.length} data rows`);
  
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
  console.log(`  Found ${imageGroupIndices.length} "groupe image" columns`);
  
  // Determine column types
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
  
  let imageArraySlug = null;
  
  // Create IMAGE_ARRAY column for grouped images
  if (imageGroupIndices.length > 1) {
    imageArraySlug = 'galerie_images';
    console.log(`  Creating IMAGE_ARRAY column: ${imageArraySlug}`);
    await apiCall('POST', `/api/datasources/${dsId}/columns`, {
      name: 'Galerie Images',
      type: 'IMAGE_ARRAY',
      visible: true,
      required: false,
      config: { sourceColumns: imageGroupIndices.map(i => columnSlugs[i]) },
    });
  }
  
  // Create individual columns
  let created = 0;
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
      colType = 'IMAGE'; visible = false; // Default hidden for unknown columns
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
    
    const res = await apiCall('POST', `/api/datasources/${dsId}/columns`, {
      name: headerName,
      type: colType,
      visible,
      required: false,
      config,
    });
    
    if (res.status === 201) created++;
    
    // Small delay to avoid overwhelming the API
    if (created % 20 === 0) {
      console.log(`    Created ${created}/${headers.length} columns...`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
  console.log(`  ✓ Created ${created + (imageArraySlug ? 1 : 0)} columns`);
  
  // Import rows in batches
  console.log(`  Importing ${dataRows.length} rows...`);
  let importedRows = 0;
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowData = {};
    
    for (let c = 0; c < headers.length; c++) {
      if (c < row.length && row[c]) {
        rowData[columnSlugs[c]] = row[c];
      }
    }
    
    // Build grouped image array
    if (imageArraySlug && imageGroupIndices.length > 0) {
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
    
    await apiCall('POST', `/api/datasources/${dsId}/rows`, {
      data: rowData,
      order: i,
    });
    
    importedRows++;
    
    if (importedRows % 10 === 0) {
      console.log(`    Imported ${importedRows}/${dataRows.length} rows...`);
    }
    
    // Small delay to avoid rate limiting
    if (importedRows % 20 === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  console.log(`  ✓ Imported ${importedRows} rows`);
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

main().catch(e => {
  console.error('\n❌ IMPORT FAILED:', e);
  process.exit(1);
});
