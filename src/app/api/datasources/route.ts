import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const dataSources = await db.dataSource.findMany({
      include: {
        _count: { select: { columns: true, rows: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = dataSources.map(ds => ({
      id: ds.id,
      name: ds.name,
      slug: ds.slug,
      description: ds.description,
      icon: ds.icon,
      color: ds.color,
      sourceType: ds.sourceType,
      sourceUrl: ds.sourceUrl,
      columnCount: ds._count.columns,
      rowCount: ds._count.rows,
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt,
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch data sources' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, sourceType, sourceUrl, icon, color } = body;

    if (!name) {
      return NextResponse.json({ data: null, error: 'Name is required' }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);

    const ds = await db.dataSource.create({
      data: {
        name,
        slug,
        description: description || null,
        sourceType: sourceType || 'manual',
        sourceUrl: sourceUrl || null,
        icon: icon || 'Table',
        color: color || '#C9A84C',
      },
    });

    return NextResponse.json({ data: ds, error: null }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Slug already exists' : 'Failed to create data source';
    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
