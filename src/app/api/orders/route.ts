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
    // TODO(DEBT-3): add a 200-char length cap on `search` to prevent oversized
    // LIKE patterns (DoS mitigation). Currently unbounded — a very long string
    // would still be escaped and injected into 11 LIKE clauses.
    const search = searchParams.get('search');
    const archived = searchParams.get('archived') === 'true';
    // TODO(DEBT-2): reinforce pagination guard — parseInt returns NaN on invalid
    // input (e.g. ?limit=abc), which currently propagates as NaN into take/skip.
    // Add Number.isFinite() checks and explicit fallback to defaults.
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause for the no-search path (standard Prisma query)
    const where: Record<string, unknown> = { isDeleted: archived };
    if (status) where.status = status;

    let orders: Awaited<ReturnType<typeof db.order.findMany>>;
    let total: number;

    if (search?.trim()) {
      // ━━ V4.1.5 — Robust cross-DB search (unified from abaya-collection-admin) ━━
      // Previous V4.1.3 implementation was BROKEN: it used
      // `LOWER(CAST(${field} AS TEXT))` where `field` was a JS string, which
      // Prisma.sql treats as a bound parameter (not SQL literal) → SQL syntax
      // error "near [object Object]" → search returned nothing in production.
      //
      // FIX: column names are now written as SQL literals directly in the
      // tagged template (no interpolation). LIKE wildcards (%, _) are escaped.
      // Search extended from 6 to 11 fields (added productColor, productSize,
      // productQuantity, status, createdAt).
      const escaped = search.trim().replace(/[%_\\]/g, '\\$&');
      const q = `%${escaped}%`;

      // Build parameterized WHERE conditions (SQL-injection safe)
      const conditions: Prisma.Sql[] = [Prisma.sql`is_deleted = ${archived}`];
      if (status) {
        conditions.push(Prisma.sql`status = ${status}`);
      }
      // TODO(DEBT-1): datetime(created_at/1000, 'unixepoch') is SQLite-specific.
      // Prisma stores DateTime as epoch-ms integer in SQLite, so CAST AS TEXT
      // yields "1784318910427" (not a date). On PostgreSQL, replace with
      // CAST(created_at AS TEXT) which yields ISO 8601 directly.
      // See PROJECT_MAP.md → Dette Technique à traiter.
      conditions.push(Prisma.sql`(
        LOWER(CAST(customer_name AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(customer_phone AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(customer_city AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(customer_address AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(product_name AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(product_price AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(product_color AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(CAST(product_size AS TEXT)) LIKE LOWER(${q}) ESCAPE '\\'
        OR CAST(product_quantity AS TEXT) LIKE ${q} ESCAPE '\\'
        OR LOWER(status) LIKE LOWER(${q}) ESCAPE '\\'
        OR LOWER(datetime(created_at/1000, 'unixepoch')) LIKE LOWER(${q}) ESCAPE '\\'
      )`);

      const whereClause = Prisma.join(conditions, ' AND ');

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
