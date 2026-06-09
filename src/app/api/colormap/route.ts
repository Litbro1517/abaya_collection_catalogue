import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeColorName, generateColorSlug, validateAndNormalizeHex } from '@/lib/color-utils';

// ─── GET /api/colormap — List all colors, ordered by ordre ASC ──────────
export async function GET() {
  try {
    const colors = await db.colorMap.findMany({
      orderBy: { ordre: 'asc' },
    });
    return NextResponse.json({ data: colors });
  } catch (error) {
    console.error('GET /api/colormap error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ─── POST /api/colormap — Create a new color with normalization ─────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name: rawName, hex: rawHex, ordre, visible, isActive } = body;

    // ── Validate name ──
    if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
      return NextResponse.json(
        { error: 'Le champ "name" est requis' },
        { status: 400 }
      );
    }

    // ── Validate hex ──
    if (!rawHex || typeof rawHex !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "hex" est requis' },
        { status: 400 }
      );
    }

    const hex = validateAndNormalizeHex(rawHex);
    if (!hex) {
      return NextResponse.json(
        { error: `Code hex invalide: "${rawHex}". Format attendu: #RRGGBB` },
        { status: 400 }
      );
    }

    // ── Normalize name & generate slug ──
    const name = normalizeColorName(rawName);
    const slug = generateColorSlug(name);

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Le nom normalisé est vide après traitement' },
        { status: 400 }
      );
    }

    // ── Check uniqueness ──
    const existingByName = await db.colorMap.findUnique({ where: { name } });
    if (existingByName) {
      return NextResponse.json(
        { error: `Une couleur avec le nom "${name}" existe déjà` },
        { status: 409 }
      );
    }

    const existingBySlug = await db.colorMap.findUnique({ where: { slug } });
    if (existingBySlug) {
      return NextResponse.json(
        { error: `Une couleur avec le slug "${slug}" existe déjà` },
        { status: 409 }
      );
    }

    // ── Determine ordre ──
    let colorOrdre: number;
    if (ordre !== undefined && ordre !== null) {
      colorOrdre = Number(ordre);
    } else {
      // Auto-assign: put at the end
      const maxOrdre = await db.colorMap.aggregate({
        _max: { ordre: true },
      });
      colorOrdre = (maxOrdre._max.ordre ?? -1) + 1;
    }

    // ── Create ──
    const color = await db.colorMap.create({
      data: {
        name,
        slug,
        hex,
        ordre: colorOrdre,
        visible: visible !== false,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ data: color }, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Cette couleur existe déjà (contrainte unique)' },
        { status: 409 }
      );
    }
    console.error('POST /api/colormap error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ─── PUT /api/colormap — Update a color by id ───────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "id" est requis' },
        { status: 400 }
      );
    }

    // ── Verify color exists ──
    const existing = await db.colorMap.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Couleur introuvable' },
        { status: 404 }
      );
    }

    // ── Build update data ──
    const updateData: {
      name?: string;
      slug?: string;
      hex?: string;
      ordre?: number;
      visible?: boolean;
      isActive?: boolean;
    } = {};

    // If name is being updated, re-normalize and regenerate slug
    if (body.name !== undefined && body.name !== null) {
      const name = normalizeColorName(body.name);
      if (!name) {
        return NextResponse.json(
          { error: 'Le nom normalisé est vide après traitement' },
          { status: 400 }
        );
      }

      const slug = generateColorSlug(name);

      // Check uniqueness of new name/slug (excluding current record)
      if (name !== existing.name) {
        const dupName = await db.colorMap.findUnique({ where: { name } });
        if (dupName) {
          return NextResponse.json(
            { error: `Une couleur avec le nom "${name}" existe déjà` },
            { status: 409 }
          );
        }
      }

      if (slug !== existing.slug) {
        const dupSlug = await db.colorMap.findUnique({ where: { slug } });
        if (dupSlug) {
          return NextResponse.json(
            { error: `Une couleur avec le slug "${slug}" existe déjà` },
            { status: 409 }
          );
        }
      }

      updateData.name = name;
      updateData.slug = slug;
    }

    // If hex is being updated, validate it
    if (body.hex !== undefined && body.hex !== null) {
      const hex = validateAndNormalizeHex(body.hex);
      if (!hex) {
        return NextResponse.json(
          { error: `Code hex invalide: "${body.hex}". Format attendu: #RRGGBB` },
          { status: 400 }
        );
      }
      updateData.hex = hex;
    }

    if (body.ordre !== undefined) updateData.ordre = Number(body.ordre);
    if (body.visible !== undefined) updateData.visible = Boolean(body.visible);
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    // ── Perform update ──
    const color = await db.colorMap.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: color });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Couleur introuvable' },
        { status: 404 }
      );
    }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflit de contrainte unique lors de la mise à jour' },
        { status: 409 }
      );
    }
    console.error('PUT /api/colormap error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ─── DELETE /api/colormap?id=xxx — Delete a color with safety check ─────
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'Le paramètre "id" est requis' },
        { status: 400 }
      );
    }

    // ── Verify color exists ──
    const color = await db.colorMap.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!color) {
      return NextResponse.json(
        { error: 'Couleur introuvable' },
        { status: 404 }
      );
    }

    // ── Safety check: count product references ──
    // Check all DataSources for rows referencing this color slug or name
    const dataSources = await db.dataSource.findMany({
      select: { id: true },
    });

    let productCount = 0;
    for (const ds of dataSources) {
      const rows = await db.row.findMany({
        where: { dataSourceId: ds.id },
        select: { data: true },
      });
      for (const row of rows) {
        const data = row.data as Record<string, unknown> | null;
        if (data) {
          // Check all values in the row data for this color slug or name
          const values = Object.values(data);
          if (
            values.some(
              v =>
                v === color.slug ||
                v === color.name ||
                (typeof v === 'string' &&
                  v.split(/[,;]/).some(s => s.trim().toLowerCase() === color.slug.toLowerCase() || s.trim().toLowerCase() === color.name.toLowerCase()))
            )
          ) {
            productCount++;
          }
        }
      }
    }

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer: ${productCount} produit(s) référence(nt) cette couleur`,
          count: productCount,
        },
        { status: 403 }
      );
    }

    // ── Safe to delete ──
    await db.colorMap.delete({ where: { id } });

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Couleur introuvable' },
        { status: 404 }
      );
    }
    console.error('DELETE /api/colormap error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
