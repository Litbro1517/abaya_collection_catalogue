import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── POST /api/orders/[id]/history/[historyId]/restore — Restore a field value ──
// Restores the oldValue from a specific OrderHistory entry back into the Order.
// Creates a NEW OrderHistory entry recording the restoration (old=new, new=old).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json(
        { data: null, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { id, historyId } = await params;
    if (!id || !historyId) {
      return NextResponse.json(
        { data: null, error: 'Order ID and History ID are required.' },
        { status: 400 }
      );
    }

    // Find the history entry
    const historyEntry = await db.orderHistory.findUnique({
      where: { id: historyId },
    });

    if (!historyEntry || historyEntry.orderId !== id) {
      return NextResponse.json(
        { data: null, error: 'Entrée d\'historique introuvable.' },
        { status: 404 }
      );
    }

    // Get current value of the field
    const order = await db.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { data: null, error: 'Commande introuvable.' },
        { status: 404 }
      );
    }

    const currentValue = order[historyEntry.field as keyof typeof order];
    const currentStr = currentValue === null ? null : String(currentValue);

    // The value to restore = historyEntry.oldValue
    const restoredValue = historyEntry.oldValue;

    // Coerce if productQuantity
    let updateValue: unknown = restoredValue;
    if (historyEntry.field === 'productQuantity') {
      updateValue = parseInt(restoredValue || '1') || 1;
    }

    // Create a new history entry recording the restoration
    await db.orderHistory.create({
      data: {
        orderId: id,
        field: historyEntry.field,
        oldValue: currentStr,
        newValue: restoredValue,
        changedBy: admin.id,
      },
    });

    // Apply the restoration
    const updated = await db.order.update({
      where: { id },
      data: { [historyEntry.field]: updateValue },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error('[POST /api/orders/[id]/history/[historyId]/restore] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la restauration.' },
      { status: 500 }
    );
  }
}
