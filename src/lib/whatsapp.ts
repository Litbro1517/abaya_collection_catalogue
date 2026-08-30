/**
 * WhatsApp link builder — shared utility
 *
 * Builds a wa.me deep-link with a pre-filled, dynamically composed message
 * that includes the selected product variant (color / size / quantity) and
 * the product image direct URL (for WhatsApp link previewers).
 *
 * Used by:
 *   - src/components/preview/ProductPage.tsx     (main CTA + mobile CTA)
 *   - src/components/preview/CatalogPreview.tsx  (catalog card CTA)
 *
 * Previously duplicated in both files — now centralized here so the template
 * stays in sync and placeholders are honoured consistently.
 */

import { parsePriceToNumber } from '@/lib/analytics';

export interface BuildWhatsappLinkOptions {
  /** WhatsApp phone number in international format, digits only (e.g. "212600000000"). */
  phone: string;
  /** Product title (already resolved from the row cell). */
  title: string;
  /** Product unit price (already resolved from the row cell). */
  price: string;
  /** Selected color name (null if none selected / no color variants). */
  color?: string | null;
  /** Selected size name (null if none selected / no size variants). */
  size?: string | null;
  /** Selected quantity (defaults to 1). */
  quantity?: number;
  /** Direct (public) product image URL — used by WhatsApp link preview. */
  imageUrl?: string;
  /** Legacy single-locale admin message (string). Kept for backward compatibility. */
  customMessage?: string;
  /** Multilingual admin messages keyed by locale: { fr: "...", en: "...", ar: "..." }. */
  conversionMessages?: Record<string, string> | null;
  /** Visitor's active locale ('fr' | 'en' | 'ar'). Used for Smart Logic resolution. */
  locale?: string;
  /** Flux type: 'A' = product validated (purchase), 'B' = general (clarification). Determines fallback greeting. */
  flux?: 'A' | 'B';
  /** i18n strings injected by the caller (so this file stays framework-agnostic). */
  labels: {
    greeting: string;       // e.g. "Bonjour, je souhaite commander :" (legacy default)
    greetingA: string;      // Flux A hardcoded greeting (purchase)
    greetingB: string;      // Flux B hardcoded greeting (clarification)
    priceLabel: string;     // e.g. "Prix"
    colorLabel: string;     // e.g. "Couleur"
    sizeLabel: string;      // e.g. "Taille"
    quantityLabel: string;  // e.g. "Quantité"
    totalLabel?: string;    // e.g. "Total" — optional, falls back to priceLabel
  };
}

/**
 * Replace placeholders in an admin-customized message template.
 * Supports: {product}, {color}, {size}, {quantity}, {price}, {image}.
 * Missing values become empty strings (the line is preserved as-is).
 */
function applyPlaceholders(template: string, opts: BuildWhatsappLinkOptions): string {
  const qty = opts.quantity && opts.quantity > 0 ? String(opts.quantity) : '1';
  return template
    .replace(/\{product\}/g, opts.title)
    .replace(/\{color\}/g, opts.color || '')
    .replace(/\{size\}/g, opts.size || '')
    .replace(/\{quantity\}/g, qty)
    .replace(/\{price\}/g, opts.price || '')
    .replace(/\{image\}/g, opts.imageUrl || '');
}

/**
 * Detect whether the admin's custom message template uses any of the
 * supported placeholders. If it does, we honour the template as-is
 * (placeholders get replaced). If it doesn't, the customMessage is
 * treated as a greeting only and the structured variant info is appended.
 */
function hasPlaceholders(template: string): boolean {
  return /\{(product|color|size|quantity|price|image)\}/.test(template);
}

/**
 * Build the structured message body: title, price, color, size, quantity, image.
 * Used as the suffix appended after a plain-text custom greeting.
 */
function buildStructuredBody(opts: BuildWhatsappLinkOptions): string {
  const qty = opts.quantity && opts.quantity > 0 ? opts.quantity : 1;
  const lines: string[] = [];

  // Product title (bold in WhatsApp)
  lines.push(`*${opts.title}*`);

  // Unit price
  if (opts.price) {
    lines.push(`${opts.labels.priceLabel} : ${opts.price}`);
  }

  // Selected color (only if a color is selected)
  if (opts.color) {
    lines.push(`${opts.labels.colorLabel} : ${opts.color}`);
  }

  // Selected size (only if a size is selected)
  if (opts.size) {
    lines.push(`${opts.labels.sizeLabel} : ${opts.size}`);
  }

  // Quantity (only shown when > 1)
  if (qty > 1) {
    lines.push(`${opts.labels.quantityLabel} : ${qty}`);
    // ━━ Fix: Total = unit price × quantity (only shown when qty > 1) ━━
    // Previously: only the unit price was shown, even for multi-quantity orders.
    // Now: also shows the computed total so the seller can verify the amount.
    if (opts.price) {
      const unitPrice = parsePriceToNumber(opts.price);
      if (unitPrice > 0) {
        const total = unitPrice * qty;
        const totalStr = formatLineAmount(total);
        // Reuse the priceLabel as the total label (contextually clear with qty shown above)
        lines.push(`${opts.labels.totalLabel || opts.labels.priceLabel} (${qty}×) : ${totalStr}`);
      }
    }
  }

  // Product image direct URL
  if (opts.imageUrl) {
    lines.push(opts.imageUrl);
  }

  return lines.join('\n');
}

/**
 * Smart Logic — resolve the greeting for the current visitor.
 *
 * Resolution order (STRICT — no French fallback for AR/EN visitors):
 *  1. Admin multilingual message for the visitor's locale (if filled)
 *  2. Hardcoded "passe-partout" in the visitor's locale (Flux A or B)
 *
 * If the admin filled a message for the visitor's locale AND it contains placeholders,
 * placeholders are replaced. Otherwise the message is used as-is (plain greeting).
 *
 * Note: `opts.customMessage` (legacy single-locale) is only used if the visitor's
 * locale is 'fr' AND no `conversionMessages.fr` exists — backward compatibility.
 */
function resolveGreeting(opts: BuildWhatsappLinkOptions): { text: string; hasPlaceholders: boolean } {
  const locale = opts.locale || 'fr';
  const flux = opts.flux || 'A';

  // 1. Admin multilingual message for this locale
  const adminMsg = opts.conversionMessages?.[locale];
  if (adminMsg && adminMsg.trim()) {
    return { text: adminMsg, hasPlaceholders: hasPlaceholders(adminMsg) };
  }

  // 2. Legacy customMessage — only for FR visitors (backward compat)
  if (locale === 'fr' && opts.customMessage && opts.customMessage.trim()) {
    return { text: opts.customMessage, hasPlaceholders: hasPlaceholders(opts.customMessage) };
  }

  // 3. Hardcoded "passe-partout" in the visitor's locale (NO FR fallback)
  const hardcoded = flux === 'A' ? opts.labels.greetingA : opts.labels.greetingB;
  return { text: hardcoded, hasPlaceholders: false };
}

/**
 * Build the final wa.me URL with the pre-filled, URL-encoded message.
 * Returns '#' if the phone number is missing or empty.
 *
 * Smart Logic composition:
 *  1. Resolve greeting via resolveGreeting() — admin multilingual or hardcoded.
 *  2. If the greeting contains placeholders → apply them (template used AS-IS).
 *  3. Otherwise → greeting + structured body (title, price, color, size, qty, image).
 */
export function buildWhatsappLink(opts: BuildWhatsappLinkOptions): string {
  const phone = (opts.phone || '').trim();
  if (!phone) return '#';

  const { text: greeting, hasPlaceholders: greetingHasPlaceholders } = resolveGreeting(opts);

  let message: string;
  if (greetingHasPlaceholders) {
    // Admin template with placeholders — honour it fully
    message = applyPlaceholders(greeting, opts);
  } else {
    // Plain greeting + structured body
    message = `${greeting}\n${buildStructuredBody(opts)}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// ═══════════════════════════════════════════════════════════════════════
// Lot 3 — Multi-product WhatsApp link builder
// ═══════════════════════════════════════════════════════════════════════
// Problem (audit): when the COD API fails, the WhatsApp fallback used only
// the first cart item and summarized the rest as "(+N autres)" — losing the
// color/size/price details of the secondary items, which the seller needs
// to fulfill the order.
//
// Fix: buildMultiProductWhatsappLink() loops over ALL cart items and emits
// a structured line for each (title, color, size, quantity, unit price +
// line total), followed by a grand total line. No item is truncated.

export interface WhatsAppCartItem {
  title: string;
  price: string;        // unit price (formatted, e.g. "290 DH")
  color?: string | null;
  size?: string | null;
  quantity: number;
  imageUrl?: string;
}

export interface BuildMultiProductWhatsappLinkOptions {
  phone: string;
  items: WhatsAppCartItem[];
  /** Grand total formatted (e.g. "580 DH") — emitted as a Total line. */
  totalFormatted: string;
  /** Total quantity across all items (for the summary line). */
  totalQuantity: number;
  /** Legacy single-locale admin message. */
  customMessage?: string;
  /** Multilingual admin messages keyed by locale. */
  conversionMessages?: Record<string, string> | null;
  locale?: string;
  flux?: 'A' | 'B';
  labels: {
    greeting: string;
    greetingA: string;
    greetingB: string;
    priceLabel: string;
    colorLabel: string;
    sizeLabel: string;
    quantityLabel: string;
    totalLabel: string;       // e.g. "Total" / "المجموع" / "Total"
    itemsLabel: string;       // e.g. "Articles" / "المنتجات" / "Items"
    subtotalLabel: string;    // Audit remediation: e.g. "Sous-total" / "المجموع الفرعي" / "Subtotal"
  };
}

// ━━ Audit remediation: helper for WhatsApp subtotal formatting ━━
// Note: parsePriceToNumber (canonical price parser) is imported from @/lib/analytics.
// It correctly handles prices with thousand separators (spaces): "1 290,50 DH" → 1290.5.
// The previous local parseItemPrice used /[\d.,]+/ which stopped at the first space,
// returning 1 instead of 1290.5 for prices >= 1000 DH.

/**
 * Format a numeric amount with up to 2 decimal places (no trailing zeros).
 * Examples: 290 → "290", 290.5 → "290.5", 290.567 → "290.57"
 * Used for the subtotal line in the WhatsApp message body.
 */
function formatLineAmount(n: number): string {
  if (n === Math.floor(n)) return String(Math.floor(n));
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Build a multi-product WhatsApp wa.me link.
 *
 * Message structure:
 *   <greeting>
 *
 *   🛒 <itemsLabel> (<totalQuantity>)
 *   ━━━━━━━━━━━━━━━
 *   1. *<title>*
 *      Couleur : <color>
 *      Taille : <size>
 *      Quantité : <qty>
 *      Prix : <unitPrice> × <qty> = <lineTotal>
 *
 *   2. *<title>*
 *      ...
 *
 *   ━━━━━━━━━━━━━━━
 *   *Total : <totalFormatted>*
 *
 * Each item gets its own block with color/size/quantity/price. No truncation.
 */
export function buildMultiProductWhatsappLink(opts: BuildMultiProductWhatsappLinkOptions): string {
  const phone = (opts.phone || '').trim();
  if (!phone || opts.items.length === 0) return '#';

  // Resolve greeting (reuse the single-product Smart Logic)
  const singleOpts: BuildWhatsappLinkOptions = {
    phone: opts.phone,
    title: opts.items[0]?.title || '',
    price: opts.items[0]?.price || '',
    color: opts.items[0]?.color,
    size: opts.items[0]?.size,
    quantity: opts.totalQuantity,
    imageUrl: opts.items[0]?.imageUrl,
    customMessage: opts.customMessage,
    conversionMessages: opts.conversionMessages,
    locale: opts.locale,
    flux: opts.flux || 'A',
    labels: {
      greeting: opts.labels.greeting,
      greetingA: opts.labels.greetingA,
      greetingB: opts.labels.greetingB,
      priceLabel: opts.labels.priceLabel,
      colorLabel: opts.labels.colorLabel,
      sizeLabel: opts.labels.sizeLabel,
      quantityLabel: opts.labels.quantityLabel,
    },
  };
  const { text: greeting } = resolveGreeting(singleOpts);

  // Build the multi-product body
  const lines: string[] = [greeting, ''];

  // Items header
  lines.push(`🛒 ${opts.labels.itemsLabel} (${opts.totalQuantity})`);
  lines.push('━━━━━━━━━━━━━━━');

  // One block per item
  opts.items.forEach((item, idx) => {
    const qty = item.quantity > 0 ? item.quantity : 1;
    lines.push(`${idx + 1}. *${item.title}*`);
    if (item.color) {
      lines.push(`   ${opts.labels.colorLabel} : ${item.color}`);
    }
    if (item.size) {
      lines.push(`   ${opts.labels.sizeLabel} : ${item.size}`);
    }
    lines.push(`   ${opts.labels.quantityLabel} : ${qty}`);
    if (item.price) {
      // ━━ Audit remediation: per-line subtotal (unit price × quantity) ━━
      // Previously: only displayed the unit price, leaving the seller to mentally
      // multiply by quantity for each line. Now: shows both unit price AND
      // the computed subtotal, so the seller can verify the grand total at a glance.
      const unitPrice = parsePriceToNumber(item.price);
      const subtotal = unitPrice * qty;
      lines.push(`   ${opts.labels.priceLabel} : ${item.price}`);
      if (qty > 1 && subtotal > unitPrice) {
        lines.push(`   ${opts.labels.subtotalLabel} : ${unitPrice} × ${qty} = ${formatLineAmount(subtotal)}`);
      }
    }
    lines.push('');  // blank line between items
  });

  // Grand total
  lines.push('━━━━━━━━━━━━━━━');
  lines.push(`*${opts.labels.totalLabel} : ${opts.totalFormatted}*`);

  const message = lines.join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
