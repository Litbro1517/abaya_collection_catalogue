/**
 * Multilingual dictionaries — FR / EN / AR
 *
 * Keys are organized by component/context.
 * Each key maps to { fr, en, ar } strings.
 */

export type Locale = 'fr' | 'en' | 'ar';

export interface TranslationDict {
  [key: string]: string;
}

export const dictionaries: Record<Locale, TranslationDict> = {
  fr: {
    // ── General ──
    'catalog.loading': 'Chargement...',
    'catalog.search': 'Rechercher...',
    'catalog.all': 'Tout',
    'catalog.noProducts': 'Aucun produit trouvé',
    'catalog.preparing': 'Le catalogue est en cours de préparation. Revenez bientôt !',
    'catalog.adminLogin': 'Connexion admin',

    // ── Product Card ──
    'product.new': 'Nouveau',
    'product.featured': 'Vedette',
    'product.commander': 'Commander',
    'product.soldOut': 'Produit épuisé',
    'product.onOrder': 'Sur commande',
    'product.available': 'Disponible',

    // ── Product Page ──
    'product.description': 'Description',
    'product.colors': 'Couleurs',
    'product.sizes': 'Tailles',
    'product.quantity': 'Quantité',
    'product.share': 'Partager',
    'product.favorite': 'Favori',
    'product.linkCopied': 'Lien copié !',
    'product.commanderWhatsApp': 'Commander via WhatsApp',

    // ── Contact Channels ──
    'contact.whatsapp': 'Commander via WhatsApp',
    'contact.instagram': 'Commander via Instagram',
    'contact.email': 'Commander par email',
    'contact.landing': 'Voir la page produit',

    // ── WhatsApp Message ──
    'whatsapp.message': 'Bonjour, je souhaite commander :',

    // ── Filters ──
    'filter.all': 'Tous',

    // ── Footer ──
    'footer.rights': 'Tous droits réservés',

    // ── Status ──
    'status.courant': 'Courant',
    'status.nouveau': 'Nouveau',
    'status.epuise': 'Épuisé',
    'status.surCommande': 'Sur commande',
    'status.disponible': 'Disponible',
    'status.locked': 'Verrouillé',

    // ── Data Table ──
    'table.price': 'Prix',
    'table.currency': 'Valeur monétaire',

    // ── Settings ──
    'settings.language': 'Langue',
    'settings.currency': 'Devise',
    'settings.french': 'Français',
    'settings.english': 'English',
    'settings.arabic': 'العربية',

    // ── Column Types ──
    'colType.text': 'Texte',
    'colType.number': 'Nombre',
    'colType.currency': 'Prix',
    'colType.image': 'Image',
    'colType.gallery': 'Galerie',
    'colType.select': 'Sélection',
    'colType.multiSelect': 'Multi-sélection',
    'colType.boolean': 'Oui/Non',
    'colType.relation': 'Relation',
    'colType.array': 'Groupe',
    'colType.url': 'Lien',
    'colType.status': 'Statut',
    'colType.color': 'Couleur',

    // ── Product Form ──
    'form.newProduct': 'Nouveau produit',

    // ── Admin ──
    'admin.recharge': 'Recharger la page',
    'admin.error': 'Une erreur inattendue s\'est produite.',
  },

  en: {
    // ── General ──
    'catalog.loading': 'Loading...',
    'catalog.search': 'Search...',
    'catalog.all': 'All',
    'catalog.noProducts': 'No products found',
    'catalog.preparing': 'The catalog is being prepared. Check back soon!',
    'catalog.adminLogin': 'Admin login',

    // ── Product Card ──
    'product.new': 'New',
    'product.featured': 'Featured',
    'product.commander': 'Order',
    'product.soldOut': 'Sold out',
    'product.onOrder': 'On order',
    'product.available': 'Available',

    // ── Product Page ──
    'product.description': 'Description',
    'product.colors': 'Colors',
    'product.sizes': 'Sizes',
    'product.quantity': 'Quantity',
    'product.share': 'Share',
    'product.favorite': 'Favorite',
    'product.linkCopied': 'Link copied!',
    'product.commanderWhatsApp': 'Order via WhatsApp',

    // ── Contact Channels ──
    'contact.whatsapp': 'Order via WhatsApp',
    'contact.instagram': 'Order via Instagram',
    'contact.email': 'Order by email',
    'contact.landing': 'View product page',

    // ── WhatsApp Message ──
    'whatsapp.message': 'Hello, I would like to order:',

    // ── Filters ──
    'filter.all': 'All',

    // ── Footer ──
    'footer.rights': 'All rights reserved',

    // ── Status ──
    'status.courant': 'Current',
    'status.nouveau': 'New',
    'status.epuise': 'Sold out',
    'status.surCommande': 'On order',
    'status.disponible': 'Available',
    'status.locked': 'Locked',

    // ── Data Table ──
    'table.price': 'Price',
    'table.currency': 'Currency value',

    // ── Settings ──
    'settings.language': 'Language',
    'settings.currency': 'Currency',
    'settings.french': 'Français',
    'settings.english': 'English',
    'settings.arabic': 'العربية',

    // ── Column Types ──
    'colType.text': 'Text',
    'colType.number': 'Number',
    'colType.currency': 'Price',
    'colType.image': 'Image',
    'colType.gallery': 'Gallery',
    'colType.select': 'Select',
    'colType.multiSelect': 'Multi-select',
    'colType.boolean': 'Yes/No',
    'colType.relation': 'Relation',
    'colType.array': 'Group',
    'colType.url': 'Link',
    'colType.status': 'Status',
    'colType.color': 'Color',

    // ── Product Form ──
    'form.newProduct': 'New product',

    // ── Admin ──
    'admin.recharge': 'Reload page',
    'admin.error': 'An unexpected error occurred.',
  },

  ar: {
    // ── General ──
    'catalog.loading': '...جارٍ التحميل',
    'catalog.search': '...بحث',
    'catalog.all': 'الكل',
    'catalog.noProducts': 'لم يتم العثور على منتجات',
    'catalog.preparing': 'الكتالوج قيد الإعداد. عد قريبًا!',
    'catalog.adminLogin': 'تسجيل دخول المشرف',

    // ── Product Card ──
    'product.new': 'جديد',
    'product.featured': 'مميز',
    'product.commander': 'اطلب',
    'product.soldOut': 'نفذ المخزون',
    'product.onOrder': 'عند الطلب',
    'product.available': 'متوفر',

    // ── Product Page ──
    'product.description': 'الوصف',
    'product.colors': 'الألوان',
    'product.sizes': 'المقاسات',
    'product.quantity': 'الكمية',
    'product.share': 'مشاركة',
    'product.favorite': 'مفضل',
    'product.linkCopied': 'تم نسخ الرابط!',
    'product.commanderWhatsApp': 'اطلب عبر واتساب',

    // ── Contact Channels ──
    'contact.whatsapp': 'اطلب عبر واتساب',
    'contact.instagram': 'اطلب عبر إنستغرام',
    'contact.email': 'اطلب عبر البريد الإلكتروني',
    'contact.landing': 'عرض صفحة المنتج',

    // ── WhatsApp Message ──
    'whatsapp.message': 'مرحبًا، أرغب في الطلب:',

    // ── Filters ──
    'filter.all': 'الكل',

    // ── Footer ──
    'footer.rights': 'جميع الحقوق محفوظة',

    // ── Status ──
    'status.courant': 'جارٍ',
    'status.nouveau': 'جديد',
    'status.epuise': 'نفذ',
    'status.surCommande': 'عند الطلب',
    'status.disponible': 'متوفر',
    'status.locked': 'مقفل',

    // ── Data Table ──
    'table.price': 'السعر',
    'table.currency': 'قيمة العملة',

    // ── Settings ──
    'settings.language': 'اللغة',
    'settings.currency': 'العملة',
    'settings.french': 'الفرنسية',
    'settings.english': 'الإنجليزية',
    'settings.arabic': 'العربية',

    // ── Column Types ──
    'colType.text': 'نص',
    'colType.number': 'رقم',
    'colType.currency': 'السعر',
    'colType.image': 'صورة',
    'colType.gallery': 'معرض',
    'colType.select': 'اختيار',
    'colType.multiSelect': 'اختيار متعدد',
    'colType.boolean': 'نعم/لا',
    'colType.relation': 'علاقة',
    'colType.array': 'مجموعة',
    'colType.url': 'رابط',
    'colType.status': 'الحالة',
    'colType.color': 'لون',

    // ── Product Form ──
    'form.newProduct': 'منتج جديد',

    // ── Admin ──
    'admin.recharge': 'إعادة تحميل الصفحة',
    'admin.error': 'حدث خطأ غير متوقع.',
  },
};

/**
 * Get a translated string by key and locale.
 * Falls back to French if key not found in requested locale.
 */
export function t(key: string, locale: Locale = 'fr'): string {
  return dictionaries[locale]?.[key] || dictionaries.fr[key] || key;
}

/**
 * Check if a locale is RTL
 */
export function isRTL(locale: Locale): boolean {
  return locale === 'ar';
}

/**
 * Currency display config per currency code
 */
export interface CurrencyConfig {
  symbol: string;
  position: 'before' | 'after';
  decimalDigits: number;
  separator: string;
}

export const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  MAD: { symbol: 'MAD', position: 'after', decimalDigits: 0, separator: '.' },
  DH:  { symbol: 'DH',  position: 'after', decimalDigits: 0, separator: '.' },
  EUR: { symbol: '€',   position: 'before', decimalDigits: 2, separator: ',' },
  USD: { symbol: '$',   position: 'before', decimalDigits: 2, separator: '.' },
  GBP: { symbol: '£',   position: 'before', decimalDigits: 2, separator: '.' },
  DZD: { symbol: 'د.ج', position: 'after', decimalDigits: 2, separator: '.' },
  TND: { symbol: 'د.ت', position: 'after', decimalDigits: 3, separator: '.' },
  SAR: { symbol: 'ر.س', position: 'after', decimalDigits: 2, separator: '.' },
  AED: { symbol: 'د.إ', position: 'after', decimalDigits: 2, separator: '.' },
};

/**
 * Format a price with the given currency code.
 * Uses the CURRENCY_CONFIG for symbol position and decimal digits.
 */
export function formatPriceWithCurrency(
  price: number | string,
  currencyCode: string = 'MAD',
): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return String(price);

  const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.MAD;
  const formatted = num.toFixed(config.decimalDigits);

  if (config.position === 'before') {
    return `${config.symbol}${formatted}`;
  }
  return `${formatted} ${config.symbol}`;
}
