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
