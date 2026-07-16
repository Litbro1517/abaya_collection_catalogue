import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── POST /api/orders/restore — Restore archived orders (un-soft-delete) ──
// Body: { ids: string[] }
// Sets isDeleted=false and deletedAt=null.
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

    await db.order.updateMany({
      where: { id: { in: ids }, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    });

    return NextResponse.json({
      data: { restored: ids.length },
      error: null,
    });
  } catch (error) {
    console.error('[POST /api/orders/restore] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la restauration.' },
      { status: 500 }
    );
  }
}
