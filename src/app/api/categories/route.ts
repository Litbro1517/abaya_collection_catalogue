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
// ━━━ Phase 3: Native SQL — PostgreSQL counts at the engine level, zero RAM loading ━━━
// Before: Loaded ALL rows into Node.js RAM, iterated with JS — O(N×M) with full JSONB transfer
// After: Single COUNT query with JSONB path filter — engine-only, zero rows transferred
async function countProductReferences(field: '__category__' | '__sub_category__', slug: string): Promise<number> {
  const result = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::int AS count
    FROM rows
    WHERE data->>${field} = ${slug}
  `;
  return Number(result[0]?.count ?? 0);
}

// GET /api/categories — Return all categories with subCategories, ordered by ordre
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { ordre: 'asc' },
      include: {
        subCategories: {
          orderBy: { ordre: 'asc' },
        },
      },
    });
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/categories — Create a new category
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const label: string | undefined = body.label;
    if (!label || typeof label !== 'string' || label.trim() === '') {
      return NextResponse.json({ error: 'Le champ "label" est requis' }, { status: 400 });
    }

    const slug = body.slug || generateSlug(label);

    // Check slug uniqueness
    const existing = await db.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Une catégorie avec le slug "${slug}" existe déjà` },
        { status: 409 }
      );
    }

    const category = await db.category.create({
      data: {
        label: label.trim(),
        slug,
        visible: body.visible !== false,
        ordre: body.ordre ?? 0,
        ...(body.translations !== undefined ? { translations: body.translations } : {}),
      },
      include: {
        subCategories: { orderBy: { ordre: 'asc' } },
      },
    });

    // Auto-translate if translations not provided
    if (!body.translations) {
      try {
        const translateRes = await fetch(new URL('/api/translate', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: label.trim(), sourceLang: 'fr', targetLangs: ['ar', 'en'] }),
        });
        if (translateRes.ok) {
          const translateJson = await translateRes.json();
          if (translateJson.data) {
            await db.category.update({
              where: { id: category.id },
              data: { translations: translateJson.data },
            });
            category.translations = translateJson.data;
          }
        }
      } catch {
        // Auto-translation failed — non-critical, continue without it
      }
    }

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json({ error: 'Cette catégorie existe déjà (slug dupliqué)' }, { status: 409 });
    }
    console.error('POST /api/categories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/categories — Update a category by id
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Le champ "id" est requis' }, { status: 400 });
    }

    // Build update data — slug is NEVER changed
    const updateData: { label?: string; visible?: boolean; ordre?: number; translations?: unknown } = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.visible !== undefined) updateData.visible = body.visible;
    if (body.ordre !== undefined) updateData.ordre = body.ordre;
    if (body.translations !== undefined) (updateData as any).translations = body.translations;

    const category = await db.category.update({
      where: { id },
      data: updateData,
      include: {
        subCategories: { orderBy: { ordre: 'asc' } },
      },
    });

    // Auto-translate if label changed but translations not provided
    if (body.label !== undefined && !body.translations) {
      try {
        const translateRes = await fetch(new URL('/api/translate', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: body.label.trim(), sourceLang: 'fr', targetLangs: ['ar', 'en'] }),
        });
        if (translateRes.ok) {
          const translateJson = await translateRes.json();
          if (translateJson.data) {
            await db.category.update({
              where: { id: category.id },
              data: { translations: translateJson.data },
            });
            category.translations = translateJson.data;
          }
        }
      } catch {
        // Auto-translation failed — non-critical
      }
    }

    return NextResponse.json({ data: category });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }
    console.error('PATCH /api/categories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/categories?id=xxx — Delete a category (cascade removes subcategories)
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Le paramètre "id" est requis' }, { status: 400 });
    }

    // Find the category to get its slug
    const category = await db.category.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!category) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }

    // Zero-product constraint: check if any rows reference this category slug
    const productCount = await countProductReferences('__category__', category.slug);
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer: ${productCount} produit(s) référence(nt) cette catégorie`, count: productCount },
        { status: 403 }
      );
    }

    // Safe to delete — cascade will remove subcategories
    await db.category.delete({ where: { id } });

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }
    console.error('DELETE /api/categories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
