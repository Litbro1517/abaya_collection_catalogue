import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/datasources/fix-stock-dispo
 *
 * ━━━ RETROACTIVE FIX: Cascade Stock → Disponibilité ━━━
 * Scans all rows across all DataSources (or a specific one) and fixes
 * the mismatch where stock > 0 but __disponibilite__ is still 'false'.
 *
 * Rules applied:
 * - stock > 0 + __disponibilite__ = 'false' → set to 'true' (Disponible)
 * - stock = 0 + __disponibilite__ = 'true' → set to 'false' (Épuisé)
 *   ⚠️ EXCEPTION: stock=0 + __disponibilite__='true' is a valid "Sur commande"
 *   state — we do NOT overwrite this (it's a manual override).
 *
 * So we ONLY fix: stock > 0 + __disponibilite__ = 'false' → 'true'
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { dataSourceId } = body;

    // Load rows — either for a specific DataSource or all
    const where = dataSourceId ? { dataSourceId } : {};
    const rows = await db.row.findMany({ where });

    console.log(`🔧 RETROACTIVE FIX: Scanning ${rows.length} rows for stock/disponibilité mismatch${dataSourceId ? ` (DataSource: ${dataSourceId})` : ' (ALL)'}`);

    let fixedCount = 0;
    let surCommandePreserved = 0;

    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      const stockVal = typeof data.__stock__ === 'number'
        ? data.__stock__
        : parseInt(String(data.__stock__ ?? '0')) || 0;

      const dispoVal = String(data.__disponibilite__ ?? 'false');

      // Only fix the anomaly: stock > 0 but Disponibilité = OFF (Épuisé)
      if (stockVal > 0 && dispoVal === 'false') {
        const updatedData = { ...data, __disponibilite__: 'true' };
        await db.row.update({
          where: { id: row.id },
          data: { data: updatedData },
        });
        fixedCount++;
      }

      // DO NOT touch stock=0 + dispo='true' — that's Sur Commande (manual override)
      if (stockVal === 0 && dispoVal === 'true') {
        surCommandePreserved++;
      }
    }

    console.log(`✅ RETROACTIVE FIX COMPLETE: ${fixedCount} row(s) fixed (stock>0 → Disponible), ${surCommandePreserved} Sur commande preserved`);

    return NextResponse.json({
      data: {
        totalRows: rows.length,
        fixedCount,
        surCommandePreserved,
      },
      error: null,
    });
  } catch (error) {
    console.error('❌ RETROACTIVE FIX error:', error);
    return NextResponse.json(
      { data: null, error: 'Failed to fix stock/disponibilité mismatch' },
      { status: 500 }
    );
  }
}
