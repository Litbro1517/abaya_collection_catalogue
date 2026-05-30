import { db } from './src/lib/db';
import * as fs from 'fs';

async function seed() {
  console.log('🌱 Re-importing catalog data from JSON...');

  // Delete existing data source
  const existing = await db.dataSource.findFirst({ where: { slug: 'catalogue_produits' } });
  if (existing) {
    await db.row.deleteMany({ where: { dataSourceId: existing.id } });
    await db.column.deleteMany({ where: { dataSourceId: existing.id } });
    await db.relation.deleteMany({ where: { sourceTableId: existing.id } });
    await db.dataSource.delete({ where: { id: existing.id } });
    console.log('🗑️  Deleted existing data source');
  }

  // Delete existing section
  const catalog = await db.catalog.findFirst();
  if (catalog) {
    await db.section.deleteMany({ where: { catalogId: catalog.id } });
  }

  // Create data source
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

  // Define columns
  const columns = [
    { name: 'N° Ordre', slug: 'n_ordre', type: 'NUMBER', visible: false },
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

  // Read JSON data
  const jsonData = JSON.parse(fs.readFileSync('/tmp/catalog_seed.json', 'utf-8'));
  const headers: string[] = jsonData.headers;

  // Find column indices
  const headerMap: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    headerMap[headers[i]] = i;
  }

  const groupeImageIndices: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (/^groupe\s*image/i.test(headers[i])) {
      groupeImageIndices.push(i);
    }
  }

  const knownHeaders: Record<string, string> = {
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

  const columnIndices: Record<string, number> = {};
  for (const [header, slug] of Object.entries(knownHeaders)) {
    const idx = headerMap[header];
    if (idx !== undefined) columnIndices[slug] = idx;
  }

  console.log(`📊 Found ${groupeImageIndices.length} image group columns`);

  // Create rows
  let rowsCreated = 0;
  const batchSize = 50;

  for (let i = 0; i < jsonData.rows.length; i += batchSize) {
    const batch = jsonData.rows.slice(i, i + batchSize);
    const createPromises = batch.map((cells: string[], idx: number) => {
      const data: Record<string, string> = {};

      for (const [slug, colIdx] of Object.entries(columnIndices)) {
        if (colIdx < cells.length && cells[colIdx]) {
          let val = cells[colIdx];
          // Clean up HYPERLINK formulas
          if (val.startsWith('=HYPERLINK(')) {
            const match = val.match(/=HYPERLINK\("([^"]+)"/);
            val = match ? match[1] : '';
          }
          // Clean up error values
          if (val === '#ERROR!') val = '';
          data[slug] = val;
        }
      }

      // Collect image URLs
      const images: string[] = [];
      for (const imgIdx of groupeImageIndices) {
        if (imgIdx < cells.length && cells[imgIdx] && cells[imgIdx].startsWith('http')) {
          images.push(cells[imgIdx]);
        }
      }
      if (images.length > 0) {
        data['galerie_images'] = JSON.stringify(images);
      }

      return db.row.create({
        data: {
          dataSourceId: ds.id,
          data: JSON.stringify(data),
          order: i + idx,
        },
      });
    });

    await Promise.all(createPromises);
    rowsCreated += createPromises.length;
  }

  console.log(`✅ ${rowsCreated} rows imported`);

  // Create section
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
    console.log('✅ Section created');
  }

  console.log('\n🎉 Import complete!');
}

seed()
  .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
