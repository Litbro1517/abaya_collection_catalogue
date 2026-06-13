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
    // V1 FREEZE: Disable relation creation for launch
    return NextResponse.json(
      { data: null, error: 'Les relations sont désactivées en V1. Disponible en V2.' },
      { status: 403 }
    );
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to create relation' }, { status: 500 });
  }
}
