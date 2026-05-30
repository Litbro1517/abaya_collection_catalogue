import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/google/session
 * Check if there's an active Google session, return session info
 */
export async function GET() {
  try {
    const session = await db.googleSession.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return NextResponse.json({
        data: { connected: false },
        error: null,
      });
    }

    // Check if token is expired (but still return session info - refresh can happen on use)
    const isExpired = new Date(session.tokenExpiry) < new Date();

    return NextResponse.json({
      data: {
        connected: true,
        id: session.id,
        email: session.email,
        name: session.name,
        picture: session.picture,
        scope: session.scope,
        tokenExpired: isExpired,
        hasRefreshToken: !!session.refreshToken,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      error: null,
    });
  } catch (e) {
    console.error('Failed to check Google session:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to check Google session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/google/session
 * Disconnect Google session (remove tokens)
 */
export async function DELETE() {
  try {
    await db.googleSession.deleteMany({});

    return NextResponse.json({
      data: { connected: false },
      error: null,
    });
  } catch (e) {
    console.error('Failed to disconnect Google session:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to disconnect Google session' },
      { status: 500 }
    );
  }
}
