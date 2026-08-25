'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, ColumnConfig, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, ArrowRight, Search, MessageCircle, ChevronLeft, ChevronRight,
  Mail, Instagram, ImageIcon, BookOpen, Settings, Heart,
  ShoppingBag, LayoutDashboard, Lock, RefreshCw, Globe, Check, X, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveColorHex, buildColorLookupMap, normalizeCouleurKey } from '@/lib/color-utils';
import { readCache, writeCache, clearAllCache, sanitizeSections, CACHE_KEYS } from '@/lib/cache';
import type { CachedSectionData } from '@/lib/cache';
import { ProductPage } from './ProductPage';
import { SocialStickyTickets } from './SocialStickyTickets';
import { TrustGuaranteesSection } from '@/components/TrustGuaranteesSection';
import { useCartStore } from '@/lib/cart-store';
import { CheckoutPage, type CheckoutPayload } from './CheckoutPage';
import { useClientTranslation } from '@/lib/i18n';
import { buildWhatsappLink } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { computeDiscount, getCompareAtPrice } from '@/lib/discount-utils';
import { PriceText } from '@/components/PriceText';
import { useAutoTranslatedText } from '@/lib/useAutoTranslatedText';
import { resolveMarketingStatus } from '@/lib/status-config';
import {
  resolveHybridImageUrl as resolveDirectImageUrl,
  resolveProxyUrl as resolveProxyImageUrl,
  resolveImageUrl,
  extractDriveFileId,
} from '@/lib/media-utils';
// DEBT-6 revert: ContactModal retiré — retour à la Méthode Hybride mailto: + clipboard (DEBT-5)

// ── Brand Constants removed — all values migrated to CSS pivot variables & global classes ──

const ITEMS_PER_PAGE = 16;

// ── Slugify: URL-safe slugs preserving ALL scripts (Latin, Arabic, etc.) ──
// Uses Unicode property escapes (\p{L} for letters, \p{N} for numbers).
// Must stay in sync with src/lib/products.ts slugify (server-side).
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip Latin combining accents (no effect on Arabic)
    .replace(/[^\p{L}\p{N}]+/gu, '-') // non-letter/non-number → hyphen (Unicode-aware)
    .replace(/^-+|-+$/g, '')          // trim leading/trailing hyphens
    .slice(0, 80);                    // reasonable max length
}

// ── Image URL Resolution ──
// (VG33) These functions are now centralized in src/lib/media-utils.ts.
// Local re-exports above (resolveDirectImageUrl, resolveProxyImageUrl,
// resolveImageUrl) preserve all existing call sites without code changes.
// extractImageId wraps extractDriveFileId for backward compat (returns URL as fallback).

function extractImageId(url: string): string {
  return extractDriveFileId(url) ?? url;
}

function parseImageUrls(val: unknown, separator?: string): string[] {
  if (!val) return [];

  if (Array.isArray(val)) {
    return val
      .filter((u: unknown) => typeof u === 'string' && u.length > 0)
      .map((u: string) => resolveImageUrl(u));
  }

  if (typeof val !== 'string') return [];
  const str = val.trim();
  if (!str) return [];

  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str) as unknown[];
      if (Array.isArray(parsed)) {
        return parsed
          .filter((u): u is string => typeof u === 'string' && u.length > 0)
          .map(u => resolveImageUrl(u));
      }
    } catch { /* not valid JSON */ }
  }

  if (str.startsWith('http') || str.startsWith('/api/')) {
    return [resolveImageUrl(str)];
  }

  if (str.includes('http')) {
    const sep = separator || ',';
    const splitRegex = sep === '|' ? /\|/ : sep === '\n' ? /\n/ : sep === ';' ? /;/ : /[,;]/
    return str
      .split(splitRegex)
      .map(s => s.trim())
      .filter(s => s.startsWith('http') || s.startsWith('/api/'))
      .map(u => resolveImageUrl(u));
  }

  return [];
}

// ── Pagination ──

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  primaryColor,
  rtl,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  primaryColor: string;
  rtl: boolean;
}) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8 pb-4">
      <button
        className="p-2 rounded-xl transition disabled:opacity-30"
        style={{ color: 'var(--pivot-brand)' }}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className={cn('w-5 h-5', rtl && 'rotate-180')} />
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2" style={{ color: 'var(--muted-foreground)' }}>...</span>
        ) : (
          <button
            key={p}
            className="w-10 h-10 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              backgroundColor: p === currentPage ? primaryColor : 'transparent',
              color: p === currentPage ? '#FFFFFF' : 'var(--pivot-text)',
            }}
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="p-2 rounded-xl transition disabled:opacity-30"
        style={{ color: 'var(--pivot-brand)' }}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className={cn('w-5 h-5', rtl && 'rotate-180')} />
      </button>
    </div>
  );
}

// ── Pure utility functions (extracted for stable references in hooks) ──

function getCellValue(row: Row, slug: string): string {
  const data = row.data as Record<string, unknown>;
  const val = data[slug];
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

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

// ═══════════════════════════════════════════════════════════════════════════
// ── Main Catalog Component ──
// ═══════════════════════════════════════════════════════════════════════════

// Type for dynamic categories (used in useState lazy initializer for cache)
type DynamicCategory = {
  id: string; slug: string; label: string; visible: boolean; ordre: number;
  translations?: Record<string, string> | null;
  subCategories: { id: string; slug: string; label: string; visible: boolean; ordre: number; categoryId: string; translations?: Record<string, string> | null }[];
};

interface CatalogPreviewProps {
  onAdminLogin?: () => void;
}

// ━━ DEBT-10 repair : sous-composant pour traduction auto du titre carte produit ━━
// Les hooks React ne peuvent pas être appelés dans une boucle .map(),
// on extrait donc l'élément titre dans un composant dédié qui appelle
// useAutoTranslatedText légitimement (une fois par instance de carte).
function ProductCardTitle({ title, locale }: { title: string; locale: string }) {
  const translatedTitle = useAutoTranslatedText(title, locale);
  return <span className="product-card-title">{translatedTitle}</span>;
}

// ── VG34.3: Cart Header Button — clean, no dark bg/shadow ──
// VG37.1 Axe 2: CartHeaderButton removed — GlobalCart (mounted in root layout)
// now handles the cart button globally on ALL routes. This prevents double-render
// conflict and ensures the cart is always visible.

export function CatalogPreview({ onAdminLogin }: CatalogPreviewProps) {
  const { catalog, settings, isAdmin, adminUser, setView } = useAppStore();
  const { t, formatPrice, rtl, locale, resolveTranslation: resolveT } = useClientTranslation();

  // Only owner/admin can access the builder — editors and public users cannot
  const canAccessBuilder = isAdmin && adminUser && (adminUser.role === 'owner' || adminUser.role === 'admin' || adminUser.role === 'super_admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ row: Row; columns: Column[]; section: Section } | null>(null);
  // ── Header refonte state ──
  const [langMenuOpen, setLangMenuOpen] = useState(false);       // language dropdown open?
  const [searchOpen, setSearchOpen] = useState(false);           // compact search expanded?
  const langMenuRef = useRef<HTMLDivElement | null>(null);       // for click-outside
  const searchOverlayRef = useRef<HTMLDivElement | null>(null);  // for click-outside / ESC
  const searchInputRef = useRef<HTMLInputElement | null>(null);  // autofocus on expand
  // ━━ Checkout tunnel: when set, the dedicated CheckoutPage replaces the product detail ━━
  const [checkoutData, setCheckoutData] = useState<CheckoutPayload | null>(null);

  // VG37.1 Axe 1: Watch checkoutTrigger from cart store — GlobalCart sets this
  // when the user clicks "إتمام الطلب" from the drawer. Opens the checkout view.
  // VG37.4 Phase 2: Maps ALL cart items (was items[0] only).
  const checkoutTrigger = useCartStore((s) => s.checkoutTrigger);
  useEffect(() => {
    if (checkoutTrigger === 0) return; // skip initial state
    const items = useCartStore.getState().items;
    if (items.length === 0) return;
    // VG37.4: Map the entire cart items array to CheckoutPayload
    setCheckoutData({
      items: items.map(item => ({
        productId: item.productId,
        productTitle: item.title,
        productPrice: item.price,
        productImage: item.image,
        selectedColor: item.color || null,
        selectedColorHex: null,
        selectedSize: item.size || null,
        quantity: item.quantity,
      })),
    });
    useCartStore.getState().closeDrawer();
  }, [checkoutTrigger]);
  const [currentPage, setCurrentPage] = useState(1);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // ── ColorMap for color dots on cards (include ALL colors — no isActive/visible filter;
  // filtering is for admin UI only, not for hex resolution) ──
  // NOTE: useState lazy initializer can't read localStorage during SSR (window undefined),
  // so we always start with {}. The useEffect below populates from cache on mount.
  const [colorMapData, setColorMapData] = useState<Record<string, string>>({});
  useEffect(() => {
    // Cache-first: read directly from localStorage (instant, no network)
    // CRITICAL: Do NOT use isCacheStale() as a gate — with FROZEN_MODE it always
    // returns false when data exists, but after SSR hydration the state is empty.
    const loadColorMap = async () => {
      const cached = readCache<Array<{ name: string; slug: string; hex: string }>>(CACHE_KEYS.colormap);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setColorMapData(prev => Object.keys(prev).length > 0 ? prev : buildColorLookupMap(cached));
        return; // Cache hit → zero network request
      }
      // No cache (first visit) → fetch from API
      const r = await fetch('/api/colormap');
      if (!r.ok) return;
      const json = await r.json();
      if (json?.data) {
        setColorMapData(buildColorLookupMap(json.data));
        writeCache(CACHE_KEYS.colormap, json.data);
      }
    };
    loadColorMap().catch(() => {});
  }, []);

  // ━━━ Two-Level Dynamic Category Filter ━━━━━━━━━━━━━━━━━━━━━━━━━
  // Level 1: Macro categories (Ensemble, Abaya, Kimono, etc.)
  // Level 2: Micro sub-filters (Nouveau, Saison, Discount) — contextual
  const [activeMacroFilter, setActiveMacroFilter] = useState<string>('all'); // category slug or 'all'
  const [activeMicroFilter, setActiveMicroFilter] = useState<string>('all'); // subcategory slug or 'all'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // mobile burger drawer state
  // ━━━ Categories: useState starts empty (SSR can't read localStorage) ━━━
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([]);
  // ━━━ Cache-first categories sync ━━━
  // CRITICAL: Do NOT use isCacheStale() — with FROZEN_MODE it blocks loading after SSR.
  useEffect(() => {
    const loadCategories = async () => {
      // Try cache first (instant from localStorage)
      const cached = readCache<DynamicCategory[]>(CACHE_KEYS.categories);
      if (cached && cached.length > 0) {
        setDynamicCategories(prev => prev.length > 0 ? prev : cached);
        return; // Cache hit → zero network request
      }
      // No cache → fetch from API
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data && json.data.length > 0) {
          setDynamicCategories(json.data);
          writeCache(CACHE_KEYS.categories, json.data);
          return;
        }
        // No categories found — seed defaults and re-fetch
        const seedRes = await fetch('/api/categories/seed', { method: 'POST' });
        if (seedRes.ok) {
          const catRes = await fetch('/api/categories');
          if (catRes.ok) {
            const catJson = await catRes.json();
            if (catJson?.data) {
              setDynamicCategories(catJson.data);
              writeCache(CACHE_KEYS.categories, catJson.data);
            }
          }
        }
      } catch {
        // Silent fail — catalog still works with legacy filter
      }
    };
    loadCategories();
  }, []);

  const s = settings || catalog?.settings;
  const primaryColor = s?.primaryColor || '#C9A84C';
  const secondaryColor = s?.secondaryColor || '#1A3C34';
  const accentColor = s?.accentColor || '#F5F0E8';
  const bgColor = s?.backgroundColor || '#FFFFFF';

  // ━━━ URL Param Priority: ?mode=whatsapp | ?mode=landing ━━━
  // If a URL param is present, it OVERRIDES the admin setting.
  // If no param, falls back to the admin's configured conversionChannel.
  // Priority: ?mode= param > admin setting > default 'whatsapp'
  // Using useState lazy initializer to read URL once on mount (SSR-safe).
  const [urlMode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    return (mode === 'whatsapp' || mode === 'landing') ? mode : null;
  });

  const resolvedConversionChannel = urlMode || s?.conversionChannel || 'whatsapp';

  // ━━━ Sections: useState starts empty (SSR can't read localStorage) ━━━
  const [sections, setSections] = useState<{ section: Section; columns: Column[]; rows: Row[] }[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Track whether network sync has been triggered (ref, not state — no re-render)
  const networkSyncDone = useRef(false);

  const isDetailView = !!selectedProduct;
  const catalogName = catalog?.name || 'Abaya Chic Collection';

  // Carousel state (at top level to comply with hooks rules)
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  // VG36.3 Chantier 1: Deep linking guard — prevents re-render loops
  const deepLinkDone = useRef(false);

  // Scroll to top when switching views
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedProduct, checkoutData]);

  // ━━━ Sections Network Sync (FROZEN MODE + stable trigger) ━━━━━━━━━━
  // Replaced [catalog] dependency with stable boolean catalogReady.
  // catalogReady transitions false → true EXACTLY ONCE (when catalog first appears).
  // This breaks the cascade: loadData → setCatalog → [catalog] → loadSections → re-fetch.
  // Inside the effect, we read fresh catalog from Zustand (no stale closure).
  const catalogReady = !!(catalog?.sections?.length);

  useEffect(() => {
    if (!catalogReady || networkSyncDone.current) return;
    networkSyncDone.current = true;

    // Cache-first: try localStorage before network
    // CRITICAL: Do NOT use isCacheStale() — with FROZEN_MODE it always returns false
    // when data exists, but after SSR hydration the React state is empty.
    const loadFromCacheOrNetwork = async () => {
      const cachedSections = readCache<CachedSectionData[]>(CACHE_KEYS.sections);
      if (cachedSections && cachedSections.length > 0) {
        setSections(cachedSections as unknown as { section: Section; columns: Column[]; rows: Row[] }[]);
        setSectionsLoaded(true);
        return; // Cache hit → zero network request
      }

      // No cache → fetch from network
      try {
        // Read fresh catalog from Zustand store — avoids stale closure over [catalog]
        const freshCatalog = useAppStore.getState().catalog;
        if (!freshCatalog?.sections) return;

        const results = await Promise.all(
          freshCatalog.sections
            .filter(s => s.visible)
            .map(async section => {
              const config = section.config as SectionConfig;
              const dsId = config.dataSourceId;
              if (!dsId) return { section, columns: [], rows: [] };
              const [metaRes, rowsRes] = await Promise.all([
                fetch(`/api/datasources/${dsId}?mode=meta`),
                fetch(`/api/datasources/${dsId}/rows?limit=200`),
              ]);
              const metaJson = metaRes.ok ? await metaRes.json() : null;
              const rowsJson = rowsRes.ok ? await rowsRes.json() : null;
              return {
                section,
                columns: metaJson?.data?.columns || [],
                rows: rowsJson?.data || []
              };
            })
        );
        const filtered = results.filter(Boolean);
        setSections(filtered);
        setSectionsLoaded(true);
        setLoadError(null);
        writeCache(CACHE_KEYS.sections, filtered, sanitizeSections);
      } catch (err) {
        console.error('Section loading failed:', err);
        const cachedSections = readCache<CachedSectionData[]>(CACHE_KEYS.sections);
        if (!cachedSections || cachedSections.length === 0) {
          setLoadError(t('error.loadData'));
        }
        setSectionsLoaded(true);
      }
    };

    loadFromCacheOrNetwork().catch(err => {
      console.error('Section loading failed:', err);
      setSectionsLoaded(true);
    });
  }, [catalogReady]);

  // ━━━ SEO: Update browser URL when product is selected/deselected ━━━
  // Uses window.history.pushState() exclusively — NEVER router.push()
  // This ensures no page flash/reload while keeping the URL shareable
  // for social media crawlers (WhatsApp, Facebook, Twitter, etc.)
  useEffect(() => {
    if (selectedProduct) {
      const config = selectedProduct.section.config as SectionConfig;
      const title = config.titleColumn
        ? getCellValue(selectedProduct.row, config.titleColumn)
        : '';
      const slug = slugify(title || 'produit');
      const url = new URL(window.location.href);
      url.searchParams.set('product', slug);
      window.history.pushState({ productSlug: slug }, '', url.toString());
    } else {
      // Remove ?product= when going back to catalog grid
      // VG36.3 Chantier 1: Only strip if deep link has been processed (or no
      // inbound deep link existed). This preserves ?product= for the deep link
      // effect to read when sections finish loading.
      if (deepLinkDone.current) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('product')) {
          url.searchParams.delete('product');
          window.history.pushState({}, '', url.toString());
        }
      }
    }
  }, [selectedProduct, sectionsLoaded]);

  // ━━━ VG36.3 Chantier 1: Deep Linking Inbound (?product=slug) ━━━━━━━━━
  // Auto-open PDP when landing via a shared WhatsApp link containing ?product=slug.
  useEffect(() => {
    if (!sectionsLoaded || deepLinkDone.current || selectedProduct) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get('product');
    // Mark deep link as processed whether or not a slug was found — this
    // unblocks the SEO URL effect from cleaning up the param later.
    deepLinkDone.current = true;
    if (!productSlug) return;
    for (const { section, columns, rows } of sections) {
      const config = section.config as SectionConfig;
      if (!config.titleColumn) continue;
      const match = rows.find(row => {
        const title = String(getCellValue(row, config.titleColumn) || '');
        return slugify(title) === productSlug;
      });
      if (match) {
        setSelectedProduct({ row: match, columns, section });
        break;
      }
    }
  }, [sectionsLoaded, sections, selectedProduct]);

  const getCarouselImages = useCallback((row: Row, config: SectionConfig, columns?: Column[]): string[] => {
    const images: string[] = [];
    const seenIds = new Set<string>();
    const rawData = row.data as Record<string, unknown>;

    const addImage = (url: string) => {
      const id = extractImageId(url);
      if (seenIds.has(id)) return;
      seenIds.add(id);
      images.push(url);
    };

    // Collect raw image URLs (original format, no proxy)
    const collectRaw = (val: unknown, sep?: string): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.filter((u: unknown) => typeof u === 'string' && u.length > 0) as string[];
      }
      if (typeof val === 'string') {
        const str = val.trim();
        if (!str) return [];
        if (str.startsWith('[')) {
          try {
            const parsed = JSON.parse(str) as unknown[];
            if (Array.isArray(parsed)) {
              return parsed.filter((u): u is string => typeof u === 'string' && u.length > 0);
            }
          } catch { /* not JSON */ }
        }
        if (str.startsWith('http')) return [str];
        if (str.includes('http')) {
          const splitRegex = sep === '|' ? /\|/ : sep === '\n' ? /\n/ : sep === ';' ? /;/ : /[,;]/;
          return str.split(splitRegex).map(s => s.trim()).filter(s => s.startsWith('http'));
        }
      }
      return [];
    };

    if (config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      let sep: string | undefined;
      if (columns) {
        const col = columns.find(c => c.slug === config.coverColumn);
        if (col?.config && typeof col.config === 'object') {
          sep = (col.config as ColumnConfig).gallerySeparator;
        }
      }
      const rawImgs = collectRaw(coverVal, sep);
      if (rawImgs.length > 0) addImage(rawImgs[0]);
    }

    if (config.carouselColumn) {
      const carouselVal = rawData[config.carouselColumn];
      let separator: string | undefined;
      if (columns) {
        const col = columns.find(c => c.slug === config.carouselColumn);
        if (col?.config && typeof col.config === 'object') {
          separator = (col.config as ColumnConfig).gallerySeparator;
        }
      }
      const rawImgs = collectRaw(carouselVal, separator);
      for (const img of rawImgs) {
        addImage(img);
      }
    }

    if (!config.carouselColumn && config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      let sep: string | undefined;
      if (columns) {
        const col = columns.find(c => c.slug === config.coverColumn);
        if (col?.config && typeof col.config === 'object') {
          sep = (col.config as ColumnConfig).gallerySeparator;
        }
      }
      const rawImgs = collectRaw(coverVal, sep);
      for (let i = 1; i < rawImgs.length; i++) {
        addImage(rawImgs[i]);
      }
    }

    return images;
  }, []);

  const buildConversionLink = (row: Row, config: SectionConfig): string => {
    const title = getCellValue(row, config.titleColumn || '');
    const price = getCellValue(row, config.priceColumn || '');
    const phone = s?.whatsappNumber || '';

    // Use resolvedConversionChannel (URL param ?mode= overrides admin setting)
    if (resolvedConversionChannel === 'whatsapp' && phone) {
      // Catalog card level: no variant selection yet (color/size/quantity).
      // The full dynamic link (with variants) is built in ProductPage.tsx when
      // the user opens the product detail. Here we just pre-fill title + price + image.
      const cardImages = getCarouselImages(row, config, columns);
      const imageUrl = cardImages[0] ? resolveDirectImageUrl(cardImages[0], 800) : '';
      return buildWhatsappLink({
        phone,
        title,
        price,
        imageUrl,
        customMessage: s?.conversionMessage || undefined,
        labels: {
          greeting: t('whatsapp.message'),
          priceLabel: t('product.price'),
          colorLabel: t('product.color'),
          sizeLabel: t('product.size'),
          quantityLabel: t('product.quantity'),
        },
      });
    }
    // Landing mode: no direct external link — the CTA triggers the COD form
    if (resolvedConversionChannel === 'landing') {
      return '#cod-form';
    }
    return '#';
  };

  // ── Email click handler — Méthode Hybride (DEBT-5 restauré) ──
  // 1. Tente la copie dans le presse-papier SI l'API est disponible
  // 2. Affiche un toast de confirmation sonner si la copie réussit
  // 3. Déclenche le mailto: dans un bloc finally (inconditionnel)
  //    → garantit l'ouverture du client mail même si clipboard échoue
  const handleEmailClick = async (email: string) => {
    if (!email) return;
    const mailtoUrl = `mailto:${email}`;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(email);
        toast.success(t('footer.emailCopied'));
      }
    } catch {
      // Échec copie → on continue vers mailto
    } finally {
      window.location.href = mailtoUrl;
    }
  };

  // Legacy filter options (fallback when no dynamic categories loaded)
  const getFilterOptions = (): { value: string; label: string }[] => {
    const options = new Map<string, string>();
    options.set('all', t('catalog.all'));
    sections.forEach(({ section, rows }) => {
      const config = section.config as SectionConfig;
      if (!config.filterColumn) return;
      rows.forEach(r => {
        const val = getCellValue(r, config.filterColumn!);
        if (val) {
          val.split(/[,;]/).forEach(v => {
            const trimmed = v.trim();
            if (trimmed && !options.has(trimmed)) options.set(trimmed, trimmed);
          });
        }
      });
    });
    return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
  };

  // ━━━ Phase 1: Memoized category product counts — zero recalc on every render ━━━
  const categoryProductCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sections.forEach(({ rows }) => {
      rows.forEach(r => {
        const data = r.data as Record<string, unknown>;
        if (data.__is_visible__ === false) return;
        const catSlug = String(data.__category__ || '').trim();
        if (catSlug) {
          counts.set(catSlug, (counts.get(catSlug) || 0) + 1);
        }
      });
    });
    return counts;
  }, [sections]);

  // ━━━ Phase 1: Memoized subcategory counts — only recalcs when macro filter changes ━━━
  const subCategoryProductCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (activeMacroFilter === 'all') return counts;
    sections.forEach(({ rows }) => {
      rows.forEach(r => {
        const data = r.data as Record<string, unknown>;
        if (data.__is_visible__ === false) return;
        const catSlug = String(data.__category__ || '').trim();
        if (catSlug !== activeMacroFilter) return;
        const subSlug = String(data.__sub_category__ || '').trim();
        if (subSlug) {
          counts.set(subSlug, (counts.get(subSlug) || 0) + 1);
        }
      });
    });
    return counts;
  }, [sections, activeMacroFilter]);

  // ━━━ Phase 1: Memoized filterRows — stable reference, only changes when filter state changes ━━━
  const filterRows = useCallback((rows: Row[], config: SectionConfig): Row[] => {
    let filtered = rows.filter(r => {
      const data = r.data as Record<string, unknown>;
      // ── Visibility filter: hide products marked as not visible ──
      const isVisible = data.__is_visible__ !== false;
      if (!isVisible) return false;
      const hasTitle = config.titleColumn && data[config.titleColumn];
      const hasCover = config.coverColumn && data[config.coverColumn];
      const hasPrice = config.priceColumn && data[config.priceColumn];
      return hasTitle || hasCover || hasPrice;
    });

    // ━━━ Two-Level Category Filter ━━━━━━━━━━━━━━━━━━━━━━━━━
    // Priority: dynamic categories from DB over legacy filterColumn
    if (dynamicCategories.length > 0) {
      // Level 1: Macro filter by __category__
      if (activeMacroFilter !== 'all') {
        filtered = filtered.filter(r => {
          const data = r.data as Record<string, unknown>;
          return String(data.__category__ || '').trim() === activeMacroFilter;
        });
        // Level 2: Micro filter by __sub_category__ (only when macro is selected)
        if (activeMicroFilter !== 'all') {
          filtered = filtered.filter(r => {
            const data = r.data as Record<string, unknown>;
            return String(data.__sub_category__ || '').trim() === activeMicroFilter;
          });
        }
      }
    } else if (activeFilter !== 'all' && config.filterColumn) {
      // Fallback: legacy single-level filter
      filtered = filtered.filter(r => {
        const val = getCellValue(r, config.filterColumn!);
        return val && val.split(/[,;]/).some(v => v.trim() === activeFilter);
      });
    }

    if (!searchQuery) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(r => {
      const data = r.data as Record<string, unknown>;
      return Object.values(data).some(v => String(v).toLowerCase().includes(q));
    });
  }, [dynamicCategories, activeMacroFilter, activeMicroFilter, activeFilter, searchQuery]);

  const toggleLike = (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedProducts(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // ━━━ Phase 1: Memoized allProducts — expensive flatMap+filter+sort only runs on data/filter change ━━━
  const allProducts = useMemo(() => {
    const items = sections.flatMap(({ section, columns, rows }) => {
      const config = section.config as SectionConfig;
      return filterRows(rows, config).map(row => {
        const rawData = row.data as Record<string, unknown>;
        const statut = (rawData.__statut__ as 'Nouveau' | 'Courant') || 'Courant';
        const stockState = computeStockState(rawData);
        return { row, columns, section, config, statut, stockState };
      });
    });
    // BDD supremacy (Axe 3): row.order is the SOLE source of truth for the
    // vitrine sequence. The previous composite sort (Nouveau+en_stock rank 0,
    // then stock state, then row.order) has been removed — it reset the
    // merchandising on every refresh and destroyed the admin's locked order.
    items.sort((a, b) => a.row.order - b.row.order);
    return items;
  }, [sections, filterRows]);

  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = allProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );



  const filterOptions = getFilterOptions();

  // ── Header refonte: click-outside + ESC handlers ──
  useEffect(() => {
    if (!langMenuOpen && !searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (langMenuOpen && langMenuRef.current && !langMenuRef.current.contains(target)) {
        setLangMenuOpen(false);
      }
      if (searchOpen && searchOverlayRef.current && !searchOverlayRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLangMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [langMenuOpen, searchOpen]);

  // Autofocus the search input when the overlay opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // ═══════════════════════════════════════════════════════════════════════
  // ── PERSISTENT HEADER (sticky top bar — always visible) ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderHeader = () => (
    <header
      className={cn('catalog-header sticky top-0 z-30 bg-white', isDetailView && 'catalog-header--detail')}
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className="catalog-header-inner">
        {/* Back arrow — only visible on detail view */}
        {isDetailView && (
          <button
            onClick={() => setSelectedProduct(null)}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors shrink-0"
            aria-label={t('catalog.backToCatalog')}
          >
            {/* VG36.2 Sprint 2: RTL-aware header back arrow */}
            {rtl ? <ArrowRight className="w-5 h-5" style={{ color: 'var(--pivot-text)' }} /> : <ArrowLeft className="w-5 h-5" style={{ color: 'var(--pivot-text)' }} />}
          </button>
        )}

        {/* Logo or Catalog Name — clickable, aligned with product grid left edge */}
        {/* The back-arrow placeholder was removed so the logo sits flush at the
            left padding edge — perfectly aligned with the product grid below. */}
        <Link
          href="/"
          className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={catalogName}
          onClick={() => {
            setSelectedProduct(null);
            setActiveMacroFilter('all');
            setActiveMicroFilter('all');
            setSearchQuery('');
            setCurrentPage(1);
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {s?.logo ? (
            <img
              src={s.logo}
              alt={catalogName}
              className="w-auto object-contain shrink-0 lp-logo-mobile"
              style={{ height: `${s.logoHeight || 40}px`, maxHeight: `${s.logoHeight || 40}px` }}
            />
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B, #C9A84C)' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--pivot-text)' }}>A</span>
              </div>
              <h1 className="font-display font-bold text-sm sm:text-base truncate" style={{ color: 'var(--pivot-text)' }}>
                {catalogName}
              </h1>
            </>
          )}
        </Link>

        {/* ── Compact Search icon (ref: image_bf7a44.png) ── */}
        {s?.enableSearch && (
          <div ref={searchOverlayRef} className="header-search-wrapper relative shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(o => !o)}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
              aria-label={t('catalog.search')}
              aria-expanded={searchOpen}
            >
              {searchOpen
                ? <X className="w-4 h-4" style={{ color: 'var(--pivot-text)' }} />
                : <Search className="w-4 h-4" style={{ color: 'var(--pivot-text)' }} />}
            </button>
            {/* Expanding search overlay — slides down on click */}
            {searchOpen && (
              <div className="header-search-overlay" role="search">
                <Search className="header-search-overlay-icon" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder={t('catalog.search')}
                  className="header-search-overlay-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    className="header-search-overlay-clear"
                    aria-label={t('catalog.search')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Language Dropdown (ref: image_bf7740.png) — Globe + code, menu with active dot ── */}
        <div ref={langMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setLangMenuOpen(o => !o)}
            className="flex items-center gap-1 h-9 px-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={t('catalog.language')}
            aria-expanded={langMenuOpen}
          >
            <Globe className="w-4 h-4" style={{ color: 'var(--pivot-text)' }} />
            <span className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--pivot-text)' }}>
              {locale.toUpperCase()}
            </span>
          </button>
          {langMenuOpen && (
            <div className="header-lang-menu" role="menu">
              {(['fr', 'en', 'ar'] as const).map(loc => {
                const isActive = locale === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      useAppStore.getState().setClientLocale(loc);
                      setLangMenuOpen(false);
                    }}
                    className={cn('header-lang-item', isActive && 'header-lang-item--active')}
                  >
                    <span className="header-lang-code">{loc.toUpperCase()}</span>
                    {isActive && <span className="header-lang-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin actions — only visible for owner/admin roles */}
        {canAccessBuilder ? (
          <div className="flex items-center gap-1 shrink-0">
            {/* Hard-refresh button — clears localStorage cache and forces full network reload */}
            <button
              onClick={() => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                clearAllCache();
                setSectionsLoaded(false);
                setDynamicCategories([]);
                setColorMapData({});
                setSections([]);
                setLoadError(null);
                networkSyncDone.current = false;
                // Release lock once sections have reloaded
                const check = setInterval(() => {
                  if (useAppStore.getState().catalog?.sections?.length) {
                    setIsRefreshing(false);
                    clearInterval(check);
                  }
                }, 300);
                // Safety: auto-release after 10s
                setTimeout(() => { setIsRefreshing(false); clearInterval(check); }, 10000);
              }}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                isRefreshing ? 'bg-gray-100 pointer-events-none' : 'hover:bg-gray-100'
              )}
              title={t('admin.clearCache')}
              aria-label={t('admin.clearCache')}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} style={{ color: 'var(--muted-foreground)' }} />
            </button>
            <button
              onClick={() => setView('dashboard')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={t('admin.backToDashboard')}
              aria-label={t('admin.dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" style={{ color: 'var(--pivot-brand)' }} />
              <span className="text-[11px] font-medium hidden sm:inline" style={{ color: 'var(--pivot-brand)' }}>{t('admin.dashboard')}</span>
            </button>
          </div>
        ) : (
          /* VG41: Admin lock button removed from public catalog header.
             Admin access is now exclusively via the /admin route. */
          null
        )}
      </div>
    </header>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ── DYNAMIC BREADCRUMBS (only on detail view, scrolls with content) ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderBreadcrumbs = () => {
    if (!selectedProduct) return null;

    const { section } = selectedProduct;
    const config = section.config as SectionConfig;
    const productTitle = config.titleColumn ? getCellValue(selectedProduct.row, config.titleColumn) : '';
    const sectionTitle = section.title || t('catalog.collection');

    return (
      <nav className="catalog-breadcrumb">
        <div className="catalog-breadcrumb-inner">
          {/* Small back arrow for redundancy */}
          <button
            onClick={() => setSelectedProduct(null)}
            className="flex items-center justify-center shrink-0 hover:opacity-60 transition-opacity"
            aria-label={t('catalog.back')}
          >
            {/* VG36.2 Sprint 2: RTL-aware breadcrumb back arrow */}
            {rtl ? <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} /> : <ArrowLeft className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />}
          </button>

          {/* Catalog Name segment */}
          <button
            className="breadcrumb-segment"
            style={{ color: 'var(--muted-foreground)' }}
            onClick={() => setSelectedProduct(null)}
          >
            {catalogName}
          </button>

          <span style={{ color: 'var(--muted-foreground)' }} className="shrink-0">/</span>

          {/* Section Title segment */}
          <button
            className="breadcrumb-segment"
            style={{ color: 'var(--muted-foreground)' }}
            onClick={() => setSelectedProduct(null)}
          >
            {sectionTitle}
          </button>

          <span style={{ color: 'var(--muted-foreground)' }} className="shrink-0">/</span>

          {/* Current product — bolder, not clickable */}
          <span
            className="breadcrumb-segment font-medium truncate"
            style={{ color: 'var(--pivot-text)', cursor: 'default' }}
          >
            {productTitle}
          </span>
        </div>
      </nav>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ── PRODUCT DETAIL VIEW — Delegated to ProductPage component ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderDetailView = () => {
    if (!selectedProduct) return null;
    const { row, columns: detailColumns, section } = selectedProduct;
    return (
      <ProductPage
        row={row}
        columns={detailColumns}
        section={section}
        catalogName={catalogName}
        conversionChannel={resolvedConversionChannel}
        whatsappNumber={s?.whatsappNumber || ''}
        conversionMessage={s?.conversionMessage || ''}
        conversionMessages={s?.conversionMessages || null}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        instagramHandle={s?.instagramHandle || undefined}
        facebookPage={s?.facebookPage || undefined}
        tiktokHandle={s?.tiktokHandle || undefined}
        onBack={() => setSelectedProduct(null)}
        onCheckout={(payload) => setCheckoutData(payload)}
      />
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ── CHECKOUT / FINALISATION VIEW — dedicated two-column checkout page ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderCheckoutView = () => {
    if (!checkoutData) return null;
    return (
      <CheckoutPage
        product={checkoutData}
        onBack={() => setCheckoutData(null)}
      />
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ── CATALOG GRID VIEW ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderGridView = () => (
    <>
      {/* Search bar below header — left-aligned with grid */}
      {/* Search bar moved into the compact header icon (ref: image_bf7a44.png).
          The big input field here is intentionally removed to declutter the layout. */}

      {/* ═══ Règle 2 & 3: Filters on cream white background ═══ */}

      {/* ═══ Mobile Burger Menu (block md:hidden) — minimalist drawer ═══ */}
      {/* VG36.2 Sprint 1: guard switched to sectionsLoaded for category bar resilience */}
      {sectionsLoaded && (
        <div className="block md:hidden" style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid var(--client-border, #e7e5e4)' }}>
          <div className="mx-auto max-w-[1270px] px-4 py-2.5">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-sm font-semibold shadow-sm transition-all duration-200"
              style={{ border: '1px solid #e7e5e4', color: 'var(--client-text, #1B1713)' }}
              aria-expanded={mobileMenuOpen}
              aria-label={t('catalog.categories')}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span>{t('catalog.categories')}</span>
            </button>
          </div>

          {/* Slide-down drawer */}
          {mobileMenuOpen && (
            <div
              className="mx-auto max-w-[1270px] px-4 pb-3"
            >
              <div
                className="rounded-xl overflow-hidden shadow-lg"
                style={{ backgroundColor: '#fff', border: '1px solid #e7e5e4' }}
              >
                {dynamicCategories.length > 0 ? (
                  <>
                    {/* "Tout" — all categories */}
                    <button
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-150',
                        activeMacroFilter === 'all'
                          ? 'text-white'
                          : 'hover:bg-[#FAF8F5]'
                      )}
                      style={activeMacroFilter === 'all' ? { backgroundColor: '#1B1713' } : { color: 'var(--client-text, #1B1713)' }}
                      onClick={() => {
                        setActiveMacroFilter('all');
                        setActiveMicroFilter('all');
                        setCurrentPage(1);
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                    >
                      {t('catalog.all')}
                    </button>

                    {/* Macro categories */}
                    {dynamicCategories
                      .filter(cat => cat.visible)
                      .map(cat => {
                        const count = categoryProductCounts.get(cat.slug) || 0;
                        const isActive = activeMacroFilter === cat.slug;
                        const visibleSubs = isActive
                          ? (cat.subCategories?.filter(sub => sub.visible) || [])
                          : [];
                        return (
                          <div key={cat.slug}>
                            <button
                              className={cn(
                                'w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-150 flex items-center justify-between',
                                isActive ? 'text-white' : 'hover:bg-[#FAF8F5]'
                              )}
                              style={isActive ? { backgroundColor: '#1B1713' } : { color: 'var(--client-text, #1B1713)' }}
                              onClick={() => {
                                setActiveMacroFilter(cat.slug);
                                setActiveMicroFilter('all');
                                setCurrentPage(1);
                                setMobileMenuOpen(false);
                                window.scrollTo({ top: 0, behavior: 'instant' });
                              }}
                            >
                              <span>{resolveT(cat.translations, cat.label)}</span>
                            </button>

                            {/* Sub-categories — shown when this macro is active */}
                            {isActive && visibleSubs.length > 0 && (
                              <div style={{ backgroundColor: '#FAF8F5' }}>
                                <button
                                  className={cn(
                                    'w-full text-left pl-8 pr-4 py-2 text-xs font-medium transition-colors duration-150',
                                    activeMicroFilter === 'all' ? 'font-bold' : 'hover:text-black'
                                  )}
                                  style={{
                                    color: activeMicroFilter === 'all'
                                      ? 'var(--client-text, #1B1713)'
                                      : '#8B4513',
                                  }}
                                  onClick={() => {
                                    setActiveMicroFilter('all');
                                    setCurrentPage(1);
                                    setMobileMenuOpen(false);
                                  }}
                                >
                                  {t('filter.all')}
                                </button>
                                {visibleSubs.map(sub => {
                                  const subCount = subCategoryProductCounts.get(sub.slug) || 0;
                                  return (
                                    <button
                                      key={sub.slug}
                                      className={cn(
                                        'w-full text-left pl-8 pr-4 py-2 text-xs font-medium transition-colors duration-150 flex items-center justify-between',
                                        activeMicroFilter === sub.slug ? 'font-bold' : 'hover:text-black'
                                      )}
                                      style={{
                                        color: activeMicroFilter === sub.slug
                                          ? 'var(--client-text, #1B1713)'
                                          : '#8B4513',
                                      }}
                                      onClick={() => {
                                        setActiveMicroFilter(sub.slug);
                                        setCurrentPage(1);
                                        setMobileMenuOpen(false);
                                      }}
                                    >
                                      <span>{resolveT(sub.translations, sub.label)}</span>
                                      {subCount > 0 && (
                                        <span className="text-[10px] text-gray-400">{subCount}</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </>
                ) : (
                  /* Legacy filter options (fallback when no dynamic categories) */
                  filterOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-150',
                        activeFilter === opt.value ? 'text-white' : 'hover:bg-[#FAF8F5]'
                      )}
                      style={activeFilter === opt.value ? { backgroundColor: '#1B1713' } : { color: 'var(--client-text, #1B1713)' }}
                      onClick={() => {
                        setActiveFilter(opt.value);
                        setCurrentPage(1);
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Desktop Filter Bar (hidden md:block) — horizontal capsule pills ═══ */}
      {/* VG36.2 Sprint 1: guard switched to sectionsLoaded for category bar resilience.
          The inner dynamicCategories.length > 0 still decides WHICH bar to render
          (macro categories vs filter options), but the OUTER wrapper no longer
          disappears when the API returns an empty array on first load. */}
      {sectionsLoaded && (
        <>
      {dynamicCategories.length > 0 ? (
        <div className="catalog-filter-bar-wrap hidden md:block">
          {/* ── Level 1: Macro Categories — elongated capsule pills ── */}
          <div className="catalog-filter-bar no-scrollbar">
            <button
              className={cn(
                'px-5 py-1.5 rounded-[999px] text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200',
                activeMacroFilter === 'all' ? 'btn-filter-active' : 'btn-filter-default'
              )}
              onClick={() => { setActiveMacroFilter('all'); setActiveMicroFilter('all'); setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'instant' }); }}
            >
              {t('catalog.all')}
            </button>
            {(() => {
              return dynamicCategories
                .filter(cat => cat.visible)
                .map(cat => {
                  const count = categoryProductCounts.get(cat.slug) || 0;
                  return (
                    <button
                      key={cat.slug}
                      className={cn(
                        'px-5 py-1.5 rounded-[999px] text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200',
                        activeMacroFilter === cat.slug ? 'btn-filter-active' : 'btn-filter-default'
                      )}
                      onClick={() => {
                        setActiveMacroFilter(cat.slug);
                        setActiveMicroFilter('all');
                        setCurrentPage(1);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                    >
                      {resolveT(cat.translations, cat.label)}
                    </button>
                  );
                });
            })()}
          </div>

          {/* ── Level 2: Micro Sub-filters — ALWAYS mounted, CSS-animated ━━ */}
          {/* ━━━ Brand Chart color: inactive text uses chart-3 (#8B4513) instead of noir ━━━ */}
          {(() => {
            const selectedCat = activeMacroFilter !== 'all' ? dynamicCategories.find(c => c.slug === activeMacroFilter) : null;
            const visibleSubs = selectedCat?.subCategories?.filter(sub => sub.visible) || [];
            const hasSubs = visibleSubs.length > 0;
            const subCounts = subCategoryProductCounts;
            return (
              <div className={cn(
                'catalog-subfilter-slot no-scrollbar',
                hasSubs && 'catalog-subfilter-slot--visible'
              )}>
                <div className="catalog-filter-bar no-scrollbar" style={{ paddingTop: '4px', paddingBottom: '8px', marginTop: '4px' }}>
                  {/* "Tous" sub-pill */}
                  <button
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-all duration-200',
                      activeMicroFilter === 'all' ? 'btn-filter-sub-active shadow-sm' : 'btn-filter-sub-inactive hover:opacity-80'
                    )}
                    onClick={() => { setActiveMicroFilter('all'); setCurrentPage(1); }}
                  >
                    {t('filter.all')}
                  </button>
                  {visibleSubs.map(sub => {
                    const count = subCounts.get(sub.slug) || 0;
                    return (
                      <button
                        key={sub.slug}
                        className={cn(
                          'px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-all duration-200',
                          activeMicroFilter === sub.slug ? 'btn-filter-sub-active shadow-sm' : 'btn-filter-sub-inactive hover:opacity-80'
                        )}
                        onClick={() => { setActiveMicroFilter(sub.slug); setCurrentPage(1); }}
                      >
                        {resolveT(sub.translations, sub.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      ) : filterOptions.length > 1 ? (
        <div className="catalog-filter-bar-wrap hidden md:block">
          <div className="catalog-filter-bar no-scrollbar">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                className={cn(
                  'px-5 py-1.5 rounded-[999px] text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200',
                  activeFilter === opt.value ? 'btn-filter-active' : 'btn-filter-default'
                )}
                onClick={() => { setActiveFilter(opt.value); setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'instant' }); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
        </>
      )}

      {/* ── Contextual Category Title ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeMacroFilter !== 'all' && dynamicCategories.length > 0 && (() => {
        const selectedCat = dynamicCategories.find(c => c.slug === activeMacroFilter);
        if (!selectedCat) return null;
        return (
          <div className="mx-auto max-w-[1270px] px-4 sm:px-8 pt-5 pb-1">
            <h2 className="font-display text-2xl sm:text-3xl font-bold" style={{ color: 'var(--pivot-text)' }}>
              {resolveT(selectedCat.translations, selectedCat.label)}
            </h2>
          </div>
        );
      })()}

      {/* Error */}
      {loadError && (
        <div className="catalog-container">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'rgba(128,0,32,0.06)', border: '1px solid rgba(128,0,32,0.19)' }}>
            <p className="text-sm" style={{ color: 'var(--pivot-danger)' }}>{loadError}</p>
            <button onClick={() => { setSectionsLoaded(false); setLoadError(null); networkSyncDone.current = false; }} className="text-xs underline mt-1" style={{ color: 'var(--pivot-danger)' }}>{t('catalog.retry')}</button>
          </div>
        </div>
      )}

      {/* Product Gallery */}
      <main className="catalog-container flex-1">
        {/* Section title */}
        {sections.length > 0 && sections[0].section.title && (
          <div className="catalog-toolbar">
            <h2 className="font-display" style={{ color: secondaryColor }}>
              {sections[0].section.title}
            </h2>
            {sections[0].section.subtitle && (
              <span style={{ color: '#777', fontSize: 15 }}>{sections[0].section.subtitle}</span>
            )}
          </div>
        )}

        {/* Glide-like grid */}
        <div className="catalog-grid catalog-grid-fade">
          {paginatedProducts.map(({ row, columns, section, config, statut, stockState }) => {
            const rawData = row.data as Record<string, unknown>;
            const coverRawVal = config.coverColumn ? rawData[config.coverColumn] : null;
            let coverUrl = '';
            if (coverRawVal) {
              if (Array.isArray(coverRawVal)) {
                const imgs = parseImageUrls(coverRawVal);
                coverUrl = imgs[0] || '';
              } else if (typeof coverRawVal === 'string') {
                const imgs = parseImageUrls(coverRawVal);
                coverUrl = imgs[0] || '';
              } else {
                coverUrl = String(coverRawVal);
              }
            }
            const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
            const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
            const isLiked = likedProducts.has(row.id);
            const isEpuise = stockState === 'epuise';
            const isSurCommande = stockState === 'sur_commande';
            // ━━ Axe 2: marketing status band (pied d'image) ━━
            // Resolves row.data.__statut__ → bilingual label + vibrant color.
            // Returns null for "Courant" / unrecognized statut → no band.
            const marketingStatus = resolveMarketingStatus(statut, locale);
            // ━━ Axe 1: discount (hoisted — feeds top-left badge + price-row strikethrough) ━━
            const discount = computeDiscount(price, getCompareAtPrice(rawData));

            return (
              <article key={row.id} className="product-card group">
                {/* Clickable overlay */}
                <button
                  className="product-card-action"
                  onClick={() => { setSelectedProduct({ row, columns, section }); setCarouselIdx(0); }}
                  aria-label={`${t('catalog.viewProduct')} ${title}`}
                />

                {/* Image: aspect-ratio 4/3, object-fit cover */}
                <div className="product-card-image-wrap">
                  {coverUrl ? (
                    <img
                      src={resolveDirectImageUrl(coverUrl, 800)}
                      alt={title}
                      width={400}
                      height={300}
                      loading="lazy"
                      decoding="async"
                      className="product-card-img"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        // Retry with proxy if direct CDN fails
                        if (!el.dataset.retried) {
                          el.dataset.retried = '1';
                          el.src = resolveProxyImageUrl(coverUrl, 800);
                          return;
                        }
                        // Both failed — show placeholder
                        el.style.display = 'none';
                        const parent = el.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="product-card-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#808080" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;
                        }
                      }}
                    />
                  ) : (
                    <div className="product-card-placeholder">
                      <ImageIcon style={{ width: 40, height: 40, color: '#808080', opacity: 0.3 }} />
                    </div>
                  )}

                  {/* Like button */}
                  <button
                    onClick={(e) => toggleLike(row.id, e)}
                    className="product-card-like"
                    style={{ background: isLiked ? '#FEE2E2' : 'rgba(255,255,255,0.9)' }}
                    aria-label={t('product.favorite')}
                  >
                    <Heart className={isLiked ? 'fill-current' : ''} style={{ width: 14, height: 14, color: isLiked ? '#EF4444' : '#808080' }} />
                  </button>

                  {/* ━━━ DISCOUNT BADGE — top-left, soft coral (#EF4444) ━━ Axe 1 ━━━ */}
                  {discount.hasDiscount && (
                    <span className="product-card-discount-badge" aria-label={`-${discount.percentage}%`}>
                      -{discount.percentage}%
                    </span>
                  )}

                  {/* ━━━ HOVER CTA — opens Product Detail Page (PDP) ━━ FIX VG34.2 ━━━ */}
                  <button
                    className={cn(
                      'product-card-hover-cta',
                      isEpuise && 'product-card-hover-cta--disabled'
                    )}
                    data-cta="product-card-view"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEpuise) {
                        setSelectedProduct({ row, columns, section });
                        setCarouselIdx(0);
                      }
                    }}
                    aria-label={isEpuise ? t('product.soldOut') : t('product.commander')}
                  >
                    {isEpuise ? t('product.soldOut') : t('product.commander')}
                  </button>

                  {/* ━━━ STATUS BAND — Pied d'image (italic, Sentence case) ━━ Axe 2 ━━━ */}
                  {/* Null for "Courant" / unrecognized statut → no band rendered. */}
                  {marketingStatus && (
                    <div
                      className="product-card-status-band"
                      style={{ backgroundColor: marketingStatus.color }}
                      dir={rtl ? 'rtl' : 'ltr'}
                    >
                      <span className="product-card-status-band-text">
                        {marketingStatus.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Text — DEBT-10 repair : traduction auto via ProductCardTitle */}
                {config.showTitle !== false && title && (
                  <ProductCardTitle title={title} locale={locale} />
                )}

                {/* Color dots — NATIVE color column only (single source of truth).
                    Reads exclusively from `config.colorColumn` (the COLOR-type
                    column validated in admin via ColorMap). Raw import fields
                    (optionscouleurs, couleurs, …) are intentionally NOT read
                    so the public catalog never displays unvalidated colors.
                    If the native column is empty/missing, the entire block is
                    hidden — no broken pills, no neutral placeholder. */}
                {(() => {
                  const rawColors = config.colorColumn ? getCellValue(row, config.colorColumn) : '';
                  if (!rawColors) return null;
                  const names = rawColors.split(/[,;]/).map(v => v.trim()).filter(Boolean);
                  if (names.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1 mt-0.5 px-0.5">
                      {names.slice(0, 5).map(name => {
                        const hex = resolveColorHex(name, colorMapData);
                        return (
                          <div
                            key={name}
                            className={cn(
                              'w-3.5 h-3.5 rounded-full border border-black/10 shrink-0',
                              !hex && 'color-dot-missing'
                            )}
                            style={hex ? { backgroundColor: hex } : undefined}
                            title={name}
                          />
                        );
                      })}
                      {names.length > 5 && (
                        <span className="text-[9px] text-muted-foreground ml-0.5">+{names.length - 5}</span>
                      )}
                    </div>
                  );
                })()}

                {/* Price line with inline status — minimalist, high-end */}
                {/* Axe 1: discount badge -X% moved to top-left of image (coral #EF4444). Strikethrough original price kept here. */}
                {((price && config.showPrice !== false) || isEpuise || isSurCommande) && (
                  <div className="product-card-price-row">
                    {price && config.showPrice !== false && (
                      <>
                        <span className="product-card-price">
                          <PriceText locale={locale}>{formatPrice(price)}</PriceText>
                        </span>
                        {/* DEBT-9 : prix barré si compareAtPrice > price */}
                        {discount.hasDiscount && (
                          <span
                            className="product-card-price-original"
                            style={{
                              color: 'var(--muted-foreground, #888)',
                              fontSize: '0.85em',
                              opacity: 0.7,
                            }}
                            aria-label={t('product.originalPrice')}
                          >
                            <PriceText strikethrough locale={locale}>{formatPrice(discount.compareAtPrice!)}</PriceText>
                          </span>
                        )}
                      </>
                    )}
                    {/* Scenario B: Épuisé — soft rose, no background */}
                    {isEpuise && (
                      <span className="product-card-status product-card-status--epuise">
                        {t('product.soldOut')}
                      </span>
                    )}
                    {/* Scenario C: Sur commande — amber/gold, no background */}
                    {isSurCommande && (
                      <span className="product-card-status product-card-status--sur-commande">
                        {t('product.onOrder')}
                      </span>
                    )}
                  </div>
                )}

                {/* No CTA below card — micro-CTA is on the image */}
              </article>
            );
          })}
        </div>

        {/* Empty state */}
        {allProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 16px' }}>
            <div style={{ width: 80, height: 80, margin: '0 auto 20px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `${primaryColor}15` }}>
              <ShoppingBag style={{ width: 36, height: 36, color: primaryColor, opacity: 0.5 }} />
            </div>
            <p className="font-display" style={{ fontSize: 18, fontWeight: 600, color: secondaryColor }}>{t('catalog.noProducts')}</p>
            {searchQuery ? (
              <p style={{ fontSize: 14, marginTop: 6, color: '#777' }}>{t('catalog.tryAnotherSearch')}</p>
            ) : isAdmin ? (
              <p style={{ fontSize: 14, marginTop: 6, color: '#777' }}>{t('catalog.addSections')}</p>
            ) : (
              <p style={{ fontSize: 14, marginTop: 6, color: '#777' }}>{t('catalog.preparing')}</p>
            )}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          primaryColor={primaryColor}
          rtl={rtl}
        />
      </main>

      {/* Trust Guarantees — VG32: 4 trust cards above footer */}
      <TrustGuaranteesSection />

      {/* Footer — sticky to bottom, 3-column responsive grid */}
      <footer className="mt-auto py-8 sm:py-10" style={{ backgroundColor: secondaryColor }}>
        <div className="mx-auto px-4 sm:px-8" style={{ maxWidth: 1270 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">

            {/* ── Col 1: Logo (clickable, top-left) + Social block ── */}
            <div className="flex flex-col items-start text-start gap-4">
              <Link
                href="/"
                className="cursor-pointer inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                aria-label={catalogName}
                onClick={() => {
                  setSelectedProduct(null);
                  setActiveMacroFilter('all');
                  setActiveMicroFilter('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {s?.logo ? (
                  <img src={s.logo} alt={catalogName} className="w-auto object-contain" style={{ height: `${Math.round((s.logoHeight || 40) * 0.6)}px`, maxHeight: `${Math.round((s.logoHeight || 40) * 0.6)}px`, filter: 'brightness(0) invert(1)' }} />
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B)' }}>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--pivot-text)' }}>A</span>
                    </div>
                    <span className="font-display font-semibold text-xs sm:text-sm text-white">
                      {catalogName}
                    </span>
                  </>
                )}
              </Link>

              {/* Social block — Premium horizontal icon row (réseaux sociaux uniquement — email dissocié) */}
              {(s?.whatsappNumber || s?.messengerLink || s?.instagramHandle || s?.facebookPage || s?.tiktokHandle) && (
                <div className="flex flex-col items-start text-start gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{t('footer.followUs')}</span>
                  <div className="flex items-center gap-2.5">
                    {/* Instagram */}
                    {s?.instagramHandle && (
                      <a
                        href={`https://instagram.com/${s.instagramHandle.replace('@','')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('footer.instagram')}
                        className="group flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-pink-500/30"
                      >
                        <svg className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                        </svg>
                      </a>
                    )}
                    {/* Facebook */}
                    {s?.facebookPage && (
                      <a
                        href={s.facebookPage.startsWith('http') ? s.facebookPage : `https://facebook.com/${s.facebookPage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('footer.facebook')}
                        className="group flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-[#1877F2] transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/30"
                      >
                        <svg className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                    )}
                    {/* TikTok */}
                    {s?.tiktokHandle && (
                      <a
                        href={s.tiktokHandle.startsWith('http') ? s.tiktokHandle : `https://tiktok.com/@${s.tiktokHandle.replace('@','')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('footer.tiktok')}
                        className="group flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-gradient-to-br hover:from-[#00f2ea] hover:via-[#ff0050] hover:to-[#000000] transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-red-500/30"
                      >
                        <svg className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78 2.92 2.92 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.57 6.33 6.33 0 0 0 9.37 22a6.33 6.33 0 0 0 6.34-6.22V8.79a8.18 8.18 0 0 0 3.88.97V6.69z"/>
                        </svg>
                      </a>
                    )}
                    {/* WhatsApp */}
                    {s?.whatsappNumber && (
                      <a
                        href={`https://wa.me/${s.whatsappNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('footer.whatsapp')}
                        className="group flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-[#25D366] transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-green-500/30"
                      >
                        <svg className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ── Bloc Contact Email dissocié (DEBT-7) ── */}
              {/* L'email n'est plus mêlé aux réseaux sociaux : bloc dédié avec icône enveloppe + adresse visible */}
              {s?.emailContact && (
                <div className="flex flex-col items-start text-start gap-2 mt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{t('footer.contactEmail')}</span>
                  <button
                    type="button"
                    onClick={() => handleEmailClick(s.emailContact!)}
                    aria-label={t('footer.email')}
                    title={s.emailContact}
                    className="group flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[#C9A84C]/15 hover:bg-[#C9A84C]/30 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-[#C9A84C] group-hover:text-white transition-colors" />
                    </span>
                    <span className="truncate max-w-[180px]" dir="ltr">{s.emailContact}</span>
                  </button>
                </div>
              )}
            </div>

            {/* ── Col 2: Pages Réglementaires ── */}
            <div className="flex flex-col items-start text-start gap-2">
              <h3 className="font-display text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1">
                {t('footer.regulatoryPages')}
              </h3>
              <a href="/conditions-generales" className="text-xs text-white/70 hover:text-white transition-colors">{t('footer.cgv')}</a>
              <a href="/mentions-legales" className="text-xs text-white/70 hover:text-white transition-colors">{t('footer.legalNotice')}</a>
              <a href="/politique-de-confidentialite" className="text-xs text-white/70 hover:text-white transition-colors">{t('footer.privacyPolicy')}</a>
            </div>

            {/* ── Col 3: Catalog Navigation (quick access to categories) ── */}
            <div className="flex flex-col items-start text-start gap-2">
              <h3 className="font-display text-[10px] font-semibold uppercase tracking-wider text-white/50 mb-1">
                {t('footer.quickNav')}
              </h3>
              <button
                type="button"
                onClick={() => { setActiveMacroFilter('all'); setActiveMicroFilter('all'); setSearchQuery(''); setCurrentPage(1); setSelectedProduct(null); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="text-xs text-white/70 hover:text-white transition-colors text-start"
              >
                {t('catalog.all')}
              </button>
              {dynamicCategories
                .filter(cat => cat.visible)
                .map(cat => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => { setActiveMacroFilter(cat.slug); setActiveMicroFilter('all'); setCurrentPage(1); setSelectedProduct(null); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-xs text-white/70 hover:text-white transition-colors text-start"
                  >
                    {resolveT(cat.translations, cat.label)}
                  </button>
                ))}
            </div>
          </div>

          {/* Copyright — bottom, left-aligned */}
          <div className="mt-8 pt-4 text-start" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <p className="text-[11px] text-white/50">
              &copy; {new Date().getFullYear()} {catalogName}. {t('footer.rights')}.
            </p>
          </div>
        </div>
      </footer>

      {/* VG37.1 Axe 1+2: CartDrawer and CartHeaderButton removed from CatalogPreview.
          GlobalCart (mounted in root layout) now handles both globally.
          The checkout flow is triggered via the checkoutTrigger counter in the
          cart store — watched by the useEffect below. */}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ── MAIN RENDER ──
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-clip" style={{ backgroundColor: '#FAF8F5' }} dir={rtl ? 'rtl' : 'ltr'}>
      {/* Persistent Header — always visible */}
      {renderHeader()}

      {/* Conditional: Checkout tunnel > Product detail > Catalog grid */}
      {checkoutData
        ? renderCheckoutView()
        : isDetailView
          ? renderDetailView()
          : renderGridView()}

      {/* Floating WhatsApp badge — only in Landing Page mode (hidden during checkout) */}
      {!checkoutData && (
        <SocialStickyTickets
          whatsappNumber={s?.whatsappNumber || ''}
          conversionChannel={resolvedConversionChannel}
        />
      )}

      {/* Footer — voir rendu dédié plus haut */}
    </div>
  );
}
