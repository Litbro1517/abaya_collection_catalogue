import { NextRequest, NextResponse } from 'next/server';
import { listSpreadsheetTabs } from '@/lib/google/sheets';
import { getValidAccessToken } from '@/lib/google/auth';

/**
 * GET /api/google/sheets/[sheetId]/tabs
 * List tabs/sheets within a specific spreadsheet
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sheetId: string }> }
) {
  try {
    const { sheetId } = await params;

    if (!sheetId) {
      return NextResponse.json(
        { data: null, error: 'sheetId is required' },
        { status: 400 }
      );
    }

    const tokenInfo = await getValidAccessToken();

    if (!tokenInfo) {
      return NextResponse.json(
        { data: null, error: 'No active Google session. Please connect your Google account first.' },
        { status: 401 }
      );
    }

    const tabs = await listSpreadsheetTabs(tokenInfo.accessToken, sheetId);

    return NextResponse.json({
      data: tabs,
      error: null,
    });
  } catch (e) {
    console.error('Failed to list spreadsheet tabs:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to list spreadsheet tabs' },
      { status: 500 }
    );
  }
}
