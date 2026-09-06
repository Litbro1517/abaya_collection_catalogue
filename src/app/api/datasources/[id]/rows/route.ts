import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    // ━━ MANDAT 4P-rectification (audit 360, point 3) : garde-fou NaN ━━
    // parseInt('abc') → NaN ; Math.max(1, NaN) → NaN (NaN n'est pas filtré !)
    // → skip: NaN, take: NaN propagés à Prisma → PrismaClientValidationError
    // → 500 bruité sur simple requête malformée ?page=abc&limit=xyz.
    // Garde Number.isFinite + fallbacks sécurisés : page=1, limit=20 (valeur
    // absente inchangée : page '1', limit '1000' — zéro impact appelants sains).
    const rawPage = parseInt(url.searchParams.get('page') || '1', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawLimit = parseInt(url.searchParams.get('limit') || '1000', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(1000, Math.max(1, rawLimit)) : 20;

    // Note: JSON field search not supported with Prisma Json type in PostgreSQL.
    // Filtering by search is done post-fetch if needed.
    const where = { dataSourceId: id };

    const [rows, total] = await Promise.all([
      db.row.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.row.count({ where }),
    ]);

    // SQLite returns JSON fields as strings — parse them for client compatibility
    const parsedRows = rows.map(row => ({
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    }));

    return NextResponse.json({
      data: parsedRows,
      total,
      page,
      totalPages: Math.ceil(total / (limit || 1)),
      error: null,
    });
  } catch (e) {
    console.error('Rows GET error:', e);
    return NextResponse.json({ data: null, error: 'Failed to fetch rows' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const maxOrder = await db.row.findFirst({
      where: { dataSourceId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const row = await db.row.create({
      data: {
        dataSourceId: id,
        data: body.data || {},
        order: body.order ?? (maxOrder?.order ?? -1) + 1,
      },
    });

    return NextResponse.json({ data: row, error: null }, { status: 201 });
  } catch (e) {
    console.error('Row POST error:', e);
    return NextResponse.json({ data: null, error: 'Failed to create row' }, { status: 500 });
  }
}
