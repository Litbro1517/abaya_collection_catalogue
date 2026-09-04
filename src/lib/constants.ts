export const TAILLES_DISPONIBLES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Unique'
] as const;

export type Taille = typeof TAILLES_DISPONIBLES[number];

export const CANAUX: { value: string; label: string; color: string; icon: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: 'MessageCircle' },
  { value: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'Instagram' },
  { value: 'landing', label: 'Page produit', color: '#C9A84C', icon: 'ExternalLink' },
  { value: 'email', label: 'Email', color: '#1A1A1A', icon: 'Mail' },
];

export const MAX_CAROUSEL_IMAGES = 6;
export const PRODUCTS_PER_PAGE = 24;
// MANDAT 4P — RECTIFICATIONS AUDIT 360° (P2 hygiène secrets) : l'export mort
// ADMIN_PASSWORD = 'abayachic2024' (mot de passe admin en clair dans le code
// applicatif, zéro consommateur — l'auth réelle utilise passwordHash bcrypt
// en DB) a été SUPPRIMÉ. Rotation du mot de passe prod recommandée : la
// valeur a vécu en clair dans le repo (réserve D1 de l'audit DUEL + ce 4e
// site découvert lors du correctif).

export const COULEURS_DEFAULTS: Record<string, string> = {
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
 * Normalize a color name for lookup/comparison.
 * Case-insensitive, accent-insensitive, separator-normalized.
 *
 * Examples:
 *   "Noir, Blanc" → "noir, blanc"  (used for lookup key matching)
 *   "NOIR" → "noir"
 *   "Bleu-Nuit" → "bleu-nuit"     (hyphen preserved as ligature)
 *   "Noir ,  Blanc" → "noir ,  blanc"  (trim only outer whitespace)
 */
export function normalizeCouleurKey(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');  // Strip accents
}

/**
 * Format a price with a currency symbol.
 * @deprecated Use `useTranslation().formatPrice()` in React components instead.
 * This function is kept for non-React contexts (constants, API routes).
 */
export function formatPrice(price: number, currency: string = 'MAD'): string {
  const config = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.MAD;
  const formatted = price.toFixed(config.decimalDigits);
  if (config.position === 'before') {
    return `${config.symbol}${formatted}`;
  }
  return `${formatted} ${config.symbol}`;
}

// ── Currency symbol config for formatPrice ──
const CURRENCY_SYMBOLS: Record<string, { symbol: string; position: 'before' | 'after'; decimalDigits: number }> = {
  MAD: { symbol: 'MAD', position: 'after', decimalDigits: 0 },
  DH:  { symbol: 'DH',  position: 'after', decimalDigits: 0 },
  EUR: { symbol: '€',   position: 'before', decimalDigits: 2 },
  USD: { symbol: '$',   position: 'before', decimalDigits: 2 },
  GBP: { symbol: '£',   position: 'before', decimalDigits: 2 },
  DZD: { symbol: 'د.ج', position: 'after', decimalDigits: 2 },
  TND: { symbol: 'د.ت', position: 'after', decimalDigits: 3 },
  SAR: { symbol: 'ر.س', position: 'after', decimalDigits: 2 },
  AED: { symbol: 'د.إ', position: 'after', decimalDigits: 2 },
};

export function buildWhatsAppUrl(productNom: string, productPrix: number, phone: string = '212600000000', currency: string = 'MAD'): string {
  const priceStr = formatPrice(productPrix, currency);
  const message = `Bonjour, je souhaite commander :\n*${productNom}*\nPrix : ${priceStr}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildInstagramUrl(username: string = 'abayachiccollection'): string {
  return `https://instagram.com/${username}`;
}

export function buildEmailUrl(productNom: string, email: string = 'contact@abayachic.ma'): string {
  return `mailto:${email}?subject=${encodeURIComponent(`Commande : ${productNom}`)}`;
}
