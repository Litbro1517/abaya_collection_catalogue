import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await db.dataSource.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { order: 'asc' } },
        rows: { orderBy: { order: 'asc' } },
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

    const result = {
      ...ds,
      rows: ds.rows.map(r => ({ ...r, data: JSON.parse(r.data as string) })),
      columns: ds.columns.map(c => ({ ...c, config: JSON.parse(c.config as string) })),
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
