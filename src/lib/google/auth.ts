import { db } from '@/lib/db';

/**
 * Refresh a Google access token using the refresh token
 */
export async function refreshAccessToken(session: {
  id: string;
  refreshToken: string | null;
}): Promise<string | null> {
  if (!session.refreshToken) return null;

  try {
    const clientIdSetting = await db.settings.findUnique({ where: { key: 'googleClientId' } });
    const clientSecretSetting = await db.settings.findUnique({ where: { key: 'googleClientSecret' } });

    const clientId = clientIdSetting?.value;
    const clientSecret = clientSecretSetting?.value;

    if (!clientId || !clientSecret) return null;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: session.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.access_token) return null;

    // Update the session with the new token
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    await db.googleSession.update({
      where: { id: session.id },
      data: {
        accessToken: data.access_token,
        tokenExpiry: expiresAt,
        refreshToken: data.refresh_token || session.refreshToken,
      },
    });

    return data.access_token;
  } catch (e) {
    console.error('Failed to refresh Google access token:', e);
    return null;
  }
}

/**
 * Get a valid Google access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<{
  accessToken: string;
  sessionId: string;
} | null> {
  try {
    const session = await db.googleSession.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      console.log('[Google Auth] No Google session found in database');
      return null;
    }

    console.log('[Google Auth] Found session for:', session.email, '| Scope:', session.scope?.slice(0, 80), '| Has refresh token:', !!session.refreshToken);

    // Check if token is still valid (with 5 min buffer)
    const isExpired = new Date(session.tokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

    if (!isExpired) {
      console.log('[Google Auth] Token is still valid until:', session.tokenExpiry);
      return { accessToken: session.accessToken, sessionId: session.id };
    }

    // Try to refresh
    console.log('[Google Auth] Token expired, attempting refresh...');
    const newAccessToken = await refreshAccessToken(session);
    if (!newAccessToken) {
      console.error('[Google Auth] Failed to refresh token. Session may need re-authorization.');
      return null;
    }

    console.log('[Google Auth] Token refreshed successfully');
    return { accessToken: newAccessToken, sessionId: session.id };
  } catch (e) {
    console.error('[Google Auth] Error getting valid access token:', e);
    return null;
  }
}
