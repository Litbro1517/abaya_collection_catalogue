import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const search = url.searchParams.get('search') || '';

    const where = search
      ? { dataSourceId: id, data: { contains: search } }
      : { dataSourceId: id };

    const [rows, total] = await Promise.all([
      db.row.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.row.count({ where }),
    ]);

    const parsed = rows.map(r => ({ ...r, data: JSON.parse(r.data as string) }));

    return NextResponse.json({
      data: parsed,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      error: null,
    });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch rows' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const maxOrder = await db.row.findFirst({
      where: { dataSourceId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const row = await db.row.create({
      data: {
        dataSourceId: id,
        data: JSON.stringify(body.data || {}),
        order: body.order ?? (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json({ data: { ...row, data: JSON.parse(row.data as string) }, error: null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to create row' }, { status: 500 });
  }
}
