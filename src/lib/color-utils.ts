// ─── Color Name Normalization & Utilities ─────────────────────────────
// Shared across ColorMap API routes (CRUD, import, lookup)
// Rules: trim, collapse spaces, Title Case, hyphen is a ligature (not separator)
// ──────────────────────────────────────────────────────────────────────

/**
 * Normalize a raw color name to Title Case.
 *
 * Examples:
 *   "bleu-nuit"   → "Bleu-Nuit"
 *   "  bleu  nuit " → "Bleu Nuit"
 *   "ROUGE FONCE" → "Rouge Foncé" (accent preservation via original input)
 *   "vert,bleu"   → "Vert Bleu"   (comma is a separator for mass import)
 *
 * Rules:
 *   1. Trim leading/trailing whitespace
 *   2. Collapse multiple spaces to single space
 *   3. Hyphen "-" is a LIGATURE (part of the word, NOT a separator)
 *   4. Comma and space are the only valid separators
 *   5. First letter of each word uppercase, rest lowercase
 */
export function normalizeColorName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .replace(/-/g, '§HYPHEN§')      // Protect hyphens (ligature)
    .split(/[\s,]+/)                 // Split on spaces/commas
    .filter(Boolean)
    .map(word => word.replace(/§HYPHEN§/g, '-'))  // Restore hyphens
    .map(word =>
      // Title-case each hyphenated part within the word
      // e.g. "bleu-nuit" → "Bleu-Nuit"
      word.split('-').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('-')
    )
    .join(' ');
}

/**
 * Generate a slug from a normalized color name.
 *
 * Examples:
 *   "Bleu-Nuit" → "bleu-nuit"
 *   "Rouge Foncé" → "rouge-fonce"
 *
 * Rules:
 *   1. NFD normalization then strip combining marks (remove accents)
 *   2. Lowercase
 *   3. Replace non-alphanumeric (except hyphens) with hyphens
 *   4. Strip leading/trailing hyphens
 */
export function generateColorSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse a comma/semicolon-separated list of color names.
 * Used for mass import and lookup endpoints.
 */
export function parseColorList(raw: string): string[] {
  return raw
    .trim()
    .split(/[,;]|\s{2,}/)  // Split on comma/semicolon OR 2+ spaces
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Client-side color key normalization.
 * Lowercase + strip accents + trim.
 * Used for color name → hex lookup matching.
 */
export function normalizeCouleurKey(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Default color fallback map (used when ColorMap DB doesn't have a match).
 * Kept in sync with src/lib/constants.ts COULEURS_DEFAULTS.
 */
const COULEURS_DEFAULTS: Record<string, string> = {
  'noir': '#000000',
  'blanc': '#FFFFFF',
  'gris': '#808080',
  'beige': '#F5F0E8',
  'caramel': '#C9A84C',
  'marron': '#8B4513',
  'bleu': '#1565C0',
  'rouge': '#D32F2F',
  'rose': '#F48FB1',
  'vert': '#2E7D32',
  'bordeaux': '#800020',
  'creme': '#FFFDD0',
  'abricot': '#FBCEB1',
  'taupe': '#483C32',
  'marine': '#1A237E',
  'lavande': '#9575CD',
  'moutarde': '#F9A825',
  'terracotta': '#C0644A',
  'turquoise': '#00897B',
  'chocolat': '#4E342E',
  'or': '#FFD600',
  'argent': '#9E9E9E',
};

/**
 * Resolve a color name to a hex code using multi-strategy lookup.
 * Case-insensitive, separator-tolerant, accent-insensitive.
 *
 * Strategies:
 *   1. Normalized key (lowercase + strip accents)
 *   2. Direct lowercase match
 *   3. Collapsed key (spaces/commas/semicolons removed)
 *   4. Per-word lookup for compound names (e.g., "Rose kachiri" → tries "rose")
 *   5. COULEURS_DEFAULTS fallback (normal + collapsed)
 *   6. Hex color passthrough
 *
 * @param colorName - Raw color name from product data
 * @param colorMap - Lookup map built from ColorMap API data
 * @returns Hex code string or null if not found
 */
export function resolveColorHex(colorName: string, colorMap: Record<string, string>): string | null {
  // Strategy 1: Normalize key (lowercase + strip accents)
  const key = normalizeCouleurKey(colorName);
  if (colorMap[key]) return colorMap[key];

  // Strategy 2: Direct lowercase match
  const lower = colorName.toLowerCase().trim();
  if (colorMap[lower]) return colorMap[lower];

  // Strategy 3: Collapsed key (spaces/commas/semicolons removed)
  const collapsedKey = key.replace(/[\s,;]+/g, '');
  if (colorMap[collapsedKey]) return colorMap[collapsedKey];

  // Strategy 4: Try each word individually (for compound names like "Rose kachiri")
  const words = colorName.trim().split(/[\s,;]+/).filter(Boolean);
  if (words.length > 1) {
    for (const word of words) {
      const wordKey = normalizeCouleurKey(word);
      if (colorMap[wordKey]) return colorMap[wordKey];
    }
  }

  // Strategy 5: Fallback to COULEURS_DEFAULTS
  if (COULEURS_DEFAULTS[key]) return COULEURS_DEFAULTS[key];
  if (COULEURS_DEFAULTS[collapsedKey]) return COULEURS_DEFAULTS[collapsedKey];
  // Try per-word in defaults too
  if (words.length > 1) {
    for (const word of words) {
      const wordKey = normalizeCouleurKey(word);
      if (COULEURS_DEFAULTS[wordKey]) return COULEURS_DEFAULTS[wordKey];
    }
  }

  // Strategy 6: Try if it's already a hex color
  if (/^#[0-9a-fA-F]{3,8}$/.test(colorName)) return colorName;

  return null;
}

/**
 * Build a robust ColorMap lookup from API data.
 * Stores by multiple keys for case/accent/separator-insensitive matching.
 *
 * @param data - Array of ColorMap items from /api/colormap
 * @returns Lookup map: various key forms → hex code
 */
export function buildColorLookupMap(data: Array<{ name: string; slug: string; hex: string; isActive?: boolean; visible?: boolean }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of data) {
    // Store by multiple keys for robust lookup
    map[c.name.toLowerCase()] = c.hex;
    map[c.slug] = c.hex;
    // Also store accent-stripped version
    const accentKey = normalizeCouleurKey(c.name);
    map[accentKey] = c.hex;
    // Store collapsed version (no spaces/commas)
    const collapsed = accentKey.replace(/[\s,;]+/g, '');
    if (collapsed !== accentKey) map[collapsed] = c.hex;
  }
  return map;
}

/**
 * Validate a hex color code.
 * Accepts formats: #RGB, #RRGGBB, RGB, RRGGBB
 * Returns normalized format: #RRGGBB or null if invalid.
 */
export function validateAndNormalizeHex(hex: string): string | null {
  const cleaned = hex.trim().replace(/^#/, '');

  // #RGB → #RRGGBB
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned.split('').map(c => c + c).join('');
    return `#${expanded.toUpperCase()}`;
  }

  // #RRGGBB
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }

  return null;
}
