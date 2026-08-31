/**
 * Migration script: backfill __compare_at_price__ native column
 * for all existing DataSources.
 *
 * Run with: bun run scripts/backfill-compare-at-price.ts
 *
 * Ensures every DataSource has the 7th native column
 * __compare_at_price__ (CURRENCY) physically created in the DB,
 * even if the source sheet/CSV never contained a discount column.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const NATIVE_COLUMN = {
  slug: '__compare_at_price__',
  name: 'Prix barré',
  type: 'CURRENCY',
  order: -6,
  config: {},
};

async function main() {
  console.log('━'.repeat(60));
  console.log('Backfill: __compare_at_price__ native column');
  console.log('━'.repeat(60));

  const dataSources = await db.dataSource.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${dataSources.length} DataSource(s) to check.\n`);

  let created = 0;
  let skipped = 0;

  for (const ds of dataSources) {
    const existing = await db.column.findFirst({
      where: { dataSourceId: ds.id, slug: NATIVE_COLUMN.slug },
    });

    if (existing) {
      console.log(`  ✓ ${ds.name} — already has __compare_at_price__`);
      skipped++;
      continue;
    }

    await db.column.create({
      data: {
        dataSourceId: ds.id,
        slug: NATIVE_COLUMN.slug,
        name: NATIVE_COLUMN.name,
        type: NATIVE_COLUMN.type,
        order: NATIVE_COLUMN.order,
        config: NATIVE_COLUMN.config,
        visible: true,
        required: false,
      },
    });

    console.log(`  + ${ds.name} — __compare_at_price__ created`);
    created++;
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`Done. Created: ${created}, Skipped (already exists): ${skipped}`);
  console.log('━'.repeat(60));

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  db.$disconnect();
  process.exit(1);
});
