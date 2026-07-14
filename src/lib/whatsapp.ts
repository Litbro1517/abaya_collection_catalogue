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
  /** Optional admin-customized message template. Placeholders supported:
   *  {product}, {color}, {size}, {quantity}, {price}, {image} */
  customMessage?: string;
  /** i18n strings injected by the caller (so this file stays framework-agnostic). */
  labels: {
    greeting: string;       // e.g. "Bonjour, je souhaite commander :"
    priceLabel: string;     // e.g. "Prix"
    colorLabel: string;     // e.g. "Couleur"
    sizeLabel: string;      // e.g. "Taille"
    quantityLabel: string;  // e.g. "Quantité"
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
  }

  // Product image direct URL
  if (opts.imageUrl) {
    lines.push(opts.imageUrl);
  }

  return lines.join('\n');
}

/**
 * Build the final wa.me URL with the pre-filled, URL-encoded message.
 * Returns '#' if the phone number is missing or empty.
 *
 * Message composition logic:
 *  1. If customMessage contains placeholders ({product}, {color}, …):
 *     → applyPlaceholders replaces them; the template is used AS-IS.
 *  2. If customMessage is plain text (no placeholders):
 *     → it's used as a greeting, and the structured variant info
 *       (title, price, color, size, quantity, image) is APPENDED.
 *  3. If no customMessage:
 *     → the default greeting (opts.labels.greeting) is used, followed
 *       by the structured variant info.
 */
export function buildWhatsappLink(opts: BuildWhatsappLinkOptions): string {
  const phone = (opts.phone || '').trim();
  if (!phone) return '#';

  let message: string;

  if (opts.customMessage && hasPlaceholders(opts.customMessage)) {
    // Case 1: admin template with placeholders — honour it fully
    message = applyPlaceholders(opts.customMessage, opts);
  } else {
    // Case 2 & 3: plain greeting (custom or default) + structured body
    const greeting = opts.customMessage || opts.labels.greeting;
    message = `${greeting}\n${buildStructuredBody(opts)}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
