import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google/credentials
 * Check if Google OAuth credentials are configured
 */
export async function GET() {
  try {
    const clientIdSetting = await db.settings.findUnique({ where: { key: 'googleClientId' } });
    const clientSecretSetting = await db.settings.findUnique({ where: { key: 'googleClientSecret' } });

    const configured = !!(clientIdSetting?.value && clientSecretSetting?.value);

    return NextResponse.json({
      data: {
        configured,
        hasClientId: !!clientIdSetting?.value,
        hasClientSecret: !!clientSecretSetting?.value,
        clientId: clientIdSetting?.value || '',
        clientSecret: clientSecretSetting?.value ? 'exists' : '',
      },
      error: null,
    });
  } catch (e) {
    console.error('Failed to check Google credentials:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to check Google credentials' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/google/credentials
 * Save Google OAuth credentials (clientId, clientSecret) to Settings table
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientSecret } = body;

    if (!clientId) {
      return NextResponse.json(
        { data: null, error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Upsert client ID
    await db.settings.upsert({
      where: { key: 'googleClientId' },
      update: { value: clientId },
      create: { key: 'googleClientId', value: clientId },
    });

    // Upsert client secret if provided
    if (clientSecret) {
      await db.settings.upsert({
        where: { key: 'googleClientSecret' },
        update: { value: clientSecret },
        create: { key: 'googleClientSecret', value: clientSecret },
      });
    }

    return NextResponse.json({
      data: { configured: true },
      error: null,
    });
  } catch (e) {
    console.error('Failed to save Google credentials:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to save Google credentials' },
      { status: 500 }
    );
  }
}
