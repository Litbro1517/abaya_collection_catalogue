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
export const ADMIN_PASSWORD = 'abayachic2024';

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

export function formatPrice(price: number): string {
  return `${price.toFixed(0)} DH`;
}

export function buildWhatsAppUrl(productNom: string, productPrix: number, phone: string = '212600000000'): string {
  const message = `Bonjour, je souhaite commander :\n*${productNom}*\nPrix : ${productPrix} DH`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildInstagramUrl(username: string = 'abayachiccollection'): string {
  return `https://instagram.com/${username}`;
}

export function buildEmailUrl(productNom: string, email: string = 'contact@abayachic.ma'): string {
  return `mailto:${email}?subject=${encodeURIComponent(`Commande : ${productNom}`)}`;
}
