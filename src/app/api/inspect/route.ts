import { NextResponse } from 'next/server';

/**
 * PRODUCTION INSPECTION ROUTE — Temporary diagnostic
 * Probes the PostgreSQL database directly to diagnose RELATION display issues.
 * This route MUST be deleted after diagnosis.
 */
export async function GET() {
  try {
    // Dynamic import so Prisma resolves with the correct provider at build time
    const { db } = await import('@/lib/db');

    // ═══ 1. Extract all RELATION columns with their full config ═══
    const allColumns = await db.column.findMany({
      orderBy: [{ dataSourceId: 'asc' }, { order: 'asc' }],
    });

    const relationColumns = allColumns.filter(c => c.type === 'RELATION');

    // ═══ 2. For each RELATION column, find the target table columns ═══
    const relationInspections = [];

    for (const relCol of relationColumns) {
      const config = (relCol.config as Record<string, unknown>) || {};
      const targetTableId = (config.targetTableId as string) || (config.targetTable as string) || '';
      const explicitPivotSlug = (config.targetColumnId as string) || '';

      // Get the target table's columns
      let targetColumns: typeof allColumns = [];
      if (targetTableId && targetTableId !== 'self') {
        targetColumns = allColumns.filter(c => c.dataSourceId === targetTableId);
      } else if (targetTableId === 'self') {
        targetColumns = allColumns.filter(c => c.dataSourceId === relCol.dataSourceId);
      }

      // Simulate the effectivePivotSlug logic from DataTable.tsx
      const effectivePivotSlug = explicitPivotSlug
        || (targetColumns.find(c => c.type === 'TEXT' && c.visible && !c.slug.startsWith('__'))?.slug || '');

      relationInspections.push({
        relationColumn: {
          id: relCol.id,
          name: relCol.name,
          slug: relCol.slug,
          dataSourceId: relCol.dataSourceId,
          config: config,
        },
        targetTableId: targetTableId || '(empty — no target set)',
        targetColumnsCount: targetColumns.length,
        targetColumns: targetColumns.map(c => ({
          slug: c.slug,
          name: c.name,
          type: c.type,
          visible: c.visible,
          order: c.order,
        })),
        effectivePivotSlug: effectivePivotSlug || '(NONE — no TEXT column found!)',
        pivotSource: explicitPivotSlug ? 'explicit (targetColumnId from config)' : effectivePivotSlug ? 'auto-fallback (first visible TEXT column)' : '⚠️ NO PIVOT AVAILABLE',
      });
    }

    // ═══ 3. Extract all DataSources ═══
    const dataSources = await db.dataSource.findMany({
      select: { id: true, name: true, slug: true },
    });

    // ═══ 4. Extract sample Row.data from the main datasource ═══
    const mainDs = dataSources[0];
    let sampleRow = null;
    let sampleRows = null;
    let targetSampleRows = null;

    if (mainDs) {
      sampleRows = await db.row.findMany({
        where: { dataSourceId: mainDs.id },
        take: 3,
        orderBy: { order: 'asc' },
      });
      sampleRow = sampleRows[0] ? {
        id: sampleRows[0].id,
        dataSourceId: sampleRows[0].dataSourceId,
        data: sampleRows[0].data,
      } : null;

      // If there's a RELATION column pointing to another table, get sample rows from that target
      if (relationColumns.length > 0) {
        const firstRel = relationColumns[0];
        const relConfig = (firstRel.config as Record<string, unknown>) || {};
        const targetId = (relConfig.targetTableId as string) || (relConfig.targetTable as string) || '';

        if (targetId && targetId !== 'self') {
          targetSampleRows = await db.row.findMany({
            where: { dataSourceId: targetId },
            take: 3,
            orderBy: { order: 'asc' },
          });
        }
      }
    }

    // ═══ 5. Simulate relationLookupMap for the first RELATION column ═══
    let lookupSimulation = null;
    if (relationColumns.length > 0) {
      const relCol = relationColumns[0];
      const config = (relCol.config as Record<string, unknown>) || {};
      const targetDsId = (config.targetTableId as string) || (config.targetTable as string) || '';
      const explicitPivotSlug = (config.targetColumnId as string) || '';

      const targetCols = allColumns.filter(c => c.dataSourceId === targetDsId);
      const effectivePivotSlug = explicitPivotSlug
        || (targetCols.find(c => c.type === 'TEXT' && c.visible && !c.slug.startsWith('__'))?.slug || '');

      if (targetDsId && effectivePivotSlug) {
        const targetRows = await db.row.findMany({
          where: { dataSourceId: targetDsId },
          take: 10,
        });

        const lookup: Record<string, string> = {};
        for (const tRow of targetRows) {
          const tData = (tRow.data as Record<string, unknown>) || {};
          const pivotKey = effectivePivotSlug
            ? String(tData[effectivePivotSlug] ?? '')
            : tRow.id;
          if (!pivotKey) continue;
          // findBestLabel: first visible TEXT column
          const labelCol = targetCols.find(c => c.type === 'TEXT' && c.visible && !c.slug.startsWith('__'));
          const label = labelCol ? String(tData[labelCol.slug] ?? '') : pivotKey;
          if (label) lookup[pivotKey] = label;
        }

        // Now check: what values are in the source cells?
        const sourceRows = await db.row.findMany({
          where: { dataSourceId: relCol.dataSourceId },
          take: 5,
        });

        const cellValues = sourceRows.map(sRow => {
          const sData = (sRow.data as Record<string, unknown>) || {};
          return {
            rawValue: sData[relCol.slug],
            resolved: lookup[String(sData[relCol.slug] ?? '')] || '❌ NOT FOUND',
          };
        });

        lookupSimulation = {
          effectivePivotSlug,
          lookupMapPreview: Object.fromEntries(Object.entries(lookup).slice(0, 10)),
          sourceCellValues: cellValues,
          matchCount: cellValues.filter(cv => cv.resolved !== '❌ NOT FOUND').length,
          totalChecked: cellValues.length,
        };
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      databaseProvider: process.env.DATABASE_URL?.startsWith('postgresql') ? 'PostgreSQL' : 'SQLite',
      dataSources: dataSources,
      relationColumns: relationInspections,
      sampleRowFromMainDs: sampleRow,
      targetSampleRows: targetSampleRows?.map(r => ({ id: r.id, data: r.data })),
      lookupSimulation,
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 30) + '...',
    }, { status: 500 });
  }
}
