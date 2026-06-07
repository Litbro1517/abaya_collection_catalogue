import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '1000')));

    // Note: JSON field search not supported with Prisma Json type in PostgreSQL.
    // Filtering by search is done post-fetch if needed.
    const where = { dataSourceId: id };

    const [rows, total] = await Promise.all([
      db.row.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.row.count({ where }),
    ]);

    // Json fields are returned as native objects by Prisma with PostgreSQL
    return NextResponse.json({
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / (limit || 1)),
      error: null,
    });
  } catch (e) {
    console.error('Rows GET error:', e);
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
        data: body.data || {},
        order: body.order ?? (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json({ data: row, error: null }, { status: 201 });
  } catch (e) {
    console.error('Row POST error:', e);
    return NextResponse.json({ data: null, error: 'Failed to create row' }, { status: 500 });
  }
}
