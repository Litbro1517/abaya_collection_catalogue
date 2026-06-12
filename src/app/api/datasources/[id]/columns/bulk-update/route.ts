import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/datasources/[id]/columns/bulk-update
 * Batch-update multiple columns in a single request.
 * Body: { updates: Array<{ id: string; visible?: boolean; order?: number; ... }> }
 * All updates run inside a Prisma $transaction for atomicity.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dataSourceId } = await params;
    const body = await req.json();
    const { updates } = body as { updates: Array<Record<string, unknown>> };

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { data: null, error: 'updates must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate that every update has an id
    for (const u of updates) {
      if (!u.id || typeof u.id !== 'string') {
        return NextResponse.json(
          { data: null, error: 'Each update must have a string id' },
          { status: 400 }
        );
      }
    }

    // Run all updates inside a transaction
    const results = await db.$transaction(
      updates.map(u => {
        const { id, ...fields } = u;
        // Only allow known column fields
        const updateData: Record<string, unknown> = {};
        if (fields.visible !== undefined) updateData.visible = fields.visible;
        if (fields.order !== undefined) updateData.order = fields.order;
        if (fields.name !== undefined) updateData.name = fields.name;
        if (fields.type !== undefined) updateData.type = fields.type;
        if (fields.required !== undefined) updateData.required = fields.required;
        if (fields.width !== undefined) updateData.width = fields.width;
        if (fields.config !== undefined) updateData.config = fields.config;

        return db.column.update({
          where: { id: id as string, dataSourceId },
          data: updateData,
        });
      })
    );

    return NextResponse.json({ data: results, error: null });
  } catch (e) {
    console.error('Bulk update failed:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to bulk-update columns' },
      { status: 500 }
    );
  }
}
