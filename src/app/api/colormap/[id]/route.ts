import { db } from '@/lib/db';
import { normalizeColorName, colorNameToSlug, isValidHex } from '@/lib/color-utils';
import { NextRequest, NextResponse } from 'next/server';

// ─── PATCH /api/colormap/[id] ────────────────────────────────────────
// Update a color entry (name, hex, visible, ordre)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name: rawName, hex, visible, ordre } = body;

    const existing = await db.colorMap.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: 'Color not found' }, { status: 404 });
    }

    const data: { name?: string; slug?: string; hex?: string; visible?: boolean; ordre?: number } = {};

    if (rawName !== undefined && rawName !== null) {
      const name = normalizeColorName(rawName);
      if (!name) {
        return NextResponse.json({ data: null, error: 'Invalid color name' }, { status: 400 });
      }
      // Check uniqueness (exclude self)
      const duplicate = await db.colorMap.findFirst({
        where: {
          OR: [{ name }, { slug: colorNameToSlug(name) }],
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { data: null, error: `Color "${duplicate.name}" already exists` },
          { status: 409 }
        );
      }
      data.name = name;
      data.slug = colorNameToSlug(name);
    }

    if (hex !== undefined && hex !== null) {
      if (!isValidHex(hex)) {
        return NextResponse.json({ data: null, error: 'Invalid hex code' }, { status: 400 });
      }
      data.hex = hex.trim().toUpperCase();
    }

    if (visible !== undefined && visible !== null) {
      data.visible = Boolean(visible);
    }

    if (ordre !== undefined && ordre !== null) {
      data.ordre = Number(ordre);
    }

    const updated = await db.colorMap.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (e) {
    console.error('ColorMap PATCH error:', e);
    return NextResponse.json({ data: null, error: 'Failed to update color' }, { status: 500 });
  }
}

// ─── DELETE /api/colormap/[id] ───────────────────────────────────────
// Delete a color, with guard if used by products (returns 409)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.colorMap.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: 'Color not found' }, { status: 404 });
    }

    // Check product usage: count rows that reference this color name
    const allRows = await db.row.findMany({
      select: { id: true, data: true },
    });

    let productCount = 0;
    const colorName = existing.name;

    for (const row of allRows) {
      if (!row.data || typeof row.data !== 'object') continue;
      const data = row.data as Record<string, unknown>;
      for (const value of Object.values(data)) {
        if (typeof value === 'string' && value.includes(colorName)) {
          productCount++;
          break; // Count each row only once
        }
      }
    }

    if (productCount > 0) {
      return NextResponse.json(
        { data: null, error: `Impossible de supprimer : utilisée par ${productCount} produits`, productCount },
        { status: 409 }
      );
    }

    await db.colorMap.delete({ where: { id } });

    return NextResponse.json({ data: null, error: null });
  } catch (e) {
    console.error('ColorMap DELETE error:', e);
    return NextResponse.json({ data: null, error: 'Failed to delete color' }, { status: 500 });
  }
}
