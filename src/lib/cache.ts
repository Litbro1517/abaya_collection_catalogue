// ━━━ Offline-First Cache Utility ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Centralizes all localStorage cache logic:
// - FROZEN MODE: cache never auto-expires — only invalidated by explicit admin action
// - Per-key timestamps (no global timestamp — prevents false stale detection)
// - Size guard (never exceed ~4MB per write)
// - Data sanitization (strip Prisma metadata before caching)
// - Cache-first read, zero speculation
//
// Architecture Decision: FROZEN_MODE = true means cache NEVER expires by TTL.
// isCacheStale() returns false when data exists (no auto-revalidation).
// Cache is only invalidated by:
//   1. clearAllCache() — admin clicks "Force Refresh"
//   2. No data at all — first visit must still fetch from network

// ── Cache Key Registry ──────────────────────────────────────────────────
export const CACHE_KEYS = {
  catalog:     'abaya_cache_catalog',
  datasources: 'abaya_cache_datasources',
  sections:    'abaya_cache_sections',
  categories:  'abaya_cache_categories',
  colormap:    'abaya_cache_colormap',
} as const;

// ── Per-Key TTL Configuration ───────────────────────────────────────────
// Dynamic data (admin-modifiable) = short TTL → always revalidated quickly
// Static structures (rarely change) = long TTL → skip network for 30 min
const TTL_BY_KEY: Record<CacheKey, number> = {
  [CACHE_KEYS.catalog]:     2 * 60 * 1000,   //  2 min — products, settings: admin-modifiable
  [CACHE_KEYS.sections]:    2 * 60 * 1000,   //  2 min — product rows: admin-modifiable
  [CACHE_KEYS.datasources]: 5 * 60 * 1000,   //  5 min — data source list: semi-static
  [CACHE_KEYS.categories]:  30 * 60 * 1000,  // 30 min — category structure: rarely changes
  [CACHE_KEYS.colormap]:    30 * 60 * 1000,  // 30 min — color map: rarely changes
};

// ── Max size per write: 4MB (localStorage limit ~5MB per origin) ───────
const MAX_CACHE_SIZE = 4_000_000;

// ── Type helpers ────────────────────────────────────────────────────────
type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

// ── Per-Key Timestamp Helper ────────────────────────────────────────────
// Each cache key gets its own timestamp: `${key}_ts`
// This prevents cross-key desynchronization (Bug #2 from audit)
function getTimestampKey(key: CacheKey): string {
  return `${key}_ts`;
}

// ── Core read/write ─────────────────────────────────────────────────────

/**
 * Read cached data. ALWAYS returns data if available (offline-first principle).
 * Returns null only if the key doesn't exist or data is malformed.
 * Staleness is NOT checked here — use isCacheStale(key) at call sites.
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
 * Check if a SPECIFIC cache key is stale (older than its per-key TTL).
 * Each key has its own TTL and its own timestamp — no cross-key interference.
 *
 * Usage pattern:
 *   if (isCacheStale(CACHE_KEYS.categories)) {
 *     // Categories cache is old → trigger background network sync
 *     fetchCategories().then(updateCache);
 *   }
 *   // else: cache is fresh → skip network entirely → 0ms latency
 */
// ── FROZEN MODE ──────────────────────────────────────────────────────────
// When active, cache NEVER auto-expires by TTL.
// Only invalidation triggers: clearAllCache() (admin Force Refresh) or no data at all.
// This eliminates all "silent sync" background fetches that fire on TTL expiry.
const FROZEN_MODE = true;

export function isCacheStale(key: CacheKey): boolean {
  if (typeof window === 'undefined') return true;

  // ━━━ FROZEN MODE: cache never auto-expires ━━━
  // If data exists in localStorage → always "fresh" (no TTL check)
  // If no data exists → still "stale" (must fetch on first visit)
  if (FROZEN_MODE) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return true; // No data → must fetch
      return false; // Has data → never stale (admin must explicitly invalidate)
    } catch {
      return true;
    }
  }

  // ── Standard TTL-based staleness (unused when FROZEN_MODE is on) ──
  try {
    const ts = localStorage.getItem(getTimestampKey(key));
    if (!ts) return true;
    const ttl = TTL_BY_KEY[key] ?? 5 * 60 * 1000; // fallback: 5 min
    return Date.now() - parseInt(ts) > ttl;
  } catch {
    return true;
  }
}

/**
 * Convenience: inverse of isCacheStale(key).
 * When true, the cached data for this key is fresh and NO network fetch is needed.
 */
export function isCacheFresh(key: CacheKey): boolean {
  return !isCacheStale(key);
}

/**
 * Write data to cache with a PER-KEY timestamp.
 * Skips write if serialized size exceeds MAX_CACHE_SIZE.
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
    // Per-key timestamp — each key tracks its own freshness independently
    localStorage.setItem(getTimestampKey(key), String(Date.now()));
  } catch (e) {
    console.warn(`[cache] Write failed for ${key}:`, e);
  }
}

/**
 * Clear ALL abaya_cache_* keys AND their per-key timestamps from localStorage.
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return;
  try {
    // Remove data keys
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
    // Remove per-key timestamps
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(`${k}_ts`));
    // Also remove legacy global timestamp if it exists (migration cleanup)
    localStorage.removeItem('abaya_cache_ts');
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
