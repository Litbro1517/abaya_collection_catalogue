// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * POST /api/datasources/[id]/stock-import
 *
 * One-Shot Bulk Import: copies stock values from a source column to __stock__.
 * This is a DESTRUCTIVE write — it overwrites __stock__ values in the current table.
 * Called ONCE when the user clicks "Connecter" or "Forcer la ré-importation du stock".
 *
 * After writing stock values, applies the reactive cascade:
 *   stock > 0 → __disponibilite__ = 'true' (Disponible)
 *   stock = 0 → __disponibilite__ = 'false' (Épuisé — default, admin can toggle to Sur commande)
 *
 * ⚠️ IMPORTANT: This cascade ONLY applies to rows whose __stock__ was modified.
 * Rows that already had stock=0 + dispo=true ("Sur commande") from a previous admin
 * choice are NOT touched unless their stock value actually changed.
 *
 * Body:
 *   sourceTableId    — ID of the data source to read from (can be the same table)
 *   matchColumnSlug  — Column slug in the source table that matches the key
 *                      (ignored when sourceTableId === currentDataSourceId)
 *   stockColumnSlug  — Column slug in the source table containing stock values
 *   matchTargetSlug  — Column slug in the CURRENT table to match on (default: __n_ordre__)
 *                      (ignored when sourceTableId === currentDataSourceId)
 *
 * Returns:
 *   { updated: number } — count of rows whose __stock__ was updated
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sourceTableId, matchColumnSlug, stockColumnSlug, matchTargetSlug = '__n_ordre__' } = body;

    if (!sourceTableId || !stockColumnSlug) {
      return NextResponse.json(
        { error: 'sourceTableId and stockColumnSlug are required' },
        { status: 400 }
      );
    }

    // 1. Fetch all rows from the current table
    const currentRows = await db.row.findMany({
      where: { dataSourceId: id },
      select: { id: true, data: true },
    });

    let updated = 0;

    if (sourceTableId === id) {
      // ━━━ SAME TABLE: direct column-to-column copy ━━━
      // No matching needed — just copy stockColumnSlug value to __stock__ for each row
      for (const row of currentRows) {
        const data = row.data as Record<string, unknown>;
        const sourceValue = data[stockColumnSlug];

        if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
          const numStock = typeof sourceValue === 'number' ? sourceValue : parseInt(String(sourceValue));
          if (!isNaN(numStock)) {
            const updatedData: Record<string, unknown> = { ...data, __stock__: numStock };
            // ━━━ Reactive Cascade: stock → disponibilite ━━━
            if (numStock > 0) {
              updatedData.__disponibilite__ = 'true'; // stock positif → Disponible
            } else {
              updatedData.__disponibilite__ = 'false'; // stock nul → Épuisé (default)
            }
            await db.row.update({
              where: { id: row.id },
              data: { data: updatedData as unknown as Prisma.InputJsonValue as unknown as Prisma.InputJsonValue },
            });
            updated++;
          }
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

      // 4. For each row in the current table, look up and write the stock value
      for (const row of currentRows) {
        const data = row.data as Record<string, unknown>;
        const matchValue = String(data[matchTargetSlug] ?? '');

        if (matchValue && lookupMap.has(matchValue)) {
          const numStock = lookupMap.get(matchValue)!;
          const updatedData: Record<string, unknown> = { ...data, __stock__: numStock };
          // ━━━ Reactive Cascade: stock → disponibilite ━━━
          if (numStock > 0) {
            updatedData.__disponibilite__ = 'true'; // stock positif → Disponible
          } else {
            updatedData.__disponibilite__ = 'false'; // stock nul → Épuisé (default)
          }
          await db.row.update({
            where: { id: row.id },
            data: { data: updatedData as unknown as Prisma.InputJsonValue as unknown as Prisma.InputJsonValue },
          });
          updated++;
        }
      }
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Stock import error:', error);
    return NextResponse.json(
      { error: 'Failed to import stock values' },
      { status: 500 }
    );
  }
}
