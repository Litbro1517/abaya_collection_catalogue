import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── GET /api/orders/[id] — Fetch a single order by ID ──
// Used by the Merci (thank-you) page to display the real order recap.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { data: null, error: 'Order not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: order, error: null });
  } catch (error) {
    console.error('[GET /api/orders/[id]] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la récupération de la commande.' },
      { status: 500 }
    );
  }
}

// ── PATCH /api/orders/[id] — Update order status (admin) ──
// Updates the status of an existing order. Only `status` is mutable via this
// endpoint to keep the surface area minimal and prevent accidental field
// overwrites.
//
// Allowed statuses: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
const ALLOWED_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
type AllowedStatus = typeof ALLOWED_STATUSES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check — only owner/admin/super_admin can update order status
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json(
        { data: null, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { status } = body;

    // Validate status value (whitelist)
    if (!status || !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
      return NextResponse.json(
        {
          data: null,
          error: `Statut invalide. Valeurs autorisées : ${ALLOWED_STATUSES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    // Check order exists
    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: 'Commande introuvable.' },
        { status: 404 }
      );
    }

    const updated = await db.order.update({
      where: { id },
      data: { status: status as AllowedStatus },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error('[PATCH /api/orders/[id]] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la mise à jour de la commande.' },
      { status: 500 }
    );
  }
}
