import { db } from '@/lib/db';
import { normalizeColorName, parseColorList, generateDefaultHex } from '@/lib/color-utils';
import { NextRequest, NextResponse } from 'next/server';

// ─── POST /api/colormap/validate-import ──────────────────────────────
// Given a list of raw color values from an import, return unknown colors
// with suggested hex codes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { colors: rawColors } = body;

    if (!Array.isArray(rawColors)) {
      return NextResponse.json(
        { data: null, error: 'colors must be an array of strings' },
        { status: 400 }
      );
    }

    // Get all known colors
    const knownColors = await db.colorMap.findMany();
    const knownNames = new Set(knownColors.map(c => c.name));

    // Parse and normalize all incoming color values
    const allParsedNames = new Set<string>();
    for (const raw of rawColors) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const parsed = parseColorList(raw);
      for (const name of parsed) {
        allParsedNames.add(name);
      }
    }

    // Find unknown colors
    const unknownColors = Array.from(allParsedNames)
      .filter(name => !knownNames.has(name))
      .map(name => ({
        name,
        suggestedHex: generateDefaultHex(name),
      }));

    return NextResponse.json({ data: unknownColors, error: null });
  } catch (e) {
    console.error('ColorMap validate-import error:', e);
    return NextResponse.json({ data: null, error: 'Failed to validate colors' }, { status: 500 });
  }
}
