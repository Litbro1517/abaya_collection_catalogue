import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── GET /api/orders/[id]/history — Fetch modification history for an order ──
// Returns all OrderHistory entries for the given order, most recent first.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const history = await db.orderHistory.findMany({
      where: { orderId: id },
      orderBy: { changedAt: 'desc' },
    });

    return NextResponse.json({ data: history, error: null });
  } catch (error) {
    console.error('[GET /api/orders/[id]/history] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la récupération de l\'historique.' },
      { status: 500 }
    );
  }
}
