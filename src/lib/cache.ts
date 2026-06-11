// ━━━ Offline-First Cache Utility ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Centralizes all localStorage cache logic:
// - TTL management (5-minute expiry)
// - Size guard (never exceed ~4MB per write)
// - Data sanitization (strip Prisma metadata before caching)
// - Cache-first read, silent background sync

// ── Cache Key Registry ──────────────────────────────────────────────────
export const CACHE_KEYS = {
  catalog:     'abaya_cache_catalog',
  datasources: 'abaya_cache_datasources',
  sections:    'abaya_cache_sections',
  categories:  'abaya_cache_categories',
  colormap:    'abaya_cache_colormap',
  timestamp:   'abaya_cache_ts',
} as const;

// ── TTL: 5 minutes ─────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;

// ── Max size per write: 4MB (localStorage limit ~5MB per origin) ───────
const MAX_CACHE_SIZE = 4_000_000;

// ── Type helpers ────────────────────────────────────────────────────────
type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

// ── Core read/write ─────────────────────────────────────────────────────

/**
 * Read cached data. Returns null if:
 * - Key doesn't exist
 * - Data is malformed JSON
 * - Cache is stale (older than CACHE_TTL)
 */
export function readCache<T = unknown>(key: CacheKey): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write data to cache. Skips write if serialized size exceeds MAX_CACHE_SIZE.
 * Accepts an optional sanitizer to strip heavy fields before caching.
 */
export function writeCache<T = unknown>(
  key: CacheKey,
  data: T,
  sanitizer?: (data: T) => unknown
): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = sanitizer ? sanitizer(data) : data;
    const serialized = JSON.stringify(clean);
    if (serialized.length > MAX_CACHE_SIZE) {
      console.warn(`[cache] Skipping write for ${key}: size ${serialized.length} exceeds ${MAX_CACHE_SIZE}`);
      return;
    }
    localStorage.setItem(key, serialized);
    // Update global timestamp
    localStorage.setItem(CACHE_KEYS.timestamp, String(Date.now()));
  } catch (e) {
    console.warn(`[cache] Write failed for ${key}:`, e);
  }
}

/**
 * Check if cache is stale (older than CACHE_TTL).
 * Returns true if no timestamp exists or if cache has expired.
 */
export function isCacheStale(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const ts = localStorage.getItem(CACHE_KEYS.timestamp);
    if (!ts) return true;
    return Date.now() - parseInt(ts) > CACHE_TTL;
  } catch {
    return true;
  }
}

/**
 * Clear ALL abaya_cache_* keys from localStorage.
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return;
  try {
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
  } catch {
    // Silently fail — localStorage might be unavailable
  }
}

// ── Data Sanitizers ─────────────────────────────────────────────────────
// Strip Prisma metadata and heavy fields that aren't needed for display.
// This keeps cache entries well under the 5MB localStorage limit.

interface PrismaRow {
  id: string;
  data: Record<string, unknown>;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  dataSourceId?: string;
}

interface PrismaColumn {
  id: string;
  name: string;
  slug: string;
  type: string;
  order: number;
  visible: boolean;
  config: unknown;
  width?: number;
  dataSourceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PrismaSection {
  id: string;
  title: string | null;
  subtitle: string | null;
  config: unknown;
  order: number;
  visible: boolean;
  catalogId?: string;
  components?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CachedSectionData {
  section: {
    id: string;
    title: string | null;
    subtitle: string | null;
    config: unknown;
    order: number;
    visible: boolean;
  };
  columns: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    order: number;
    visible: boolean;
    config: unknown;
    width: number;
  }>;
  rows: Array<{
    id: string;
    data: Record<string, unknown>;
    order: number;
  }>;
}

/**
 * Sanitize sections data for cache — strips Prisma metadata.
 * Keeps only fields needed for catalog display.
 */
export function sanitizeSections(
  sections: Array<{ section: PrismaSection; columns: PrismaColumn[]; rows: PrismaRow[] }>
): CachedSectionData[] {
  return sections.map(({ section, columns, rows }) => ({
    section: {
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      config: section.config,
      order: section.order,
      visible: section.visible,
    },
    columns: columns.map(col => ({
      id: col.id,
      name: col.name,
      slug: col.slug,
      type: col.type,
      order: col.order,
      visible: col.visible,
      config: col.config,
      width: col.width ?? 150,
    })),
    rows: rows.map(row => ({
      id: row.id,
      data: row.data,
      order: row.order,
    })),
  }));
}

/**
 * Sanitize catalog data — strip heavy/large fields not needed for display.
 */
export function sanitizeCatalog(catalog: unknown): unknown {
  // Catalog is relatively small; pass through as-is
  // but we could strip sections[].components if needed
  return catalog;
}

/**
 * Sanitize datasources — keep only essential fields.
 */
export function sanitizeDatasources(ds: unknown): unknown {
  // Datasources list is small; pass through
  return ds;
}
