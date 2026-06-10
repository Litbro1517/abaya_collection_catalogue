import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const settings = await db.catalogSettings.findFirst();
    if (!settings) {
      return NextResponse.json({ data: null, error: 'No settings found' }, { status: 404 });
    }
    return NextResponse.json({ data: settings, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await db.catalogSettings.findFirst();

    if (!current) {
      // Create default settings
      const settings = await db.catalogSettings.create({
        data: {
          catalogId: body.catalogId || (await db.catalog.findFirst())?.id || '',
          language: body.language || 'fr',
          currency: body.currency || 'MAD',
          whatsappNumber: body.whatsappNumber || '',
          messengerLink: body.messengerLink || '',
          emailContact: body.emailContact || '',
          instagramHandle: body.instagramHandle || '',
          primaryColor: body.primaryColor || '#C9A84C',
          secondaryColor: body.secondaryColor || '#1A1A1A',
          accentColor: body.accentColor || '#F5F0E8',
          backgroundColor: body.backgroundColor || '#FAF8F5',
          fontFamily: body.fontFamily || 'inter',
          enableZoom: body.enableZoom !== undefined ? body.enableZoom : true,
          enableSearch: body.enableSearch !== undefined ? body.enableSearch : true,
          enableSharing: body.enableSharing !== undefined ? body.enableSharing : true,
          conversionChannel: body.conversionChannel || 'whatsapp',
          conversionMessage: body.conversionMessage || '',
          brandGreenColor: body.brandGreenColor || '#1A3C34',
          destructiveColor: body.destructiveColor || '#800020',
          borderColor: body.borderColor || '#E8E2D9',
          customCSS: body.customCSS || '',
        },
      });
      return NextResponse.json({ data: settings, error: null });
    }

    // Update existing
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'language', 'currency', 'whatsappNumber', 'messengerLink', 'emailContact',
      'instagramHandle', 'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor',
      'fontFamily', 'enableZoom', 'enableSearch', 'enableSharing', 'conversionChannel',
      'conversionMessage', 'brandGreenColor', 'destructiveColor', 'borderColor',
      'customCSS', 'clientOverrides', 'favicon', 'logo',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const settings = await db.catalogSettings.update({
      where: { id: current.id },
      data: updateData,
    });

    return NextResponse.json({ data: settings, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to update settings' }, { status: 500 });
  }
}
