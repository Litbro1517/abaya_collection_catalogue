import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ─── Helpers ────────────────────────────────────────────────────────────────────

type RowData = Record<string, unknown> & {
  __statut__?: string;
  __statut_locked__?: boolean;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function computeStatut(
  row: { id: string; data: RowData; createdAt: Date },
  topFiveIds: Set<string>,
): { statut: 'Nouveau' | 'Courant'; locked: boolean } {
  const locked = row.data.__statut_locked__ === true;

  // If locked, respect the existing stored status
  if (locked) {
    return {
      statut: (row.data.__statut__ as 'Nouveau' | 'Courant') || 'Courant',
      locked: true,
    };
  }

  // Auto-transition rules:
  // 'Nouveau' if createdAt < 30 days ago AND row is in the top 5 newest
  const isRecent = Date.now() - row.createdAt.getTime() < THIRTY_DAYS_MS;
  const isInTopFive = topFiveIds.has(row.id);

  if (isRecent && isInTopFive) {
    return { statut: 'Nouveau', locked: false };
  }

  return { statut: 'Courant', locked: false };
}

// ─── GET /api/datasources/[id]/status ───────────────────────────────────────────
// Compute and return current status for all rows (no DB writes)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Verify data source exists
    const ds = await db.dataSource.findUnique({ where: { id } });
    if (!ds) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    // Fetch all rows ordered by createdAt DESC (newest first)
    const rows = await db.row.findMany({
      where: { dataSourceId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true, createdAt: true },
    });

    // Build set of top 5 newest row IDs
    const topFiveIds = new Set(rows.slice(0, 5).map((r) => r.id));

    const result = rows.map((row) => {
      const { statut, locked } = computeStatut(row, topFiveIds);
      return {
        rowId: row.id,
        statut,
        locked,
        createdAt: row.createdAt,
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    console.error('Status GET error:', e);
    return NextResponse.json({ error: 'Failed to compute statuses' }, { status: 500 });
  }
}

// ─── POST /api/datasources/[id]/status ──────────────────────────────────────────
// Auto-sync all row statuses based on rules (writes to DB)

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Verify data source exists
    const ds = await db.dataSource.findUnique({ where: { id } });
    if (!ds) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    // Ensure __statut__ column exists
    await db.column.upsert({
      where: { dataSourceId_slug: { dataSourceId: id, slug: '__statut__' } },
      update: {},
      create: {
        name: 'Statut',
        slug: '__statut__',
        type: 'STATUS',
        dataSourceId: id,
        visible: true,
        required: false,
        config: { options: ['Nouveau', 'Courant'] },
        order: -1,
      },
    });

    // Fetch all rows ordered by createdAt DESC (newest first)
    const rows = await db.row.findMany({
      where: { dataSourceId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true, createdAt: true },
    });

    // Build set of top 5 newest row IDs
    const topFiveIds = new Set(rows.slice(0, 5).map((r) => r.id));

    let updatesCount = 0;

    for (const row of rows) {
      const { statut, locked } = computeStatut(row, topFiveIds);

      // Skip locked rows — they keep their manual status
      if (locked) continue;

      const currentStatut = (row.data as RowData).__statut__;

      // Only update if the computed status differs from the stored one
      if (currentStatut !== statut) {
        const updatedData = { ...(row.data as RowData), __statut__: statut };
        await db.row.update({
          where: { id: row.id },
          data: { data: updatedData },
        });
        updatesCount++;
      }
    }

    return NextResponse.json({ data: { updatesCount }, error: null });
  } catch (e) {
    console.error('Status POST error:', e);
    return NextResponse.json({ error: 'Failed to sync statuses' }, { status: 500 });
  }
}

// ─── PUT /api/datasources/[id]/status ───────────────────────────────────────────
// Manually set status for a specific row (with lock)

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { rowId, statut, locked } = body as { rowId?: string; statut?: string; locked?: boolean };

    if (!rowId || !statut) {
      return NextResponse.json(
        { error: 'rowId and statut are required' },
        { status: 400 },
      );
    }

    if (statut !== 'Nouveau' && statut !== 'Courant') {
      return NextResponse.json(
        { error: "statut must be 'Nouveau' or 'Courant'" },
        { status: 400 },
      );
    }

    // Verify the row belongs to this data source
    const row = await db.row.findFirst({
      where: { id: rowId, dataSourceId: id },
    });

    if (!row) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    }

    // Set __statut__ and __statut_locked__ in the row's data
    const currentData = (row.data as RowData) || {};
    const updatedData: RowData = {
      ...currentData,
      __statut__: statut,
      __statut_locked__: locked !== undefined ? locked : true,
    };

    const updated = await db.row.update({
      where: { id: rowId },
      data: { data: updatedData },
    });

    return NextResponse.json({
      data: {
        rowId: updated.id,
        statut: updatedData.__statut__,
        locked: updatedData.__statut_locked__,
      },
      error: null,
    });
  } catch (e) {
    console.error('Status PUT error:', e);
    return NextResponse.json({ error: 'Failed to set status' }, { status: 500 });
  }
}
