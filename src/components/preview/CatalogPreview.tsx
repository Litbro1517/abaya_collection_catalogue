'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Search, MessageCircle, Share2, X, ChevronLeft, ChevronRight,
  ZoomIn, Mail, Instagram, ImageIcon, BookOpen, Home, Grid3X3, Heart,
  ShoppingBag, ChevronDown
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Constants ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;

// ── Image URL Resolution ──────────────────────────────────────────────────

function resolveImageUrl(url: string, size = 800): string {
  if (!url) return '';

  // Already a proxy URL — adjust size if needed
  const proxyMatch = url.match(/\/api\/google\/image-proxy\?id=([^&]+)&sz=(\d+)/);
  if (proxyMatch) {
    if (size !== 800) {
      return `/api/google/image-proxy?id=${proxyMatch[1]}&sz=${size}`;
    }
    return url;
  }

  // Detect Google Drive URLs and convert to proxy
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

function parseImageUrls(val: string): string[] {
  if (!val) return [];

  // Try JSON array
  if (val.startsWith('[')) {
    try {
      const parsed = JSON.parse(val) as string[];
      return parsed.map(u => resolveImageUrl(u)).filter(Boolean);
    } catch {
      // not valid JSON, continue
    }
  }

  // Single URL
  if (val.startsWith('http') || val.startsWith('/api/')) {
    return [resolveImageUrl(val)];
  }

  // Comma-separated URLs
  if (val.includes('http')) {
    return val
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.startsWith('http'))
      .map(u => resolveImageUrl(u));
  }

  return [];
}

// ── Image with Error Handling ────────────────────────────────────────────

function ProductImage({
  src,
  alt,
  className,
  fallbackClassName,
  objectFit = 'cover',
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  objectFit?: 'cover' | 'contain';
  sizes?: string;
}) {
  const [error, setError] = useState(false);
  // Don't re-resolve if already a proxy URL
  const resolvedSrc = src.startsWith('/api/') ? src : resolveImageUrl(src);

  if (error || !resolvedSrc) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100', fallbackClassName || className)}>
        <ImageIcon className="w-8 h-8 text-gray-300" />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={{ objectFit }}
      loading="lazy"
      sizes={sizes}
      onError={() => setError(true)}
    />
  );
}

// ── Carousel with Swipe Support ──────────────────────────────────────────

function ImageCarousel({
  images,
  alt,
  enableZoom,
  onZoom,
}: {
  images: string[];
  alt: string;
  enableZoom?: boolean;
  onZoom?: (url: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((newIdx: number, dir?: 'left' | 'right') => {
    if (isAnimating) return;
    setDirection(dir || (newIdx > idx ? 'right' : 'left'));
    setIsAnimating(true);
    setIdx(newIdx);
    setTimeout(() => setIsAnimating(false), 300);
  }, [idx, isAnimating]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    goTo((idx + 1) % images.length, 'right');
  }, [idx, images.length, goTo]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    goTo((idx - 1 + images.length) % images.length, 'left');
  }, [idx, images.length, goTo]);

  // Touch handlers for swipe
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
      <div className="relative w-full aspect-[3/4] bg-gray-100 flex items-center justify-center">
        <ImageIcon className="w-12 h-12 text-gray-300" />
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[3/4] bg-gray-100 overflow-hidden" ref={containerRef}>
      {/* Current image */}
      <div
        className="w-full h-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <ProductImage
          src={images[idx]}
          alt={`${alt} - ${idx + 1}`}
          className={cn(
            'w-full h-full transition-transform duration-300 ease-out',
            isAnimating && direction === 'right' && 'animate-slide-in-right',
            isAnimating && direction === 'left' && 'animate-slide-in-left',
          )}
          objectFit="cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 60vw"
        />
      </div>

      {/* Zoom button */}
      {enableZoom && images[idx] && (
        <button
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white transition z-10 shadow-sm"
          onClick={() => onZoom?.(resolveImageUrl(images[idx], 1600))}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      )}

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white transition z-10 shadow-sm"
            onClick={goPrev}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white transition z-10 shadow-sm"
            onClick={goNext}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              className={cn(
                'rounded-full transition-all duration-200',
                i === idx
                  ? 'bg-white w-6 h-2 shadow-sm'
                  : 'bg-white/60 w-2 h-2 hover:bg-white/80'
              )}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full z-10">
          {idx + 1}/{images.length}
        </div>
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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
    <div className="flex items-center justify-center gap-1 mt-6 sm:mt-8">
      <button
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-muted-foreground">...</span>
        ) : (
          <button
            key={p}
            className={cn(
              'w-9 h-9 rounded-lg text-sm font-medium transition',
              p === currentPage
                ? 'bg-foreground text-background'
                : 'hover:bg-gray-100'
            )}
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

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

  const s = settings || catalog?.settings;

  // Load section data
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
          // Use meta endpoint for columns + paginated rows endpoint to avoid OOM
          const [metaRes, rowsRes] = await Promise.all([
            fetch(`/api/datasources/${dsId}?mode=meta`),
            fetch(`/api/datasources/${dsId}/rows?limit=100`),
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
    const data = row.data as Record<string, string>;
    return data[slug] || '';
  };

  const getCarouselImages = (row: Row, config: SectionConfig): string[] => {
    const images: string[] = [];

    // Add cover image first
    if (config.coverColumn) {
      const cover = getCellValue(row, config.coverColumn);
      if (cover) {
        images.push(resolveImageUrl(cover, 1200));
      }
    }

    // Add carousel images
    if (config.carouselColumn) {
      const val = getCellValue(row, config.carouselColumn);
      const carouselImgs = parseImageUrls(val).map(u => resolveImageUrl(u, 1200));
      images.push(...carouselImgs);
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

  const filterRows = (rows: Row[], config: SectionConfig): Row[] => {
    let filtered = rows;

    // Skip rows with no meaningful content
    filtered = filtered.filter(r => {
      const data = r.data as Record<string, string>;
      const hasTitle = config.titleColumn && data[config.titleColumn];
      const hasCover = config.coverColumn && data[config.coverColumn];
      const hasPrice = config.priceColumn && data[config.priceColumn];
      return hasTitle || hasCover || hasPrice;
    });

    if (!searchQuery) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(r => {
      const data = r.data as Record<string, string>;
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

  // Collect all products across sections for pagination
  const allProducts = sections.flatMap(({ section, columns, rows }) => {
    const config = section.config as SectionConfig;
    return filterRows(rows, config).map(row => ({ row, columns, section, config }));
  });

  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = allProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page on search
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  if (searchQuery !== lastSearchQuery) {
    setLastSearchQuery(searchQuery);
    setCurrentPage(1);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: s?.backgroundColor || '#FAF8F5' }}>
      {/* Header — Glide-style clean top bar */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-md bg-white/95" style={{ borderColor: s?.primaryColor ? `${s.primaryColor}15` : '#E8E2D9' }}>
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6 py-2.5 flex items-center gap-3">
          {/* Admin button */}
          {isAdmin ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView('builder')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          ) : (
            <button
              onClick={onAdminLogin}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted shrink-0"
              title="Accès administrateur"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base sm:text-lg truncate" style={{ color: s?.secondaryColor || '#1A1A1A' }}>
              {catalog?.name || 'Mon Catalogue'}
            </h1>
          </div>
          {s?.enableSearch && (
            <div className="relative w-full max-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="h-9 pl-9 text-sm rounded-full border-gray-200 bg-gray-50 focus:bg-white"
              />
            </div>
          )}
        </div>
      </header>

      {/* Error display */}
      {loadError && (
        <div className="mx-auto max-w-[1400px] px-4 py-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-sm text-red-700">{loadError}</p>
            <button onClick={() => { setSectionsLoaded(false); setLoadError(null); }} className="text-xs text-red-600 underline mt-1">Réessayer</button>
          </div>
        </div>
      )}

      {/* Product Grid — Glide-inspired responsive layout */}
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Single section or combined grid */}
        {sections.length > 0 && sections[0].section.title && (
          <div className="mb-4 sm:mb-5 px-1">
            <h2 className="text-lg sm:text-xl font-bold" style={{ color: s?.secondaryColor || '#1A1A1A' }}>
              {sections[0].section.title}
            </h2>
            {sections[0].section.subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{sections[0].section.subtitle}</p>
            )}
          </div>
        )}

        {/* Responsive grid: 2 cols mobile, 3 tablet, 4 desktop — portrait cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {paginatedProducts.map(({ row, columns, section, config }) => {
            const coverUrl = config.coverColumn ? getCellValue(row, config.coverColumn) : '';
            const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
            const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
            const isLiked = likedProducts.has(row.id);

            return (
              <div
                key={row.id}
                className="group cursor-pointer bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                onClick={() => {
                  setSelectedProduct({ row, columns, section });
                  setDetailCarouselIdx(0);
                }}
              >
                {/* Cover Image — portrait on desktop, near-square on mobile */}
                <div className={cn(
                  'relative w-full overflow-hidden bg-gray-100',
                  // Portrait on large screens, near-square on mobile
                  'aspect-[3/4] sm:aspect-[3/4] lg:aspect-[3/4]'
                )}>
                  {coverUrl ? (
                    <ProductImage
                      src={resolveImageUrl(coverUrl, 600)}
                      alt={title}
                      className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                      objectFit="cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <ImageIcon className="w-10 h-10 text-gray-300" />
                    </div>
                  )}

                  {/* Like button overlay */}
                  <button
                    className={cn(
                      'absolute top-2 right-2 p-1.5 rounded-full transition-all duration-200 z-10',
                      isLiked
                        ? 'bg-red-50 text-red-500'
                        : 'bg-white/80 backdrop-blur-sm text-gray-500 opacity-0 group-hover:opacity-100'
                    )}
                    onClick={(e) => toggleLike(row.id, e)}
                  >
                    <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
                  </button>

                  {/* Price badge overlay */}
                  {price && config.showPrice !== false && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent pt-8 pb-2 px-2.5">
                      <span className="text-white font-bold text-xs sm:text-sm drop-shadow-sm">
                        {price}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Content — minimal like Glide */}
                <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                  {config.showTitle !== false && title && (
                    <h3 className="text-xs sm:text-sm font-medium line-clamp-2 leading-tight text-gray-800" style={{ color: s?.secondaryColor || '#1A1A1A' }}>
                      {title}
                    </h3>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {allProducts.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-lg font-medium">Aucun produit trouvé</p>
            {searchQuery ? (
              <p className="text-sm mt-1">Essayez un autre terme de recherche</p>
            ) : isAdmin ? (
              <p className="text-sm mt-1">Ajoutez des sections dans l&apos;onglet Mise en page</p>
            ) : (
              <p className="text-sm mt-1">Le catalogue est en cours de préparation. Revenez bientôt !</p>
            )}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </main>

      {/* Footer — sticky to bottom */}
      <footer className="mt-auto border-t py-3 sm:py-4 bg-white/80 backdrop-blur-sm" style={{ borderColor: `${s?.primaryColor || '#C9A84C'}15` }}>
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <h3 className="font-semibold text-xs sm:text-sm" style={{ color: s?.primaryColor || '#C9A84C' }}>{catalog?.name || 'Mon Catalogue'}</h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {s?.whatsappNumber && (
              <a href={`https://wa.me/${s.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-600 transition-colors flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            {s?.instagramHandle && (
              <a href={`https://instagram.com/${s.instagramHandle.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="hover:text-pink-600 transition-colors flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5" /> Instagram
              </a>
            )}
            {s?.emailContact && (
              <a href={`mailto:${s.emailContact}`} className="hover:text-blue-600 transition-colors flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Contact
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* ── Product Detail Sheet — Glide-style full-screen detail ────────── */}
      <Dialog open={!!selectedProduct} onOpenChange={v => { if (!v) setSelectedProduct(null); }}>
        <DialogContent className="sm:max-w-lg lg:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl">
          {selectedProduct && (() => {
            const { row, columns: detailColumns, section } = selectedProduct;
            const config = section.config as SectionConfig;
            const carouselImages = getCarouselImages(row, config);
            const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
            const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
            const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
            const variants = config.variantColumn ? getCellValue(row, config.variantColumn) : '';
            const conversionLink = buildConversionLink(row, config);

            return (
              <div className="flex flex-col max-h-[90vh]">
                {/* Image Carousel — portrait aspect ratio like Glide */}
                {carouselImages.length > 0 && (
                  <div className="shrink-0">
                    <ImageCarousel
                      images={carouselImages}
                      alt={title}
                      enableZoom={s?.enableZoom}
                      onZoom={setZoomImage}
                    />
                  </div>
                )}

                {/* Fallback if no carousel images */}
                {carouselImages.length === 0 && (
                  <div className="relative w-full aspect-[3/4] bg-gray-100 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  </div>
                )}

                {/* Thumbnail strip */}
                {carouselImages.length > 1 && (
                  <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 bg-white border-b custom-scrollbar">
                    {carouselImages.map((img, i) => (
                      <button
                        key={i}
                        className={cn(
                          'w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all',
                          i === detailCarouselIdx ? 'border-[var(--gold,#C9A84C)] shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                        )}
                        onClick={() => setDetailCarouselIdx(i)}
                      >
                        <ProductImage
                          src={resolveImageUrl(img, 100)}
                          alt=""
                          className="w-full h-full"
                          objectFit="cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Product info — scrollable area */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 custom-scrollbar">
                  {/* Title & Price */}
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold" style={{ color: s?.secondaryColor || '#1A1A1A' }}>{title}</h2>
                    {price && (
                      <p className="text-lg sm:text-xl font-bold mt-0.5" style={{ color: s?.primaryColor || '#C9A84C' }}>{price}</p>
                    )}
                  </div>

                  {description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{description}</p>
                  )}

                  {/* Variants (Sizes, Colors) */}
                  {variants && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Options disponibles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {variants.split(/[,;]/).filter(Boolean).map((v, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-medium">{v.trim()}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detail columns */}
                  {config.detailColumns && config.detailColumns.length > 0 && (
                    <div className="border-t pt-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        {config.detailColumns.map(slug => {
                          const col = detailColumns.find(c => c.slug === slug);
                          if (!col) return null;
                          const val = getCellValue(row, slug);
                          if (!val) return null;
                          return (
                            <div key={slug} className="text-sm">
                              <span className="text-muted-foreground text-xs">{col.name}</span>
                              <p className="font-medium mt-0.5">{val}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons — fixed at bottom */}
                <div className="shrink-0 px-4 sm:px-6 pb-4 pt-3 space-y-2 border-t bg-white">
                  <Button
                    className="w-full h-12 text-sm font-semibold gap-2 rounded-xl"
                    style={{ backgroundColor: s?.primaryColor || '#C9A84C', color: s?.primaryColor === '#1A1A1A' ? '#fff' : '#1A1A1A' }}
                    onClick={() => window.open(conversionLink, '_blank')}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {s?.conversionChannel === 'whatsapp' ? 'Commander via WhatsApp' :
                     s?.conversionChannel === 'messenger' ? 'Commander via Messenger' :
                     s?.conversionChannel === 'email' ? 'Commander par email' :
                     'Commander'}
                  </Button>
                  {s?.enableSharing && (
                    <Button variant="outline" className="w-full h-10 text-sm gap-2 rounded-xl" onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Lien copié !');
                    }}>
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
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black rounded-2xl">
          {zoomImage && (
            <div className="relative flex items-center justify-center min-h-[50vh] max-h-[85vh]">
              <ProductImage
                src={zoomImage}
                alt="Zoom"
                className="max-w-full max-h-[85vh]"
                objectFit="contain"
                fallbackClassName="w-full h-[60vh]"
              />
              <button
                className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full p-2.5 hover:bg-white/40 z-10 transition"
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
