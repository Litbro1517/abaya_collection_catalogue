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
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
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
