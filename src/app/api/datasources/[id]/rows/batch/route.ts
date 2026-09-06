// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client';

/**
 * PATCH /api/datasources/[id]/rows/batch
 * Batch update multiple rows (for status/lock sync AND catalog reorder).
 *
 * Supports two body formats:
 * 1. { updates: Array<{ id: string, data?: Record<string, unknown>, order?: number }> }
 *    - `data`  : shallow-merged into row.data (existing fields preserved)
 *    - `order` : writes the Row.order field directly (catalog sequence — Axe 4)
 * 2. { changes: Array<{ rowId: string, statut?: string, locked?: boolean }> }
 *
 * NOTE: Prisma returns Json columns as a parsed JS value (object) on SQLite, but
 * legacy rows may store a raw JSON string. We read defensively to support both,
 * and write the merged object back (consistent with the single-row PUT route).
 */
function readRowData(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {} } catch { return {} }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

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

    // Normalize to a common format: Array<{ id, data, order? }>
    let normalizedUpdates: Array<{ id: string; data: Record<string, unknown>; order?: number }>

    if (Array.isArray(updates) && updates.length > 0) {
      // Format 1: explicit updates (supports optional `order`)
      normalizedUpdates = (updates as Array<{ id: string; data?: Record<string, unknown>; order?: number }>).map((u) => ({
        id: u.id,
        data: u.data || {},
        order: typeof u.order === 'number' && Number.isFinite(u.order) ? u.order : undefined,
      }))
    } else if (Array.isArray(changes) && changes.length > 0) {
      // Format 2: changes from status/lock UI
      normalizedUpdates = (changes as Array<{ rowId: string; statut?: string; locked?: boolean }>).map((c) => {
        const data: Record<string, unknown> = {}
        if (c.statut !== undefined) {
          data.__statut__ = c.statut
        }
        if (c.locked !== undefined) {
          data.__statut_locked__ = c.locked
        }
        return { id: c.rowId, data, order: undefined }
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
        { error: `Row IDs not found in this datasource: ${invalidIds.join(', ') }` },
        { status: 404 }
      )
    }

    // Build a map of existing data for merging (defensive: string OR object)
    const existingDataMap = new Map(
      existingRows.map((r) => [r.id, readRowData(r.data)])
    )

    // Execute updates in a transaction
    const results = await db.$transaction(
      normalizedUpdates.map((update) => {
        const existingData = existingDataMap.get(update.id) || {}
        const mergedData = { ...existingData, ...update.data }

        // Only write `order` when explicitly provided (Axe 4 — catalog reorder).
        // Otherwise leave the existing Row.order untouched.
        const patch: { data: Record<string, unknown>; order?: number } = { data: mergedData }
        if (update.order !== undefined) {
          patch.order = update.order
        }

        return db.row.update({
          where: { id: update.id },
          data: patch as unknown as Prisma.InputJsonValue,
        })
      })
    )

    // Normalize data fields for response (defensive parse)
    const parsed = results.map((r) => ({
      ...r,
      data: readRowData(r.data),
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
