import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeColorName, generateColorSlug, parseColorList } from '@/lib/color-utils';

// ─── GET /api/colormap/lookup?names=noir,beige,bleu-nuit ────────────────
// Resolve color names to hex codes.
// Returns array of { name, hex } for names found in ColorMap.
// For names not found, returns { name, hex: null }.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const namesParam = req.nextUrl.searchParams.get('names');

    if (!namesParam || namesParam.trim() === '') {
      return NextResponse.json(
        { error: 'Le paramètre "names" est requis (ex: ?names=noir,beige,bleu-nuit)' },
        { status: 400 }
      );
    }

    // Parse the comma/semicolon-separated list
    const rawNames = parseColorList(namesParam);

    if (rawNames.length === 0) {
      return NextResponse.json(
        { error: 'Aucun nom de couleur fourni' },
        { status: 400 }
      );
    }

    // ── Normalize all names and generate slugs for lookup ──
    // We look up by slug (which is the immutable identifier)
    const lookupEntries = rawNames.map(raw => {
      const normalized = normalizeColorName(raw);
      const slug = generateColorSlug(normalized);
      return { raw, normalized, slug };
    });

    // ── Batch fetch from DB by slug ──
    const slugs = lookupEntries.map(e => e.slug);
    const colors = await db.colorMap.findMany({
      where: {
        slug: { in: slugs },
        isActive: true,
      },
      select: { name: true, slug: true, hex: true },
    });

    // Build a map: slug → { name, hex }
    const colorBySlug = new Map(
      colors.map(c => [c.slug, { name: c.name, hex: c.hex }])
    );

    // ── Build response ──
    const results = lookupEntries.map(entry => {
      const found = colorBySlug.get(entry.slug);
      return {
        name: entry.normalized,
        hex: found ? found.hex : null,
      };
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('GET /api/colormap/lookup error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
