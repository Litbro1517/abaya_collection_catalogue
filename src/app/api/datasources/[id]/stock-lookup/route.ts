import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/datasources/[id]/stock-lookup
 * 
 * Resolves stock values from a connected external table.
 * 
 * Body:
 *   sourceTableId    — ID of the data source to look up
 *   matchColumnSlug  — Column slug in the source table that matches the key
 *   stockColumnSlug  — Column slug in the source table containing stock values
 *   matchTargetSlug  — Column slug in the CURRENT table to match on (default: __n_ordre__)
 * 
 * Returns:
 *   { data: { [rowId]: stockValue } }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sourceTableId, matchColumnSlug, stockColumnSlug, matchTargetSlug = '__n_ordre__' } = body;

    if (!sourceTableId || !matchColumnSlug || !stockColumnSlug) {
      return NextResponse.json(
        { error: 'sourceTableId, matchColumnSlug, and stockColumnSlug are required' },
        { status: 400 }
      );
    }

    // 1. Fetch all rows from the current table (to get the match key for each row)
    const currentRows = await db.row.findMany({
      where: { dataSourceId: id },
      select: { id: true, data: true },
    });

    // 2. Fetch all rows from the source table
    const sourceRows = await db.row.findMany({
      where: { dataSourceId: sourceTableId },
      select: { data: true },
    });

    // 3. Build a lookup map: matchValue → stockValue from the source table
    const lookupMap = new Map<string, number>();
    for (const sourceRow of sourceRows) {
      const srcData = sourceRow.data as Record<string, unknown>;
      const matchValue = String(srcData[matchColumnSlug] ?? '');
      const stockValue = srcData[stockColumnSlug];
      if (matchValue && stockValue !== undefined && stockValue !== null) {
        const numStock = typeof stockValue === 'number' ? stockValue : parseInt(String(stockValue));
        if (!isNaN(numStock)) {
          lookupMap.set(matchValue, numStock);
        }
      }
    }

    // 4. For each row in the current table, look up the stock value
    const result: Record<string, number> = {};
    for (const row of currentRows) {
      const data = row.data as Record<string, unknown>;
      const matchValue = String(data[matchTargetSlug] ?? '');
      if (matchValue && lookupMap.has(matchValue)) {
        result[row.id] = lookupMap.get(matchValue)!;
      }
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Stock lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve stock values' },
      { status: 500 }
    );
  }
}
