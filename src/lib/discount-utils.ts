/**
 * Discount utilities — Native compare-at-price (DEBT-9)
 *
 * Architecture note:
 * Abaya Collection has NO `Product` model in Prisma — products are stored
 * dynamically in `Row.data` (JSON) via DataSource/Column/Row (3-pillar arch).
 *
 * The discount system uses the native slug `__compare_at_price__` stored in
 * Row.data, parallel to existing native slugs (__colors__, __statut__, etc.).
 *
 * If `__compare_at_price__` is defined AND > current price, the product is
 * considered discounted. The discount percentage is computed as:
 *
 *   percentage = Math.round((compareAtPrice - price) / compareAtPrice * 100)
 *
 * The compare-at-price is OPTIONAL — products without it behave normally
 * (no strike-through, no badge).
 */

export interface DiscountInfo {
  /** True if a valid discount is active (compareAtPrice > price > 0) */
  hasDiscount: boolean;
  /** Original price (struck through in UI). null if no discount. */
  compareAtPrice: number | null;
  /** Integer discount percentage 1-99. 0 if no discount. */
  percentage: number;
}

/**
 * Parse a price value that may be stored as a number, string, or formatted
 * string like "299 DH", "299.50", "1,299", "1 299,50 DH", etc.
 * Returns NaN if the value cannot be parsed.
 *
 * DEBT-9 repair : la fonction a été renforcée pour gérer :
 * - Les chaînes avec plusieurs groupes numériques (ex: "Prix: 299, ancien: 399")
 *   → on prend uniquement le PREMIER groupe numérique valide
 * - Les séparateurs de milliers espace + virgule décimale (format français) :
 *   "1 299,50 DH" → 1299.50
 * - Les séparateurs de milliers virgule + point décimal (format US) :
 *   "1,299.50 DH" → 1299.50
 * - Les valeurs nulles/vides/NaN → retourne NaN (pas de crash)
 * - Les booléens et autres types non-numériques → retourne NaN
 */
function parsePriceValue(value: unknown): number {
  // Guard : null/undefined → NaN
  if (value === null || value === undefined) return NaN;

  // Guard : booléens (typeof boolean ne doit pas être traité comme nombre)
  if (typeof value === 'boolean') return NaN;

  // Guard : nombre direct (mais vérifier qu'il est fini)
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  // Guard : doit être convertible en string
  if (typeof value !== 'string' && typeof value !== 'number') {
    return NaN;
  }

  const str = String(value).trim();
  if (!str) return NaN;

  // Extract the first numeric group (handles "299 DH", "1,299.50", "299.00 DH")
  // Si la chaîne contient "Prix: 299, ancien: 399", on capture "299" seulement
  // (le premier groupe [\d.,\s]+ contigu).
  const match = str.match(/[\d][\d.,\s]*[\d]/);
  if (!match) {
    // Fallback : un seul chiffre (ex: "5 DH")
    const singleDigit = str.match(/\d/);
    if (!singleDigit) return NaN;
    return parseFloat(singleDigit[0]);
  }

  let raw = match[0];

  // Détecter le format : français (1 299,50) vs US (1,299.50) vs simple (299.50 ou 299,50)
  // Si on a espace + virgule → format français (séparateur milliers = espace, décimale = virgule)
  if (raw.includes(' ') && raw.includes(',')) {
    raw = raw.replace(/\s/g, '').replace(',', '.');
  }
  // Si on a virgule + point → format US (séparateur milliers = virgule, décimale = point)
  else if (raw.includes(',') && raw.includes('.')) {
    raw = raw.replace(/,/g, '');
  }
  // Si on a juste virgule et 2 chiffres après → décimale française
  else if (/,\d{2}$/.test(raw)) {
    raw = raw.replace(',', '.');
  }
  // Sinon (juste virgule mais pas 2 chiffres après) → séparateur de milliers
  else if (raw.includes(',')) {
    raw = raw.replace(/,/g, '');
  }

  // Nettoyer : garder uniquement les chiffres et le point décimal
  const cleaned = raw.replace(/[^\d.]/g, '');

  // Sanity check : éviter les chaînes vides ou avec juste "."
  if (!cleaned || cleaned === '.') return NaN;

  const result = parseFloat(cleaned);
  return Number.isFinite(result) ? result : NaN;
}

/**
 * Compute discount information from a product row.
 *
 * @param price - Current price (raw cell value from Row.data)
 * @param compareAtPrice - Compare-at price (raw cell value from Row.data.__compare_at_price__)
 * @returns DiscountInfo with hasDiscount, compareAtPrice, percentage
 */
export function computeDiscount(
  price: unknown,
  compareAtPrice: unknown,
): DiscountInfo {
  const currentPrice = parsePriceValue(price);
  const originalPrice = parsePriceValue(compareAtPrice);

  // No discount if either price is invalid
  if (isNaN(currentPrice) || isNaN(originalPrice)) {
    return { hasDiscount: false, compareAtPrice: null, percentage: 0 };
  }

  // No discount if current price is 0 or negative
  if (currentPrice <= 0) {
    return { hasDiscount: false, compareAtPrice: null, percentage: 0 };
  }

  // No discount if compare-at-price is not greater than current price
  if (originalPrice <= currentPrice) {
    return { hasDiscount: false, compareAtPrice: null, percentage: 0 };
  }

  // Compute integer percentage (rounded, no decimals)
  const percentage = Math.round(
    ((originalPrice - currentPrice) / originalPrice) * 100,
  );

  // Sanity check: percentage must be 1-99 (avoid 0% or 100%+ edge cases)
  if (percentage < 1 || percentage > 99) {
    return { hasDiscount: false, compareAtPrice: null, percentage: 0 };
  }

  return {
    hasDiscount: true,
    compareAtPrice: originalPrice,
    percentage,
  };
}

/**
 * Get the compare-at-price value from a Row.data object.
 * Reads the native slug `__compare_at_price__`.
 *
 * @param rowData - The Row.data JSON object
 * @returns The raw value (string/number) or undefined if not set
 */
export function getCompareAtPrice(rowData: Record<string, unknown> | null | undefined): unknown {
  if (!rowData) return undefined;
  return rowData.__compare_at_price__;
}
