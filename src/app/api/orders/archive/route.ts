import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── POST /api/orders/archive — Soft-delete (archive) multiple orders ──
// Body: { ids: string[] }
// Orders with status 'delivered', 'confirmed', or 'cancelled' are eligible.
// Sets isDeleted=true and deletedAt=now().
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json(
        { data: null, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Liste d\'IDs requise.' },
        { status: 400 }
      );
    }

    // Check eligibility: delivered or cancelled orders can be archived (V4.1.3: confirmed removed)
    const eligible = await db.order.findMany({
      where: {
        id: { in: ids },
        isDeleted: false,
        status: { in: ['delivered', 'cancelled'] },
      },
      select: { id: true },
    });

    const eligibleIds = eligible.map(o => o.id);
    const rejectedCount = ids.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Aucune commande éligible à l\'archivage (Livrées ou Annulées uniquement).' },
        { status: 400 }
      );
    }

    const now = new Date();
    await db.order.updateMany({
      where: { id: { in: eligibleIds } },
      data: { isDeleted: true, deletedAt: now },
    });

    return NextResponse.json({
      data: { archived: eligibleIds.length, rejected: rejectedCount },
      error: null,
    });
  } catch (error) {
    console.error('[POST /api/orders/archive] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de l\'archivage.' },
      { status: 500 }
    );
  }
}
