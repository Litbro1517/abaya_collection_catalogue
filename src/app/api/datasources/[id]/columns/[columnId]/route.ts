import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; columnId: string }> }) {
  try {
    const { columnId } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.visible !== undefined) updateData.visible = body.visible;
    if (body.required !== undefined) updateData.required = body.required;
    if (body.order !== undefined) updateData.order = body.order;
    if (body.width !== undefined) updateData.width = body.width;
    if (body.config !== undefined) updateData.config = body.config;

    // Only update slug if explicitly requested via updateSlug flag
    // Renaming a column must NOT change the slug, as the slug is the key in row data
    // Changing the slug would orphan all existing row data
    if (body.updateSlug && body.name) {
      updateData.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 60);
    }

    const col = await db.column.update({
      where: { id: columnId },
      data: updateData,
    });

    return NextResponse.json({ data: col, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to update column' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; columnId: string }> }) {
  try {
    const { columnId } = await params;
    await db.column.delete({ where: { id: columnId } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to delete column' }, { status: 500 });
  }
}
