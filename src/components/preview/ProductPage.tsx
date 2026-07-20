'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Section, SectionConfig, Column, ColumnConfig, Row } from '@/types';
import { resolveColorHex, buildColorLookupMap, normalizeCouleurKey } from '@/lib/color-utils';
import { readCache, writeCache, CACHE_KEYS } from '@/lib/cache';
import { buildWhatsappLink } from '@/lib/whatsapp';
import {
  ArrowLeft,
  MessageCircle,
  Heart,
  Share2,
  ImageIcon,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { computeDiscount, getCompareAtPrice } from '@/lib/discount-utils';
import { useAutoTranslatedText } from '@/lib/useAutoTranslatedText';
import { PriceText } from '@/components/PriceText';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CheckoutPayload } from './CheckoutPage';

// ── Brand Constants ──
const BRAND = {
  vertFonce: '#1A3C34',
  dore: '#C9A84C',
  beige: '#F5F0E8',
  noir: '#1F1F1F',
  blanc: '#FFFFFF',
  grisClair: '#F0F0F0',
  grisMoyen: '#808080',
  bordeaux: '#800020',
} as const;

// ── Image URL Resolution ──
function resolveDirectImageUrl(url: string, size = 1200): string {
  if (!url) return '';
  const proxyMatch = url.match(/\/api\/google\/image-proxy\?id=([^&]+)&sz=(\d+)/);
  if (proxyMatch) return `https://lh3.googleusercontent.com/d/${proxyMatch[1]}=w${size}`;
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of drivePatterns) {
    const match = url.match(pattern);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}=w${size}`;
  }
  return url;
}

function resolveProxyImageUrl(url: string, size = 1200): string {
  if (!url) return '';
  const proxyMatch = url.match(/\/api\/google\/image-proxy\?id=([^&]+)&sz=(\d+)/);
  if (proxyMatch) {
    if (parseInt(proxyMatch[2]) < size) return `/api/google/image-proxy?id=${proxyMatch[1]}&sz=${size}`;
    return url;
  }
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of drivePatterns) {
    const match = url.match(pattern);
    if (match) return `/api/google/image-proxy?id=${match[1]}&sz=${size}`;
  }
  return url;
}

function extractImageId(url: string): string {
  const proxyMatch = url.match(/\/api\/google\/image-proxy\?id=([^&]+)/);
  if (proxyMatch) return proxyMatch[1];
  for (const pattern of [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ]) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return url;
}

// Collect raw image URLs from a cell value
function collectRawImageUrls(val: unknown, sep?: string): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((u: unknown) => typeof u === 'string' && u.length > 0) as string[];
  if (typeof val !== 'string') return [];
  const str = val.trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str) as unknown[];
      if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u.length > 0);
    } catch { /* not JSON */ }
  }
  if (str.startsWith('http')) return [str];
  if (str.includes('http')) {
    const splitRegex = sep === '|' ? /\|/ : sep === '\n' ? /\n/ : sep === ';' ? /;/ : /[,;]/;
    return str.split(splitRegex).map(s => s.trim()).filter(s => s.startsWith('http'));
  }
  return [];
}

// ── Stock State Types ──
type StockState = 'en_stock' | 'epuise' | 'sur_commande';

function computeStockState(rawData: Record<string, unknown>): StockState {
  const isDisponible = String(rawData.__disponibilite__) !== 'false';
  const stock = typeof rawData.__stock__ === 'number'
    ? rawData.__stock__
    : parseInt(String(rawData.__stock__)) || 0;
  if (stock > 0) return 'en_stock';
  if (stock === 0 && isDisponible) return 'sur_commande';
  return 'epuise';
}

// ═══════════════════════════════════════════════════════════════════════
// ── ProductPage Props ──
// ═══════════════════════════════════════════════════════════════════════

interface ProductPageProps {
  row: Row;
  columns: Column[];
  section: Section;
  catalogName: string;
  conversionChannel: string;
  whatsappNumber: string;
  conversionMessage: string;
  conversionMessages?: Record<string, string> | null;  // { fr, en, ar } multilingual admin messages
  primaryColor: string;
  secondaryColor: string;
  onBack: () => void;
  onCheckout: (payload: CheckoutPayload) => void;
}

// ── Arabic color name map for the color drawer (calligraphic display) ──
// Falls back to the original name when no translation is available.
const ARABIC_COLOR_NAMES: Record<string, string> = {
  'noir': 'أسود',
  'blanc': 'أبيض',
  'gris': 'رمادي',
  'beige': 'بيج',
  'caramel': 'كراميل',
  'marron': 'بني',
  'bleu': 'أزرق',
  'rouge': 'أحمر',
  'rose': 'وردي',
  'vert': 'أخضر',
  'bordeaux': 'بوردو',
  'creme': 'كريمي',
  'marine': 'كحلي',
  'taupe': 'توب',
  'abricot': 'مشمشي',
  'lavande': 'خزامى',
  'moutarde': 'خردلي',
  'terracotta': 'طيني',
  'turquoise': 'فيروزي',
  'chocolat': 'شوكولاتة',
  'or': 'ذهبي',
  'argent': 'فضي',
  'violet': 'بنفسجي',
  'violette': 'بنفسجي',
  'jaune': 'أصفر',
  'orange': 'برتقالي',
  'kaki': 'كاكي',
  'corail': 'مرجاني',
  'ivoire': 'عاجي',
  'anthracite': 'فحمي',
  'prune': 'خوخي',
  'fushia': 'فوشيا',
  'fuchsia': 'فوشيا',
  'parme': 'بنفسجي فاتح',
  'saumon': 'سلمون',
  'aqua': 'أكوا',
  'gold': 'ذهبي',
  'silver': 'فضي',
  'black': 'أسود',
  'white': 'أبيض',
  'grey': 'رمادي',
  'gray': 'رمادي',
  'brown': 'بني',
  'red': 'أحمر',
  'blue': 'أزرق',
  'green': 'أخضر',
  'pink': 'وردي',
  'purple': 'بنفسجي',
  'yellow': 'أصفر',
};

function arabicColorName(name: string): string {
  const key = normalizeCouleurKey(name);
  if (ARABIC_COLOR_NAMES[key]) return ARABIC_COLOR_NAMES[key];
  const collapsed = key.replace(/[\s,;]+/g, '');
  if (ARABIC_COLOR_NAMES[collapsed]) return ARABIC_COLOR_NAMES[collapsed];
  // Compound name: translate each word, keep original for unknown words
  const words = name.trim().split(/[\s,;]+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map(w => ARABIC_COLOR_NAMES[normalizeCouleurKey(w)] || w)
      .join(' ');
  }
  return name;
}

export function ProductPage({
  row,
  columns: detailColumns,
  section,
  catalogName,
  conversionChannel,
  whatsappNumber,
  conversionMessage,
  conversionMessages,
  primaryColor,
  secondaryColor,
  onBack,
  onCheckout,
}: ProductPageProps) {
  const config = section.config as SectionConfig;
  const rawData = row.data as Record<string, unknown>;
  const { t, locale, formatPrice, rtl } = useClientTranslation();
  const stockState = computeStockState(rawData);
  const stock = typeof rawData.__stock__ === 'number'
    ? rawData.__stock__
    : parseInt(String(rawData.__stock__)) || 0;

  // ── Extract product data ──
  const getCellValue = (slug: string): string => {
    const val = rawData[slug];
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  const title = config.titleColumn ? getCellValue(config.titleColumn) : '';
  const price = config.priceColumn ? getCellValue(config.priceColumn) : '';
  const description = config.descriptionColumn ? getCellValue(config.descriptionColumn) : '';
  const variants = config.variantColumn ? getCellValue(config.variantColumn) : '';
  const statut = (rawData.__statut__ as string) || 'Courant';

  // ━━ DEBT-10 : Traduction automatique à la volée (mono-champ BDD) ━━
  // Si la locale visiteur diffère de la langue source, traduire titre + description
  // via /api/translate (z-ai-web-dev-sdk) avec cache localStorage (30 jours)
  const translatedTitle = useAutoTranslatedText(title, locale);
  const translatedDescription = useAutoTranslatedText(description, locale);

  // ━━ DEBT-9 : Colonne native discount (prix barré) ━━
  // Lecture du slug natif __compare_at_price__ dans Row.data
  const compareAtPriceRaw = getCompareAtPrice(rawData as Record<string, unknown> | null);
  const discount = useMemo(
    () => computeDiscount(price, compareAtPriceRaw),
    [price, compareAtPriceRaw],
  );

  // ── ColorMap state ──
  // NOTE: useState lazy initializer can't read localStorage during SSR (window undefined),
  // so we always start with {}. The useEffect below populates from cache on mount.
  const [colorMap, setColorMap] = useState<Record<string, string>>({});

  // ── Parse colors: NATIVE color column only (single source of truth) ──
  // Reads exclusively from `config.colorColumn` (the COLOR-type column
  // validated in admin via ColorMap). Raw import fields (optionscouleurs,
  // couleurs, …) and legacy variantColumn extraction are intentionally NOT
  // read so the public product page never displays unvalidated colors.
  // If the native column is empty/missing, `colorData` will be empty and the
  // entire color section is hidden downstream ({colorData.length > 0 && …}).
  const rawColorValue = config.colorColumn ? getCellValue(config.colorColumn) : '';
  const finalColorNames: string[] = rawColorValue
    ? rawColorValue.split(/[,;]/).map(v => v.trim()).filter(Boolean)
    : [];

  // ── Parse variants into sizes (from variantColumn) ──
  const variantList = variants ? variants.split(/[,;]/).map(v => v.trim()).filter(Boolean) : [];
  const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|\d{1,2})$/i;
  const sizes = variantList.filter(v => sizePattern.test(v));

  // ── Color data with hex resolution from ColorMap ──
  const colorData = finalColorNames.map(name => ({
    name,
    hex: resolveColorHex(name, colorMap),
  }));

  // ── Carousel images ──
  const carouselImages = (() => {
    const images: string[] = [];
    const seenIds = new Set<string>();
    const addImage = (url: string) => {
      const id = extractImageId(url);
      if (seenIds.has(id)) return;
      seenIds.add(id);
      images.push(url);
    };

    if (config.coverColumn) {
      const val = rawData[config.coverColumn];
      let sep: string | undefined;
      const col = detailColumns.find(c => c.slug === config.coverColumn);
      if (col?.config && typeof col.config === 'object') sep = (col.config as ColumnConfig).gallerySeparator;
      const rawImgs = collectRawImageUrls(val, sep);
      if (rawImgs.length > 0) addImage(rawImgs[0]);
    }

    if (config.carouselColumn) {
      const val = rawData[config.carouselColumn];
      let sep: string | undefined;
      const col = detailColumns.find(c => c.slug === config.carouselColumn);
      if (col?.config && typeof col.config === 'object') sep = (col.config as ColumnConfig).gallerySeparator;
      for (const img of collectRawImageUrls(val, sep)) addImage(img);
    }

    if (!config.carouselColumn && config.coverColumn) {
      const val = rawData[config.coverColumn];
      let sep: string | undefined;
      const col = detailColumns.find(c => c.slug === config.coverColumn);
      if (col?.config && typeof col.config === 'object') sep = (col.config as ColumnConfig).gallerySeparator;
      const rawImgs = collectRawImageUrls(val, sep);
      for (let i = 1; i < rawImgs.length; i++) addImage(rawImgs[i]);
    }

    return images;
  })();

  // ── Detail fields ──
  const detailFields: { label: string; value: string; slug: string }[] = [];
  if (config.detailColumns && config.detailColumns.length > 0) {
    for (const slug of config.detailColumns) {
      const col = detailColumns.find(c => c.slug === slug);
      if (!col) continue;
      const val = getCellValue(slug);
      if (!val) continue;
      if (!detailFields.some(f => f.slug === slug)) {
        detailFields.push({ label: col.name, value: val, slug });
      }
    }
  }

  // Filter out technical/internal/duplicate fields
  // Remove: system columns (__*), Options_* labels, fields already shown as title/price/description
  const detailSlugsShown = new Set<string>();
  if (config.titleColumn) detailSlugsShown.add(config.titleColumn);
  if (config.priceColumn) detailSlugsShown.add(config.priceColumn);
  if (config.descriptionColumn) detailSlugsShown.add(config.descriptionColumn);
  if (config.variantColumn) detailSlugsShown.add(config.variantColumn);
  if (config.coverColumn) detailSlugsShown.add(config.coverColumn);
  if (config.carouselColumn) detailSlugsShown.add(config.carouselColumn);
  if (config.colorColumn) detailSlugsShown.add(config.colorColumn);
  // Also add their corresponding column names (case-insensitive match)
  const detailLabelsShown = new Set<string>();
  for (const slug of detailSlugsShown) {
    const col = detailColumns.find(c => c.slug === slug);
    if (col) detailLabelsShown.add(col.name.toLowerCase());
  }
  // Common duplicate names to filter
  const duplicateLabels = new Set(['prix', 'price', 'description', 'titre', 'title', 'nom', 'name', 'prix_revendeur']);

  const filteredDetailFields = detailFields.filter(f =>
    !f.label.startsWith('Options_') &&
    !f.label.startsWith('__') &&
    !f.slug.startsWith('__') &&
    !detailSlugsShown.has(f.slug) &&
    !duplicateLabels.has(f.label.toLowerCase()) &&
    !detailLabelsShown.has(f.label.toLowerCase())
  );

  // ── Mode detection ──
  // WhatsApp mode: direct WhatsApp link (simple catalog)
  // Landing mode: COD form + sticky WhatsApp badge (e-commerce)
  const isLandingMode = conversionChannel === 'landing';

  // ── State ──
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Set<number>>(new Set());
  // ── Variant validation: shown only AFTER a failed checkout attempt ──
  const [showVariantError, setShowVariantError] = useState(false);

  // ── Side drawers (Drawers) for long description & abundant colors ──
  const [descSheetOpen, setDescSheetOpen] = useState(false);
  const [colorSheetOpen, setColorSheetOpen] = useState(false);
  // ── Description overflow detection: shows "Lire la suite" only when clamped ──
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [descOverflow, setDescOverflow] = useState(false);

  // ── Color overflow: show max 11 pills + a matte-black "+X" button when > 12 colors ──
  const MAX_VISIBLE_COLORS = 11;
  const colorOverflow = colorData.length > 12;
  const visibleColorData = colorOverflow ? colorData.slice(0, MAX_VISIBLE_COLORS) : colorData;
  const hiddenColorCount = colorOverflow ? colorData.length - MAX_VISIBLE_COLORS : 0;

  // ── Selected color hex (for the checkout recap swatch) ──
  const selectedColorHex = selectedColor
    ? (colorData.find(c => c.name === selectedColor)?.hex || null)
    : null;

  // ── Missing-variant flags (derived: true only when the product HAS that variant) ──
  const colorMissing = colorData.length > 0 && !selectedColor;
  const sizeMissing = sizes.length > 0 && !selectedSize;
  const hasMissingVariant = colorMissing || sizeMissing;

  // ── WhatsApp dynamic link ──
  // Construit dynamiquement à chaque changement de sélection (color/size/quantity).
  // Inclut l'image produit (URL directe Google Drive) pour que WhatsApp puisse
  // générer un aperçu de lien côté récepteur.
  // Placeholders supportés via `conversionMessage` admin : {product} {color} {size} {quantity} {price} {image}
  const productImageDirectUrl = useMemo(
    () => resolveDirectImageUrl(carouselImages[0] || '', 800),
    [carouselImages],
  );
  const whatsappLink = useMemo(
    () => buildWhatsappLink({
      phone: whatsappNumber,
      title,
      price,
      color: selectedColor,
      size: selectedSize,
      quantity,
      imageUrl: productImageDirectUrl,
      customMessage: conversionMessage || undefined,
      conversionMessages,
      locale,
      flux: 'A',  // Flux A: product validated (purchase)
      labels: {
        greeting: t('whatsapp.message'),
        greetingA: t('whatsapp.greetingA'),
        greetingB: t('whatsapp.greetingB'),
        priceLabel: t('product.price'),
        colorLabel: t('product.color'),
        sizeLabel: t('product.size'),
        quantityLabel: t('product.quantity'),
      },
    }),
    [whatsappNumber, title, price, selectedColor, selectedSize, quantity, productImageDirectUrl, conversionMessage, conversionMessages, locale, t],
  );

  // ── Detect if the description overflows its 3-line clamp (re-measure on resize) ──
  // Measurement is deferred via rAF so setState never fires synchronously in the
  // effect body (avoids cascading renders). The resize listener re-measures on the
  // next animation frame after the viewport changes.
  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    const measure = () => { setDescOverflow(el.scrollHeight - el.clientHeight > 1); };
    const raf = requestAnimationFrame(measure);
    const onResize = () => requestAnimationFrame(measure);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [description]);

  // ── WhatsApp CTA click guard ──
  // Reuses the Landing Page validation logic: blocks wa.me opening if variants are missing.
  // Same pattern as handleCtaClick but for the <a> WhatsApp element.
  const handleWhatsappCtaClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isEpuise) {
      e.preventDefault();
      return;
    }
    if (hasMissingVariant) {
      e.preventDefault();              // ← hard stop: don't follow wa.me href
      setShowVariantError(true);       // ← show red alert (same as Landing mode)
      return;
    }
    // Variants OK — let the browser follow the href normally
  };

  // CTA click handler — tunnels to the dedicated checkout page in ALL modes.
  // BLOCKING: if a required variant (color/size) is missing, stop immediately
  // and surface red alerts. The checkout redirect does NOT happen.
  // showVariantError is a one-way "attempted" gate: once set true it stays true,
  // and the DERIVED colorMissing/sizeMissing flags handle instant per-field
  // clearing (spec: selecting a missing variant clears ONLY that field's border).
  const handleCtaClick = () => {
    if (isEpuise) return;
    if (hasMissingVariant) {
      setShowVariantError(true);
      return; // ← hard stop: no checkout redirect
    }
    onCheckout({
      productId: row.id,
      productTitle: title,
      productPrice: price,
      productImage: resolveProxyImageUrl(carouselImages[0] || '', 400),
      selectedColor,
      selectedColorHex,
      selectedSize,
      quantity,
    });
  };

  // Select a color. The derived colorMissing flag updates instantly, so the
  // color border + (if size also selected) the global alert clear automatically.
  const handleSelectColor = (name: string) => {
    setSelectedColor(prev => (prev === name ? null : name));
  };

  // Select a size. The derived sizeMissing flag updates instantly, so the
  // size border + (if color also selected) the global alert clear automatically.
  const handleSelectSize = (size: string) => {
    if (isEpuise) return;
    setSelectedSize(prev => (prev === size ? null : size));
  };

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Load colormap: cache-first (instant from localStorage), then network if needed ──
  // Critical: we read cache INSIDE useEffect (not useState initializer) because
  // useState initializer runs during SSR where window/localStorage is unavailable.
  // With FROZEN_MODE, isCacheStale() always returns false when cache exists,
  // so we must NOT use isCacheStale as a gate — we read cache directly instead.
  useEffect(() => {
    const loadColorMap = async () => {
      // Priority 1: read from localStorage cache (instant, no network)
      const cached = readCache<Array<{ name: string; slug: string; hex: string }>>(CACHE_KEYS.colormap);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setColorMap(buildColorLookupMap(cached));
        return; // ✅ Cache hit → zero network request
      }
      // Priority 2: no cache (first visit) → fetch from API
      const r = await fetch('/api/colormap');
      if (!r.ok) return;
      const json = await r.json();
      if (json?.data) {
        setColorMap(buildColorLookupMap(json.data));
        writeCache(CACHE_KEYS.colormap, json.data);
      }
    };
    loadColorMap().catch(() => {});
  }, []);

  // ── Carousel controls ──
  const goPrev = () => setCarouselIdx(i => (i === 0 ? carouselImages.length - 1 : i - 1));
  const goNext = () => setCarouselIdx(i => (i === carouselImages.length - 1 ? 0 : i + 1));
  const goTo = (idx: number) => setCarouselIdx(idx);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      // RTL: swipe direction is reversed (left → prev, right → next)
      if (rtl ? diff < 0 : diff > 0) goNext(); else goPrev();
    }
  };

  // ── Share handler — Méthode Hybride robuste (DEBT-5) ──
  // Cascade 3 étapes avec guards de présence + gestion erreurs + feedback sonner :
  // 1. navigator.share (Web Share API native — préférée sur mobile, ouvre la feuille de partage OS)
  // 2. navigator.clipboard avec guard (évite TypeError sur anciens nav / HTTP / Safari privé)
  //    + await explicite (évite race condition iOS/Safari) + toast.success sonner
  // 3. Fallback ultime : setShowShareToast (state local) si aucune API moderne disponible
  const handleShare = async () => {
    const shareData = {
      title: title || t('product.product'),
      text: `${title}${price ? ` — ${price}` : ''}`,
      url: window.location.href,
    };

    // Étape 1 : Web Share API native (mobile/desktop moderne)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Utilisateur a annulé OU erreur share → on continue vers clipboard fallback
      }
    }

    // Étape 2 : Fallback Clipboard API avec guard de présence
    if (typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t('product.linkCopied'));
        return;
      } catch {
        // Échec clipboard (permission refusée, contexte non sécurisé) → fallback ultime
      }
    }

    // Étape 3 : Fallback ultime — toast visuel local (aucune API moderne disponible)
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2000);
  };

  // ── Keyboard navigation for carousel ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // RTL: arrow keys are reversed (ArrowLeft → next, ArrowRight → prev)
      if (e.key === 'ArrowLeft') { if (rtl) goNext(); else goPrev(); }
      if (e.key === 'ArrowRight') { if (rtl) goPrev(); else goNext(); }
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, carouselImages.length, rtl]);

  const isEpuise = stockState === 'epuise';
  const isSurCommande = stockState === 'sur_commande';
  const sectionTitle = section.title || t('catalog.collection');

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER ──
  // ═══════════════════════════════════════════════════════════════════

  return (
    <main className="product-page">
      {/* ── Main Layout: Carousel + Info ── */}
      <div className="product-page-layout">
        {/* ═══════ LEFT: Breadcrumb + Carousel + Thumbnails ═══════ */}
        <div className="product-page-gallery">
          {/* ── Breadcrumb — inside left column, scrolls with images ── */}
          <nav className="product-page-breadcrumb">
            <button onClick={onBack} className="breadcrumb-back" aria-label={t('catalog.back')}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button className="breadcrumb-link" onClick={onBack}>{catalogName}</button>
            <span className="breadcrumb-sep">/</span>
            <button className="breadcrumb-link" onClick={onBack}>{sectionTitle}</button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{title}</span>
          </nav>

          {/* Main Carousel — wrapped in a relative container so the floating
              overlay (badge + actions) positions against the carousel area
              regardless of whether images are loaded. */}
          <div className="product-page-carousel-wrap relative">
            {carouselImages.length > 0 ? (
            <section
              className="product-page-carousel"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="product-page-carousel-track"
                style={{ transform: `translateX(${rtl ? '' : '-'}${carouselIdx * 100}%)` }}
              >
                {carouselImages.map((rawUrl, i) => {
                  const isVisible = Math.abs(i - carouselIdx) <= 2;
                  const directUrl = isVisible ? resolveDirectImageUrl(rawUrl, 1000) : '';
                  const proxyUrl = isVisible ? resolveProxyImageUrl(rawUrl, 1000) : '';
                  return (
                    <div key={i} className="product-page-carousel-slide">
                      {isVisible ? (
                        <img
                          src={directUrl}
                          alt={`${title} - ${i + 1}`}
                          loading={Math.abs(i - carouselIdx) <= 1 ? 'eager' : 'lazy'}
                          decoding="async"
                          className={cn('product-page-img', imageLoaded.has(i) && 'loaded')}
                          onLoad={() => setImageLoaded(prev => new Set(prev).add(i))}
                          onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            if (!el.dataset.retried) {
                              el.dataset.retried = '1';
                              el.src = proxyUrl;
                            }
                          }}
                        />
                      ) : (
                        <div className="product-page-carousel-placeholder" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Navigation arrows */}
              {carouselImages.length > 1 && (
                <>
                  <button className="carousel-arrow left" onClick={goPrev} aria-label={t('product.previousImage')}>‹</button>
                  <button className="carousel-arrow right" onClick={goNext} aria-label={t('product.nextImage')}>›</button>

                  {/* Dots */}
                  <div className="carousel-dots">
                    {carouselImages.length <= 10 ? (
                      carouselImages.map((_, i) => (
                        <button
                          key={i}
                          className={i === carouselIdx ? 'active' : ''}
                          onClick={() => goTo(i)}
                          aria-label={`${t('carousel.image')} ${i + 1}`}
                        />
                      ))
                    ) : (
                      <>
                        <button className={carouselIdx === 0 ? 'active' : ''} onClick={() => goTo(0)} aria-label={`${t('carousel.image')} 1`} />
                        {carouselIdx > 3 && <span className="carousel-ellipsis">…</span>}
                        {Array.from({ length: carouselImages.length }, (_, i) => i)
                          .filter(i => i !== 0 && i !== carouselImages.length - 1 && Math.abs(i - carouselIdx) <= 2)
                          .map(i => (
                            <button key={i} className={i === carouselIdx ? 'active' : ''} onClick={() => goTo(i)} aria-label={`${t('carousel.image')} ${i + 1}`} />
                          ))}
                        {carouselIdx < carouselImages.length - 4 && <span className="carousel-ellipsis">…</span>}
                        <button
                          className={carouselIdx === carouselImages.length - 1 ? 'active' : ''}
                          onClick={() => goTo(carouselImages.length - 1)}
                          aria-label={`${t('carousel.image')} ${carouselImages.length}`}
                        />
                        <span className="carousel-counter">{carouselIdx + 1}/{carouselImages.length}</span>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Image counter badge */}
              {carouselImages.length > 1 && (
                <div className="product-page-img-counter">
                  <ImageIcon className="w-3 h-3" />
                  <span>{carouselIdx + 1}/{carouselImages.length}</span>
                </div>
              )}
            </section>
          ) : (
            <div className="product-page-carousel product-page-carousel-empty">
              <ImageIcon style={{ width: 48, height: 48, color: BRAND.grisMoyen, opacity: 0.3 }} />
            </div>
          )}

            {/* ── Floating "Nouveau" badge — absolute top-left of carousel ── */}
            {statut === 'Nouveau' && stockState === 'en_stock' && (
              <div className="product-page-float-badge absolute top-4 left-4 z-10">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>{t('product.new')}</span>
              </div>
            )}

            {/* ── Floating action buttons — Mobile-first responsive ──
                MOBILE (default): compact top-right (top-3 right-3, gap-2) so the
                rigid 200px offset doesn't break short mobile carousels.
                DESKTOP (md+): validated 200px offset (md:top-[200px] md:right-4
                md:gap-3) sitting below the Nouveau badge and above the center
                carousel arrow (>). z-20 keeps buttons above carousel arrows. */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 md:top-[200px] md:right-4 md:gap-3">
              <button
                className="product-page-float-action"
                onClick={() => setIsLiked(!isLiked)}
                aria-label={t('product.favorite')}
                aria-pressed={isLiked}
              >
                <Heart
                  className={cn('w-5 h-5', isLiked && 'fill-current')}
                  style={{ color: isLiked ? '#EF4444' : BRAND.noir }}
                />
              </button>
              <button
                className="product-page-float-action"
                onClick={handleShare}
                aria-label={t('product.share')}
              >
                <Share2 className="w-5 h-5" style={{ color: BRAND.noir }} />
              </button>
            </div>
          </div>

          {/* Thumbnail strip (desktop only) */}
          {carouselImages.length > 1 && (
            <div className="product-page-thumbnails">
              {carouselImages.map((rawUrl, i) => {
                const thumbUrl = resolveDirectImageUrl(rawUrl, 200);
                const thumbProxy = resolveProxyImageUrl(rawUrl, 200);
                return (
                  <button
                    key={i}
                    className={cn('product-page-thumb', i === carouselIdx && 'active')}
                    onClick={() => goTo(i)}
                    aria-label={`${t('carousel.thumbnail')} ${i + 1}`}
                  >
                    <img
                      src={thumbUrl}
                      alt={`${title} - ${t('carousel.thumbnail')} ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (!el.dataset.retried) {
                          el.dataset.retried = '1';
                          el.src = thumbProxy;
                        }
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════ RIGHT: Product Info — fluid layout, natural top-to-bottom flow ═══════ */}
        {/* Abandoned fixed-height lockdown. Content flows naturally with section margins.
            Long descriptions are clamped to 3 lines + "Lire la suite" opens a side drawer.
            Abundant colors (>12) collapse to 11 pills + a matte-black "+X" drawer button. */}
        <div className="product-page-info">
          <div className="product-page-info-inner" dir={rtl ? 'rtl' : 'ltr'}>
          {/* ── Statut badge moved to floating overlay on the carousel (top-left) ── */}

          {/* ── Title ── */}
          <h1 className="product-page-title">{translatedTitle}</h1>

          {/* ── Price (avec DEBT-9 : prix barré + badge discount si compareAtPrice) ── */}
          {price && (
            <div className="product-page-price-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="product-page-price">
                <PriceText>{formatPrice(price)}</PriceText>
              </span>
              {/* DEBT-9 : prix barré + badge discount */}
              {discount.hasDiscount && (
                <>
                  <span
                    className="product-page-price-original"
                    style={{
                      color: 'var(--muted-foreground, #888)',
                      fontSize: '0.9em',
                      opacity: 0.7,
                    }}
                    aria-label={t('product.originalPrice')}
                  >
                    <PriceText strikethrough>{formatPrice(discount.compareAtPrice!)}</PriceText>
                  </span>
                  <span
                    className="product-page-discount-badge"
                    style={{
                      backgroundColor: 'var(--pivot-danger, #800020)',
                      color: '#fff',
                      fontSize: '0.75em',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      letterSpacing: '0.02em',
                    }}
                    aria-label={t('product.discount')}
                  >
                    -{discount.percentage}%
                  </span>
                </>
              )}
              {isEpuise && <span className="product-page-status status-epuise">{t('product.soldOut')}</span>}
              {isSurCommande && <span className="product-page-status status-sur-commande">{t('product.onOrder')}</span>}
            </div>
          )}

          {/* ── Description ── */}
          {description && (
            <div className="product-page-section">
              <div className="product-page-section-title">{t('product.description')}</div>
              {/* Fluid layout: line-clamp-3 clamps long descriptions. A "Lire la suite"
                  micro-button appears only when the text overflows 3 lines, opening a
                  side drawer (Sheet) with the full description for comfortable reading. */}
              <p ref={descriptionRef} className="product-page-description line-clamp-3">{translatedDescription}</p>
              {descOverflow && (
                <button
                  type="button"
                  className="product-page-read-more"
                  onClick={() => setDescSheetOpen(true)}
                >
                  {t('product.readMore')}
                </button>
              )}
            </div>
          )}

          {/* ── Color swatches (40×40px circles from ColorMap) ── */}
          {colorData.length > 0 && (
            <div className="product-page-section">
              <div className="product-page-section-title">
                {t('product.colors')}{selectedColor ? <span className="selected-value">: {selectedColor}</span> : ''}
              </div>
              {/* Fluid 6-col grid, content-start. Max 11 pills shown inline; when the
                  product has more than 12 colors, the 12th cell becomes a matte-black
                  "+X" button that opens a side drawer listing every color with its
                  Arabic name calligraphied beside the swatch. */}
              <div
                className={cn('product-page-colors grid grid-cols-6 gap-2 content-start', showVariantError && colorMissing && 'product-page-colors--error')}
                role="group"
                aria-label={showVariantError && colorMissing ? t('product.colorRequiredAria') : t('product.colors')}
              >
                {visibleColorData.map(({ name, hex }) => {
                  const isSelected = selectedColor === name;
                  return (
                    <button
                      key={name}
                      className={cn(
                        'product-page-color-circle',
                        isSelected && 'selected'
                      )}
                      onClick={() => handleSelectColor(name)}
                      title={name}
                      aria-label={`${t('product.colorAria')} ${name}${isSelected ? ` ${t('product.selectedAria')}` : ''}`}
                    >
                      <span
                        className={cn(
                          'color-circle-inner',
                          !hex && 'color-circle-missing'
                        )}
                        style={hex ? { backgroundColor: hex } : undefined}
                      />
                      {isSelected && (
                        <Check
                          className="color-circle-check"
                          style={{ color: hex && isLightColor(hex) ? BRAND.noir : BRAND.blanc }}
                        />
                      )}
                    </button>
                  );
                })}
                {colorOverflow && (
                  <button
                    type="button"
                    className="product-page-color-overflow"
                    onClick={() => setColorSheetOpen(true)}
                    title={t('product.allColors')}
                    aria-label={`${t('product.allColors')} (+${hiddenColorCount})`}
                  >
                    +{hiddenColorCount}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Size selector ── */}
          {sizes.length > 0 && (
            <div className="product-page-section">
              <div className="product-page-section-title">
                {t('product.sizes')}{selectedSize ? <span className="selected-value">: {selectedSize}</span> : ''}
              </div>
              <div
                className={cn('product-page-sizes', showVariantError && sizeMissing && 'product-page-sizes--error')}
                role="group"
                aria-label={showVariantError && sizeMissing ? t('product.sizeRequiredAria') : t('product.sizes')}
              >
                {sizes.map(size => (
                  <button
                    key={size}
                    className={cn(
                      'product-page-size-chip',
                      selectedSize === size && 'selected',
                      isEpuise && 'disabled'
                    )}
                    onClick={() => handleSelectSize(size)}
                    disabled={isEpuise}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Detail fields ── */}
          {filteredDetailFields.length > 0 && (
            <div className="product-page-details">
              <div className="product-page-section-title">{t('product.details')}</div>
              {filteredDetailFields.map(field => (
                <div key={field.slug} className="product-page-detail-row">
                  <span className="detail-label">{field.label}</span>
                  <span className="detail-value">{field.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="product-page-actions">
            {/* Quantity selector — minimalist, sits just above the main CTA */}
            <div className="product-page-quantity">
              <span className="product-page-quantity-label">{t('product.quantity')}</span>
              <div className="product-page-quantity-control" role="group" aria-label={t('product.quantity')}>
                <button
                  type="button"
                  className="product-page-quantity-btn"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isEpuise}
                  aria-label={t('product.decreaseQuantity')}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="product-page-quantity-value" aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  className="product-page-quantity-btn"
                  onClick={() => setQuantity(q => Math.min(99, q + 1))}
                  disabled={isEpuise}
                  aria-label={t('product.increaseQuantity')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Variant error alert (red, above the main CTA) ── */}
            {showVariantError && hasMissingVariant && (
              <p className="product-page-variant-error" role="alert" aria-live="assertive">
                {t('product.selectMissingVariants')}
              </p>
            )}

            {/* Main CTA — dynamic based on conversion mode */}
            {isLandingMode ? (
              <button
                className={cn('product-page-cta', isEpuise && 'cta-disabled')}
                disabled={isEpuise}
                onClick={isEpuise ? undefined : handleCtaClick}
                style={{
                  backgroundColor: isEpuise ? BRAND.grisClair : 'rgb(0 0 0 / 89%)',
                  color: isEpuise ? BRAND.grisMoyen : 'rgb(255, 255, 255)',
                }}
              >
                <ShoppingBag className="w-5 h-5 shrink-0" />
                {isEpuise ? t('product.soldOut') : isSurCommande ? t('product.onOrder') : t('product.quickBuy')}
              </button>
            ) : (
              <a
                className={cn('product-page-cta', isEpuise && 'cta-disabled')}
                href={isEpuise ? '#' : whatsappLink}
                target={isEpuise ? undefined : '_blank'}
                rel={isEpuise ? undefined : 'noopener noreferrer'}
                onClick={isEpuise ? (e) => e.preventDefault() : handleWhatsappCtaClick}
                style={{
                  backgroundColor: isEpuise ? BRAND.grisClair : '#25D366',
                  color: isEpuise ? BRAND.grisMoyen : 'rgb(255, 255, 255)',
                  textDecoration: 'none',
                }}
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                {isEpuise ? t('product.soldOut') : t('product.commander')}
              </a>
            )}

            {/* ── Favoris / Partage moved to floating overlay on the carousel (top-right) ── */}
          </div>

          {/* ── Share toast ── */}
          {showShareToast && (
            <div className="product-page-toast">
              <Check className="w-4 h-4" style={{ color: BRAND.vertFonce }} />
              {t('product.linkCopied')}
            </div>
          )}
          </div>{/* end .product-page-info-inner */}
        </div>
      </div>

      {/* ── Mobile sticky CTA ── */}
      <div className="product-page-mobile-cta">
        <div className="mobile-cta-price-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {price && (
            <>
              <span className="mobile-cta-price">
                <PriceText>{formatPrice(price)}</PriceText>
              </span>
              {/* DEBT-9 : badge discount compact pour mobile */}
              {discount.hasDiscount && (
                <span
                  style={{
                    backgroundColor: 'var(--pivot-danger, #800020)',
                    color: '#fff',
                    fontSize: '0.65em',
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: '3px',
                  }}
                >
                  -{discount.percentage}%
                </span>
              )}
            </>
          )}
          {isEpuise && <span className="product-page-status status-epuise">{t('product.soldOut')}</span>}
          {isSurCommande && <span className="product-page-status status-sur-commande">{t('product.onOrder')}</span>}
        </div>
        {isLandingMode ? (
          <button
            className={cn('mobile-cta-button', isEpuise && 'cta-disabled')}
            disabled={isEpuise}
            onClick={isEpuise ? undefined : handleCtaClick}
            style={{
              backgroundColor: isEpuise ? BRAND.grisClair : 'rgb(0 0 0 / 89%)',
              color: isEpuise ? BRAND.grisMoyen : 'rgb(255, 255, 255)',
            }}
          >
            <ShoppingBag className="w-4 h-4" />
            {isEpuise ? t('product.soldOut') : t('product.commander')}
          </button>
        ) : (
          <a
            className={cn('mobile-cta-button', isEpuise && 'cta-disabled')}
            href={isEpuise ? '#' : whatsappLink}
            target={isEpuise ? undefined : '_blank'}
            rel={isEpuise ? undefined : 'noopener noreferrer'}
            onClick={isEpuise ? (e) => e.preventDefault() : handleWhatsappCtaClick}
            style={{
              backgroundColor: isEpuise ? BRAND.grisClair : '#25D366',
              color: isEpuise ? BRAND.grisMoyen : 'rgb(255, 255, 255)',
              textDecoration: 'none',
            }}
          >
            <MessageCircle className="w-4 h-4" />
            {isEpuise ? t('product.soldOut') : t('product.commander')}
          </a>
        )}
      </div>

      {/* ═══════ Side Drawer: Full product description ═══════ */}
      <Sheet open={descSheetOpen} onOpenChange={setDescSheetOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-md bg-[#E8E2E0] p-6 shadow-xl overflow-y-auto"
        >
          <SheetHeader className="p-0 pr-8">
            <SheetTitle
              className="text-xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t('product.productDetails')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('product.productDetails')}
            </SheetDescription>
          </SheetHeader>
          <div
            dir={rtl ? 'rtl' : 'ltr'}
            className="text-sm leading-7 text-foreground/90 whitespace-pre-line"
          >
            {translatedDescription}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════ Side Drawer: All color nuances (with Arabic names) ═══════ */}
      <Sheet open={colorSheetOpen} onOpenChange={setColorSheetOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-md bg-[#E8E2E0] p-6 shadow-xl overflow-y-auto"
        >
          <SheetHeader className="p-0 pr-8">
            <SheetTitle
              className="text-xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {t('product.allColors')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('product.allColors')}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-2 flex flex-col gap-1.5">
            {colorData.map(({ name, hex }) => {
              const isSelected = selectedColor === name;
              return (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    'product-page-drawer-color-row',
                    isSelected && 'selected'
                  )}
                  onClick={() => { handleSelectColor(name); setColorSheetOpen(false); }}
                  dir="rtl"
                >
                  <span
                    className={cn('product-page-drawer-color-swatch', !hex && 'color-circle-missing')}
                    style={hex ? { backgroundColor: hex } : undefined}
                  />
                  <span className="product-page-drawer-color-name">{arabicColorName(name)}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: BRAND.vertFonce }} />}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

// ── Helper: is color light or dark ──
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}
