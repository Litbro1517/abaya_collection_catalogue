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

      // Json fields are returned as native objects by Prisma with PostgreSQL
      const result = {
        ...ds,
        rows: [], // No rows in meta mode
      };

      return NextResponse.json({ data: result, error: null });
    }

    // Full mode: return columns + paginated rows
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

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

    // Json fields are returned as native objects by Prisma with PostgreSQL
    const result = {
      ...ds,
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
