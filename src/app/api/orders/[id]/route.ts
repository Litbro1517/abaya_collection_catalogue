import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
