import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * GET /api/google/auth
 * Generate Google OAuth URL with proper scopes
 */
export async function GET(req: NextRequest) {
  try {
    // Get Google OAuth credentials from Settings
    const clientIdSetting = await db.settings.findUnique({ where: { key: 'googleClientId' } });
    const clientSecretSetting = await db.settings.findUnique({ where: { key: 'googleClientSecret' } });

    const clientId = clientIdSetting?.value;
    const clientSecret = clientSecretSetting?.value;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          data: null,
          error: 'Google OAuth credentials not configured. Please set clientId and clientSecret via /api/google/credentials first.',
          setupRequired: true,
        },
        { status: 400 }
      );
    }

    // Generate a random state for CSRF protection
    const state = uuidv4();

    // Determine the redirect URI
    // Use the request origin to build the callback URL
    const origin = req.headers.get('x-forwarded-host')
      ? `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host')}`
      : req.headers.get('origin') || 'http://localhost:3000';

    const redirectUri = `${origin}/api/google/auth`;

    // Build the OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Store state in a cookie for CSRF verification
    const response = NextResponse.json({
      data: { authUrl, state },
      error: null,
    });

    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (e) {
    console.error('Failed to generate Google OAuth URL:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to generate Google OAuth URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/google/auth
 * Handle the OAuth callback - exchange code for tokens, store in GoogleSession table
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, state } = body;

    if (!code) {
      return NextResponse.json(
        { data: null, error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Verify state for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get('google_oauth_state')?.value;

    if (state && storedState && state !== storedState) {
      return NextResponse.json(
        { data: null, error: 'Invalid OAuth state - possible CSRF attack' },
        { status: 403 }
      );
    }

    // Get Google OAuth credentials
    const clientIdSetting = await db.settings.findUnique({ where: { key: 'googleClientId' } });
    const clientSecretSetting = await db.settings.findUnique({ where: { key: 'googleClientSecret' } });

    const clientId = clientIdSetting?.value;
    const clientSecret = clientSecretSetting?.value;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { data: null, error: 'Google OAuth credentials not configured' },
        { status: 400 }
      );
    }

    // Determine the redirect URI (must match the one used in GET)
    const origin = req.headers.get('x-forwarded-host')
      ? `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host')}`
      : req.headers.get('origin') || 'http://localhost:3000';

    const redirectUri = `${origin}/api/google/auth`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.json(
        { data: null, error: 'Failed to exchange authorization code for tokens' },
        { status: 400 }
      );
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    if (!access_token) {
      return NextResponse.json(
        { data: null, error: 'No access token received from Google' },
        { status: 400 }
      );
    }

    // Fetch user info
    let userInfo: { email?: string; name?: string; picture?: string } = {};
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userRes.ok) {
        userInfo = await userRes.json();
      }
    } catch (e) {
      console.error('Failed to fetch user info:', e);
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Delete any existing Google sessions (we only keep one active)
    await db.googleSession.deleteMany({});

    // Store in GoogleSession table
    const session = await db.googleSession.create({
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || null,
        tokenExpiry: expiresAt,
        scope: scope || '',
        email: userInfo.email || null,
        name: userInfo.name || null,
        picture: userInfo.picture || null,
      },
    });

    // Clear the OAuth state cookie
    cookieStore.set('google_oauth_state', '', { expires: new Date(0), path: '/' });

    return NextResponse.json({
      data: {
        id: session.id,
        email: session.email,
        name: session.name,
        picture: session.picture,
      },
      error: null,
    });
  } catch (e) {
    console.error('Google OAuth callback error:', e);
    return NextResponse.json(
      { data: null, error: 'Google OAuth callback failed' },
      { status: 500 }
    );
  }
}
