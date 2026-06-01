import { NextResponse } from 'next/server';
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

    // Use Drive API v3 to list spreadsheets
    const url = 'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent('mimeType="application/vnd.google-apps.spreadsheet"') +
      '&fields=files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,iconLink,owners(displayName,emailAddress))' +
      '&orderBy=modifiedTime desc&pageSize=50' +
      '&includeItemsFromAllDrives=true&supportsAllDrives=true';

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${tokenInfo.accessToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Drive API error:', res.status, errorText);
      return NextResponse.json(
        { data: null, error: `Drive API error (${res.status}): ${errorText.slice(0, 200)}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const files = data.files || [];

    const sheets = files.map((file: {
      id: string;
      name: string;
      mimeType: string;
      modifiedTime: string;
      webViewLink: string;
      thumbnailLink?: string;
      iconLink?: string;
      owners?: { displayName: string; emailAddress: string }[];
    }) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      thumbnailLink: file.thumbnailLink,
      iconLink: file.iconLink,
      owners: file.owners,
    }));

    return NextResponse.json({
      data: sheets,
      error: null,
    });
  } catch (e) {
    console.error('Failed to list Google Sheets:', e);
    return NextResponse.json(
      { data: null, error: 'Failed to list Google Sheets: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
