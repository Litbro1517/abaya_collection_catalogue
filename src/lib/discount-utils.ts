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
 * string like "299 DH", "299.50", "1,299", etc.
 * Returns NaN if the value cannot be parsed.
 */
function parsePriceValue(value: unknown): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  if (!str) return NaN;
  // Extract the first numeric group (handles "299 DH", "1,299.50", "299.00 DH")
  const match = str.match(/[\d.,]+/);
  if (!match) return NaN;
  // Normalize: remove thousands separators, keep decimal point
  const cleaned = match[0]
    .replace(/\s/g, '')
    .replace(/,(?=\d{2}$)/, '.')  // "299,50" → "299.50" (French decimal)
    .replace(/[^\d.]/g, '');       // keep digits and dots only
  return parseFloat(cleaned);
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
