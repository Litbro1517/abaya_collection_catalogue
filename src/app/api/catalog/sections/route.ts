import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { catalogId, type, title, subtitle, config } = body;

    if (!catalogId) {
      const catalog = await db.catalog.findFirst();
      if (!catalog) return NextResponse.json({ data: null, error: 'No catalog' }, { status: 400 });
    }

    const catId = catalogId || (await db.catalog.findFirst())?.id;
    if (!catId) return NextResponse.json({ data: null, error: 'No catalog found' }, { status: 400 });

    const maxOrder = await db.section.findFirst({
      where: { catalogId: catId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const section = await db.section.create({
      data: {
        catalogId: catId,
        type: type || 'collection',
        title: title || null,
        subtitle: subtitle || null,
        config: JSON.stringify(config || {}),
        order: (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json({ data: { ...section, config: JSON.parse(section.config as string) }, error: null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to create section' }, { status: 500 });
  }
}
