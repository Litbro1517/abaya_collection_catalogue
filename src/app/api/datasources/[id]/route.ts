import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'full'; // 'full' or 'meta'

    if (mode === 'meta') {
      // Lightweight: return only datasource metadata + column definitions (no rows)
      const ds = await db.dataSource.findUnique({
        where: { id },
        include: {
          columns: { orderBy: { order: 'asc' } },
          relations: {
            include: {
              sourceTable: { select: { id: true, name: true } },
              targetTable: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!ds) {
        return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
      }

      // SQLite returns JSON fields as strings — parse them for client compatibility
      const result = {
        ...ds,
        columns: ds.columns.map(col => ({
          ...col,
          config: typeof col.config === 'string' ? JSON.parse(col.config) : col.config,
        })),
        rows: [], // No rows in meta mode
      };

      return NextResponse.json({ data: result, error: null });
    }

    // Full mode: return columns + paginated rows
    // ━━ MANDAT 4P-rectification (audit 360, point 3) : garde-fou NaN ━━
    // Même défaut que rows/route.ts : parseInt NaN non filtré → skip/take
    // NaN → PrismaClientValidationError → 500. Garde Number.isFinite +
    // fallbacks (page=1, limit=20) ; valeurs absentes inchangées.
    const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawLimit = parseInt(url.searchParams.get('limit') || '1000', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(1000, Math.max(1, rawLimit)) : 20;

    const [ds, rowCount] = await Promise.all([
      db.dataSource.findUnique({
        where: { id },
        include: {
          columns: { orderBy: { order: 'asc' } },
          rows: {
            orderBy: { order: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          },
          relations: {
            include: {
              sourceTable: { select: { id: true, name: true } },
              targetTable: { select: { id: true, name: true } },
            },
          },
        },
      }),
      db.row.count({ where: { dataSourceId: id } }),
    ]);

    if (!ds) {
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    // SQLite returns JSON fields as strings — parse them for client compatibility
    const result = {
      ...ds,
      columns: ds.columns.map(col => ({
        ...col,
        config: typeof col.config === 'string' ? JSON.parse(col.config) : col.config,
      })),
      rows: ds.rows.map(row => ({
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      })),
      totalRows: rowCount,
      page,
      totalPages: Math.ceil(rowCount / limit),
    };

    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ds = await db.dataSource.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        icon: body.icon,
        color: body.color,
        sourceUrl: body.sourceUrl,
        sourceType: body.sourceType,
        sheetId: body.sheetId,
        sheetName: body.sheetName,
        syncInterval: body.syncInterval,
        lastSyncedAt: body.lastSyncedAt ? new Date(body.lastSyncedAt) : undefined,
      },
    });
    return NextResponse.json({ data: ds, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.dataSource.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to delete' }, { status: 500 });
  }
}
