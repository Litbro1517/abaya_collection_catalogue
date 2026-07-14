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
 * Default message template — composed of greeting + product info.
 * Lines are filtered (empty optional lines are dropped) so the message
 * stays compact when color/size aren't selected.
 */
function buildDefaultMessage(opts: BuildWhatsappLinkOptions): string {
  const qty = opts.quantity && opts.quantity > 0 ? opts.quantity : 1;
  const lines: string[] = [];

  // 1. Greeting
  lines.push(opts.labels.greeting);

  // 2. Product title (bold in WhatsApp)
  lines.push(`*${opts.title}*`);

  // 3. Unit price
  if (opts.price) {
    lines.push(`${opts.labels.priceLabel} : ${opts.price}`);
  }

  // 4. Selected color (only if a color is selected)
  if (opts.color) {
    lines.push(`${opts.labels.colorLabel} : ${opts.color}`);
  }

  // 5. Selected size (only if a size is selected)
  if (opts.size) {
    lines.push(`${opts.labels.sizeLabel} : ${opts.size}`);
  }

  // 6. Quantity (only shown when > 1, to keep messages concise for single-unit orders)
  if (qty > 1) {
    lines.push(`${opts.labels.quantityLabel} : ${qty}`);
  }

  // 7. Product image direct URL (public, so WhatsApp can generate a link preview)
  if (opts.imageUrl) {
    lines.push(opts.imageUrl);
  }

  return lines.join('\n');
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
 * Build the final wa.me URL with the pre-filled, URL-encoded message.
 * Returns '#' if the phone number is missing or empty.
 */
export function buildWhatsappLink(opts: BuildWhatsappLinkOptions): string {
  const phone = (opts.phone || '').trim();
  if (!phone) return '#';

  const message = opts.customMessage
    ? applyPlaceholders(opts.customMessage, opts)
    : buildDefaultMessage(opts);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
