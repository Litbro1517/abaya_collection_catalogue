'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, ColumnConfig, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Search, MessageCircle, ChevronLeft, ChevronRight,
  Mail, Instagram, ImageIcon, BookOpen, Settings, Heart,
  ShoppingBag, LayoutDashboard, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductPage } from './ProductPage';

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

const ITEMS_PER_PAGE = 16;

// ── Image URL Resolution ──

// Direct CDN URL — for <img> src (no CORS proxy needed, instant loading)
function resolveDirectImageUrl(url: string, size = 1200): string {
  if (!url) return '';

  // Already a proxy URL — extract the ID and build direct CDN URL
  const proxyMatch = url.match(/\/api\/google\/image-proxy\?id=([^&]+)&sz=(\d+)/);
  if (proxyMatch) {
    return `https://lh3.googleusercontent.com/d/${proxyMatch[1]}=w${size}`;
  }

  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of drivePatterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://lh3.googleusercontent.com/d/${match[1]}=w${size}`;
    }
  }

  return url;
}

// Proxy URL — fallback for images that fail to load via direct CDN
function resolveProxyImageUrl(url: string, size = 1200): string {
  if (!url) return '';

  const proxyMatch = url.match(/\/api\/google\/image-proxy\?id=([^&]+)&sz=(\d+)/);
  if (proxyMatch) {
    if (parseInt(proxyMatch[2]) < size) {
      return `/api/google/image-proxy?id=${proxyMatch[1]}&sz=${size}`;
    }
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
    if (match) {
      return `/api/google/image-proxy?id=${match[1]}&sz=${size}`;
    }
  }

  return url;
}

// Legacy alias — routes through proxy (kept for non-img usage)
function resolveImageUrl(url: string, size = 1200): string {
  return resolveProxyImageUrl(url, size);
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
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  primaryColor: string;
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
        style={{ color: BRAND.vertFonce }}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2" style={{ color: BRAND.grisMoyen }}>...</span>
        ) : (
          <button
            key={p}
            className="w-10 h-10 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              backgroundColor: p === currentPage ? primaryColor : 'transparent',
              color: p === currentPage ? BRAND.blanc : BRAND.noir,
            }}
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="p-2 rounded-xl transition disabled:opacity-30"
        style={{ color: BRAND.vertFonce }}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Main Catalog Component ──
// ═══════════════════════════════════════════════════════════════════════════

interface CatalogPreviewProps {
  onAdminLogin?: () => void;
}

export function CatalogPreview({ onAdminLogin }: CatalogPreviewProps) {
  const { catalog, settings, isAdmin, adminUser, setView } = useAppStore();

  // Only owner/admin can access the builder — editors and public users cannot
  const canAccessBuilder = isAdmin && adminUser && (adminUser.role === 'owner' || adminUser.role === 'admin' || adminUser.role === 'super_admin');
  const [sections, setSections] = useState<{ section: Section; columns: Column[]; rows: Row[] }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ row: Row; columns: Column[]; section: Section } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // ━━━ Two-Level Dynamic Category Filter ━━━━━━━━━━━━━━━━━━━━━━━━━
  // Level 1: Macro categories (Ensemble, Abaya, Kimono, etc.)
  // Level 2: Micro sub-filters (Nouveau, Saison, Discount) — contextual
  const [activeMacroFilter, setActiveMacroFilter] = useState<string>('all'); // category slug or 'all'
  const [activeMicroFilter, setActiveMicroFilter] = useState<string>('all'); // subcategory slug or 'all'
  const [dynamicCategories, setDynamicCategories] = useState<{
    id: string; slug: string; label: string; visible: boolean; ordre: number;
    subCategories: { id: string; slug: string; label: string; visible: boolean; ordre: number; categoryId: string }[];
  }[]>([]);

  // Fetch dynamic categories from DB on mount; auto-seed defaults if empty
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data && json.data.length > 0) {
          setDynamicCategories(json.data);
          return;
        }
        // No categories found — seed defaults and re-fetch
        const seedRes = await fetch('/api/categories/seed', { method: 'POST' });
        if (seedRes.ok) {
          const catRes = await fetch('/api/categories');
          if (catRes.ok) {
            const catJson = await catRes.json();
            if (catJson?.data) setDynamicCategories(catJson.data);
          }
        }
      } catch {
        // Silent fail — catalog still works with legacy filter
      }
    };
    loadCategories();
  }, []);

  const s = settings || catalog?.settings;
  const primaryColor = s?.primaryColor || BRAND.dore;
  const secondaryColor = s?.secondaryColor || BRAND.vertFonce;
  const accentColor = s?.accentColor || BRAND.beige;
  const bgColor = s?.backgroundColor || BRAND.blanc;

  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDetailView = !!selectedProduct;
  const catalogName = catalog?.name || 'Abaya Chic Collection';

  // Carousel state (at top level to comply with hooks rules)
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Scroll to top when switching views
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedProduct]);

  useEffect(() => {
    if (!catalog?.sections || sectionsLoaded) return;
    let cancelled = false;

    const loadSections = async () => {
      const loaded: { section: Section; columns: Column[]; rows: Row[] }[] = [];

      for (const section of catalog.sections) {
        if (!section.visible) continue;
        const config = section.config as SectionConfig;
        const dsId = config.dataSourceId;
        if (!dsId) {
          loaded.push({ section, columns: [], rows: [] });
          continue;
        }

        try {
          const [metaRes, rowsRes] = await Promise.all([
            fetch(`/api/datasources/${dsId}?mode=meta`),
            fetch(`/api/datasources/${dsId}/rows?limit=200`),
          ]);

          let columns: Column[] = [];
          let rows: Row[] = [];

          if (metaRes.ok) {
            const metaJson = await metaRes.json();
            columns = metaJson.data?.columns || [];
          }

          if (rowsRes.ok) {
            const rowsJson = await rowsRes.json();
            rows = rowsJson.data || [];
          }

          loaded.push({ section, columns, rows });
        } catch (err) {
          console.error('Failed to load section data:', err);
          loaded.push({ section, columns: [], rows: [] });
        }
      }

      if (!cancelled) {
        setSections(loaded);
        setSectionsLoaded(true);
        setLoadError(null);
      }
    };

    loadSections().catch(err => {
      console.error('Section loading failed:', err);
      if (!cancelled) {
        setLoadError('Erreur de chargement des données');
        setSectionsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [catalog, sectionsLoaded]);

  const getCellValue = (row: Row, slug: string): string => {
    const data = row.data as Record<string, unknown>;
    const val = data[slug];
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

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

  const getImageCount = useCallback((row: Row, config: SectionConfig, columns?: Column[]): number => {
    return getCarouselImages(row, config, columns).length;
  }, [getCarouselImages]);

  const buildConversionLink = (row: Row, config: SectionConfig): string => {
    const title = getCellValue(row, config.titleColumn || '');
    const price = getCellValue(row, config.priceColumn || '');
    const phone = s?.whatsappNumber || '';

    if (s?.conversionChannel === 'whatsapp' && phone) {
      const msg = s?.conversionMessage || `Bonjour, je souhaite commander :\n*${title}*\nPrix : ${price}`;
      return `https://wa.me/${phone}?text=${encodeURIComponent(msg.replace('{product}', title))}`;
    }
    if (s?.conversionChannel === 'messenger' && s?.messengerLink) {
      return s.messengerLink;
    }
    if (s?.conversionChannel === 'email' && s?.emailContact) {
      return `mailto:${s.emailContact}?subject=${encodeURIComponent(`Commande : ${title}`)}`;
    }
    return '#';
  };

  // Legacy filter options (fallback when no dynamic categories loaded)
  const getFilterOptions = (): { value: string; label: string }[] => {
    const options = new Map<string, string>();
    options.set('all', 'Tout');
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

  // Compute product counts per category slug (from __category__ field in row data)
  const getCategoryProductCounts = (): Map<string, number> => {
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
  };

  // Compute product counts per subcategory slug for a given category
  const getSubCategoryProductCounts = (categorySlug: string): Map<string, number> => {
    const counts = new Map<string, number>();
    sections.forEach(({ rows }) => {
      rows.forEach(r => {
        const data = r.data as Record<string, unknown>;
        if (data.__is_visible__ === false) return;
        const catSlug = String(data.__category__ || '').trim();
        if (catSlug !== categorySlug) return;
        const subSlug = String(data.__sub_category__ || '').trim();
        if (subSlug) {
          counts.set(subSlug, (counts.get(subSlug) || 0) + 1);
        }
      });
    });
    return counts;
  };

  const filterRows = (rows: Row[], config: SectionConfig): Row[] => {
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
  };

  const toggleLike = (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedProducts(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // ━━━ REACTIVE 3-DIMENSIONAL STATE ENGINE ━━━━━━━━━━━━━━━━━━━━━━━━━
  // Scenario A: stock > 0 + switch ON → "En stock" (normal, buyable)
  // Scenario B: stock == 0 + switch OFF → "Épuisé" (SOLD OUT, buy disabled)
  // Scenario C: stock == 0 + switch ON → "Sur commande" (buyable, special badge)
  type StockState = 'en_stock' | 'epuise' | 'sur_commande';

  function computeStockState(rawData: Record<string, unknown>): StockState {
    const isDisponible = String(rawData.__disponibilite__) !== 'false';
    const stock = typeof rawData.__stock__ === 'number'
      ? rawData.__stock__
      : parseInt(String(rawData.__stock__)) || 0;

    // ━━━ SAFETY NET: stock > 0 always implies "Disponible" ━━━
    // If stock > 0 but __disponibilite__ is somehow 'false', that's an
    // invalid state (likely from a bulk import bug). Correct it on-the-fly.
    if (stock > 0) return 'en_stock';                       // Scenario A (+ safety net)
    if (stock === 0 && isDisponible) return 'sur_commande'; // Scenario C
    return 'epuise';                                        // Scenario B
  }

  const allProducts = (() => {
    const items = sections.flatMap(({ section, columns, rows }) => {
      const config = section.config as SectionConfig;
      return filterRows(rows, config).map(row => {
        const rawData = row.data as Record<string, unknown>;
        const statut = (rawData.__statut__ as 'Nouveau' | 'Courant') || 'Courant';
        const stockState = computeStockState(rawData);
        return { row, columns, section, config, statut, stockState };
      });
    });
    // Composite sort: Nouveau+en_stock first, then by stock state, then by row order
    items.sort((a, b) => {
      // Nouveau + en_stock products come first
      const aIsNouveau = a.statut === 'Nouveau' && a.stockState === 'en_stock' ? 0 : 1;
      const bIsNouveau = b.statut === 'Nouveau' && b.stockState === 'en_stock' ? 0 : 1;
      if (aIsNouveau !== bIsNouveau) return aIsNouveau - bIsNouveau;
      // Then en_stock > sur_commande > epuise
      const stateOrder: Record<StockState, number> = { en_stock: 0, sur_commande: 1, epuise: 2 };
      const aState = stateOrder[a.stockState];
      const bState = stateOrder[b.stockState];
      if (aState !== bState) return aState - bState;
      return a.row.order - b.row.order;
    });
    return items;
  })();

  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = allProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const [lastSearchQuery, setLastSearchQuery] = useState('');
  if (searchQuery !== lastSearchQuery) {
    setLastSearchQuery(searchQuery);
    setCurrentPage(1);
  }

  const filterOptions = getFilterOptions();

  // ═══════════════════════════════════════════════════════════════════════
  // ── PERSISTENT HEADER (sticky top bar — always visible) ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderHeader = () => (
    <header className="catalog-header sticky top-0 z-30 border-b bg-white/95" style={{ borderColor: `${BRAND.dore}15` }}>
      <div className="catalog-header-inner">
        {/* Back arrow — only visible on detail view */}
        {isDetailView ? (
          <button
            onClick={() => setSelectedProduct(null)}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Retour au catalogue"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: BRAND.noir }} />
          </button>
        ) : (
          <div className="w-9 h-9 shrink-0" />
        )}

        {/* Logo badge + Catalog Name */}
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B, #C9A84C)' }}>
            <span className="text-sm font-bold" style={{ color: BRAND.noir }}>A</span>
          </div>
          <h1 className="font-bold text-sm sm:text-base truncate" style={{ color: BRAND.noir, fontFamily: "'Playfair Display', serif" }}>
            {catalogName}
          </h1>
        </div>

        {/* Dashboard button — only visible for owner/admin roles */}
        {canAccessBuilder ? (
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            title="Retour au Dashboard"
            aria-label="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4" style={{ color: BRAND.vertFonce }} />
            <span className="text-[11px] font-medium hidden sm:inline" style={{ color: BRAND.vertFonce }}>Dashboard</span>
          </button>
        ) : (
          <button
            onClick={onAdminLogin}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors shrink-0"
            title="Accès administrateur"
            aria-label="Connexion admin"
          >
            <Lock className="w-4 h-4" style={{ color: BRAND.grisMoyen }} />
          </button>
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
    const sectionTitle = section.title || 'Collection';

    return (
      <nav className="catalog-breadcrumb">
        <div className="catalog-breadcrumb-inner">
          {/* Small back arrow for redundancy */}
          <button
            onClick={() => setSelectedProduct(null)}
            className="flex items-center justify-center shrink-0 hover:opacity-60 transition-opacity"
            aria-label="Retour"
          >
            <ArrowLeft className="w-3.5 h-3.5" style={{ color: BRAND.grisMoyen }} />
          </button>

          {/* Catalog Name segment */}
          <button
            className="breadcrumb-segment"
            style={{ color: BRAND.grisMoyen }}
            onClick={() => setSelectedProduct(null)}
          >
            {catalogName}
          </button>

          <span style={{ color: BRAND.grisMoyen }} className="shrink-0">/</span>

          {/* Section Title segment */}
          <button
            className="breadcrumb-segment"
            style={{ color: BRAND.grisMoyen }}
            onClick={() => setSelectedProduct(null)}
          >
            {sectionTitle}
          </button>

          <span style={{ color: BRAND.grisMoyen }} className="shrink-0">/</span>

          {/* Current product — bolder, not clickable */}
          <span
            className="breadcrumb-segment font-medium truncate"
            style={{ color: BRAND.noir, cursor: 'default' }}
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
        conversionChannel={s?.conversionChannel || 'whatsapp'}
        whatsappNumber={s?.whatsappNumber || ''}
        messengerLink={s?.messengerLink || ''}
        emailContact={s?.emailContact || ''}
        conversionMessage={s?.conversionMessage || ''}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        onBack={() => setSelectedProduct(null)}
      />
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ── CATALOG GRID VIEW ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderGridView = () => (
    <>
      {/* Search bar below header */}
      {s?.enableSearch && (
        <div className="mx-auto max-w-[1270px] px-4 sm:px-8 pt-4">
          <div className="relative w-full max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: BRAND.grisMoyen }} />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="h-10 pl-10 text-sm rounded-full border-gray-200 bg-gray-50 focus:bg-white"
            />
          </div>
        </div>
      )}

      {/* ━━━ Two-Level Dynamic Category Filter ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {dynamicCategories.length > 0 ? (
        <div className="sticky top-[52px] z-20 border-b backdrop-blur-md" style={{ backgroundColor: `${bgColor}ee`, borderColor: `${primaryColor}20` }}>
          {/* ── Level 1: Macro Categories ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="catalog-filter-bar no-scrollbar">
            {/* "Tout" pill */}
            <button
              className={cn(
                'px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200',
                activeMacroFilter === 'all' ? 'shadow-sm' : 'hover:opacity-80'
              )}
              style={{
                backgroundColor: activeMacroFilter === 'all' ? secondaryColor : 'transparent',
                color: activeMacroFilter === 'all' ? BRAND.blanc : BRAND.noir,
                border: activeMacroFilter === 'all' ? 'none' : `1px solid ${primaryColor}30`,
              }}
              onClick={() => { setActiveMacroFilter('all'); setActiveMicroFilter('all'); setCurrentPage(1); }}
            >
              Tout
            </button>
            {/* Dynamic category pills with product count */}
            {(() => {
              const catCounts = getCategoryProductCounts();
              return dynamicCategories
                .filter(cat => cat.visible)
                .map(cat => {
                  const count = catCounts.get(cat.slug) || 0;
                  return (
                    <button
                      key={cat.slug}
                      className={cn(
                        'px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200',
                        activeMacroFilter === cat.slug ? 'shadow-sm' : 'hover:opacity-80'
                      )}
                      style={{
                        backgroundColor: activeMacroFilter === cat.slug ? secondaryColor : 'transparent',
                        color: activeMacroFilter === cat.slug ? BRAND.blanc : BRAND.noir,
                        border: activeMacroFilter === cat.slug ? 'none' : `1px solid ${primaryColor}30`,
                      }}
                      onClick={() => {
                        setActiveMacroFilter(cat.slug);
                        setActiveMicroFilter('all');
                        setCurrentPage(1);
                      }}
                    >
                      {cat.label}{count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                });
            })()}
          </div>

          {/* ── Level 2: Micro Sub-filters (only when a macro category is selected) ━━ */}
          {/* ━━━ Brand Chart color: inactive text uses chart-3 (#8B4513) instead of noir ━━━ */}
          {activeMacroFilter !== 'all' && (() => {
            const selectedCat = dynamicCategories.find(c => c.slug === activeMacroFilter);
            if (!selectedCat || !selectedCat.subCategories?.length) return null;
            const visibleSubs = selectedCat.subCategories.filter(sub => sub.visible);
            if (visibleSubs.length === 0) return null;
            const subCounts = getSubCategoryProductCounts(activeMacroFilter);
            // Brand chart palette for sub-category row
            const CHART_ACTIVE_BG = BRAND.dore;       // #C9A84C — chart-1 gold
            const CHART_ACTIVE_TEXT = BRAND.blanc;      // #FFFFFF
            const CHART_INACTIVE_TEXT = '#8B4513';      // chart-3 warm brown
            const CHART_INACTIVE_BG = 'rgba(201,168,76,0.08)'; // subtle gold tint
            const CHART_INACTIVE_BORDER = 'rgba(201,168,76,0.25)';
            return (
              <div className="catalog-filter-bar no-scrollbar" style={{ paddingTop: '4px', paddingBottom: '8px' }}>
                {/* "Tous" sub-pill */}
                <button
                  className={cn(
                    'px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all duration-200',
                    activeMicroFilter === 'all' ? 'shadow-sm' : 'hover:opacity-80'
                  )}
                  style={{
                    backgroundColor: activeMicroFilter === 'all' ? CHART_ACTIVE_BG : CHART_INACTIVE_BG,
                    color: activeMicroFilter === 'all' ? CHART_ACTIVE_TEXT : CHART_INACTIVE_TEXT,
                    border: activeMicroFilter === 'all' ? 'none' : `1px solid ${CHART_INACTIVE_BORDER}`,
                  }}
                  onClick={() => { setActiveMicroFilter('all'); setCurrentPage(1); }}
                >
                  Tous
                </button>
                {visibleSubs.map(sub => {
                  const count = subCounts.get(sub.slug) || 0;
                  return (
                    <button
                      key={sub.slug}
                      className={cn(
                        'px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all duration-200',
                        activeMicroFilter === sub.slug ? 'shadow-sm' : 'hover:opacity-80'
                      )}
                      style={{
                        backgroundColor: activeMicroFilter === sub.slug ? CHART_ACTIVE_BG : CHART_INACTIVE_BG,
                        color: activeMicroFilter === sub.slug ? CHART_ACTIVE_TEXT : CHART_INACTIVE_TEXT,
                        border: activeMicroFilter === sub.slug ? 'none' : `1px solid ${CHART_INACTIVE_BORDER}`,
                      }}
                      onClick={() => { setActiveMicroFilter(sub.slug); setCurrentPage(1); }}
                    >
                      {sub.label}{count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : filterOptions.length > 1 ? (
        <div className="sticky top-[52px] z-20 border-b backdrop-blur-md" style={{ backgroundColor: `${bgColor}ee`, borderColor: `${primaryColor}20` }}>
          <div className="catalog-filter-bar no-scrollbar">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200',
                  activeFilter === opt.value ? 'shadow-sm' : 'hover:opacity-80'
                )}
                style={{
                  backgroundColor: activeFilter === opt.value ? secondaryColor : 'transparent',
                  color: activeFilter === opt.value ? BRAND.blanc : BRAND.noir,
                  border: activeFilter === opt.value ? 'none' : `1px solid ${primaryColor}30`,
                }}
                onClick={() => { setActiveFilter(opt.value); setCurrentPage(1); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Contextual Category Title ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeMacroFilter !== 'all' && dynamicCategories.length > 0 && (() => {
        const selectedCat = dynamicCategories.find(c => c.slug === activeMacroFilter);
        if (!selectedCat) return null;
        return (
          <div className="mx-auto max-w-[1270px] px-4 sm:px-8 pt-6 pb-2">
            <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: BRAND.noir, fontFamily: "'Playfair Display', serif" }}>
              {selectedCat.label}
            </h2>
          </div>
        );
      })()}

      {/* Error */}
      {loadError && (
        <div className="catalog-container">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${BRAND.bordeaux}10`, border: `1px solid ${BRAND.bordeaux}30` }}>
            <p className="text-sm" style={{ color: BRAND.bordeaux }}>{loadError}</p>
            <button onClick={() => { setSectionsLoaded(false); setLoadError(null); }} className="text-xs underline mt-1" style={{ color: BRAND.bordeaux }}>Réessayer</button>
          </div>
        </div>
      )}

      {/* Product Gallery */}
      <main className="catalog-container flex-1">
        {/* Section title */}
        {sections.length > 0 && sections[0].section.title && (
          <div className="catalog-toolbar">
            <h2 style={{ color: secondaryColor, fontFamily: "'Playfair Display', serif" }}>
              {sections[0].section.title}
            </h2>
            {sections[0].section.subtitle && (
              <span style={{ color: '#777', fontSize: 15 }}>{sections[0].section.subtitle}</span>
            )}
          </div>
        )}

        {/* Glide-like grid */}
        <div className="catalog-grid">
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
            const imageCount = getImageCount(row, config, columns);
            const isEpuise = stockState === 'epuise';
            const isSurCommande = stockState === 'sur_commande';

            return (
              <article key={row.id} className="product-card">
                {/* Clickable overlay */}
                <button
                  className="product-card-action"
                  onClick={() => { setSelectedProduct({ row, columns, section }); setCarouselIdx(0); }}
                  aria-label={`Voir ${title}`}
                />

                {/* Image: aspect-ratio 4/3, object-fit cover */}
                <div className="product-card-image-wrap">
                  {coverUrl ? (
                    <img
                      src={resolveDirectImageUrl(coverUrl, 800)}
                      alt={title}
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
                    aria-label="Favori"
                  >
                    <Heart className={isLiked ? 'fill-current' : ''} style={{ width: 14, height: 14, color: isLiked ? '#EF4444' : '#808080' }} />
                  </button>

                  {/* ━━━ BADGE ENGINE — Only Nouveau on image, NO status overlays ━━━ */}
                  {/* Nouveau badge — STRICTLY preserved, only shown for in-stock products */}
                  {statut === 'Nouveau' && stockState === 'en_stock' && (
                    <span
                      className="absolute left-2.5 top-2.5 z-10 rounded-sm px-2.5 py-1 text-[9px] font-medium tracking-[0.15em] uppercase text-white/90"
                      style={{ backgroundColor: BRAND.vertFonce, backdropFilter: 'blur(4px)' }}
                    >
                      Nouveau
                    </span>
                  )}

                  {/* Image count badge */}
                  {imageCount > 1 && (
                    <div className="product-card-count">
                      <ImageIcon style={{ width: 11, height: 11 }} />
                      {imageCount}
                    </div>
                  )}

                  {/* ━━━ MICRO-CTA ON IMAGE — Amber/Gold capsule (cloned Masquer style) ━━━ */}
                  <button
                    className={cn(
                      'product-card-micro-cta',
                      isEpuise ? 'product-card-micro-cta--disabled' : 'product-card-micro-cta--active'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEpuise) {
                        setSelectedProduct({ row, columns, section });
                        setCarouselIdx(0);
                      }
                    }}
                    aria-label={isEpuise ? 'Produit épuisé' : 'Commander'}
                  >
                    {isEpuise ? 'Produit épuisé' : 'Commander'}
                  </button>
                </div>

                {/* Text */}
                {config.showTitle !== false && title && (
                  <strong className="product-card-title">{title}</strong>
                )}

                {/* Price line with inline status — minimalist, high-end */}
                {((price && config.showPrice !== false) || isEpuise || isSurCommande) && (
                  <div className="product-card-price-row">
                    {price && config.showPrice !== false && (
                      <span className="product-card-price">{price}</span>
                    )}
                    {/* Scenario B: Épuisé — soft rose, no background */}
                    {isEpuise && (
                      <span className="product-card-status product-card-status--epuise">
                        Sold out
                      </span>
                    )}
                    {/* Scenario C: Sur commande — amber/gold, no background */}
                    {isSurCommande && (
                      <span className="product-card-status product-card-status--sur-commande">
                        Sur commande
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
            <p style={{ fontSize: 18, fontWeight: 600, color: secondaryColor, fontFamily: "'Playfair Display', serif" }}>Aucun produit trouvé</p>
            {searchQuery ? (
              <p style={{ fontSize: 14, marginTop: 6, color: '#777' }}>Essayez un autre terme de recherche</p>
            ) : isAdmin ? (
              <p style={{ fontSize: 14, marginTop: 6, color: '#777' }}>Ajoutez des sections dans l&apos;onglet Mise en page</p>
            ) : (
              <p style={{ fontSize: 14, marginTop: 6, color: '#777' }}>Le catalogue est en cours de préparation. Revenez bientôt !</p>
            )}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          primaryColor={primaryColor}
        />
      </main>

      {/* Footer — sticky to bottom */}
      <footer className="mt-auto py-4 sm:py-5" style={{ backgroundColor: secondaryColor }}>
        <div style={{ maxWidth: 1270, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B)' }}>
              <span className="text-[10px] font-bold" style={{ color: BRAND.noir }}>A</span>
            </div>
            <span className="font-semibold text-xs sm:text-sm text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              {catalogName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="text-xs text-white/70">
            {s?.whatsappNumber && (
              <a href={`https://wa.me/${s.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {s?.instagramHandle && (
              <a href={`https://instagram.com/${s.instagramHandle.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors flex items-center gap-1.5">
                <Instagram className="w-4 h-4" /> Instagram
              </a>
            )}
            {s?.emailContact && (
              <a href={`mailto:${s.emailContact}`} className="hover:text-blue-300 transition-colors flex items-center gap-1.5">
                <Mail className="w-4 h-4" /> Contact
              </a>
            )}
          </div>
        </div>
      </footer>
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ── MAIN RENDER ──
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* Persistent Header — always visible */}
      {renderHeader()}

      {/* Conditional: Grid or Detail */}
      {isDetailView ? renderDetailView() : renderGridView()}
    </div>
  );
}
