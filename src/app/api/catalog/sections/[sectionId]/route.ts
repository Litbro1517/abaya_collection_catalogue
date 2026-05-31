import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  try {
    const { sectionId } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.visible !== undefined) updateData.visible = body.visible;

    const section = await db.section.update({
      where: { id: sectionId },
      data: updateData,
    });

    // Json field (config) is returned as native object by Prisma with PostgreSQL
    return NextResponse.json({ data: section, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to update section' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  try {
    const { sectionId } = await params;
    await db.section.delete({ where: { id: sectionId } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to delete section' }, { status: 500 });
  }
}
