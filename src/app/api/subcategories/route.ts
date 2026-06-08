import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Slug generation: lowercase, hyphens, no accents ────────────────────────
function generateSlug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Zero-product constraint: count rows referencing a slug ──────────────────
async function countProductReferences(field: '__category__' | '__sub_category__', slug: string): Promise<number> {
  const dataSources = await db.dataSource.findMany({
    select: { id: true },
  });

  let count = 0;
  for (const ds of dataSources) {
    const rows = await db.row.findMany({
      where: { dataSourceId: ds.id },
      select: { data: true },
    });
    for (const row of rows) {
      const data = row.data as Record<string, unknown> | null;
      if (data && data[field] === slug) {
        count++;
      }
    }
  }
  return count;
}

// GET /api/subcategories — Return subcategories, optionally filtered by categoryId
export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get('categoryId');

    const where: { categoryId?: string } = {};
    if (categoryId) where.categoryId = categoryId;

    const subCategories = await db.subCategory.findMany({
      where,
      orderBy: { ordre: 'asc' },
      include: {
        category: {
          select: { id: true, slug: true, label: true },
        },
      },
    });

    return NextResponse.json({ data: subCategories });
  } catch (error) {
    console.error('GET /api/subcategories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/subcategories — Create a subcategory
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { label, categoryId } = body;

    if (!label || typeof label !== 'string' || label.trim() === '') {
      return NextResponse.json({ error: 'Le champ "label" est requis' }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ error: 'Le champ "categoryId" est requis' }, { status: 400 });
    }

    // Verify parent category exists
    const parentCategory = await db.category.findUnique({ where: { id: categoryId } });
    if (!parentCategory) {
      return NextResponse.json({ error: 'Catégorie parente introuvable' }, { status: 404 });
    }

    const slug = body.slug || generateSlug(label);

    // Check slug uniqueness
    const existing = await db.subCategory.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Une sous-catégorie avec le slug "${slug}" existe déjà` },
        { status: 409 }
      );
    }

    const subCategory = await db.subCategory.create({
      data: {
        label: label.trim(),
        slug,
        categoryId,
        visible: body.visible !== false,
        ordre: body.ordre ?? 0,
      },
      include: {
        category: {
          select: { id: true, slug: true, label: true },
        },
      },
    });

    return NextResponse.json({ data: subCategory }, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json({ error: 'Cette sous-catégorie existe déjà (slug dupliqué)' }, { status: 409 });
    }
    console.error('POST /api/subcategories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/subcategories — Update a subcategory by id
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Le champ "id" est requis' }, { status: 400 });
    }

    // Build update data — slug is NEVER changed
    const updateData: { label?: string; visible?: boolean; ordre?: number } = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.visible !== undefined) updateData.visible = body.visible;
    if (body.ordre !== undefined) updateData.ordre = body.ordre;

    const subCategory = await db.subCategory.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: { id: true, slug: true, label: true },
        },
      },
    });

    return NextResponse.json({ data: subCategory });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Sous-catégorie introuvable' }, { status: 404 });
    }
    console.error('PATCH /api/subcategories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/subcategories?id=xxx — Delete a subcategory
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Le paramètre "id" est requis' }, { status: 400 });
    }

    // Find the subcategory to get its slug
    const subCategory = await db.subCategory.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!subCategory) {
      return NextResponse.json({ error: 'Sous-catégorie introuvable' }, { status: 404 });
    }

    // Zero-product constraint: check if any rows reference this subcategory slug
    const productCount = await countProductReferences('__sub_category__', subCategory.slug);
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer: ${productCount} produit(s) référence(nt) cette sous-catégorie`, count: productCount },
        { status: 403 }
      );
    }

    await db.subCategory.delete({ where: { id } });

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Sous-catégorie introuvable' }, { status: 404 });
    }
    console.error('DELETE /api/subcategories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
