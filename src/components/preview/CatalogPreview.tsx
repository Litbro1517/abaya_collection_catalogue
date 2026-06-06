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
  const canAccessBuilder = isAdmin && adminUser && (adminUser.role === 'owner' || adminUser.role === 'admin');
  const [sections, setSections] = useState<{ section: Section; columns: Column[]; rows: Row[] }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ row: Row; columns: Column[]; section: Section } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set);
  const [activeFilter, setActiveFilter] = useState<string>('all');

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

    if (activeFilter !== 'all' && config.filterColumn) {
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

  const allProducts = (() => {
    const items = sections.flatMap(({ section, columns, rows }) => {
      const config = section.config as SectionConfig;
      return filterRows(rows, config).map(row => {
        const rawData = row.data as Record<string, unknown>;
        const statut = (rawData.__statut__ as 'Nouveau' | 'Courant') || 'Courant';
        const isEpuise = String(rawData.__disponibilite__) === 'false';
        return { row, columns, section, config, statut, isEpuise };
      });
    });
    // Composite sort: Nouveau first (by row order), then Courant (by row order)
    items.sort((a, b) => {
      const aIsNouveau = a.statut === 'Nouveau' && !a.isEpuise ? 0 : 1;
      const bIsNouveau = b.statut === 'Nouveau' && !b.isEpuise ? 0 : 1;
      if (aIsNouveau !== bIsNouveau) return aIsNouveau - bIsNouveau;
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
  // ── PRODUCT DETAIL VIEW (full-page inline, NOT a Dialog) ──
  // ═══════════════════════════════════════════════════════════════════════
  const renderDetailView = () => {
    if (!selectedProduct) return null;
    const { row, columns: detailColumns, section } = selectedProduct;
    const config = section.config as SectionConfig;
    const carouselImages = getCarouselImages(row, config, detailColumns);
    const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
    const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
    const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
    const variants = config.variantColumn ? getCellValue(row, config.variantColumn) : '';
    const conversionLink = buildConversionLink(row, config);
    const coverImage = carouselImages[0] || '';

    // Parse variants
    const variantList = variants ? variants.split(/[,;]/).map(v => v.trim()).filter(Boolean) : [];
    const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|\d{1,2})$/i;
    const sizes = variantList.filter(v => sizePattern.test(v));
    const colors = variantList.filter(v => !sizePattern.test(v));

    const goPrev = () => setCarouselIdx(i => (i === 0 ? carouselImages.length - 1 : i - 1));
    const goNext = () => setCarouselIdx(i => (i === carouselImages.length - 1 ? 0 : i + 1));
    const goTo = (idx: number) => setCarouselIdx(idx);

    // Touch swipe
    const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
    const onTouchEnd = () => {
      const diff = touchStartX.current - touchEndX.current;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goNext();
        else goPrev();
      }
    };

    // Collect detail fields
    const detailFields: { label: string; value: string }[] = [];
    if (price) detailFields.push({ label: 'Prix_Vente', value: price });
    if (description) detailFields.push({ label: 'Description', value: description });
    if (sizes.length > 0) detailFields.push({ label: 'Options_Tailles', value: sizes.join(', ') });
    if (colors.length > 0) detailFields.push({ label: 'Options_Couleurs', value: colors.join(', ') });

    if (config.detailColumns && config.detailColumns.length > 0) {
      for (const slug of config.detailColumns) {
        const col = detailColumns.find(c => c.slug === slug);
        if (!col) continue;
        const val = getCellValue(row, slug);
        if (!val) continue;
        if (!detailFields.some(f => f.label === col.name)) {
          detailFields.push({ label: col.name, value: val });
        }
      }
    }

    return (
      <main className="detail-container flex-1 pb-24 sm:pb-8">
        {/* ── Breadcrumb: inside product container, above hero ── */}
        {renderBreadcrumbs()}

        {/* ── Desktop/Tablet: Side-by-side layout; Mobile: Stacked ── */}
        <div className="detail-layout">
          {/* LEFT COLUMN: Carousel */}
          <div>
            {/* ── Glide Carousel: virtual-window sliding with CSS transforms ── */}
            {carouselImages.length > 0 && (
              <section
                className="glide-carousel"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Sliding track — virtual window: only render visible ± 2 slides */}
                <div
                  className="glide-carousel-track"
                  style={{
                    transform: `translateX(-${carouselIdx * 100}%)`,
                  }}
                >
                  {carouselImages.map((rawUrl, i) => {
                    // Virtual window: only load images within ±2 of current index
                    const isVisible = Math.abs(i - carouselIdx) <= 2;
                    const directUrl = isVisible ? resolveDirectImageUrl(rawUrl, 1000) : '';
                    const proxyUrl = isVisible ? resolveProxyImageUrl(rawUrl, 1000) : '';
                    return (
                      <div key={i} className="glide-carousel-slide">
                        {isVisible ? (
                          <img
                            src={directUrl}
                            alt={`${title} - ${i + 1}`}
                            loading={Math.abs(i - carouselIdx) <= 1 ? 'eager' : 'lazy'}
                            decoding="async"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement;
                              if (!el.dataset.retried) {
                                el.dataset.retried = '1';
                                el.src = proxyUrl;
                              }
                            }}
                          />
                        ) : (
                          <div className="glide-carousel-placeholder" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {carouselImages.length > 1 && (
                  <>
                    <button
                      className="carousel-arrow left"
                      onClick={goPrev}
                      aria-label="Image précédente"
                    >
                      ‹
                    </button>
                    <button
                      className="carousel-arrow right"
                      onClick={goNext}
                      aria-label="Image suivante"
                    >
                      ›
                    </button>

                    {/* Dots: compact window for many images, full display for few */}
                    <div className="carousel-dots">
                      {carouselImages.length <= 10 ? (
                        carouselImages.map((_, i) => (
                          <button
                            key={i}
                            className={i === carouselIdx ? 'active' : ''}
                            onClick={() => goTo(i)}
                            aria-label={`Image ${i + 1}`}
                          />
                        ))
                      ) : (
                        <>
                          {/* First dot */}
                          <button
                            className={carouselIdx === 0 ? 'active' : ''}
                            onClick={() => goTo(0)}
                            aria-label="Image 1"
                          />
                          {/* Left ellipsis */}
                          {carouselIdx > 3 && <span className="carousel-ellipsis">…</span>}
                          {/* Window dots around current */}
                          {Array.from({ length: carouselImages.length }, (_, i) => i)
                            .filter(i => {
                              if (i === 0 || i === carouselImages.length - 1) return false;
                              return Math.abs(i - carouselIdx) <= 2;
                            })
                            .map(i => (
                              <button
                                key={i}
                                className={i === carouselIdx ? 'active' : ''}
                                onClick={() => goTo(i)}
                                aria-label={`Image ${i + 1}`}
                              />
                            ))}
                          {/* Right ellipsis */}
                          {carouselIdx < carouselImages.length - 4 && <span className="carousel-ellipsis">…</span>}
                          {/* Last dot */}
                          <button
                            className={carouselIdx === carouselImages.length - 1 ? 'active' : ''}
                            onClick={() => goTo(carouselImages.length - 1)}
                            aria-label={`Image ${carouselImages.length}`}
                          />
                          {/* Counter badge */}
                          <span className="carousel-counter">
                            {carouselIdx + 1}/{carouselImages.length}
                          </span>
                        </>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Product Info (sticky on desktop) */}
          <div className="detail-info">
            {/* ── Product Hero: title + price + description ── */}
            <section className="product-hero">
              {coverImage ? (
                <img
                  className="product-hero-thumb"
                  src={resolveDirectImageUrl(coverImage, 400)}
                  alt={title}
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    if (!el.dataset.retried) {
                      el.dataset.retried = '1';
                      el.src = resolveProxyImageUrl(coverImage, 400);
                    }
                  }}
                />
              ) : (
                <div className="product-hero-thumb product-hero-thumb-placeholder">
                  <ImageIcon style={{ width: 32, height: 32, color: '#808080', opacity: 0.4 }} />
                </div>
              )}

              <div className="product-hero-text">
                <h1>{title}</h1>
                {price && <p className="product-hero-price">{price}</p>}
                {description && <p>{description}</p>}
              </div>
            </section>

            {/* ── Product Fields ── */}
            {detailFields.length > 0 && (
              <section className="product-fields">
                {detailFields.map((field, i) => (
                  <div key={i} className="product-field">
                    <span>{field.label}</span>
                    <strong>{field.value}</strong>
                  </div>
                ))}
              </section>
            )}

            {/* ── Disponibilité status indicator ── */}
            {(() => {
              const detailRawData = row.data as Record<string, unknown>;
              const detailIsEpuise = String(detailRawData.__disponibilite__) === 'false';
              return detailIsEpuise ? (
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${BRAND.noir}15`, color: BRAND.noir }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND.noir }} />
                    Produit épuisé
                  </span>
                </div>
              ) : null;
            })()}

            {/* ── WhatsApp CTA ── */}
            {(() => {
              const detailRawData = row.data as Record<string, unknown>;
              const detailIsEpuise = String(detailRawData.__disponibilite__) === 'false';
              return (
                <a
                  className={cn('whatsapp-cta', detailIsEpuise && 'opacity-50 pointer-events-none cursor-not-allowed')}
                  href={detailIsEpuise ? undefined : conversionLink}
                  target={detailIsEpuise ? undefined : '_blank'}
                  rel={detailIsEpuise ? undefined : 'noopener noreferrer'}
                  style={{
                    backgroundColor: detailIsEpuise ? BRAND.grisClair : primaryColor,
                    color: detailIsEpuise ? BRAND.grisMoyen : '#111',
                  }}
                  onClick={detailIsEpuise ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                >
                  {detailIsEpuise ? 'Produit épuisé' :
                   s?.conversionChannel === 'whatsapp' ? 'Commander via WhatsApp' :
                   s?.conversionChannel === 'messenger' ? 'Commander via Messenger' :
                   s?.conversionChannel === 'email' ? 'Commander par email' :
                   'Commander'}
                </a>
              );
            })()}
          </div>
        </div>
      </main>
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

      {/* Category Filter Bar */}
      {filterOptions.length > 1 && (
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
      )}

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
          {paginatedProducts.map(({ row, columns, section, config, statut, isEpuise }) => {
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

                  {/* Nouveau badge — hidden when Épuisé */}
                  {statut === 'Nouveau' && !isEpuise && (
                    <span className="absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm" style={{ backgroundColor: BRAND.vertFonce }}>
                      Nouveau
                    </span>
                  )}

                  {/* Sold Out badge — shown when Disponibilité is OFF */}
                  {isEpuise && (
                    <span className="absolute right-2 top-2 z-10 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm" style={{ backgroundColor: BRAND.noir }}>
                      Épuisé
                    </span>
                  )}

                  {/* Sold Out overlay — semi-transparent overlay on the image */}
                  {isEpuise && (
                    <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
                      <div className="absolute inset-0 bg-black/20" />
                      <span
                        className="relative z-10 text-white font-bold text-sm tracking-widest uppercase opacity-70"
                        style={{
                          transform: 'rotate(-25deg)',
                          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                          border: '2px solid rgba(255,255,255,0.5)',
                          padding: '4px 16px',
                          borderRadius: '4px',
                        }}
                      >
                        SOLD OUT
                      </span>
                    </div>
                  )}

                  {/* Image count badge */}
                  {imageCount > 1 && (
                    <div className="product-card-count">
                      <ImageIcon style={{ width: 11, height: 11 }} />
                      {imageCount}
                    </div>
                  )}
                </div>

                {/* Text */}
                {config.showTitle !== false && title && (
                  <strong className="product-card-title">{title}</strong>
                )}
                {price && config.showPrice !== false && (
                  <span className="product-card-price">{price}</span>
                )}
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
