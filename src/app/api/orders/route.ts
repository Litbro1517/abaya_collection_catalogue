import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({ data: orders, total, error: null });
  } catch (error) {
    console.error('[GET /api/orders] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la récupération des commandes.' },
      { status: 500 }
    );
  }
}
