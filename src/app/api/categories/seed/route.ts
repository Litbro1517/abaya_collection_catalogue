import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// Seed default categories and sub-categories for the Abaya Collection Catalogue
// POST /api/categories/seed — Idempotent (upsert, won't duplicate)
export async function POST() {
  try {
    const defaultCategories = [
      { slug: 'ensemble', label: 'Ensemble', ordre: 1, subCategories: [
        { slug: 'ensemble-nouveau', label: 'Nouveau', ordre: 1 },
        { slug: 'ensemble-saison', label: 'Saison', ordre: 2 },
        { slug: 'ensemble-discount', label: 'Discount', ordre: 3 },
      ]},
      { slug: 'abaya', label: 'Abaya', ordre: 2, subCategories: [
        { slug: 'abaya-nouveau', label: 'Nouveau', ordre: 1 },
        { slug: 'abaya-saison', label: 'Saison', ordre: 2 },
        { slug: 'abaya-discount', label: 'Discount', ordre: 3 },
      ]},
      { slug: 'kimono', label: 'Kimono', ordre: 3, subCategories: [
        { slug: 'kimono-nouveau', label: 'Nouveau', ordre: 1 },
        { slug: 'kimono-saison', label: 'Saison', ordre: 2 },
        { slug: 'kimono-discount', label: 'Discount', ordre: 3 },
      ]},
      { slug: 'robe', label: 'Robe', ordre: 4, subCategories: [
        { slug: 'robe-nouveau', label: 'Nouveau', ordre: 1 },
        { slug: 'robe-saison', label: 'Saison', ordre: 2 },
        { slug: 'robe-discount', label: 'Discount', ordre: 3 },
      ]},
      { slug: 'accessoires', label: 'Accessoires', ordre: 5, subCategories: [
        { slug: 'accessoires-nouveau', label: 'Nouveau', ordre: 1 },
        { slug: 'accessoires-saison', label: 'Saison', ordre: 2 },
        { slug: 'accessoires-discount', label: 'Discount', ordre: 3 },
      ]},
    ];

    let categoriesCreated = 0;
    let subCategoriesCreated = 0;

    for (const cat of defaultCategories) {
      const upserted = await db.category.upsert({
        where: { slug: cat.slug },
        update: {}, // NEVER overwrite admin's label/visibility
        create: {
          slug: cat.slug,
          label: cat.label,
          ordre: cat.ordre,
          visible: true,
        },
      });
      if (upserted) categoriesCreated++;

      for (const sub of cat.subCategories) {
        const subUpserted = await db.subCategory.upsert({
          where: { slug: sub.slug },
          update: {}, // NEVER overwrite admin's label/visibility
          create: {
            slug: sub.slug,
            label: sub.label,
            ordre: sub.ordre,
            visible: true,
            categoryId: upserted.id,
          },
        });
        if (subUpserted) subCategoriesCreated++;
      }
    }

    return NextResponse.json({
      data: {
        categoriesCreated,
        subCategoriesCreated,
        message: 'Default categories seeded (idempotent)',
      },
    });
  } catch (error) {
    console.error('Seed categories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// GET /api/categories/seed — Auto-seed on first load (call from frontend)
export async function GET() {
  return POST();
}
