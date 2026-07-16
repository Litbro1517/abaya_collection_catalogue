import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── DELETE /api/orders/purge — Permanently delete archived orders ──
// Body: { ids: string[] }
// Rule: only orders archived (isDeleted=true) for MORE than 10 days can be purged.
// This is a HARD DELETE — the order and its OrderHistory are permanently removed.
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export async function DELETE(req: NextRequest) {
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

    // 10-day eligibility cutoff
    const cutoff = new Date(Date.now() - TEN_DAYS_MS);

    // Find eligible orders: isDeleted=true AND deletedAt < cutoff
    const eligible = await db.order.findMany({
      where: {
        id: { in: ids },
        isDeleted: true,
        deletedAt: { lt: cutoff },
      },
      select: { id: true },
    });

    const eligibleIds = eligible.map(o => o.id);
    const rejectedCount = ids.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Aucune commande éligible à la purge définitive (archivée depuis plus de 10 jours).' },
        { status: 400 }
      );
    }

    // Hard delete — OrderHistory rows are cascade-deleted via onDelete: Cascade
    await db.order.deleteMany({
      where: { id: { in: eligibleIds } },
    });

    return NextResponse.json({
      data: { purged: eligibleIds.length, rejected: rejectedCount },
      error: null,
    });
  } catch (error) {
    console.error('[DELETE /api/orders/purge] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la suppression définitive.' },
      { status: 500 }
    );
  }
}
