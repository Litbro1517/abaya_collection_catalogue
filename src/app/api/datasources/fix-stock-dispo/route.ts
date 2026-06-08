import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/datasources/fix-stock-dispo
 * GET  /api/datasources/fix-stock-dispo
 *
 * ━━━ RETROACTIVE FIX: Cascade Stock → Disponibilité ━━━
 * Scans all rows across all DataSources (or a specific one) and fixes
 * ONLY true anomalies in stock/disponibilité states.
 *
 * Only rule applied:
 * - stock > 0 + __disponibilite__ = 'false' → set to 'true' (Disponible)
 *
 * ⚠️ IMPORTANT: stock = 0 + __disponibilite__ = 'true' ("Sur commande") is a
 * LEGITIMATE admin choice and is NEVER modified by this endpoint.
 * The previous version incorrectly treated "Sur commande" as an import bug
 * and forcibly reverted it to "Épuisé". This has been removed.
 *
 * GET endpoint allows triggering without authentication (one-time migration fix).
 */
export async function GET(req: NextRequest) {
  return fixStockDispo(req);
}

export async function POST(req: NextRequest) {
  return fixStockDispo(req);
}

async function fixStockDispo(req: NextRequest) {
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const dataSourceId = body.dataSourceId || url.searchParams.get('dataSourceId') || undefined;

    // Load rows — either for a specific DataSource or all
    const where = dataSourceId ? { dataSourceId } : {};
    const rows = await db.row.findMany({ where });

    console.log(`🔧 RETROACTIVE FIX: Scanning ${rows.length} rows for stock>0 + Épuisé anomaly${dataSourceId ? ` (DataSource: ${dataSourceId})` : ' (ALL)'}`);

    let fixedToDisponible = 0;
    let surCommandePreserved = 0;

    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      const stockVal = typeof data.__stock__ === 'number'
        ? data.__stock__
        : parseInt(String(data.__stock__ ?? '0')) || 0;

      const dispoVal = String(data.__disponibilite__ ?? 'false');

      // Only fix: stock > 0 but Disponibilité = OFF (Épuisé) → Disponible
      if (stockVal > 0 && dispoVal === 'false') {
        const updatedData = { ...data, __disponibilite__: 'true' };
        await db.row.update({
          where: { id: row.id },
          data: { data: updatedData },
        });
        fixedToDisponible++;
        continue;
      }

      // Count Sur commande states for reporting (but NEVER modify them)
      if (stockVal === 0 && dispoVal === 'true') {
        surCommandePreserved++;
      }
    }

    console.log(`✅ RETROACTIVE FIX COMPLETE: ${fixedToDisponible} stock>0→Disponible, ${surCommandePreserved} Sur commande preserved (admin choice — never auto-corrected)`);

    return NextResponse.json({
      data: {
        totalRows: rows.length,
        fixedToDisponible,
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
