'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, ColumnConfig, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Search, MessageCircle, Share2, X, ChevronLeft, ChevronRight,
  ZoomIn, Mail, Instagram, ImageIcon, BookOpen, Home, Grid3X3, Heart,
  ShoppingBag, ChevronDown, Phone, Sparkles
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Brand Charte Constants (from Guide de Design & Charte Graphique) ──
const BRAND = {
  vertFonce: '#1A3C34',   // Primary dark green
  dore: '#C9A84C',        // Gold accent
  beige: '#F5F0E8',       // Background beige
  noir: '#1F1F1F',        // Text black
  blanc: '#FFFFFF',        // White
  grisClair: '#F0F0F0',   // Light gray
  grisMoyen: '#808080',   // Medium gray
  bordeaux: '#800020',    // Error/bordeaux
} as const;

const ITEMS_PER_PAGE = 12;

// ── Image URL Resolution (high-res by default) ──

function resolveImageUrl(url: string, size = 1200): string {
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

function parseImageUrls(val: unknown, separator?: string): string[] {
  if (!val) return [];

  // Array — already parsed (e.g. from JSON column data)
  if (Array.isArray(val)) {
    return val
      .filter((u: unknown) => typeof u === 'string' && u.length > 0)
      .map((u: string) => resolveImageUrl(u));
  }

  if (typeof val !== 'string') return [];
  const str = val.trim();
  if (!str) return [];

  // JSON array string: ["url1", "url2"]
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

  // Single URL
  if (str.startsWith('http') || str.startsWith('/api/')) {
    return [resolveImageUrl(str)];
  }

  // Multiple URLs separated by comma, semicolon, pipe, or newline
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

// ── Image Component with Skeleton Loading ──

function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  objectFit = 'cover',
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  objectFit?: 'cover' | 'contain';
  sizes?: string;
  priority?: boolean;
}) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const resolvedSrc = src.startsWith('/api/') ? src : resolveImageUrl(src);

  if (error || !resolvedSrc) {
    return (
      <div className={cn('flex items-center justify-center', fallbackClassName || className)} style={{ backgroundColor: BRAND.beige }}>
        <ImageIcon className="w-8 h-8" style={{ color: BRAND.grisMoyen, opacity: 0.4 }} />
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Skeleton while loading */}
      {!loaded && (
        <div className="absolute inset-0 skeleton-pulse" style={{ backgroundColor: BRAND.grisClair }} />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        className={cn(
          'w-full h-full transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        style={{ objectFit, imageRendering: 'auto' }}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// ── Carousel with Swipe & Smooth Transitions ──

function ImageCarousel({
  images,
  alt,
  enableZoom,
  onZoom,
  activeIdx: externalIdx,
  onIdxChange,
}: {
  images: string[];
  alt: string;
  enableZoom?: boolean;
  onZoom?: (url: string) => void;
  activeIdx?: number;
  onIdxChange?: (idx: number) => void;
}) {
  const [internalIdx, setInternalIdx] = useState(0);
  const currentIdx = externalIdx !== undefined ? externalIdx : internalIdx;
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((newIdx: number) => {
    setInternalIdx(newIdx);
    onIdxChange?.(newIdx);
  }, [onIdxChange]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    goTo((currentIdx + 1) % images.length);
  }, [currentIdx, images.length, goTo]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    goTo((currentIdx - 1 + images.length) % images.length);
  }, [currentIdx, images.length, goTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (images.length === 0) {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.beige }}>
        <ImageIcon className="w-16 h-16" style={{ color: BRAND.grisMoyen, opacity: 0.3 }} />
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', overflow: 'hidden', backgroundColor: BRAND.beige }}
      ref={trackRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Sliding track */}
      <div
        className="flex h-full transition-transform duration-400 ease-out"
        style={{ transform: `translateX(-${currentIdx * 100}%)` }}
      >
        {images.map((img, i) => (
          <div key={i} className="w-full h-full shrink-0">
            <ProductImage
              src={resolveImageUrl(img, 1920)}
              alt={`${alt} - ${i + 1}`}
              className="w-full h-full"
              objectFit="cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 60vw"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Zoom button */}
      {enableZoom && images[currentIdx] && (
        <button
          className="absolute top-3 right-3 backdrop-blur-md rounded-full p-2.5 hover:scale-105 transition-all z-10 shadow-md"
          style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          onClick={() => onZoom?.(resolveImageUrl(images[currentIdx], 1920))}
        >
          <ZoomIn className="w-4 h-4" style={{ color: BRAND.noir }} />
        </button>
      )}

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 backdrop-blur-md rounded-full p-2 hover:scale-105 transition-all z-10 shadow-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
            onClick={goPrev}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: BRAND.noir }} />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 backdrop-blur-md rounded-full p-2 hover:scale-105 transition-all z-10 shadow-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
            onClick={goNext}
          >
            <ChevronRight className="w-5 h-5" style={{ color: BRAND.noir }} />
          </button>
        </>
      )}

      {/* Dot indicators — Glide style */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              className={cn(
                'rounded-full transition-all duration-300',
                i === currentIdx
                  ? 'w-6 h-2 shadow-sm'
                  : 'w-2 h-2 hover:scale-110'
              )}
              style={{
                backgroundColor: i === currentIdx ? BRAND.blanc : 'rgba(255,255,255,0.5)',
              }}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute top-3 left-3 backdrop-blur-md text-xs px-2.5 py-1 rounded-full z-10 font-medium"
          style={{ backgroundColor: 'rgba(26,60,52,0.7)', color: BRAND.blanc }}
        >
          {currentIdx + 1}/{images.length}
        </div>
      )}
    </div>
  );
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
            className={cn(
              'w-10 h-10 rounded-xl text-sm font-semibold transition-all duration-200',
            )}
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

// ── Main Component ──

interface CatalogPreviewProps {
  onAdminLogin?: () => void;
}

export function CatalogPreview({ onAdminLogin }: CatalogPreviewProps) {
  const { catalog, settings, isAdmin, setView } = useAppStore();
  const [sections, setSections] = useState<{ section: Section; columns: Column[]; rows: Row[] }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ row: Row; columns: Column[]; section: Section } | null>(null);
  const [detailCarouselIdx, setDetailCarouselIdx] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [likedProducts, setLikedProducts] = useState<Set<string>>(new Set);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const s = settings || catalog?.settings;
  // Apply brand colors from settings or defaults from charte
  const primaryColor = s?.primaryColor || BRAND.dore;
  const secondaryColor = s?.secondaryColor || BRAND.vertFonce;
  const accentColor = s?.accentColor || BRAND.beige;
  const bgColor = s?.backgroundColor || BRAND.beige;

  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const getCarouselImages = (row: Row, config: SectionConfig, columns?: Column[]): string[] => {
    const images: string[] = [];
    const rawData = row.data as Record<string, unknown>;

    // 1. Add cover image first
    if (config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      if (coverVal) {
        // For cover, use first image if it's an array
        if (Array.isArray(coverVal)) {
          const coverImgs = parseImageUrls(coverVal);
          if (coverImgs.length > 0) images.push(resolveImageUrl(coverImgs[0], 1600));
        } else {
          const coverStr = typeof coverVal === 'string' ? coverVal : String(coverVal);
          const coverImgs = parseImageUrls(coverStr);
          if (coverImgs.length > 0) images.push(resolveImageUrl(coverImgs[0], 1600));
        }
      }
    }

    // 2. Add carousel column images — read RAW data to preserve arrays
    if (config.carouselColumn) {
      const carouselVal = rawData[config.carouselColumn];

      // Find the column config to get separator
      let separator: string | undefined;
      if (columns) {
        const col = columns.find(c => c.slug === config.carouselColumn);
        if (col?.config && typeof col.config === 'object') {
          const colConfig = col.config as ColumnConfig;
          separator = colConfig.gallerySeparator;
        }
      }

      if (carouselVal !== undefined && carouselVal !== null) {
        const carouselImgs = parseImageUrls(carouselVal, separator).map(u => resolveImageUrl(u, 1600));
        images.push(...carouselImgs);
      }
    }

    // 3. If no carousel column but cover is IMAGE_ARRAY, add remaining cover images
    if (!config.carouselColumn && config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      if (coverVal) {
        const allCoverImgs = parseImageUrls(coverVal);
        // Skip the first one (already added as cover), add the rest
        for (let i = 1; i < allCoverImgs.length; i++) {
          images.push(resolveImageUrl(allCoverImgs[i], 1600));
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return images.filter(img => {
      if (seen.has(img)) return false;
      seen.add(img);
      return true;
    });
  };

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

  // Collect unique filter values
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
      const hasTitle = config.titleColumn && data[config.titleColumn];
      const hasCover = config.coverColumn && data[config.coverColumn];
      const hasPrice = config.priceColumn && data[config.priceColumn];
      return hasTitle || hasCover || hasPrice;
    });

    // Apply category filter
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

  const allProducts = sections.flatMap(({ section, columns, rows }) => {
    const config = section.config as SectionConfig;
    return filterRows(rows, config).map(row => ({ row, columns, section, config }));
  });

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

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* ── Header — Dark green luxury nav bar ── */}
      <header className="sticky top-0 z-30 shadow-lg" style={{ backgroundColor: secondaryColor }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Admin button */}
          {isAdmin ? (
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setView('builder')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <button
              onClick={onAdminLogin}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10 shrink-0"
              title="Accès administrateur"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Logo/Title */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 gold-shimmer">
              <span className="text-sm font-bold" style={{ color: BRAND.noir }}>A</span>
            </div>
            <h1 className="font-bold text-base sm:text-lg text-white truncate tracking-wide" style={{ fontFamily: "'Playfair Display', serif" }}>
              {catalog?.name || 'Abaya Chic Collection'}
            </h1>
          </div>

          {/* Search */}
          {s?.enableSearch && (
            <div className="relative w-full max-w-[180px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="h-9 pl-9 text-sm rounded-full border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/40"
              />
            </div>
          )}
        </div>
      </header>

      {/* ── Category Filter Bar ── */}
      {filterOptions.length > 1 && (
        <div className="sticky top-[52px] z-20 border-b backdrop-blur-md" style={{ backgroundColor: `${bgColor}ee`, borderColor: `${primaryColor}20` }}>
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-2.5 flex gap-2 overflow-x-auto custom-scrollbar">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200',
                  activeFilter === opt.value
                    ? 'shadow-sm'
                    : 'hover:opacity-80'
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

      {/* ── Error ── */}
      {loadError && (
        <div className="mx-auto max-w-[1200px] px-4 py-3">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${BRAND.bordeaux}10`, border: `1px solid ${BRAND.bordeaux}30` }}>
            <p className="text-sm" style={{ color: BRAND.bordeaux }}>{loadError}</p>
            <button onClick={() => { setSectionsLoaded(false); setLoadError(null); }} className="text-xs underline mt-1" style={{ color: BRAND.bordeaux }}>Réessayer</button>
          </div>
        </div>
      )}

      {/* ── Product Gallery — Normalized format per spec ── */}
      <main
        className="flex-1 w-full abaya-gallery-container"
        style={{
          maxWidth: 1200,
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 24,
          paddingBottom: 32,
        }}
      >
        {/* Responsive padding: 16px mobile → 32px desktop */}

        {/* Section title */}
        {sections.length > 0 && sections[0].section.title && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ color: secondaryColor, fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, margin: 0 }}>
              {sections[0].section.title}
            </h2>
            {sections[0].section.subtitle && (
              <p style={{ color: BRAND.grisMoyen, fontSize: 14, marginTop: 4 }}>{sections[0].section.subtitle}</p>
            )}
            <div style={{ width: 48, height: 2, marginTop: 8, borderRadius: 2, backgroundColor: primaryColor }} />
          </div>
        )}

        {/* ── Grille flexible: repeat(auto-fill, minmax(200px, 1fr)) ── */}
        <div className="abaya-gallery-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          padding: 0,
          width: '100%',
        }}>
          {paginatedProducts.map(({ row, columns, section, config }) => {
            // Read cover from raw data to support IMAGE_ARRAY (multiple images)
            const rawData = row.data as Record<string, unknown>;
            const coverRawVal = config.coverColumn ? rawData[config.coverColumn] : null;
            let coverUrl = '';
            if (coverRawVal) {
              if (Array.isArray(coverRawVal)) {
                // IMAGE_ARRAY: use first image as cover
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

            return (
              <div
                key={row.id}
                className="product-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: '#fff',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onClick={() => {
                  setSelectedProduct({ row, columns, section });
                  setDetailCarouselIdx(0);
                }}
              >
                {/* ── Format image strict: aspect-ratio 3/4, object-fit cover ── */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', overflow: 'hidden', background: BRAND.grisClair }}>
                  {coverUrl ? (
                    <img
                      src={resolveImageUrl(coverUrl, 1600)}
                      alt={title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        aspectRatio: '3 / 4',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.3s ease',
                      }}
                      onMouseEnter={(e) => { (e.target as HTMLImageElement).style.transform = 'scale(1.03)'; }}
                      onMouseLeave={(e) => { (e.target as HTMLImageElement).style.transform = 'scale(1)'; }}
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const parent = el.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div style="width:100%;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;background:${BRAND.beige}"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${BRAND.grisMoyen}" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;
                        }
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '3 / 4', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.beige }}>
                      <ImageIcon style={{ width: 40, height: 40, color: BRAND.grisMoyen, opacity: 0.3 }} />
                    </div>
                  )}

                  {/* Like button */}
                  <button
                    onClick={(e) => toggleLike(row.id, e)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isLiked ? '#FEE2E2' : 'rgba(255,255,255,0.9)',
                      cursor: 'pointer',
                      zIndex: 2,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Heart className={isLiked ? 'fill-current' : ''} style={{ width: 16, height: 16, color: isLiked ? '#EF4444' : BRAND.grisMoyen }} />
                  </button>
                </div>

                {/* ── Style typographie ── */}
                <div style={{ padding: '8px 12px 12px' }}>
                  {config.showTitle !== false && title && (
                    <p style={{
                      fontWeight: 600,
                      fontSize: 14,
                      marginTop: 0,
                      marginBottom: 0,
                      color: BRAND.noir,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {title}
                    </p>
                  )}
                  {price && config.showPrice !== false && (
                    <p style={{
                      color: '#666',
                      fontSize: 13,
                      marginTop: 4,
                      marginBottom: 0,
                    }}>
                      {price}
                    </p>
                  )}
                </div>
              </div>
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
              <p style={{ fontSize: 14, marginTop: 6, color: BRAND.grisMoyen }}>Essayez un autre terme de recherche</p>
            ) : isAdmin ? (
              <p style={{ fontSize: 14, marginTop: 6, color: BRAND.grisMoyen }}>Ajoutez des sections dans l&apos;onglet Mise en page</p>
            ) : (
              <p style={{ fontSize: 14, marginTop: 6, color: BRAND.grisMoyen }}>Le catalogue est en cours de préparation. Revenez bientôt !</p>
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

      {/* ── Footer — Dark green with gold accents ── */}
      <footer className="mt-auto py-4 sm:py-5" style={{ backgroundColor: secondaryColor }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center gold-shimmer">
              <span className="text-[10px] font-bold" style={{ color: BRAND.noir }}>A</span>
            </div>
            <span className="font-semibold text-xs sm:text-sm text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              {catalog?.name || 'Abaya Chic Collection'}
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-white/70">
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

      {/* ── Product Detail Sheet — Full Glide-style detail ── */}
      <Dialog open={!!selectedProduct} onOpenChange={v => { if (!v) setSelectedProduct(null); }}>
        <DialogContent className="sm:max-w-lg lg:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border-0">
          {selectedProduct && (() => {
            const { row, columns: detailColumns, section } = selectedProduct;
            const config = section.config as SectionConfig;
            const carouselImages = getCarouselImages(row, config, detailColumns);
            const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
            const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
            const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
            const variants = config.variantColumn ? getCellValue(row, config.variantColumn) : '';
            const conversionLink = buildConversionLink(row, config);

            return (
              <div className="flex flex-col max-h-[92vh]">
                {/* Image Carousel */}
                {carouselImages.length > 0 && (
                  <div className="shrink-0">
                    <ImageCarousel
                      images={carouselImages}
                      alt={title}
                      enableZoom={s?.enableZoom}
                      onZoom={setZoomImage}
                      activeIdx={detailCarouselIdx}
                      onIdxChange={setDetailCarouselIdx}
                    />
                  </div>
                )}
                {carouselImages.length === 0 && (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: BRAND.beige }}>
                    <ImageIcon className="w-16 h-16" style={{ color: BRAND.grisMoyen, opacity: 0.3 }} />
                  </div>
                )}

                {/* Thumbnail strip — Glide-style horizontal scroll */}
                {carouselImages.length > 1 && (
                  <div className="flex gap-2.5 px-4 py-3 overflow-x-auto shrink-0 bg-white custom-scrollbar" style={{ borderBottom: `1px solid ${primaryColor}15` }}>
                    {carouselImages.map((img, i) => (
                      <button
                        key={i}
                        className={cn(
                          'w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all duration-200',
                        )}
                        style={{
                          borderColor: i === detailCarouselIdx ? primaryColor : 'transparent',
                          opacity: i === detailCarouselIdx ? 1 : 0.5,
                        }}
                        onClick={() => setDetailCarouselIdx(i)}
                      >
                        <ProductImage
                          src={resolveImageUrl(img, 150)}
                          alt=""
                          className="w-full h-full"
                          objectFit="cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Product info — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4 custom-scrollbar">
                  {/* Title & Price */}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold" style={{ color: secondaryColor, fontFamily: "'Playfair Display', serif" }}>{title}</h2>
                    {price && (
                      <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: primaryColor, fontFamily: "'Playfair Display', serif" }}>{price}</p>
                    )}
                  </div>

                  {description && (
                    <p className="text-sm leading-relaxed" style={{ color: BRAND.grisMoyen }}>{description}</p>
                  )}

                  {/* Variants */}
                  {variants && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: BRAND.grisMoyen }}>Options disponibles</p>
                      <div className="flex flex-wrap gap-2">
                        {variants.split(/[,;]/).filter(Boolean).map((v, i) => (
                          <Badge
                            key={i}
                            className="text-xs font-medium rounded-lg px-3 py-1"
                            style={{
                              backgroundColor: `${secondaryColor}10`,
                              color: secondaryColor,
                              border: `1px solid ${secondaryColor}20`,
                            }}
                          >
                            {v.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detail columns */}
                  {config.detailColumns && config.detailColumns.length > 0 && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: `${accentColor}80` }}>
                      <div className="grid grid-cols-2 gap-3">
                        {config.detailColumns.map(slug => {
                          const col = detailColumns.find(c => c.slug === slug);
                          if (!col) return null;
                          const val = getCellValue(row, slug);
                          if (!val) return null;
                          return (
                            <div key={slug} className="text-sm">
                              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: BRAND.grisMoyen }}>{col.name}</span>
                              <p className="font-medium mt-0.5" style={{ color: BRAND.noir }}>{val}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* CTA buttons — fixed bottom */}
                <div className="shrink-0 px-5 sm:px-6 pb-5 pt-4 space-y-2.5 bg-white" style={{ borderTop: `1px solid ${primaryColor}15` }}>
                  <Button
                    className="w-full h-12 text-sm font-bold gap-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                    style={{ backgroundColor: secondaryColor, color: BRAND.blanc }}
                    onClick={() => window.open(conversionLink, '_blank')}
                  >
                    <MessageCircle className="w-4.5 h-4.5" />
                    {s?.conversionChannel === 'whatsapp' ? 'Commander via WhatsApp' :
                     s?.conversionChannel === 'messenger' ? 'Commander via Messenger' :
                     s?.conversionChannel === 'email' ? 'Commander par email' :
                     'Commander'}
                  </Button>
                  {s?.enableSharing && (
                    <Button
                      variant="outline"
                      className="w-full h-10 text-sm gap-2 rounded-xl font-medium"
                      style={{ borderColor: `${primaryColor}30`, color: secondaryColor }}
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Lien copié !');
                      }}
                    >
                      <Share2 className="w-4 h-4" /> Partager ce produit
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={v => { if (!v) setZoomImage(null); }}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black rounded-2xl border-0">
          {zoomImage && (
            <div className="relative flex items-center justify-center min-h-[50vh] max-h-[90vh]">
              <ProductImage
                src={zoomImage}
                alt="Zoom"
                className="max-w-full max-h-[90vh]"
                objectFit="contain"
                fallbackClassName="w-full h-[60vh]"
              />
              <button
                className="absolute top-4 right-4 backdrop-blur-md rounded-full p-3 hover:bg-white/30 z-10 transition-all"
                onClick={() => setZoomImage(null)}
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
