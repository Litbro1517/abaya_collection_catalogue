import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── GET /api/orders/export?view=active|archived — Export orders as CSV ──
// Exports only the orders in the current view (active or archived).
// Manual CSV stringification (no library) — same pattern as datasources export.
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json(
        { data: null, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') === 'archived';

    const orders = await db.order.findMany({
      where: { isDeleted: view },
      orderBy: { createdAt: 'desc' },
    });

    // CSV headers (business labels)
    const headers = [
      'Date de commande',
      'Client',
      'Téléphone',
      'Ville de livraison',
      'Adresse',
      'Article commandé',
      'Couleur',
      'Taille',
      'Quantité',
      'Montant total',
      'État de la commande',
    ];

    const escapeCsv = (val: unknown): string => {
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    let csv = headers.map(escapeCsv).join(',') + '\n';
    for (const o of orders) {
      csv += [
        escapeCsv(new Date(o.createdAt).toLocaleString('fr-FR')),
        escapeCsv(o.customerName),
        escapeCsv(o.customerPhone),
        escapeCsv(o.customerCity),
        escapeCsv(o.customerAddress),
        escapeCsv(o.productName),
        escapeCsv(o.productColor),
        escapeCsv(o.productSize),
        escapeCsv(o.productQuantity),
        escapeCsv(o.productPrice),
        escapeCsv(o.status),
      ].join(',') + '\n';
    }

    const filename = view ? 'commandes-archives.csv' : 'commandes-actives.csv';
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[GET /api/orders/export] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de l\'export.' },
      { status: 500 }
    );
  }
}
