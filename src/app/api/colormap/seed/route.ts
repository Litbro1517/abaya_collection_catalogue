import { db } from '@/lib/db';
import { DEFAULT_SEED_COLORS, normalizeColorName, colorNameToSlug } from '@/lib/color-utils';
import { NextResponse } from 'next/server';

// ─── POST /api/colormap/seed ─────────────────────────────────────────
// Seed default colors into the ColorMap (only if empty)
export async function POST() {
  try {
    const existing = await db.colorMap.findMany();
    if (existing.length > 0) {
      return NextResponse.json(
        { data: null, error: 'ColorMap is not empty — seed aborted' },
        { status: 400 }
      );
    }

    const colors = await db.colorMap.createMany({
      data: DEFAULT_SEED_COLORS.map((c, i) => ({
        name: normalizeColorName(c.name),
        slug: colorNameToSlug(c.name),
        hex: c.hex,
        ordre: i,
        visible: true,
      })),
    });

    const allColors = await db.colorMap.findMany({ orderBy: { ordre: 'asc' } });

    return NextResponse.json({ data: allColors, error: null }, { status: 201 });
  } catch (e) {
    console.error('ColorMap seed error:', e);
    return NextResponse.json({ data: null, error: 'Failed to seed colors' }, { status: 500 });
  }
}
