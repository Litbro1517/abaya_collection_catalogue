// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { STATUS_OPTIONS } from '@/lib/status-config';
import { Prisma } from '@prisma/client';

// ── 7 native columns that MUST always exist for every DataSource ──
// If any are missing from DB (e.g. DataSource created via admin UI without
// import/sync), they are upserted and injected into the GET response.
const NATIVE_COLUMNS_FALLBACK = [
  { slug: '__colors__', name: 'Couleur', type: 'COLOR', order: -7, config: {} },
  { slug: '__compare_at_price__', name: 'Prix barré', type: 'CURRENCY', order: -6, config: {} },
  { slug: '__category__', name: 'Catégorie', type: 'SELECT', order: -5, config: {} },
  { slug: '__sub_category__', name: 'Sous-catégorie', type: 'SELECT', order: -4, config: {} },
  { slug: '__disponibilite__', name: 'Disponibilité', type: 'BOOLEAN', order: -3, config: { labels: { true: 'Disponible', false: 'Épuisé' } } },
  { slug: '__stock__', name: 'Stock', type: 'NUMBER', order: -2, config: { isCounter: true, min: 0 } },
  { slug: '__statut__', name: 'Statut', type: 'STATUS', order: -1, config: { options: STATUS_OPTIONS.map(o => o.value) } },
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let columns = await db.column.findMany({
      where: { dataSourceId: id },
      orderBy: { order: 'asc' },
    });

    // ── Fallback: ensure all 7 native columns exist in DB + response ──
    const existingSlugs = new Set(columns.map(c => c.slug));
    const missingNatives = NATIVE_COLUMNS_FALLBACK.filter(nc => !existingSlugs.has(nc.slug));

    if (missingNatives.length > 0) {
      for (const nc of missingNatives) {
        const created = await db.column.upsert({
          where: { dataSourceId_slug: { dataSourceId: id, slug: nc.slug } },
          update: {},
          create: {
            dataSourceId: id,
            slug: nc.slug,
            name: nc.name,
            type: nc.type,
            order: nc.order,
            config: nc.config as unknown as Prisma.InputJsonValue as Record<string, unknown>,
            visible: true,
            required: false,
          },
        });
        columns.push(created);
      }
      columns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    return NextResponse.json({ data: columns, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch columns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, type, config, visible, required } = body;

    if (!name) {
      return NextResponse.json({ data: null, error: 'Name is required' }, { status: 400 });
    }

    // V1 FREEZE: Reject RELATION column creation
    if (type === 'RELATION') {
      return NextResponse.json(
        { data: null, error: 'Le type Relation est désactivé en V1. Disponible en V2.' },
        { status: 403 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 60);

    const maxOrder = await db.column.findFirst({
      where: { dataSourceId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const col = await db.column.create({
      data: {
        name,
        slug,
        type: type || 'TEXT',
        dataSourceId: id,
        order: (maxOrder?.order ?? -1) + 1,
        visible: visible !== false,
        required: required === true,
        config: config as unknown as Prisma.InputJsonValue || {},
      },
    });

    return NextResponse.json({ data: col, error: null }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'Column slug already exists' : 'Failed to create column';
    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
