import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/datasources/[id]/columns/bulk-delete
 *
 * VG33.4: Hard-deletes multiple IMAGE-type columns in a single operation.
 * Designed to clean up the ~70 individual "Image 1, Image 2, ..." columns
 * that remain in the DB after gallery migration (IMAGE_ARRAY).
 *
 * Safety constraints (enforced server-side):
 * 1. Only columns of type 'IMAGE' can be deleted (IMAGE_ARRAY galleries,
 *    native columns, TEXT/CURRENCY/etc. are never touched).
 * 2. The column must belong to the specified dataSourceId.
 * 3. The request body must contain an array of column IDs.
 *
 * Body: { columnIds: string[] }
 * Returns: { data: { deleted: number, skipped: number } }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: dataSourceId } = await params;
    const body = await req.json();
    const { columnIds } = body as { columnIds?: string[] };

    if (!columnIds || !Array.isArray(columnIds) || columnIds.length === 0) {
      return NextResponse.json(
        { error: 'columnIds[] array is required and must not be empty' },
        { status: 400 },
      );
    }

    // Verify the DataSource exists
    const ds = await db.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!ds) {
      return NextResponse.json({ error: 'DataSource not found' }, { status: 404 });
    }

    // Fetch the target columns — only IMAGE type columns belonging to this datasource
    const targetColumns = await db.column.findMany({
      where: {
        id: { in: columnIds },
        dataSourceId,
        type: 'IMAGE', // SAFETY: only IMAGE columns can be bulk-deleted
      },
      select: { id: true, slug: true, name: true, type: true },
    });

    if (targetColumns.length === 0) {
      return NextResponse.json(
        { error: 'No eligible IMAGE columns found to delete' },
        { status: 404 },
      );
    }

    // Count how many were skipped (non-IMAGE or not belonging to this datasource)
    const skippedCount = columnIds.length - targetColumns.length;

    // Hard-delete the eligible columns
    const result = await db.column.deleteMany({
      where: {
        id: { in: targetColumns.map((c) => c.id) },
        dataSourceId,
        type: 'IMAGE', // double safety: deleteMany also enforces IMAGE type
      },
    });

    return NextResponse.json({
      data: {
        deleted: result.count,
        skipped: skippedCount,
      },
      error: null,
    });
  } catch (error) {
    console.error('Bulk delete columns error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk delete columns' },
      { status: 500 },
    );
  }
}
