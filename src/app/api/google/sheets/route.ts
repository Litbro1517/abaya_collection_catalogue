import { NextResponse } from 'next/server';
import { listDriveSheets } from '@/lib/google/sheets';
import { getValidAccessToken } from '@/lib/google/auth';

/**
 * GET /api/google/sheets
 * List available Google Sheets from the user's Drive
 */
export async function GET() {
  try {
    const tokenInfo = await getValidAccessToken();

    if (!tokenInfo) {
      return NextResponse.json(
        { data: null, error: 'No active Google session. Please connect your Google account first.' },
        { status: 401 }
      );
    }

    const sheets = await listDriveSheets(tokenInfo.accessToken);

    return NextResponse.json({
      data: sheets,
      error: null,
    });
  } catch (e) {
    console.error('Failed to list Google Sheets:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to list Google Sheets' },
      { status: 500 }
    );
  }
}
