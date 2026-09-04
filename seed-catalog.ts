import { db } from './src/lib/db';
import * as fs from 'fs';

// MANDAT 4P — P2 hygiène secrets : mot de passe admin depuis l'env (plus de
// clair dans le repo). Le script refuse de s'exécuter sans la variable.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD manquant — exportez-le avant d’exécuter ce script.');
  process.exit(1);
}

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Ensure admin password exists
  const existingPwd = await db.settings.findUnique({ where: { key: 'adminPassword' } });
  if (!existingPwd) {
    await db.settings.create({ data: { key: 'adminPassword', value: ADMIN_PASSWORD } }); // MANDAT 4P — P2 : secret env, pas en clair
    console.log('✅ Admin password set (from ADMIN_PASSWORD env)');
  }

  // 2. Check if data source already exists
  const existing = await db.dataSource.findFirst({ where: { slug: 'catalogue_produits' } });
  if (existing) {
    console.log('⚠️  Data source already exists, skipping import');
    console.log(`   ID: ${existing.id}, Rows: ${await db.row.count({ where: { dataSourceId: existing.id } })}`);
    return;
  }

  // 3. Create data source
  const ds = await db.dataSource.create({
    data: {
      name: 'Catalogue Produits',
      slug: 'catalogue_produits',
      description: 'Catalogue principal importé depuis Google Sheets',
      icon: 'Table',
      color: '#C9A84C',
      sourceType: 'csv',
    },
  });
  console.log(`✅ Data source created: ${ds.id}`);

  // 4. Define columns based on the Excel structure
  const columns = [
    { name: 'N° Ordre', slug: 'n_ordre', type: 'NUMBER', visible: true },
    { name: 'Image de Garde', slug: 'image_de_garde', type: 'IMAGE', visible: true },
    { name: 'URL Produit', slug: 'url_complete', type: 'URL', visible: true },
    { name: 'Nom du Produit', slug: 'nom_produit_docx', type: 'TEXT', visible: true },
    { name: 'Nom du Store', slug: 'nom_store', type: 'TEXT', visible: true },
    { name: 'Prix de Vente', slug: 'prix_vente', type: 'CURRENCY', visible: true },
    { name: 'Prix Revendeur', slug: 'prix_revendeur', type: 'CURRENCY', visible: false },
    { name: 'Bénéfice', slug: 'benefice', type: 'CURRENCY', visible: false },
    { name: 'Description', slug: 'description', type: 'TEXT', visible: true },
    { name: 'Tailles', slug: 'options_tailles', type: 'SELECT', visible: true },
    { name: 'Couleurs', slug: 'options_couleurs', type: 'SELECT', visible: true },
    { name: 'Galerie Images', slug: 'galerie_images', type: 'IMAGE_ARRAY', visible: true },
  ];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    await db.column.create({
      data: {
        name: col.name,
        slug: col.slug,
        type: col.type,
        dataSourceId: ds.id,
        order: i,
        visible: col.visible,
        config: JSON.stringify(
          col.type === 'CURRENCY' ? { currencySymbol: 'DH' } :
          col.type === 'SELECT' ? {} :
          col.type === 'IMAGE_ARRAY' ? { sourceColumns: [] } :
          {}
        ),
      },
    });
  }
  console.log(`✅ ${columns.length} columns created`);

  // 5. Read and parse the Excel data
  const xlsx = await import('node:fs');
  const { execSync } = await import('node:child_process');

  // Convert xlsx to csv using python
  const inputFile = '/home/z/my-project/upload/Copie de final Catalog_doss_Correct (3).xlsx';
  const csvFile = '/tmp/catalog_seed.csv';

  try {
    execSync(`python3 -c "
import openpyxl
import csv
wb = openpyxl.load_workbook('${inputFile}', read_only=True)
ws = wb['Galerie Glide']
with open('${csvFile}', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    for row in ws.iter_rows(values_only=True):
        writer.writerow([str(c) if c is not None else '' for c in row])
wb.close()
"`, { stdio: 'pipe' });
    console.log('✅ Excel converted to CSV');
  } catch (e) {
    console.error('❌ Failed to convert Excel:', e);
    return;
  }

  // 6. Parse CSV and import rows
  const csvContent = fs.readFileSync(csvFile, 'utf-8');
  const lines = csvContent.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Map headers to column slugs
  const headerToSlug: Record<string, string> = {
    'N Ordre': 'n_ordre',
    'Image de Garde': 'image_de_garde',
    'URL_Complete': 'url_complete',
    'Nom_Produit_Docx': 'nom_produit_docx',
    'Nom_Store': 'nom_store',
    'Prix_Vente': 'prix_vente',
    'Prix_Revendeur': 'prix_revendeur',
    'Benefice': 'benefice',
    'Description': 'description',
    'Options_Tailles': 'options_tailles',
    'Options_Couleurs': 'options_couleurs',
  };

  // Find indices for groupe image columns
  const groupeImageIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (/^groupe\s*image/i.test(headers[i])) {
      groupeImageIndices.push(i);
    }
  }

  // Find indices for other known columns
  const columnIndices: Record<string, number> = {};
  for (const [header, slug] of Object.entries(headerToSlug)) {
    const idx = headers.findIndex(h => h === header);
    if (idx >= 0) columnIndices[slug] = idx;
  }

  console.log(`📊 Found ${groupeImageIndices.length} image group columns`);
  console.log(`📊 Mapped ${Object.keys(columnIndices).length} known columns`);

  // 7. Create rows in batches
  let rowsCreated = 0;
  const batchSize = 50;

  for (let i = 1; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    const createPromises = batch.map((line, idx) => {
      // Simple CSV parse (handle basic quoting)
      const cells: string[] = [];
      let cell = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { cells.push(cell.trim()); cell = ''; }
        else { cell += ch; }
      }
      cells.push(cell.trim());

      const data: Record<string, string> = {};

      // Add mapped columns
      for (const [slug, colIdx] of Object.entries(columnIndices)) {
        if (colIdx < cells.length && cells[colIdx]) {
          // Clean up HYPERLINK formulas
          let val = cells[colIdx];
          if (val.startsWith('=HYPERLINK(')) {
            const match = val.match(/=HYPERLINK\("([^"]+)"/);
            val = match ? match[1] : val;
          }
          data[slug] = val;
        }
      }

      // Collect image URLs into galerie_images array
      const images: string[] = [];
      for (const imgIdx of groupeImageIndices) {
        if (imgIdx < cells.length && cells[imgIdx] && cells[imgIdx].startsWith('http')) {
          images.push(cells[imgIdx]);
        }
      }
      if (images.length > 0) {
        data['galerie_images'] = JSON.stringify(images);
      }

      // Skip empty rows
      if (Object.keys(data).length <= 1) return null;

      return db.row.create({
        data: {
          dataSourceId: ds.id,
          data: JSON.stringify(data),
          order: i + idx - 1,
        },
      });
    }).filter(Boolean);

    await Promise.all(createPromises);
    rowsCreated += createPromises.length;
    if (i % 200 === 0) console.log(`  ... ${rowsCreated} rows created`);
  }

  console.log(`✅ ${rowsCreated} rows imported`);

  // 8. Create a default collection section
  const catalog = await db.catalog.findFirst();
  if (catalog) {
    await db.section.create({
      data: {
        catalogId: catalog.id,
        type: 'collection',
        title: 'Nos Produits',
        subtitle: 'Découvrez notre collection',
        config: JSON.stringify({
          dataSourceId: ds.id,
          titleColumn: 'nom_produit_docx',
          descriptionColumn: 'description',
          priceColumn: 'prix_vente',
          coverColumn: 'image_de_garde',
          carouselColumn: 'galerie_images',
          variantColumn: 'options_couleurs',
          detailColumns: ['options_tailles', 'options_couleurs', 'nom_store', 'url_complete'],
          columnsPerRow: 3,
          cardStyle: 'elevated',
          showTitle: true,
          showDescription: true,
          showPrice: true,
        }),
        order: 0,
        visible: true,
      },
    });
    console.log('✅ Default section created');
  }

  console.log('\n🎉 Seed complete!');
  console.log(`   Data Source ID: ${ds.id}`);
  console.log(`   Rows: ${rowsCreated}`);
  console.log(`   Admin password: via ADMIN_PASSWORD env (jamais affiché)`);
}

seed()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
