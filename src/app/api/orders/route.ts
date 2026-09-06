import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCurrentAdmin } from '@/lib/auth';

// ━━ MANDAT 4P — Sanitisation serveur attribution UTM ━━
// Liste blanche stricte (mirroir du client) + max 256 chars par valeur.
// Élimine toute tentative d'injection SQL ou de payload arbitraire.
const ALLOWED_ATTR_KEYS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'
]);
const MAX_ATTR_VALUE_LENGTH = 256;

function sanitizeAttribution(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (ALLOWED_ATTR_KEYS.has(key) && typeof value === 'string' && value.length <= MAX_ATTR_VALUE_LENGTH) {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

// ── POST /api/orders — Create a new order (multi-product support) ──
// VG37.4 Phase 2: Accepts multi-product payload with items[] array.
// Creates one Order record per cart item (same customer info).
// Backward compatible: if items[] is absent, falls back to single-product format.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      // Multi-product fields (VG37.4)
      items,
      // Single-product fields (backward compatibility)
      productId, productName, productPrice, productColor, productSize, productQuantity, productImage,
      // Common customer fields
      customerName, customerPhone, customerCity, customerAddress, totalPrice,
      // MANDAT 4P — Attribution UTM (best-effort, pas de colonne Prisma requise)
      attribution,
    } = body;

    if (!customerName || !customerPhone || !customerCity || !customerAddress) {
      return NextResponse.json({ data: null, error: 'Tous les champs client sont obligatoires.' }, { status: 400 });
    }

    // VG37.3 A4: Strict Morocco phone validation (10 digits local or +212 international)
    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
    const isLocalFormat = /^0[67]\d{8}$/.test(cleanPhone);
    const isIntlFormat = /^\+212[67]\d{8}$/.test(cleanPhone);
    if (!isLocalFormat && !isIntlFormat) {
      return NextResponse.json(
        { data: null, error: 'Numéro de téléphone invalide (10 chiffres requis, format 06XXXXXXXX ou 07XXXXXXXX).' },
        { status: 400 },
      );
    }

    // VG37.4 Phase 2: Multi-product path — create one Order per item
    if (Array.isArray(items) && items.length > 0) {
      if (items.length === 0) {
        return NextResponse.json({ data: null, error: 'Le panier est vide.' }, { status: 400 });
      }

      const orders = await db.$transaction(
        items.map((item: {
          productId: string;
          productName?: string;
          productPrice?: string;
          productColor?: string | null;
          productSize?: string | null;
          productQuantity?: number;
          productImage?: string | null;
        }) => {
          const qty = Math.max(1, parseInt(String(item.productQuantity)) || 1);
          return db.order.create({
            data: {
              productId: String(item.productId),
              customerName: customerName.trim(),
              customerPhone: cleanPhone,
              customerCity: customerCity.trim(),
              customerAddress: customerAddress.trim(),
              productName: item.productName || null,
              productPrice: item.productPrice || null,
              productColor: item.productColor ? String(item.productColor) : null,
              productSize: item.productSize ? String(item.productSize) : null,
              productQuantity: qty,
              productImage: item.productImage || null,
              status: 'pending',
            },
          });
        }),
      );

      // ━━ MANDAT 4P — Attribution UTM multi-produits (best-effort SQL) ━━
      // Bug fix : l'attribution n'était persistée que sur le parcours legacy
      // (single-product). Le parcours multi-produits ($transaction) la perdait.
      // Maintenant : persiste sur TOUS les orders du batch.
      if (attribution && typeof attribution === 'object' && Object.keys(attribution).length > 0) {
        try {
          const sanitized = sanitizeAttribution(attribution);
          if (sanitized) {
            for (const o of orders) {
              await db.$executeRaw`
                UPDATE orders SET attribution = ${sanitized}
                WHERE id = ${o.id}
              `;
            }
          }
        } catch {
          // Colonne attribution absente → best-effort, ne jamais casser la commande
        }
      }

      return NextResponse.json({ data: { id: orders[0]?.id, count: orders.length, orders }, error: null }, { status: 201 });
    }

    // Backward compatibility: single-product path (legacy callers)
    if (!productId) {
      return NextResponse.json({ data: null, error: 'Aucun article dans la commande.' }, { status: 400 });
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

    // ━━ MANDAT 4P — Persistance attribution UTM best-effort (raw SQL) ━━
    // Si la colonne `attribution` n'existe pas en BDD, l'erreur est catchée
    // silencieusement → le statut 201 de la commande est GARANTI.
    // Si la colonne existe (ALTER TABLE optionnel), l'attribution est persistée.
    if (attribution && typeof attribution === 'object' && Object.keys(attribution).length > 0) {
      try {
        const sanitized = sanitizeAttribution(attribution);
        if (sanitized) {
          const id = order.id;
          await db.$executeRaw`
            UPDATE orders SET attribution = ${sanitized}
            WHERE id = ${id}
          `;
        }
      } catch {
        // Colonne attribution absente ou erreur SQL → best-effort, ne jamais casser la commande
      }
    }

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
