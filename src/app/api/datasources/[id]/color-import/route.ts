import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeColorName, generateColorSlug, parseColorList } from '@/lib/color-utils';

/**
 * POST /api/datasources/[id]/color-import
 *
 * One-Shot Bulk Import: reads raw color text from a source column, normalizes each
 * color name, resolves it against the ColorMap, and writes the canonical comma-separated
 * names into the target COLOR column of the current table.
 *
 * This is MORE INTELLIGENT than stock-import because it:
 *   - Parses multi-value fields (comma, semicolon, multi-space separated)
 *   - Normalizes color names (Title Case, accent-aware)
 *   - Resolves against ColorMap via slug-based lookup
 *   - Fail-fasts if ANY color name is unrecognized (422)
 *   - Only writes when ALL colors are known
 *
 * Body:
 *   sourceTableId           — ID of the data source to read from (can be same table)
 *   matchColumnSlug         — Column slug in source table for matching (ignored if same table)
 *   colorColumnSlug         — Column slug in source table containing raw color text
 *   targetColorColumnSlug   — Column slug in CURRENT table to write to (default: __colors__)
 *   matchTargetSlug         — Column slug in current table to match on (default: __n_ordre__)
 *
 * Returns on success:
 *   { updated: number } — count of rows whose target column was updated
 *
 * Returns on unknown colors (422):
 *   { error: "Couleurs non reconnues", unknown: string[], count: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      sourceTableId,
      matchColumnSlug,
      colorColumnSlug,
      targetColorColumnSlug = '__colors__',
      matchTargetSlug = '__n_ordre__',
    } = body;

    if (!sourceTableId || !colorColumnSlug) {
      return NextResponse.json(
        { error: 'sourceTableId and colorColumnSlug are required' },
        { status: 400 }
      );
    }

    // ━━━ Step 1: Load ColorMap ━━━
    // Fetch ALL entries (no filters) — we need every slug for resolution
    const colorMapEntries = await db.colorMap.findMany();
    const resolutionMap = new Map<string, { name: string; hex: string }>();
    for (const entry of colorMapEntries) {
      const slug = generateColorSlug(entry.name);
      resolutionMap.set(slug, { name: entry.name, hex: entry.hex });
    }

    // ━━━ Step 2: Fetch current rows ━━━
    const currentRows = await db.row.findMany({
      where: { dataSourceId: id },
      select: { id: true, data: true },
    });

    // Track unknown color names across all rows (for fail-fast)
    const unknownNames = new Set<string>();
    // Store per-row results: only committed to DB if no unknowns
    const rowResults: Array<{ rowId: string; data: Record<string, unknown>; canonicalNames: string }> = [];

    if (sourceTableId === id) {
      // ━━━ SAME TABLE: read color column from same rows ━━━
      for (const row of currentRows) {
        const data = row.data as Record<string, unknown>;
        const rawValue = data[colorColumnSlug];

        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
          continue;
        }

        const { canonicalNames, unknowns } = resolveColors(String(rawValue), resolutionMap);
        for (const u of unknowns) unknownNames.add(u);

        if (canonicalNames.length > 0) {
          rowResults.push({ rowId: row.id, data, canonicalNames: canonicalNames.join(', ') });
        }
      }
    } else {
      // ━━━ DIFFERENT TABLE: lookup join ━━━
      if (!matchColumnSlug) {
        return NextResponse.json(
          { error: 'matchColumnSlug is required when importing from a different table' },
          { status: 400 }
        );
      }

      // Fetch all rows from the source table
      const sourceRows = await db.row.findMany({
        where: { dataSourceId: sourceTableId },
        select: { data: true },
      });

      // Build a lookup map: matchValue → rawColorText
      const lookupMap = new Map<string, string>();
      for (const sourceRow of sourceRows) {
        const srcData = sourceRow.data as Record<string, unknown>;
        const matchValue = String(srcData[matchColumnSlug] ?? '');
        const colorValue = srcData[colorColumnSlug];
        if (matchValue && colorValue !== undefined && colorValue !== null && String(colorValue).trim() !== '') {
          lookupMap.set(matchValue, String(colorValue));
        }
      }

      // For each current row, look up and resolve colors
      for (const row of currentRows) {
        const data = row.data as Record<string, unknown>;
        const matchValue = String(data[matchTargetSlug] ?? '');

        if (!matchValue || !lookupMap.has(matchValue)) {
          continue;
        }

        const rawColorText = lookupMap.get(matchValue)!;
        const { canonicalNames, unknowns } = resolveColors(rawColorText, resolutionMap);
        for (const u of unknowns) unknownNames.add(u);

        if (canonicalNames.length > 0) {
          rowResults.push({ rowId: row.id, data, canonicalNames: canonicalNames.join(', ') });
        }
      }
    }

    // ━━━ Step 5: Fail-fast on unknown colors ━━━
    if (unknownNames.size > 0) {
      return NextResponse.json(
        {
          error: 'Couleurs non reconnues',
          unknown: [...unknownNames],
          count: unknownNames.size,
        },
        { status: 422 }
      );
    }

    // ━━━ All colors recognized — write to DB ━━━
    let updated = 0;
    for (const result of rowResults) {
      const updatedData: Record<string, unknown> = {
        ...result.data,
        [targetColorColumnSlug]: result.canonicalNames,
      };
      await db.row.update({
        where: { id: result.rowId },
        data: { data: updatedData },
      });
      updated++;
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Color import error:', error);
    return NextResponse.json(
      { error: 'Failed to import color values' },
      { status: 500 }
    );
  }
}

/**
 * Parse a raw color value, normalize each name, and resolve against the ColorMap.
 *
 * Returns:
 *   - canonicalNames: array of ColorMap canonical names for recognized colors
 *   - unknowns: array of raw names that could NOT be resolved
 */
function resolveColors(
  rawValue: string,
  resolutionMap: Map<string, { name: string; hex: string }>
): { canonicalNames: string[]; unknowns: string[] } {
  const canonicalNames: string[] = [];
  const unknowns: string[] = [];

  // Step 4a: Parse into individual color names
  const parsedNames = parseColorList(rawValue);

  for (const rawName of parsedNames) {
    // Step 4b: Normalize (Title Case, trim, etc.)
    const normalizedName = normalizeColorName(rawName);

    // Step 4c: Generate slug for lookup
    const slug = generateColorSlug(normalizedName);

    // Step 4d: Look up slug in ColorMap resolution map
    const colorEntry = resolutionMap.get(slug);

    if (colorEntry) {
      // Step 4e: Found — use the ColorMap's canonical name
      canonicalNames.push(colorEntry.name);
    } else {
      // Step 4f: Not found — add to unknowns
      unknowns.push(normalizedName);
    }
  }

  return { canonicalNames, unknowns };
}
