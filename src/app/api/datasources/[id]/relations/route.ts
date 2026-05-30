import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const relations = await db.relation.findMany({
      where: { sourceTableId: id },
      include: {
        sourceTable: { select: { id: true, name: true } },
        targetTable: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ data: relations, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch relations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, sourceColumnId, targetTableId, type } = body;

    if (!name || !sourceColumnId || !targetTableId) {
      return NextResponse.json({ data: null, error: 'Missing required fields' }, { status: 400 });
    }

    const relation = await db.relation.create({
      data: {
        name,
        sourceTableId: id,
        sourceColumnId,
        targetTableId,
        type: type || 'manyToOne',
      },
      include: {
        sourceTable: { select: { id: true, name: true } },
        targetTable: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: relation, error: null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to create relation' }, { status: 500 });
  }
}
