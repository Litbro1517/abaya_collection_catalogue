import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PATCH /api/datasources/[id]/rows/batch
 * Batch update multiple rows (for status/lock sync)
 *
 * Supports two body formats:
 * 1. { updates: Array<{ id: string, data?: Record<string, unknown>, order?: number }> }
 * 2. { changes: Array<{ rowId: string, statut?: string, locked?: boolean }> }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const datasource = await db.dataSource.findUnique({ where: { id } })
    if (!datasource) {
      return NextResponse.json(
        { error: 'DataSource not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { updates, changes } = body

    // Normalize to a common format: Array<{ id, data }>
    let normalizedUpdates: Array<{ id: string; data: Record<string, unknown> }>

    if (Array.isArray(updates) && updates.length > 0) {
      // Format 1: explicit updates
      normalizedUpdates = updates.map((u: { id: string; data?: Record<string, unknown> }) => ({
        id: u.id,
        data: u.data || {},
      }))
    } else if (Array.isArray(changes) && changes.length > 0) {
      // Format 2: changes from status/lock UI
      normalizedUpdates = changes.map((c: { rowId: string; statut?: string; locked?: boolean }) => {
        const data: Record<string, unknown> = {}
        if (c.statut !== undefined) {
          data.__statut__ = c.statut
        }
        if (c.locked !== undefined) {
          data.__statut_locked__ = c.locked
        }
        return { id: c.rowId, data }
      })
    } else {
      return NextResponse.json(
        { error: 'updates or changes array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate all row IDs belong to this datasource
    const rowIds = normalizedUpdates.map((u) => u.id)
    const existingRows = await db.row.findMany({
      where: {
        id: { in: rowIds },
        dataSourceId: id,
      },
      select: { id: true, data: true },
    })

    const existingIds = new Set(existingRows.map((r) => r.id))
    const invalidIds = rowIds.filter((rid: string) => !existingIds.has(rid))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Row IDs not found in this datasource: ${invalidIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Build a map of existing data for merging
    const existingDataMap = new Map(
      existingRows.map((r) => [r.id, JSON.parse(r.data)])
    )

    // Execute updates in a transaction
    const results = await db.$transaction(
      normalizedUpdates.map((update) => {
        const existingData = existingDataMap.get(update.id) || {}
        const mergedData = { ...existingData, ...update.data }

        return db.row.update({
          where: { id: update.id },
          data: { data: JSON.stringify(mergedData) },
        })
      })
    )

    // Parse data fields for response
    const parsed = results.map((r) => ({
      ...r,
      data: JSON.parse(r.data),
    }))

    return NextResponse.json({ updated: parsed.length, rows: parsed })
  } catch (error) {
    console.error('Error batch updating rows:', error)
    return NextResponse.json(
      { error: 'Failed to batch update rows' },
      { status: 500 }
    )
  }
}
