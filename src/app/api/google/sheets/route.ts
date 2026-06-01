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
    // Build URL properly using URL + URLSearchParams to ensure correct encoding
    const driveUrl = new URL('https://www.googleapis.com/drive/v3/files');
    driveUrl.searchParams.set('q', 'mimeType="application/vnd.google-apps.spreadsheet"');
    driveUrl.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,iconLink,owners(displayName,emailAddress))');
    driveUrl.searchParams.set('orderBy', 'modifiedTime desc');
    driveUrl.searchParams.set('pageSize', '100');
    driveUrl.searchParams.set('includeItemsFromAllDrives', 'true');
    driveUrl.searchParams.set('supportsAllDrives', 'true');
    driveUrl.searchParams.set('corpora', 'allDrives');

    console.log('[Sheets API] Fetching Drive files with token scope:', tokenInfo.accessToken ? 'present' : 'missing');
    console.log('[Sheets API] URL:', driveUrl.toString());

    const res = await fetch(driveUrl.toString(), {
      headers: { 'Authorization': `Bearer ${tokenInfo.accessToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Drive API error:', res.status, errorText);
      return NextResponse.json(
        { data: null, error: `Drive API error (${res.status}): ${errorText.slice(0, 500)}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const files = data.files || [];

    console.log(`[Sheets API] Found ${files.length} spreadsheet(s) in Drive`);

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

    // If no results with corpora=allDrives, try without (for some Drive configurations)
    if (sheets.length === 0) {
      console.log('[Sheets API] No results with allDrives, trying user corpus...');
      const userUrl = new URL('https://www.googleapis.com/drive/v3/files');
      userUrl.searchParams.set('q', 'mimeType="application/vnd.google-apps.spreadsheet"');
      userUrl.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,iconLink)');
      userUrl.searchParams.set('orderBy', 'modifiedTime desc');
      userUrl.searchParams.set('pageSize', '100');
      userUrl.searchParams.set('includeItemsFromAllDrives', 'true');
      userUrl.searchParams.set('supportsAllDrives', 'true');

      const userRes = await fetch(userUrl.toString(), {
        headers: { 'Authorization': `Bearer ${tokenInfo.accessToken}` },
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        const userFiles = userData.files || [];
        console.log(`[Sheets API] User corpus found ${userFiles.length} spreadsheet(s)`);

        if (userFiles.length > 0) {
          return NextResponse.json({
            data: userFiles.map((file: {
              id: string;
              name: string;
              mimeType: string;
              modifiedTime: string;
              webViewLink: string;
              thumbnailLink?: string;
              iconLink?: string;
            }) => ({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              modifiedTime: file.modifiedTime,
              webViewLink: file.webViewLink,
              thumbnailLink: file.thumbnailLink,
              iconLink: file.iconLink,
              owners: [],
            })),
            error: null,
          });
        }
      }
    }

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
