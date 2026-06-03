import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/settings
export async function GET() {
  try {
    const settings = await db.settings.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    return NextResponse.json({
      data: {
        maintenanceMode: settingsMap.maintenanceMode === 'true',
        maintenanceMessage: settingsMap.maintenanceMessage || 'Site en maintenance, revenez bientôt.',
        whatsappNumber: settingsMap.whatsappNumber || '212600000000',
        instagramUsername: settingsMap.instagramUsername || 'abayachiccollection',
        shopEmail: settingsMap.shopEmail || 'contact@abayachic.ma',
        shopName: settingsMap.shopName || 'Abaya Chic Collection',
      },
    });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const updates = Object.entries(body).map(([key, value]) =>
      db.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
