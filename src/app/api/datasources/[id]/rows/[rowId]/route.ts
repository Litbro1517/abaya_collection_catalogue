import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  try {
    const { rowId } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.data !== undefined) updateData.data = JSON.stringify(body.data);
    if (body.order !== undefined) updateData.order = body.order;

    const row = await db.row.update({
      where: { id: rowId },
      data: updateData,
    });

    return NextResponse.json({ data: { ...row, data: JSON.parse(row.data as string) }, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to update row' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  try {
    const { rowId } = await params;
    await db.row.delete({ where: { id: rowId } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to delete row' }, { status: 500 });
  }
}
