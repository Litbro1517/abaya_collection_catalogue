import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCurrentAdmin } from '@/lib/auth';

// ── POST /api/orders — Create a new order ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId, customerName, customerPhone, customerCity, customerAddress,
      productName, productPrice, productColor, productSize, productQuantity, productImage,
    } = body;

    if (!productId || !customerName || !customerPhone || !customerCity || !customerAddress) {
      return NextResponse.json({ data: null, error: 'Tous les champs sont obligatoires.' }, { status: 400 });
    }

    // VG37.3 A4: Strict Morocco phone validation (10 digits local or +212 international)
    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    // Accept: 06XXXXXXXX / 07XXXXXXXX (10 digits local) OR +2126XXXXXXXX / +2127XXXXXXXX (international)
    const isLocalFormat = /^0[67]\d{8}$/.test(cleanPhone);
    const isIntlFormat = /^\+212[67]\d{8}$/.test(cleanPhone);
    if (!isLocalFormat && !isIntlFormat) {
      return NextResponse.json(
        { data: null, error: 'Numéro de téléphone invalide (10 chiffres requis, format 06XXXXXXXX ou 07XXXXXXXX).' },
        { status: 400 },
      );
    }

    const qty = Math.max(1, parseInt(String(productQuantity)) || 1);

    const order = await db.order.create({
      data: {
        productId: String(productId),
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
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
    return NextResponse.json({ data: null, error: 'Erreur lors de la création de la commande.' }, { status: 500 });
  }
}

// ── GET /api/orders — List & Search orders ──
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const archived = searchParams.get('archived') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let orders: any[];
    let total: number;

    if (search?.trim()) {
      const cleanSearch = search.trim().slice(0, 200);
      const searchPattern = `%${cleanSearch.replace(/[%_\\]/g, '\\$&')}%`;

      const conditions: Prisma.Sql[] = [Prisma.sql`is_deleted = ${archived}`];
      if (status) {
        conditions.push(Prisma.sql`status = ${status}`);
      }

      const searchFields = [
        'customer_name', 'customer_phone', 'customer_city',
        'customer_address', 'product_name', 'product_price',
      ];

      const searchClauses = searchFields.map(
        (field) => Prisma.sql`LOWER(CAST(${Prisma.raw(field)} AS TEXT)) LIKE LOWER(${searchPattern}) ESCAPE '\\'`
      );

      conditions.push(Prisma.sql`(${Prisma.join(searchClauses, ' OR ')})`);
      const whereClause = Prisma.join(conditions, ' AND ');

      const rawOrders = await db.$queryRaw`
        SELECT * FROM orders 
        WHERE ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;

      // FIX CHIRURGICAL 5 : Réintégration du mapping snake_case -> camelCase
      const rows = rawOrders as Record<string, unknown>[];
      orders = rows.map((row) => ({
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
      const where: Record<string, unknown> = { isDeleted: archived };
      if (status) where.status = status;

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
    return NextResponse.json({ data: null, error: 'Erreur lors de la récupération des commandes.' }, { status: 500 });
  }
}
