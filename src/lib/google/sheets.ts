/**
 * Google Sheets API Helper
 * 
 * Handles fetching and parsing Google Sheets data.
 * Supports two modes:
 * 1. Public sheets (published as CSV) - no auth required
 * 2. Private sheets (via Google API) - requires OAuth token
 */

import { detectImageColumns, extractSheetId } from './drive-images';

/**
 * Fetch a public Google Sheet as CSV
 * The sheet must be published to the web (File > Share > Publish to web)
 */
export async function fetchPublicSheetAsCsv(sheetUrl: string, sheetName?: string, gid?: string): Promise<{
  headers: string[];
  rows: string[][];
  imageColumns: string[];
  columnTypes: import('@/types').ColumnType[];
} | null> {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) return null;
  
  // Build CSV export URLs to try, in order of preference
  const urlsToTry: string[] = [];
  
  // If gid is provided, use the export URL with gid (most reliable for specific tabs)
  if (gid) {
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
  }
  
  // Try gviz/tq with sheet name
  if (sheetName) {
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`);
  }
  
  // Fallback: first tab via gviz
  urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);
  
  // Last resort: export first tab
  urlsToTry.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
  
  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/csv',
          'User-Agent': 'Mozilla/5.0 (compatible; CatalogBot/1.0)',
        },
        redirect: 'follow',
      });
      
      if (!response.ok) continue;
      
      const csvText = await response.text();
      if (!csvText || csvText.trim().length === 0) continue;
      // Skip if response is HTML (redirect page or error page)
      if (csvText.trimStart().startsWith('<')) continue;
      
      const result = parseCsvAndDetect(csvText);
      if (result && result.headers.length > 0) return result;
    } catch {
      // Try next URL
    }
  }
  
  return null;
}

/**
 * Fetch a private Google Sheet via the Sheets API (requires OAuth)
 */
export async function fetchPrivateSheetData(
  accessToken: string,
  sheetId: string,
  sheetName?: string
): Promise<{
  headers: string[];
  rows: string[][];
  imageColumns: string[];
  columnTypes: import('@/types').ColumnType[];
} | null> {
  try {
    // First, get spreadsheet metadata to find sheet names
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const metaRes = await fetch(metaUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    
    // Find the target sheet or use the first one
    const sheets = metaData.sheets || [];
    let targetSheet = sheets[0];
    
    if (sheetName) {
      const found = sheets.find((s: { properties: { title: string } }) => s.properties.title === sheetName);
      if (found) targetSheet = found;
    }
    
    const range = sheetName
      ? `'${sheetName}'`
      : `'${targetSheet?.properties?.title || 'Sheet1'}'`;
    
    // Fetch the data
    const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
    const dataRes = await fetch(dataUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!dataRes.ok) return null;
    const data = await dataRes.json();
    
    const values = data.values || [];
    if (values.length === 0) return null;
    
    // First row is headers
    const headers = values[0].map((h: string) => h.trim());
    const rows = values.slice(1).map((row: string[]) => {
      // Pad short rows with empty strings
      while (row.length < headers.length) row.push('');
      return row.slice(0, headers.length);
    });
    
    // Detect image columns and types
    const { imageColumns, columnTypes } = detectImageColumns(headers, rows);
    
    return { headers, rows, imageColumns, columnTypes };
  } catch (e) {
    console.error('Failed to fetch private sheet:', e);
    return null;
  }
}

/**
 * List Google Sheets from the user's Drive
 */
export async function listDriveSheets(accessToken: string): Promise<import('@/types').GoogleSheetInfo[]> {
  try {
    const url = 'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%22application%2Fvnd.google-apps.spreadsheet%22&fields=files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,iconLink,owners(displayName,emailAddress))&orderBy=modifiedTime desc&pageSize=50';
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    
    return (data.files || []).map((file: {
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
  } catch (e) {
    console.error('Failed to list Drive sheets:', e);
    return [];
  }
}

/**
 * List sheets (tabs) within a Google Spreadsheet
 */
export async function listSpreadsheetTabs(
  accessToken: string,
  sheetId: string
): Promise<string[]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    
    return (data.sheets || []).map((s: { properties: { title: string } }) => s.properties.title);
  } catch (e) {
    console.error('Failed to list spreadsheet tabs:', e);
    return [];
  }
}

/**
 * Parse CSV text and detect image columns
 */
function parseCsvAndDetect(csvText: string): {
  headers: string[];
  rows: string[][];
  imageColumns: string[];
  columnTypes: import('@/types').ColumnType[];
} | null {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return null;
  
  // Detect if gviz concatenated headers with data (e.g. "Prix_Vente 270.00 DH 280.00 DH")
  // The gviz/tq endpoint sometimes merges header + first N values into one cell
  const headers = rows[0].map(h => cleanGvizHeader(h));
  const dataRows = rows.slice(1);
  
  const { imageColumns, columnTypes } = detectImageColumns(headers, dataRows);
  
  return { headers, rows: dataRows, imageColumns, columnTypes };
}

/**
 * Clean a gviz-style header that has data concatenated after the actual column name.
 * Examples:
 *   "Prix_Vente 270.00 DH 280.00 DH" → "Prix_Vente"
 *   "N Ordre 1 2 3 4" → "N Ordre"
 *   "Image de Garde https://..." → "Image de Garde"
 *   "Nom_Produit_Docx" → "Nom_Produit_Docx" (unchanged)
 */
function cleanGvizHeader(header: string): string {
  // If header doesn't contain spaces, it's already clean (underscored headers like Prix_Vente)
  // But we need to handle headers like "N Ordre" or "Image de Garde" that have legitimate spaces
  
  // Strategy: If the header contains a URL or a number followed by text,
  // it's likely a gviz-concatenated header. Extract just the column name.
  
  // Pattern 1: Header contains a URL (http or drive.google.com)
  if (/https?:\/\//.test(header)) {
    return header.replace(/\s+https?:\/\/.*$/,'').trim();
  }
  
  // Pattern 2: Header has numeric values after the name (e.g. "N Ordre 1 2 3 4" or "Prix_Vente 270.00 DH")
  // Match: word chars/spaces followed by a number that isn't part of the name
  const numericMatch = header.match(/^(.+?)\s+\d+[\d.,]*\s/);
  if (numericMatch && numericMatch[1].length > 0) {
    return numericMatch[1].trim();
  }
  
  // Pattern 3: Header has repeated words (e.g. "Cliquer ici Cliquez ici Cliquez ici")
  const repeatedMatch = header.match(/^(.+?)\s+\1/i);
  if (repeatedMatch) {
    return repeatedMatch[1].trim();
  }
  
  // No cleaning needed
  return header;
}

/**
 * Robust CSV parser that handles quoted fields, commas in values, etc.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n after \r
      } else if (char === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  
  // Don't forget the last field/row
  currentRow.push(currentField.trim());
  if (currentRow.some(f => f.length > 0)) {
    rows.push(currentRow);
  }
  
  return rows;
}

/**
 * Generate a slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}
