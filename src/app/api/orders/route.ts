import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCurrentAdmin } from '@/lib/auth';

// ── POST /api/orders — Create a new COD order ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      customerName,
      customerPhone,
      customerCity,
      customerAddress,
      productName,
      productPrice,
      // ━━ Structured variant data (Étape 3 — Merci page recap) ━━
      productColor,
      productSize,
      productQuantity,
      productImage,
    } = body;

    // Validate required fields
    if (!productId || !customerName || !customerPhone || !customerCity || !customerAddress) {
      return NextResponse.json(
        { data: null, error: 'Tous les champs sont obligatoires.' },
        { status: 400 }
      );
    }

    // Validate field lengths
    if (customerName.trim().length < 2) {
      return NextResponse.json(
        { data: null, error: 'Le nom doit contenir au moins 2 caractères.' },
        { status: 400 }
      );
    }
    if (customerPhone.trim().length < 6) {
      return NextResponse.json(
        { data: null, error: 'Le numéro de téléphone doit contenir au moins 6 chiffres.' },
        { status: 400 }
      );
    }

    // Normalize quantity (default 1, min 1)
    const qty = Math.max(1, parseInt(String(productQuantity)) || 1);

    const order = await db.order.create({
      data: {
        productId: String(productId),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCity: customerCity.trim(),
        customerAddress: customerAddress.trim(),
        productName: productName || null,
        productPrice: productPrice || null,
        productColor: productColor ? String(productColor) : null,
        productSize: productSize ? String(productSize) : null,
        productQuantity: qty,
        productImage: productImage || null,
        status: 'pending',
      },
    });

    return NextResponse.json({ data: order, error: null }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/orders] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la création de la commande.' },
      { status: 500 }
    );
  }
}

// ── GET /api/orders — List orders (admin only) ──
// Defense in depth: middleware Guard #4 blocks unauthenticated requests,
// but we also verify admin auth at the handler level to protect PII.
export async function GET(req: NextRequest) {
  try {
    // Auth check — only owner/admin/super_admin can list orders
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json(
        { data: null, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const archived = searchParams.get('archived') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause: archived filter + status filter + case-insensitive search
    const where: Record<string, unknown> = { isDeleted: archived };
    if (status) where.status = status;

    let orders: Awaited<ReturnType<typeof db.order.findMany>>;
    let total: number;

    if (search?.trim()) {
      // ━━ Cross-DB case-insensitive search (SQLite + PostgreSQL) ━━
      // Uses LOWER() via $queryRaw because Prisma's mode: 'insensitive'
      // is PostgreSQL-only and would cause a build failure on SQLite.
      // NOTE: LOWER() does NOT handle Unicode/diacritics (é→e, à→a).
      // Boolean is passed via parameterized binding (not raw 0/1) to be
      // compatible with both SQLite (driver converts bool→0/1) and
      // PostgreSQL (native boolean type).
      const q = search.trim().toLowerCase();
      const searchPattern = `%${q}%`;

      // Build dynamic WHERE conditions (parameterized via Prisma.sql)
      const conditions: Prisma.Sql[] = [Prisma.sql`is_deleted = ${archived}`];
      if (status) {
        conditions.push(Prisma.sql`status = ${status}`);
      }
      // Search across 6 text fields (previously only 4)
      const searchFields = [
        'customer_name', 'customer_phone', 'customer_city',
        'customer_address', 'product_name', 'product_price',
      ];
      const searchClauses = searchFields.map(
        (field) => Prisma.sql`LOWER(CAST(${field} AS TEXT)) LIKE ${searchPattern}`
      );
      conditions.push(Prisma.join(searchClauses, Prisma.sql` OR `));

      const whereClause = Prisma.join(conditions, Prisma.sql` AND `);

      const rawOrders = await db.$queryRaw<Record<string, unknown>[]>`
        SELECT * FROM orders WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `;
      // Map snake_case DB columns → camelCase to match Prisma's findMany output
      orders = rawOrders.map((row) => ({
        id: row.id,
        productId: row.product_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerCity: row.customer_city,
        customerAddress: row.customer_address,
        status: row.status,
        productName: row.product_name,
        productPrice: row.product_price,
        productColor: row.product_color,
        productSize: row.product_size,
        productQuantity: row.product_quantity,
        productImage: row.product_image,
        isDeleted: Boolean(row.is_deleted),
        deletedAt: row.deleted_at ? new Date(String(row.deleted_at)) : null,
        createdAt: new Date(String(row.created_at)),
        updatedAt: new Date(String(row.updated_at)),
      }));

      const countResult = await db.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(*) as cnt FROM orders WHERE ${whereClause}
      `;
      total = Number(countResult[0].cnt);
    } else {
      // No search — use standard Prisma query (faster, type-safe)
      const [resultOrders, resultTotal] = await Promise.all([
        db.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.order.count({ where }),
      ]);
      orders = resultOrders;
      total = resultTotal;
    }

    return NextResponse.json({ data: orders, total, error: null });
  } catch (error) {
    console.error('[GET /api/orders] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la récupération des commandes.' },
      { status: 500 }
    );
  }
}
