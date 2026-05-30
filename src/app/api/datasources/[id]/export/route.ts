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
      const data = JSON.parse(row.data as string) as Record<string, unknown>;
      const values = ds.columns.map(c => {
        const val = String(data[c.slug] ?? '');
        // If the value is a JSON array, flatten it
        if (val.startsWith('[')) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) return `"${arr.join(', ')}"`;
          } catch {}
        }
        return `"${val.replace(/"/g, '""')}"`;
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
