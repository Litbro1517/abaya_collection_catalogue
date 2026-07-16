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

// ── PATCH /api/orders/[id] — Update order fields (admin, cell-level) ──
// Updates one or more fields on an order. Each modified field is snapshot
// into OrderHistory before the update, enabling diff display + restore.
//
// Allowed fields: status, customerName, customerPhone, customerCity,
// customerAddress, productName, productPrice, productColor, productSize, productQuantity
const ALLOWED_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
type AllowedStatus = typeof ALLOWED_STATUSES[number];

const EDITABLE_FIELDS = [
  'status', 'customerName', 'customerPhone', 'customerCity', 'customerAddress',
  'productName', 'productPrice', 'productColor', 'productSize', 'productQuantity',
] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check — only owner/admin/super_admin can update orders
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

    // Check order exists
    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: 'Commande introuvable.' },
        { status: 404 }
      );
    }

    // Build update data + history entries only for fields that actually changed
    const updateData: Record<string, unknown> = {};
    const historyEntries: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue;

      let newValue = body[field];
      // Coerce productQuantity to number
      if (field === 'productQuantity') {
        newValue = Math.max(1, parseInt(String(newValue)) || 1);
      }
      // Validate status whitelist
      if (field === 'status' && !ALLOWED_STATUSES.includes(newValue as AllowedStatus)) {
        return NextResponse.json(
          { data: null, error: `Statut invalide. Valeurs autorisées : ${ALLOWED_STATUSES.join(', ')}.` },
          { status: 400 }
        );
      }

      const oldValue = existing[field as keyof typeof existing];
      const oldStr = oldValue === null ? null : String(oldValue);
      const newStr = newValue === null ? null : String(newValue);

      // Only record if actually changed
      if (oldStr !== newStr) {
        updateData[field] = newValue;
        historyEntries.push({ field, oldValue: oldStr, newValue: newStr });
      }
    }

    if (Object.keys(updateData).length === 0) {
      // Nothing to update — return existing
      return NextResponse.json({ data: existing, error: null });
    }

    // Snapshot changes into OrderHistory (shadow table)
    if (historyEntries.length > 0) {
      await db.orderHistory.createMany({
        data: historyEntries.map(e => ({
          orderId: id,
          field: e.field,
          oldValue: e.oldValue,
          newValue: e.newValue,
          changedBy: admin.id,
        })),
      });
    }

    const updated = await db.order.update({
      where: { id },
      data: updateData,
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
