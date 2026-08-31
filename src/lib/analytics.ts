/**
 * Lot 1 — DataLayer Analytics Helper (GA4 / Meta Pixel compatible)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Centralized, type-safe, SSR-guarded helper for pushing e-commerce events
 * to the GTM dataLayer. All call sites use this helper — including
 * merci/page.tsx `purchase` event (integrated in MANDAT 4P to guarantee
 * `window.dataLayer` initialization before the push).
 *
 * Pattern (Zaraz + GA4 compatible):
 *   pushDataLayer({ event: 'view_item', ecommerce: { currency, value, items } })
 *
 * Safety guarantees:
 *   - SSR guard: no-op on server (typeof window === 'undefined')
 *   - Initializes window.dataLayer = [] if missing (GTM snippet normally does
 *     this, but we stay resilient if GTM is not yet loaded or the placeholder
 *     GTM-XXXXXXX is still in place)
 *   - Never throws: wrapped in try/catch so a tracking bug can NEVER break the
 *     checkout flow or any user interaction
 *   - Strips undefined values from items[] so the payload stays clean
 */

export interface EcommerceItem {
  item_id: string;
  item_name: string;
  price?: number | string;
  quantity?: number;
  item_category?: string;
  item_variant?: string;
  item_size?: string;
  sku?: string;
  [key: string]: unknown;
}

export interface DataLayerEvent {
  event: string;
  ecommerce?: {
    currency?: string;
    value?: number;
    transaction_id?: string;
    items?: EcommerceItem[];
    [key: string]: unknown;
  };
  // Flat fields for Meta Pixel compatibility (merci/page.tsx precedent)
  value?: number;
  currency?: string;
  transaction_id?: string;
  order_id?: string;
  [key: string]: unknown;
}

/**
 * Push an event to the GTM dataLayer. Safe to call from client components.
 * No-op on the server, never throws.
 */
export function pushDataLayer(event: DataLayerEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    if (!Array.isArray(w.dataLayer)) {
      w.dataLayer = [];
    }
    w.dataLayer.push(event);
  } catch {
    // Swallow — tracking must never break UX
  }
}

/**
 * Parse a numeric price from a possibly-formatted string.
 * Handles formats: "290.00 DH", "290 DH", "1 290,50", "290.00", "290".
 * Returns 0 if unparseable.
 *
 * Used to normalize product.price (which comes from a free-form column cell)
 * into the numeric `value` field expected by GA4.
 */
export function parsePriceToNumber(price: unknown): number {
  if (typeof price === 'number' && isFinite(price)) return price;
  if (typeof price !== 'string' || !price) return 0;
  const match = price.match(/[\d\s.,]+/);
  if (!match) return 0;
  // Remove spaces (thousand separators), then handle comma decimal (fr-FR)
  const cleaned = match[0].replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

/**
 * Build a single GA4 ecommerce item from a product payload.
 * Strips undefined fields for a clean payload.
 */
export function buildEcommerceItem(item: {
  id?: string;
  name?: string;
  price?: unknown;
  category?: string;
  variant?: string;
  size?: string;
  quantity?: number;
  sku?: string;
}): EcommerceItem {
  const out: EcommerceItem = {
    item_id: item.id || 'unknown',
    item_name: item.name || 'Unknown',
  };
  const priceNum = parsePriceToNumber(item.price);
  if (priceNum > 0) out.price = priceNum;
  if (item.category) out.item_category = item.category;
  if (item.variant) out.item_variant = item.variant;
  if (item.size) out.item_size = item.size;
  if (item.sku) out.sku = item.sku;
  if (item.quantity && item.quantity > 0) out.quantity = item.quantity;
  return out;
}
