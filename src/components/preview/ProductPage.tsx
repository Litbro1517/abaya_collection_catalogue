'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Section, SectionConfig, Column, ColumnConfig, Row } from '@/types';
import { resolveColorHex, buildColorLookupMap, normalizeCouleurKey } from '@/lib/color-utils';
import {
  resolveHybridImageUrl as resolveDirectImageUrl,
  resolveProxyUrl as resolveProxyImageUrl,
  extractDriveFileId,
} from '@/lib/media-utils';
import { readCache, writeCache, CACHE_KEYS } from '@/lib/cache';
import { buildWhatsappLink } from '@/lib/whatsapp';
import {
  RotateCcw,
  RotateCw,
  MessageCircle,
  Heart,
  Share2,
  ImageIcon,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Instagram,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { computeDiscount, getCompareAtPrice } from '@/lib/discount-utils';
import { useAutoTranslatedText } from '@/lib/useAutoTranslatedText';
import { useCartStore } from '@/lib/cart-store';
import { CodForm } from './CodForm';
import { TrustGuaranteesSection } from '@/components/TrustGuaranteesSection';
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
// (VG33) Centralized in src/lib/media-utils.ts. Local re-exports preserve call sites.
// extractImageId wraps extractDriveFileId for backward compat (returns URL as fallback).
function extractImageId(url: string): string {
  return extractDriveFileId(url) ?? url;
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
  instagramHandle?: string;
  facebookPage?: string;
  tiktokHandle?: string;
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
  instagramHandle,
  facebookPage,
  tiktokHandle,
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
  const MAX_VISIBLE_COLORS = 5; // FIX 4: max 5 colors inline + +N badge
  const colorOverflow = colorData.length > MAX_VISIBLE_COLORS;
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

  // VG34.1: Add to cart — increments header badge WITHOUT opening the drawer (PDP behavior)
  const { addItem } = useCartStore();
  const handleAddToCart = () => {
    if (isEpuise) return;
    if (hasMissingVariant) {
      setShowVariantError(true);
      return;
    }
    addItem({
      productId: row.id,
      title,
      price,
      color: selectedColor || '',
      size: selectedSize || '',
      image: carouselImages[0] || '',
    });
    toast.success(t('cart.added'));
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
      return;
    }
    // VG34.3: Smooth scroll to inline COD form (not checkout redirect)
    const codForm = document.getElementById('cod-form');
    if (codForm) {
      codForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      codForm.classList.add('ring-2', 'ring-[var(--gold-accent,#C5A059)]', 'ring-offset-2');
      setTimeout(() => codForm.classList.remove('ring-2', 'ring-[var(--gold-accent,#C5A059)]', 'ring-offset-2'), 2000);
    }
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
    <main className="product-page pdp-wrapper">
      {/* ── Breadcrumb — full width above grid (VG35.0 Fix C: aligns description top with image frame top) ── */}
      <nav className="product-page-breadcrumb" dir={rtl ? 'rtl' : 'ltr'}>
        <button onClick={onBack} className="breadcrumb-back" aria-label={t('catalog.back')}>
          {/* VG35.0 Fix D: curved U-turn back arrow — points left in LTR, right in RTL */}
          {rtl ? <RotateCw className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
        </button>
        <button className="breadcrumb-link" onClick={onBack}>{catalogName}</button>
        <span className="breadcrumb-sep">/</span>
        <button className="breadcrumb-link" onClick={onBack}>{sectionTitle}</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{title}</span>
      </nav>

      {/* ── PDP Grid: 2-column responsive (gallery left, details right) ── */}
      <div className="pdp-grid">
        {/* ═══════ LEFT COLUMN: Gallery + Social + Guarantees ═══════ */}
        <div className="pdp-gallery-section">
          {/* Main Carousel */}
          <div className="pdp-main-image-frame product-page-carousel-wrap relative">
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

            {/* ── Floating "Nouveau" badge ── */}
            {statut === 'Nouveau' && stockState === 'en_stock' && (
              <div className="product-page-float-badge absolute top-4 left-4 z-10">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>{t('product.new')}</span>
              </div>
            )}

            {/* ── Floating action buttons ── */}
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

          {/* Thumbnail strip — FIX D: mini-slider with outward-pointing arrows */}
          {carouselImages.length > 1 && (
            <div className="pdp-thumb-slider-wrapper">
              <button
                className="pdp-thumb-arrow pdp-thumb-arrow-left"
                onClick={() => {
                  const row = document.querySelector('.pdp-thumbnail-row') as HTMLElement;
                  if (row) row.scrollBy({ left: -200, behavior: 'smooth' });
                }}
                aria-label="Previous thumbnails"
                type="button"
              >
                ‹
              </button>
              <div className="pdp-thumbnail-row">
                {carouselImages.map((rawUrl, i) => {
                  const thumbUrl = resolveDirectImageUrl(rawUrl, 200);
                  const thumbProxy = resolveProxyImageUrl(rawUrl, 200);
                  return (
                    <button
                      key={i}
                      className={cn('pdp-thumb-box', i === carouselIdx && 'active')}
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
              <button
                className="pdp-thumb-arrow pdp-thumb-arrow-right"
                onClick={() => {
                  const row = document.querySelector('.pdp-thumbnail-row') as HTMLElement;
                  if (row) row.scrollBy({ left: 200, behavior: 'smooth' });
                }}
                aria-label="Next thumbnails"
                type="button"
              >
                ›
              </button>
            </div>
          )}

          {/* ── Under-image space: Social icons + Guarantees ── */}
          <div className="pdp-under-image-space">
            {/* Social media icons */}
            <div className="pdp-social-icons-group">
              {instagramHandle && (
                <a href={`https://instagram.com/${instagramHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="pdp-social-circle-btn" aria-label="Instagram">
                  <Instagram className="w-5 h-5" style={{ color: '#E4405F' }} />
                </a>
              )}
              {facebookPage && (
                <a href={facebookPage.startsWith('http') ? facebookPage : `https://facebook.com/${facebookPage}`} target="_blank" rel="noopener noreferrer" className="pdp-social-circle-btn" aria-label="Facebook">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {tiktokHandle && (
                <a href={`https://tiktok.com/@${tiktokHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="pdp-social-circle-btn" aria-label="TikTok">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.56-1.36 1.52-1.38 2.52-.01.8.31 1.61.88 2.16.63.63 1.55.91 2.43.8 1.05-.08 2.01-.73 2.45-1.68.21-.49.3-1.02.3-1.54V.02z"/></svg>
                </a>
              )}
              {whatsappNumber && (
                <a href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="pdp-social-circle-btn" aria-label="WhatsApp">
                  <MessageCircle className="w-5 h-5" style={{ color: '#25D366' }} />
                </a>
              )}
            </div>

            {/* Trust Guarantees — VG35.0 Fix A: compact variant (no separator, tight padding) */}
            <TrustGuaranteesSection variant="compact" />
          </div>
        </div>

        {/* ═══════ RIGHT COLUMN: Product Details + COD Form ═══════ */}
        <div className="pdp-details-section" dir={rtl ? 'rtl' : 'ltr'}>
          {/* ── Title ── */}
          <h1 className="pdp-product-title">{translatedTitle}</h1>

          {/* ── Price ── */}
          {price && (
            <div className="pdp-price-row">
              <span className="pdp-current-price">
                <PriceText>{formatPrice(price)}</PriceText>
              </span>
              {discount.hasDiscount && (
                <>
                  <span className="pdp-old-price">
                    <PriceText strikethrough>{formatPrice(discount.compareAtPrice!)}</PriceText>
                  </span>
                  <span className="pdp-discount-badge">
                    -{discount.percentage}% SOLDE
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

          {/* ── Color swatches ── */}
          {colorData.length > 0 && (
            <div className="product-page-section">
              <div className="product-page-section-title">
                {t('product.colors')}{selectedColor ? <span className="selected-value">: {selectedColor}</span> : ''}
              </div>
              <div
                className={cn('product-page-colors flex flex-nowrap gap-2.5', showVariantError && colorMissing && 'product-page-colors--error')}
                style={{ flexWrap: 'nowrap', gap: '10px' }}
                role="group"
                aria-label={showVariantError && colorMissing ? t('product.colorRequiredAria') : t('product.colors')}
              >
                {visibleColorData.map(({ name, hex }) => {
                  const isSelected = selectedColor === name;
                  return (
                    <button
                      key={name}
                      className={cn('product-page-color-circle', isSelected && 'selected')}
                      onClick={() => handleSelectColor(name)}
                      title={name}
                      aria-label={`${t('product.colorAria')} ${name}${isSelected ? ` ${t('product.selectedAria')}` : ''}`}
                    >
                      <span
                        className={cn('color-circle-inner', !hex && 'color-circle-missing')}
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
              <div className="pdp-sizes-row">
                {sizes.map(size => (
                  <button
                    key={size}
                    className={cn('pdp-size-btn', selectedSize === size && 'active', isEpuise && 'disabled')}
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

          {/* ── Quantity picker ── */}
          <div className="pdp-qty-picker">
            <button
              type="button"
              className="pdp-qty-btn"
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={quantity <= 1 || isEpuise}
              aria-label={t('product.decreaseQuantity')}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="pdp-qty-val" aria-live="polite">{quantity}</span>
            <button
              type="button"
              className="pdp-qty-btn"
              onClick={() => setQuantity(q => Math.min(99, q + 1))}
              disabled={isEpuise}
              aria-label={t('product.increaseQuantity')}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* ── Variant error alert ── */}
          {showVariantError && hasMissingVariant && (
            <p className="product-page-variant-error" role="alert" aria-live="assertive">
              {t('product.selectMissingVariants')}
            </p>
          )}

          {/* ── CTA duo: Buy Now + Add to Cart ── */}
          <div className="pdp-cta-duo-container">
            {isLandingMode ? (
              <button
                type="button"
                className="pdp-btn-buy-now"
                disabled={isEpuise}
                onClick={isEpuise ? undefined : handleCtaClick}
              >
                <ShoppingBag className="w-5 h-5 shrink-0" style={{ color: 'var(--gold-accent, #C5A059)' }} />
                {isEpuise ? t('product.soldOut') : isSurCommande ? t('product.onOrder') : t('product.quickBuy')}
              </button>
            ) : (
              <a
                className="pdp-btn-buy-now"
                href={isEpuise ? '#' : whatsappLink}
                target={isEpuise ? undefined : '_blank'}
                rel={isEpuise ? undefined : 'noopener noreferrer'}
                onClick={isEpuise ? (e) => e.preventDefault() : handleWhatsappCtaClick}
                style={{ textDecoration: 'none' }}
              >
                <MessageCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--gold-accent, #C5A059)' }} />
                {isEpuise ? t('product.soldOut') : t('product.commander')}
              </a>
            )}

            <button
              type="button"
              className="pdp-btn-add-cart"
              disabled={isEpuise}
              onClick={handleAddToCart}
            >
              <ShoppingBag className="w-4 h-4" />
              {t('cart.added') === 'Produit ajouté au panier' ? 'Ajouter au panier' : 'Add to Cart'}
            </button>
          </div>

          {/* ── Inline COD Form (gold border) ── */}
          <CodForm
            productId={row.id}
            productName={title}
            productPrice={price}
          />

          {/* ── Share toast ── */}
          {showShareToast && (
            <div className="product-page-toast">
              <Check className="w-4 h-4" style={{ color: BRAND.vertFonce }} />
              {t('product.linkCopied')}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ BOTTOM: SAV Blocks ═══════ */}
      <div className="pdp-conversion-texts-container" style={{ marginTop: '25px' }}>
        <div className="pdp-sav-block">
          <h4 className="pdp-sav-title">{t('sav.delivery.title')}</h4>
          <p className="pdp-sav-description">{t('sav.delivery.desc')}</p>
        </div>
        <div className="pdp-sav-block">
          <h4 className="pdp-sav-title">{t('sav.aftersales.title')}</h4>
          <p className="pdp-sav-description">{t('sav.aftersales.desc')}</p>
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
