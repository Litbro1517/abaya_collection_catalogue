/**
 * Centralized media URL utilities (VG33 / Pillar 1).
 *
 * Replaces the duplicated `resolveDirectImageUrl` / `resolveProxyImageUrl`
 * functions that existed in both CatalogPreview.tsx and ProductPage.tsx.
 *
 * Provides:
 * - DRIVE_FILE_ID_REGEX: universal Google Drive file_id extractor.
 * - detectImageSource(url): 'drive' | 'cdn' | 'unknown'.
 * - extractDriveFileId(url): string | null.
 * - resolveHybridImageUrl(url, size): unified resolver (Drive → CDN URL or
 *   passthrough for CDN/local URLs).
 * - resolveProxyUrl(url, size): Drive → /api/google/image-proxy (fallback).
 *
 * The hybrid architecture reads both Drive links (lh3.googleusercontent.com)
 * and CDN links (Supabase / local /uploads/) in parallel without requiring
 * a global conversion.
 */

// Universal regex: extracts the Google Drive file_id from any Drive URL format.
// Matches: drive.google.com/file/d/ID, /open?id=ID, /uc?id=ID,
// lh3.googleusercontent.com/d/ID, /api/google/image-proxy?id=ID
export const DRIVE_FILE_ID_REGEX = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^#]*id=)|lh3\.googleusercontent\.com\/d\/|\/api\/google\/image-proxy\?id=)([a-zA-Z0-9_-]+)/;

/**
 * Extract the Google Drive file_id from any Drive/proxy URL.
 * Returns null for CDN/local/unknown URLs.
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(DRIVE_FILE_ID_REGEX);
  return match ? match[1] : null;
}

export type ImageSource = 'drive' | 'cdn' | 'unknown';

/**
 * Detect the source of an image URL.
 * - 'drive': Google Drive URL (lh3.googleusercontent.com, drive.google.com, /api/google/image-proxy)
 * - 'cdn': Supabase CDN URL (supabase.co/storage) or local /uploads/ URL
 * - 'unknown': other URLs (passthrough)
 */
export function detectImageSource(url: string): ImageSource {
  if (!url) return 'unknown';
  if (extractDriveFileId(url)) return 'drive';
  if (
    url.includes('supabase.co/storage') ||
    url.includes('/uploads/') ||
    url.includes('supabase.co/object')
  ) {
    return 'cdn';
  }
  return 'unknown';
}

/**
 * Hybrid image URL resolver (Pillar 1).
 *
 * For Drive URLs: builds the direct CDN-style URL (lh3.googleusercontent.com/d/ID=w{size})
 * — ultra-fast, no CORS proxy needed, but subject to Drive quotas (429 on heavy load).
 *
 * For CDN/local URLs: passthrough (already fast and reliable).
 *
 * For unknown URLs: passthrough.
 *
 * Usage: <img src={resolveHybridImageUrl(rowData.image, 800)} />
 */
export function resolveHybridImageUrl(url: string, size = 1200): string {
  if (!url) return '';

  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
  }

  // CDN or unknown — passthrough
  return url;
}

/**
 * Proxy URL resolver — fallback for images that fail to load via direct CDN.
 * Routes Drive URLs through the /api/google/image-proxy endpoint (server-side fetch,
 * avoids 429 but slower). CDN/local URLs passthrough.
 */
export function resolveProxyUrl(url: string, size = 1200): string {
  if (!url) return '';

  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `/api/google/image-proxy?id=${fileId}&sz=${size}`;
  }

  // CDN or unknown — passthrough
  return url;
}

/**
 * Legacy alias for backward compatibility (matches the old resolveImageUrl name).
 */
export function resolveImageUrl(url: string, size = 1200): string {
  return resolveProxyUrl(url, size);
}

/**
 * Check if a URL points to a migrated CDN asset (Supabase or local /uploads/).
 * Used by the MediaLibrary to display the source badge.
 */
export function isCdnUrl(url: string): boolean {
  return detectImageSource(url) === 'cdn';
}

/**
 * Check if a URL points to a Google Drive image (direct or proxy).
 * Used by the MediaLibrary to display the source badge.
 */
export function isDriveUrl(url: string): boolean {
  return detectImageSource(url) === 'drive';
}
