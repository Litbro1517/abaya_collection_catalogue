import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Slug generation: lowercase, hyphens, no accents ────────────────────────
function generateSlug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const defaultCategories = [
  { label: 'Ensemble', ordre: 1 },
  { label: 'Abaya', ordre: 2 },
  { label: 'Kimono', ordre: 3 },
  { label: 'Robe', ordre: 4 },
  { label: 'Accessoires', ordre: 5 },
];

const defaultSubCategories = [
  { label: 'Nouveau', ordre: 1 },
  { label: 'Saison', ordre: 2 },
  { label: 'Discount', ordre: 3 },
];

async function main() {
  console.log('🌱 Seeding categories and subcategories...\n');

  for (const cat of defaultCategories) {
    const catSlug = generateSlug(cat.label);

    // Upsert category (create if not exists, skip if already exists)
    const category = await prisma.category.upsert({
      where: { slug: catSlug },
      update: {}, // Don't update if already exists
      create: {
        label: cat.label,
        slug: catSlug,
        visible: true,
        ordre: cat.ordre,
      },
    });

    console.log(`  ✅ Category: ${category.label} (slug: ${category.slug})`);

    // Create subcategories for this category
    // Prefix with category slug for global uniqueness (schema requires @unique on slug)
    for (const sub of defaultSubCategories) {
      const subSlug = `${catSlug}-${generateSlug(sub.label)}`;

      const existingSub = await prisma.subCategory.findUnique({
        where: { slug: subSlug },
      });

      if (existingSub) {
        console.log(`    ⏭️  SubCategory already exists: ${sub.label} (slug: ${subSlug})`);
      } else {
        const subCategory = await prisma.subCategory.create({
          data: {
            label: sub.label,
            slug: subSlug,
            categoryId: category.id,
            visible: true,
            ordre: sub.ordre,
          },
        });
        console.log(`    ✅ SubCategory: ${subCategory.label} (slug: ${subCategory.slug}) under ${category.label}`);
      }
    }
  }

  // Summary
  const totalCategories = await prisma.category.count();
  const totalSubCategories = await prisma.subCategory.count();
  console.log(`\n🎉 Seed complete: ${totalCategories} categories, ${totalSubCategories} subcategories`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
