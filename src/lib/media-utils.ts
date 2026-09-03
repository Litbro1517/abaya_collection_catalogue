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
 * - resolveHybridImageUrl(url, size): unified resolver — Drive → CDN URL,
 *   Supabase → render API (resize+webp), unknown → passthrough.
 * - resolveSupabaseRenderUrl(url, width, quality): Supabase render API URL
 *   builder (storage/v1/render/image/public/...?width=&quality=&format=webp).
 * - resolveProxyUrl(url, size): Drive → /api/google/image-proxy (fallback).
 *
 * MANDAT 4P — ÉTAPE 13 : OPTIMISATION LCP & IMAGES SUPABASE
 * ─────────────────────────────────────────────────────────
 * Audit ADF a mesuré (main @ 2c85464) :
 *   - LCP mobile 5,4s (objectif < 1,5s)
 *   - Poids par image 142-441 KiB (rendue 174×131 px → ratio ~7×)
 *   - srcSet factice : 3 descripteurs pointent vers la même URL HD d'origine
 *   - Aucun redimensionnement serveur — `size` ignoré pour les URLs Supabase
 *
 * Fix chirurgical (Piste B validée par audit) :
 *   1. Helper `resolveSupabaseRenderUrl(url, width, quality)` génère l'URL
 *      d'API de rendu Supabase (/storage/v1/render/image/public/...?width=400
 *      &quality=75&format=webp) — mesuré : 142 KiB → 52 KiB (-63%).
 *   2. `resolveHybridImageUrl` utilise ce helper pour les URLs Supabase →
 *      `srcSet` produit désormais 3 URLs RÉELLEMENT distinctes (400w/600w/800w).
 *   3. Le fallback `onError` conserve la passthrough originale : zéro rupture
 *      en cas d'échec de l'API render (quota, bucket privé, format non supporté).
 *   4. Drive URLs inchangées : `=w{size}` déjà optimal (Google frontend resize).
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

// ━━ MANDAT 4P ÉTAPE 13 — Regex Supabase Storage URL ━━
// Capture les 3 composantes d'une URL Supabase Storage publique :
//   - origin  : https://xxxx.supabase.co
//   - bucket  : images / product-images / etc.
//   - path    : sous-chemin + nom de fichier (peut contenir des slashes)
// Exemple : https://ldvbfsnqgulynwxqwzau.supabase.co/storage/v1/object/public/images/catalog/1By7Q7Sbhy8h.webp
//           → origin=https://ldvbfsnqgulynwxqwzau.supabase.co
//             bucket=images
//             path=catalog/1By7Q7Sbhy8h.webp
// Cette regex couvre à la fois /object/public/ et /render/image/public/.
const SUPABASE_STORAGE_REGEX =
  /^(https?:\/\/[^/]+\/storage\/v1\/(?:object|render\/image)\/public\/)([^/]+)\/(.+)$/;

/**
 * Détecte si une URL est une URL Supabase Storage publique (object ou render).
 * Utilisé par resolveSupabaseRenderUrl pour décider du rewrite.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false;
  return SUPABASE_STORAGE_REGEX.test(url);
}

/**
 * MANDAT 4P ÉTAPE 13 — Supabase Render API URL builder.
 *
 * Construit une URL d'API de rendu Supabase Storage qui redimensionne,
 * recompresse et convertit l'image côté serveur Supabase :
 *   /storage/v1/render/image/public/<bucket>/<path>?width=<w>&quality=<q>&format=webp
 *
 * Avantages mesurés (audit ADF, main @ 2c85464) :
 *   - 142 082 B → 52 170 B (width=400, quality=75, format=webp) = -63%
 *   - 441 906 B → 208 542 B (width=600, quality=75, format=webp) = -53%
 *   - Format WebP natif (meilleur que JPEG pour les photographies produit)
 *   - Cache CDN Supabase + Cloudflare (cf-cache-status: HIT en prod)
 *
 * Comportement :
 *   - URL Supabase Storage publique → rewrite en /render/image/public/...
 *   - URL déjà au format render → re-paramétrage (écrase width/quality/format)
 *   - URL non-Supabase (Drive, local, externe) → passthrough inchangé
 *
 * @param url URL d'origine (Supabase object/render, Drive, externe…)
 * @param width Largeur cible en pixels (défaut 400 — taille carte mobile)
 * @param quality Qualité 1-100 (défaut 75 — équilibre poids/visuel)
 * @returns URL optimisée ou passthrough si non-Supabase
 */
export type SupabaseResizeMode = 'cover' | 'contain';

export interface SupabaseRenderOptions {
  height?: number;
  mode?: SupabaseResizeMode;
}

export function resolveSupabaseRenderUrl(
  url: string,
  width = 400,
  quality = 75,
  options?: SupabaseRenderOptions,
): string {
  if (!url) return '';

  const match = url.match(SUPABASE_STORAGE_REGEX);
  if (!match) {
    return url;
  }

  const [, base, bucket, path] = match;
  const renderBase = base.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  );

  const params: Record<string, string> = {
    width: String(width),
    quality: String(quality),
    format: 'webp',
  };

  if (options?.mode === 'contain') {
    params.resize = 'contain';
  } else if (options?.height && options.height > 0) {
    params.height = String(options.height);
  }

  const query = new URLSearchParams(params).toString();
  return `${renderBase}${bucket}/${path}?${query}`;
}

/**
 * Hybrid image URL resolver (Pillar 1 + MANDAT 4P ÉTAPE 13).
 *
 * For Drive URLs: builds the direct CDN-style URL (lh3.googleusercontent.com/d/ID=w{size})
 * — ultra-fast, no CORS proxy needed, but subject to Drive quotas (429 on heavy load).
 *
 * For Supabase URLs: builds the render API URL with width+quality+webp format
 * — measured -63% weight (142→52 KiB), preserves SSR markup byte-exact (only
 * the URL changes, the <img> attributes stay identical).
 *
 * For other URLs: passthrough (already fast and reliable).
 *
 * Usage: <img src={resolveHybridImageUrl(rowData.image, 400)} />
 *
 * @param url URL d'origine
 * @param size Largeur cible (défaut 1200 — historique, surcharge par 400/600/800 dans CatalogPreview)
 */
export function resolveHybridImageUrl(
  url: string,
  size = 1200,
  options?: SupabaseRenderOptions,
): string {
  if (!url) return '';

  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
  }

  if (isSupabaseStorageUrl(url)) {
    return resolveSupabaseRenderUrl(url, size, 75, options);
  }

  return url;
}

/**
 * Proxy URL resolver — fallback for images that fail to load via direct CDN.
 * Routes Drive URLs through the /api/google/image-proxy endpoint (server-side fetch,
 * avoids 429 but slower). CDN/local URLs passthrough.
 *
 * Note MANDAT 4P ÉTAPE 13 : pour les URLs Supabase, cette fonction renvoie
 * l'URL passthrough d'ORIGINE (non transformée par render API). C'est le filet
 * de sécurité ultime : si l'API render échoue (quota, format non supporté,
 * bucket privé), onError() tombe sur l'URL HD originale — dégradation douce
 * sans rupture visuelle (état pré-ÉTAPE 13 exact).
 */
export function resolveProxyUrl(url: string, size = 1200): string {
  if (!url) return '';

  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `/api/google/image-proxy?id=${fileId}&sz=${size}`;
  }

  // CDN or unknown — passthrough (URL ORIGINALE, non transformée — filet de sécurité)
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
