/**
 * Google Drive Image URL Resolver
 * 
 * This module handles the detection and conversion of Google Drive image URLs
 * into displayable image URLs for the catalog.
 * 
 * How it works:
 * 1. Google Sheets cells contain links to Google Drive files
 * 2. These links come in various formats (share links, open links, etc.)
 * 3. We extract the file ID and convert to a direct image URL
 * 4. For CORS-restricted images, we use an image proxy endpoint
 * 
 * Supported URL patterns:
 * - https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
 * - https://drive.google.com/file/d/{FILE_ID}/view
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}
 * - https://drive.google.com/uc?export=view&id={FILE_ID}
 * - https://docs.google.com/spreadsheets/d/{SHEET_ID}/...
 * - https://lh3.googleusercontent.com/d/{FILE_ID}
 */

// Regex patterns for Google Drive URLs
const DRIVE_URL_PATTERNS = [
  // /file/d/{ID}/view pattern
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  // /open?id={ID} pattern
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  // /uc?id={ID} pattern
  /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
  // /uc?export=view&id={ID} pattern
  /drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/,
  // googleusercontent direct pattern
  /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  // drive thumbnail pattern
  /drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/,
];

// Folder URL pattern
const DRIVE_FOLDER_PATTERN = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/;

// Google Sheet URL pattern
const SHEET_URL_PATTERN = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

/**
 * Extract a Google Drive file ID from a URL
 */
export function extractDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  
  for (const pattern of DRIVE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract a Google Drive folder ID from a URL
 */
export function extractDriveFolderId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(DRIVE_FOLDER_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extract a Google Sheet ID from a URL
 */
export function extractSheetId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(SHEET_URL_PATTERN);
  return match ? match[1] : null;
}

/**
 * Check if a URL is a Google Drive image URL
 */
export function isDriveImageUrl(url: string): boolean {
  return extractDriveFileId(url) !== null;
}

/**
 * Check if a URL is a Google Drive folder URL
 */
export function isDriveFolderUrl(url: string): boolean {
  return extractDriveFolderId(url) !== null;
}

/**
 * Check if a URL is any type of image URL (Drive or direct)
 */
export function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // Google Drive image link
  if (isDriveImageUrl(url)) return true;
  
  // Direct image URL patterns
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowerUrl = url.toLowerCase().split('?')[0]; // Remove query params
  if (imageExtensions.some(ext => lowerUrl.endsWith(ext))) return true;
  
  // Common image hosting patterns
  const imageHosts = [
    'imgur.com',
    'i.imgur.com',
    'cdn.shopify.com',
    'images.unsplash.com',
    'cloudinary.com',
    'res.cloudinary.com',
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
  ];
  if (imageHosts.some(host => url.includes(host))) return true;
  
  return false;
}

/**
 * Convert a Google Drive URL to a direct displayable image URL
 * Uses the thumbnail API which is more reliable than uc?export=view
 */
export function resolveDriveImageUrl(driveUrl: string, size: number = 800): string {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) return driveUrl;
  
  // Use the thumbnail API - this is the most reliable method
  // The sz parameter controls the image size
  return `/api/google/image-proxy?id=${fileId}&sz=${size}`;
}

/**
 * Get the direct Google Drive thumbnail URL (server-side, no proxy)
 * This URL works when the file is publicly shared
 */
export function getDriveThumbnailUrl(fileId: string, size: number = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;
}

/**
 * Get the direct Google Drive content URL (server-side)
 */
export function getDriveContentUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Resolve any image URL for display
 * - Google Drive URLs → proxy URL
 * - Regular URLs → as-is
 */
export function resolveImageUrl(url: string, size: number = 800): string {
  if (!url || typeof url !== 'string') return '';
  
  if (isDriveImageUrl(url)) {
    return resolveDriveImageUrl(url, size);
  }
  
  return url;
}

/**
 * Parse a cell value that may contain multiple image URLs
 * Handles comma-separated, newline-separated, or JSON array formats
 */
export function parseImageUrls(value: unknown): string[] {
  if (!value) return [];

  // Native array (from PostgreSQL Json type)
  if (Array.isArray(value)) {
    return value
      .filter((url: unknown) => typeof url === 'string' && url.length > 0)
      .map((url: string) => resolveImageUrl(url));
  }

  // String value
  if (typeof value !== 'string') return [];

  // Try JSON array first (legacy stringified format)
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((url: unknown) => typeof url === 'string' && url.length > 0) as string[];
      }
    } catch {}
  }

  // Split by comma or newline
  const urls = value
    .split(/[,;\n]/)
    .map(u => u.trim())
    .filter(u => u.length > 0 && (u.startsWith('http') || u.startsWith('/api/')));

  return urls;
}

/**
 * Auto-detect column type based on cell values
 * Returns the most appropriate ColumnType for the given sample values
 */
export function detectColumnType(sampleValues: string[]): import('@/types').ColumnType {
  if (sampleValues.length === 0) return 'TEXT';
  
  let imageCount = 0;
  let numberCount = 0;
  let currencyCount = 0;
  let urlCount = 0;
  let booleanCount = 0;
  
  const currencySymbols = ['€', '$', '£', 'MAD', 'DH', 'درهم', 'د.م'];
  const booleanValues = ['oui', 'non', 'yes', 'no', 'true', 'false', 'vrai', 'faux', '1', '0'];
  
  for (const val of sampleValues) {
    if (!val) continue;
    const trimmed = val.trim().toLowerCase();
    
    // Check for image URLs
    if (isImageUrl(trimmed)) {
      imageCount++;
      continue;
    }
    
    // Check for multiple images (IMAGE_ARRAY)
    const urls = parseImageUrls(val);
    if (urls.length > 1 && urls.every(u => isImageUrl(u))) {
      imageCount += 2; // Extra weight for array
      continue;
    }
    
    // Check for currency
    if (currencySymbols.some(s => trimmed.includes(s.toLowerCase()))) {
      currencyCount++;
      continue;
    }
    
    // Check for pure number
    const numVal = trimmed.replace(/[.,\s]/g, '');
    if (/^\d+$/.test(numVal) && !isNaN(Number(numVal))) {
      numberCount++;
      continue;
    }
    
    // Check for URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      urlCount++;
      continue;
    }
    
    // Check for boolean
    if (booleanValues.includes(trimmed)) {
      booleanCount++;
      continue;
    }
  }
  
  const total = sampleValues.filter(v => v).length;
  const threshold = total * 0.5; // 50% of values should match
  
  // Check if multiple images per cell (IMAGE_ARRAY)
  const hasMultipleImages = sampleValues.some(v => {
    const urls = parseImageUrls(v);
    return urls.length > 1 && urls.every(u => isImageUrl(u));
  });
  
  if (hasMultipleImages) return 'IMAGE_ARRAY';
  if (imageCount >= threshold) return 'IMAGE';
  if (currencyCount >= threshold) return 'CURRENCY';
  if (numberCount >= threshold) return 'NUMBER';
  if (booleanCount >= threshold) return 'BOOLEAN';
  if (urlCount >= threshold) return 'URL';
  
  return 'TEXT';
}

/**
 * Find which columns in a dataset are image columns
 */
export function detectImageColumns(
  headers: string[],
  rows: string[][]
): { imageColumns: string[]; columnTypes: import('@/types').ColumnType[] } {
  const columnTypes: import('@/types').ColumnType[] = [];
  const imageColumns: string[] = [];
  
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const sampleValues = rows.slice(0, 20).map(row => row[colIdx] || '').filter(Boolean);
    const detectedType = detectColumnType(sampleValues);
    columnTypes.push(detectedType);
    
    if (detectedType === 'IMAGE' || detectedType === 'IMAGE_ARRAY') {
      imageColumns.push(headers[colIdx]);
    }
  }
  
  return { imageColumns, columnTypes };
}
