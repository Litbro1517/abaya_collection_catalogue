import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/google/auth';

/**
 * GET /api/google/picker-token
 * Returns a fresh Google OAuth access token for the Drive Picker (client-side).
 * The token is sourced from the stored Google session (refreshed if needed).
 *
 * Scope: drive.file (Picker only accesses files the app created or the user
 * explicitly selects — no full Drive access).
 */
export async function GET() {
  try {
    const result = await getValidAccessToken();
    if (!result) {
      return NextResponse.json(
        { error: 'Google session not found or token refresh failed' },
        { status: 401 },
      );
    }
    return NextResponse.json({
      data: { accessToken: result.accessToken },
      error: null,
    });
  } catch (error) {
    console.error('Picker token error:', error);
    return NextResponse.json(
      { error: 'Failed to get Google access token' },
      { status: 500 },
    );
  }
}
