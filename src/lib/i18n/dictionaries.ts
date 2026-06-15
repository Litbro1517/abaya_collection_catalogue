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

    // ── Catalog Extended ──
    'catalog.collection': 'Collection',
    'catalog.tryAnotherSearch': 'Essayez un autre terme de recherche',
    'catalog.addSections': 'Ajoutez des sections dans l\'onglet Mise en page',
    'catalog.viewProduct': 'Voir',

    // ── Product Extended ──
    'product.quickBuy': 'Achat Rapide',
    'product.whatsappOrder': 'Commander sur WhatsApp',
    'product.price': 'Prix',

    // ── Footer Extended ──
    'footer.email': 'E-mail',

    // ── Settings Tabs ──
    'settings.general': 'Général',
    'settings.appearance': 'Style',
    'settings.conversion': 'Partage',
    'settings.display': 'Affichage',
    'settings.admin': 'Admin',
    'settings.catalogue': 'Catalogue',
    'settings.colors': 'Couleurs',
    'settings.save': 'Sauvegarder',
    'settings.saved': 'Paramètres sauvegardés',
    'settings.saveError': 'Erreur de sauvegarde',
    'settings.logoLabel': 'Logo de la marque',
    'settings.logoHint': 'URL de l\'image — remplace le monogramme dans la barre de navigation et le pied de page',
    'settings.faviconLabel': 'Favicon',
    'settings.faviconHint': 'URL de l\'icône affichée dans l\'onglet du navigateur (32×32 recommandé)',
    'settings.logoPlaceholder': 'https://example.com/logo.png',
    'settings.faviconPlaceholder': 'https://example.com/favicon.ico',

    // ── Admin Extended ──
    'admin.confirmDelete': 'Êtes-vous sûr de vouloir supprimer ?',
    'admin.productsDeleted': 'produit(s) supprimé(s)',
    'admin.productsActivated': 'produit(s) activé(s)',
    'admin.linkCopied': 'Lien copié !',
    'admin.refresh': 'Rafraîchir',

    // ── Order ──
    'order.subject': 'Commande',

    // ── Order Form (COD) ──
    'order.title': 'Commander maintenant',
    'order.cod': 'Paiement à la livraison (COD)',
    'order.fullName': 'Nom complet',
    'order.fullNamePlaceholder': 'Votre nom complet',
    'order.phone': 'Téléphone',
    'order.phonePlaceholder': '06XXXXXXXX',
    'order.city': 'Ville',
    'order.cityPlaceholder': 'Votre ville',
    'order.address': 'Adresse de livraison',
    'order.addressPlaceholder': 'Adresse complète de livraison',
    'order.confirm': 'Confirmer la commande',
    'order.sending': 'Envoi en cours...',
    'order.sent': 'Commande envoyée !',
    'order.redirecting': 'Redirection en cours...',
    'order.secureData': '🔒 Vos données sont sécurisées · Paiement à la livraison',
    'order.errorName': 'Veuillez entrer votre nom complet.',
    'order.errorPhone': 'Veuillez entrer un numéro de téléphone valide.',
    'order.errorCity': 'Veuillez entrer votre ville.',
    'order.errorAddress': 'Veuillez entrer votre adresse de livraison.',
    'order.errorNetwork': 'Erreur réseau. Veuillez vérifier votre connexion et réessayer.',
    'order.errorGeneric': 'Erreur lors de la commande. Veuillez réessayer.',
    'order.required': '*',

    // ── Thank You Page ──
    'thanks.title': 'Commande confirmée !',
    'thanks.subtitle': 'Merci pour votre commande. Notre équipe vous contactera prochainement pour confirmer la livraison.',
    'thanks.orderLabel': 'Commande',
    'thanks.paymentMode': 'Mode de paiement',
    'thanks.paymentCOD': 'Paiement à la livraison',
    'thanks.status': 'Statut',
    'thanks.statusPending': 'En attente de confirmation',
    'thanks.backToCatalog': 'Retour au catalogue',
    'thanks.trackingNotice': 'Vous recevrez une confirmation par téléphone sous peu.',
    'thanks.loading': 'Chargement...',

    // ── Upload ──
    'upload.dragDrop': 'Glisser-déposer ou cliquer',
    'upload.clickOrDrop': 'Cliquez ou glissez un fichier ici',
    'upload.uploading': 'Téléversement en cours...',
    'upload.success': 'Fichier téléversé avec succès',
    'upload.error': 'Erreur lors du téléversement',
    'upload.remove': 'Supprimer',
    'upload.fileTooLarge': 'Fichier trop volumineux (max 2 Mo)',
    'upload.invalidType': 'Type de fichier non supporté',

    // ── Catalog Navigation ──
    'catalog.backToCatalog': 'Retour au catalogue',
    'catalog.back': 'Retour',
    'catalog.retry': 'Réessayer',

    // ── Admin Navigation (public catalog) ──
    'admin.clearCache': 'Vider le cache et recharger',
    'admin.backToDashboard': 'Retour au Dashboard',
    'admin.dashboard': 'Dashboard',

    // ── Product Page Extended ──
    'product.product': 'Produit',
    'product.previousImage': 'Image précédente',
    'product.nextImage': 'Image suivante',
    'product.details': 'Détails',
    'product.colorAria': 'Couleur',
    'product.selectedAria': '(sélectionnée)',

    // ── Contact Extended ──
    'contact.chatWhatsApp': 'Discuter sur WhatsApp',

    // ── Footer Social ──
    'footer.whatsapp': 'WhatsApp',
    'footer.messenger': 'Messenger',
    'footer.instagram': 'Instagram',
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

    // ── Catalog Extended ──
    'catalog.collection': 'Collection',
    'catalog.tryAnotherSearch': 'Try a different search term',
    'catalog.addSections': 'Add sections in the Layout tab',
    'catalog.viewProduct': 'View',

    // ── Product Extended ──
    'product.quickBuy': 'Quick Buy',
    'product.whatsappOrder': 'Order on WhatsApp',
    'product.price': 'Price',

    // ── Footer Extended ──
    'footer.email': 'Email',

    // ── Settings Tabs ──
    'settings.general': 'General',
    'settings.appearance': 'Style',
    'settings.conversion': 'Sharing',
    'settings.display': 'Display',
    'settings.admin': 'Admin',
    'settings.catalogue': 'Catalog',
    'settings.colors': 'Colors',
    'settings.save': 'Save',
    'settings.saved': 'Settings saved',
    'settings.saveError': 'Save error',
    'settings.logoLabel': 'Brand logo',
    'settings.logoHint': 'Image URL — replaces the monogram in the navigation bar and footer',
    'settings.faviconLabel': 'Favicon',
    'settings.faviconHint': 'Icon displayed in the browser tab (32×32 recommended)',
    'settings.logoPlaceholder': 'https://example.com/logo.png',
    'settings.faviconPlaceholder': 'https://example.com/favicon.ico',

    // ── Admin Extended ──
    'admin.confirmDelete': 'Are you sure you want to delete?',
    'admin.productsDeleted': 'product(s) deleted',
    'admin.productsActivated': 'product(s) activated',
    'admin.linkCopied': 'Link copied!',
    'admin.refresh': 'Refresh',

    // ── Order ──
    'order.subject': 'Order',

    // ── Order Form (COD) ──
    'order.title': 'Order now',
    'order.cod': 'Cash on delivery (COD)',
    'order.fullName': 'Full name',
    'order.fullNamePlaceholder': 'Your full name',
    'order.phone': 'Phone',
    'order.phonePlaceholder': '06XXXXXXXX',
    'order.city': 'City',
    'order.cityPlaceholder': 'Your city',
    'order.address': 'Delivery address',
    'order.addressPlaceholder': 'Full delivery address',
    'order.confirm': 'Confirm order',
    'order.sending': 'Sending...',
    'order.sent': 'Order sent!',
    'order.redirecting': 'Redirecting...',
    'order.secureData': '🔒 Your data is secure · Cash on delivery',
    'order.errorName': 'Please enter your full name.',
    'order.errorPhone': 'Please enter a valid phone number.',
    'order.errorCity': 'Please enter your city.',
    'order.errorAddress': 'Please enter your delivery address.',
    'order.errorNetwork': 'Network error. Please check your connection and try again.',
    'order.errorGeneric': 'Order error. Please try again.',
    'order.required': '*',

    // ── Thank You Page ──
    'thanks.title': 'Order confirmed!',
    'thanks.subtitle': 'Thank you for your order. Our team will contact you shortly to confirm delivery.',
    'thanks.orderLabel': 'Order',
    'thanks.paymentMode': 'Payment method',
    'thanks.paymentCOD': 'Cash on delivery',
    'thanks.status': 'Status',
    'thanks.statusPending': 'Pending confirmation',
    'thanks.backToCatalog': 'Back to catalog',
    'thanks.trackingNotice': 'You will receive a phone confirmation shortly.',
    'thanks.loading': 'Loading...',

    // ── Upload ──
    'upload.dragDrop': 'Drag & drop or click',
    'upload.clickOrDrop': 'Click or drag a file here',
    'upload.uploading': 'Uploading...',
    'upload.success': 'File uploaded successfully',
    'upload.error': 'Upload error',
    'upload.remove': 'Remove',
    'upload.fileTooLarge': 'File too large (max 2 MB)',
    'upload.invalidType': 'Unsupported file type',

    // ── Catalog Navigation ──
    'catalog.backToCatalog': 'Back to catalog',
    'catalog.back': 'Back',
    'catalog.retry': 'Retry',

    // ── Admin Navigation (public catalog) ──
    'admin.clearCache': 'Clear cache and reload',
    'admin.backToDashboard': 'Back to Dashboard',
    'admin.dashboard': 'Dashboard',

    // ── Product Page Extended ──
    'product.product': 'Product',
    'product.previousImage': 'Previous image',
    'product.nextImage': 'Next image',
    'product.details': 'Details',
    'product.colorAria': 'Color',
    'product.selectedAria': '(selected)',

    // ── Contact Extended ──
    'contact.chatWhatsApp': 'Chat on WhatsApp',

    // ── Footer Social ──
    'footer.whatsapp': 'WhatsApp',
    'footer.messenger': 'Messenger',
    'footer.instagram': 'Instagram',
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

    // ── Catalog Extended ──
    'catalog.collection': 'مجموعة',
    'catalog.tryAnotherSearch': 'جرّب مصطلح بحث آخر',
    'catalog.addSections': 'أضف أقسامًا في علامة التبويب التخطيط',
    'catalog.viewProduct': 'عرض',

    // ── Product Extended ──
    'product.quickBuy': 'شراء سريع',
    'product.whatsappOrder': 'اطلب عبر واتساب',
    'product.price': 'السعر',

    // ── Footer Extended ──
    'footer.email': 'البريد الإلكتروني',

    // ── Settings Tabs ──
    'settings.general': 'عام',
    'settings.appearance': 'النمط',
    'settings.conversion': 'المشاركة',
    'settings.display': 'العرض',
    'settings.admin': 'المشرف',
    'settings.catalogue': 'الكتالوج',
    'settings.colors': 'الألوان',
    'settings.save': 'حفظ',
    'settings.saved': 'تم حفظ الإعدادات',
    'settings.saveError': 'خطأ في الحفظ',
    'settings.logoLabel': 'شعار العلامة التجارية',
    'settings.logoHint': 'رابط الصورة — يحل محل الحرف في شريط التن synchronization والتذييل',
    'settings.faviconLabel': 'أيقونة الموقع',
    'settings.faviconHint': 'الأيقونة المعروضة في علامة تبويب المتصفح (32×32 موصى به)',
    'settings.logoPlaceholder': 'https://example.com/logo.png',
    'settings.faviconPlaceholder': 'https://example.com/favicon.ico',

    // ── Admin Extended ──
    'admin.confirmDelete': 'هل أنت متأكد أنك تريد الحذف؟',
    'admin.productsDeleted': 'تم حذف المنتج/المنتجات',
    'admin.productsActivated': 'تم تفعيل المنتج/المنتجات',
    'admin.linkCopied': 'تم نسخ الرابط!',
    'admin.refresh': 'تحديث',

    // ── Order ──
    'order.subject': 'طلب',

    // ── Order Form (COD) ──
    'order.title': 'اطلب الآن',
    'order.cod': 'الدفع عند الاستلام',
    'order.fullName': 'الاسم الكامل',
    'order.fullNamePlaceholder': 'الاسم الكامل',
    'order.phone': 'رقم الهاتف',
    'order.phonePlaceholder': '06XXXXXXXX',
    'order.city': 'المدينة',
    'order.cityPlaceholder': 'المدينة',
    'order.address': 'عنوان التوصيل',
    'order.addressPlaceholder': 'عنوان التوصيل الكامل',
    'order.confirm': 'تأكيد الطلب',
    'order.sending': '...جارٍ الإرسال',
    'order.sent': '!تم إرسال الطلب',
    'order.redirecting': '...جارٍ إعادة التوجيه',
    'order.secureData': '🔒 بياناتك مؤمّنة · الدفع عند الاستلام',
    'order.errorName': '.الرجاء إدخال الاسم الكامل',
    'order.errorPhone': '.الرجاء إدخال رقم هاتف صالح',
    'order.errorCity': '.الرجاء إدخال المدينة',
    'order.errorAddress': '.الرجاء إدخال عنوان التوصيل',
    'order.errorNetwork': '.خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى',
    'order.errorGeneric': '.خطأ في الطلب. حاول مرة أخرى',
    'order.required': '*',

    // ── Thank You Page ──
    'thanks.title': '!تم تأكيد الطلب',
    'thanks.subtitle': '.شكرًا على طلبك. سيتواصل فريقنا معك قريبًا لتأكيد التوصيل',
    'thanks.orderLabel': 'الطلب',
    'thanks.paymentMode': 'طريقة الدفع',
    'thanks.paymentCOD': 'الدفع عند الاستلام',
    'thanks.status': 'الحالة',
    'thanks.statusPending': 'في انتظار التأكيد',
    'thanks.backToCatalog': 'العودة إلى الكتالوج',
    'thanks.trackingNotice': '.ستتلقى تأكيدًا هاتفيًا قريبًا',
    'thanks.loading': '...جارٍ التحميل',

    // ── Upload ──
    'upload.dragDrop': 'اسحب وأفلت أو انقر',
    'upload.clickOrDrop': 'انقر أو اسحب ملفًا هنا',
    'upload.uploading': '...جارٍ الرفع',
    'upload.success': 'تم رفع الملف بنجاح',
    'upload.error': 'خطأ في الرفع',
    'upload.remove': 'إزالة',
    'upload.fileTooLarge': 'الملف كبير جدًا (الحد الأقصى 2 ميجابايت)',
    'upload.invalidType': 'نوع الملف غير مدعوم',

    // ── Catalog Navigation ──
    'catalog.backToCatalog': 'العودة إلى الكتالوج',
    'catalog.back': 'رجوع',
    'catalog.retry': 'إعادة المحاولة',

    // ── Admin Navigation (public catalog) ──
    'admin.clearCache': 'مسح ذاكرة التخزين المؤقت وإعادة التحميل',
    'admin.backToDashboard': 'العودة إلى لوحة التحكم',
    'admin.dashboard': 'لوحة التحكم',

    // ── Product Page Extended ──
    'product.product': 'منتج',
    'product.previousImage': 'الصورة السابقة',
    'product.nextImage': 'الصورة التالية',
    'product.details': 'التفاصيل',
    'product.colorAria': 'لون',
    'product.selectedAria': '(محدد)',

    // ── Contact Extended ──
    'contact.chatWhatsApp': 'تواصل عبر واتساب',

    // ── Footer Social ──
    'footer.whatsapp': 'واتساب',
    'footer.messenger': 'ماسنجر',
    'footer.instagram': 'إنستغرام',
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
 * Resolve a translated value from a JSONB translations object.
 * Falls back to the requested locale → French → English → the `label` fallback → raw key.
 * 
 * @param translations - JSONB object like { "fr": "Ensemble", "ar": "طقم", "en": "Set" }
 * @param locale - Current locale
 * @param fallback - Fallback string (typically the `label` field from DB)
 */
const LOCALE_CODES = new Set(['fr', 'en', 'ar']);

export function resolveTranslation(
  translations: Record<string, string> | null | undefined,
  locale: Locale,
  fallback?: string,
): string {
  if (translations && typeof translations === 'object' && !Array.isArray(translations)) {
    const value = translations[locale] || translations.fr || translations.en;
    // Guard: if the stored value is literally a locale code (e.g. "fr", "en", "ar"),
    // it means the translations JSONB was corrupted — skip it and use fallback.
    if (value && !LOCALE_CODES.has(value)) {
      return value;
    }
  }
  return fallback || '';
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
