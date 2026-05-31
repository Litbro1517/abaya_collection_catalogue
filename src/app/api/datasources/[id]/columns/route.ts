import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const columns = await db.column.findMany({
      where: { dataSourceId: id },
      orderBy: { order: 'asc' },
    });
    // Json fields are returned as native objects by Prisma with PostgreSQL
    return NextResponse.json({ data: columns, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch columns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, config, visible, required } = body;

    if (!name) {
      return NextResponse.json({ data: null, error: 'Name is required' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 60);

    const maxOrder = await db.column.findFirst({
      where: { dataSourceId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const col = await db.column.create({
      data: {
        name,
        slug,
        type: type || 'TEXT',
        dataSourceId: id,
        order: (maxOrder?.order ?? -1) + 1,
        visible: visible !== false,
        required: required === true,
        config: config || {},
      },
    });

    return NextResponse.json({ data: col, error: null }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Column slug already exists' : 'Failed to create column';
    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
