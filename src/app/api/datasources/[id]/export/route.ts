import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ds = await db.dataSource.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { order: 'asc' }, where: { visible: true } },
        rows: { orderBy: { order: 'asc' } },
      },
    });

    if (!ds) {
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    // Build CSV
    const headers = ds.columns.map(c => c.name);
    let csv = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

    for (const row of ds.rows) {
      // Json fields are returned as native objects by Prisma with PostgreSQL
      const data = row.data as Record<string, unknown>;
      const values = ds.columns.map(c => {
        const val = data[c.slug];
        // If the value is an array, flatten it for CSV
        if (Array.isArray(val)) {
          return `"${val.join(', ')}"`;
        }
        const strVal = String(val ?? '');
        // If the value is a stringified JSON array, flatten it
        if (typeof val === 'string' && val.startsWith('[')) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) return `"${arr.join(', ')}"`;
          } catch { /* not valid JSON */ }
        }
        return `"${strVal.replace(/"/g, '""')}"`;
      });
      csv += values.join(',') + '\n';
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${ds.slug}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Export failed' }, { status: 500 });
  }
}
