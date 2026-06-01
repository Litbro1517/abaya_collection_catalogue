'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, ColumnConfig, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Search, MessageCircle, Share2, X, ChevronLeft, ChevronRight,
  ZoomIn, Mail, Instagram, ImageIcon, BookOpen, Heart,
  ShoppingBag, Phone
} from 'lucide-react';
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

/** Extract a stable key from a URL (Drive file ID or the URL itself) */
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

// ═══════════════════════════════════════════════════════════════════════════
// ── FULL-PAGE PRODUCT VIEW — Immersive, no-scroll, single-glance design ──
// ═══════════════════════════════════════════════════════════════════════════

function ProductFullPage({
  row,
  detailColumns,
  section,
  s,
  primaryColor,
  secondaryColor,
  accentColor,
  getCellValue,
  getCarouselImages,
  buildConversionLink,
  onClose,
}: {
  row: Row;
  detailColumns: Column[];
  section: Section;
  s: CatalogSettings | null | undefined;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  getCellValue: (row: Row, slug: string) => string;
  getCarouselImages: (row: Row, config: SectionConfig, columns?: Column[]) => string[];
  buildConversionLink: (row: Row, config: SectionConfig) => string;
  onClose: () => void;
}) {
  const config = section.config as SectionConfig;
  const carouselImages = getCarouselImages(row, config, detailColumns);
  const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
  const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
  const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
  const variants = config.variantColumn ? getCellValue(row, config.variantColumn) : '';
  const conversionLink = buildConversionLink(row, config);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  // ── Non-circular navigation (FIX: Anomaly 4) ──
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < carouselImages.length - 1;

  const goTo = useCallback((idx: number) => {
    setCurrentIdx(Math.max(0, Math.min(idx, carouselImages.length - 1)));
  }, [carouselImages.length]);

  const goNext = useCallback(() => {
    if (canGoNext) setCurrentIdx(prev => prev + 1);
  }, [canGoNext]);

  const goPrev = useCallback(() => {
    if (canGoPrev) setCurrentIdx(prev => prev - 1);
  }, [canGoPrev]);

  // Touch / swipe
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

  // Keyboard navigation (non-circular)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (zoomImage) setZoomImage(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onClose, zoomImage]);

  // Auto-scroll thumbnail strip to keep active visible
  useEffect(() => {
    if (!thumbnailRef.current) return;
    const activeThumb = thumbnailRef.current.querySelector(`[data-thumb-idx="${currentIdx}"]`) as HTMLElement;
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIdx]);

  // Prevent body scroll when full-page is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: BRAND.blanc }}
    >
      {/* ── Top bar: back + title + counter ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 shadow-sm"
        style={{ backgroundColor: secondaryColor, minHeight: 52 }}
      >
        <button
          onClick={onClose}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/15 active:scale-95"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-white text-sm sm:text-base font-semibold truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
            {title}
          </h1>
        </div>

        {carouselImages.length > 1 && (
          <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>
            {currentIdx + 1}/{carouselImages.length}
          </span>
        )}
      </div>

      {/* ── Main content: NO SCROLL — everything fits in viewport ── */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* ── Image carousel — takes all available space ── */}
        <div
          className="flex-1 min-h-0 relative"
          style={{ backgroundColor: BRAND.beige }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {carouselImages.length > 0 ? (
            <>
              {/* Sliding track — NO virtualization, all images rendered with lazy loading (FIX: Anomaly 5) */}
              <div
                className="flex h-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${currentIdx * 100}%)` }}
              >
                {carouselImages.map((img, i) => (
                  <div
                    key={extractImageId(img) + '-' + i}
                    className="w-full h-full shrink-0 relative overflow-hidden"
                  >
                    <ProductImage
                      src={resolveImageUrl(img, 1600)}
                      alt={`${title} - ${i + 1}`}
                      className="w-full h-full"
                      objectFit="cover"
                      sizes="100vw"
                      priority={i === 0}
                    />
                  </div>
                ))}
              </div>

              {/* Left arrow — disabled at first image (FIX: Anomaly 4 — no wrap-around) */}
              {carouselImages.length > 1 && (
                <>
                  <button
                    className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all z-10 shadow-lg",
                      canGoPrev
                        ? "hover:scale-110 active:scale-95"
                        : "opacity-20 pointer-events-none"
                    )}
                    style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    aria-label="Image précédente"
                  >
                    <ChevronLeft className="w-5 h-5" style={{ color: BRAND.noir }} />
                  </button>

                  {/* Right arrow — disabled at last image */}
                  <button
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2.5 transition-all z-10 shadow-lg",
                      canGoNext
                        ? "hover:scale-110 active:scale-95"
                        : "opacity-20 pointer-events-none"
                    )}
                    style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
                    onClick={goNext}
                    disabled={!canGoNext}
                    aria-label="Image suivante"
                  >
                    <ChevronRight className="w-5 h-5" style={{ color: BRAND.noir }} />
                  </button>
                </>
              )}

              {/* Zoom button */}
              {s?.enableZoom && carouselImages[currentIdx] && (
                <button
                  className="absolute top-3 right-3 backdrop-blur-md rounded-full p-2.5 hover:scale-105 transition-all z-10 shadow-md"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                  onClick={() => setZoomImage(resolveImageUrl(carouselImages[currentIdx], 1920))}
                >
                  <ZoomIn className="w-4 h-4" style={{ color: BRAND.noir }} />
                </button>
              )}

              {/* Dot indicators (FIX: Anomaly 3 — better visibility) */}
              {carouselImages.length > 1 && carouselImages.length <= 9 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-2 items-center">
                  {Array.from({ length: carouselImages.length }, (_, i) => (
                    <button
                      key={i}
                      className={cn(
                        'rounded-full transition-all duration-300',
                        i === currentIdx ? 'w-7 h-2.5' : 'w-2.5 h-2.5'
                      )}
                      style={{
                        backgroundColor: i === currentIdx
                          ? BRAND.blanc
                          : 'rgba(255,255,255,0.5)',
                        boxShadow: i === currentIdx ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                      }}
                      onClick={() => goTo(i)}
                    />
                  ))}
                </div>
              )}

              {/* For many images: compact counter badge instead of dots */}
              {carouselImages.length > 9 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 backdrop-blur-md text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(26,60,52,0.7)', color: BRAND.blanc }}>
                  {currentIdx + 1} / {carouselImages.length}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-20 h-20" style={{ color: BRAND.grisMoyen, opacity: 0.3 }} />
            </div>
          )}
        </div>

        {/* ── Thumbnail strip — no scrollbar, hidden overflow with arrow buttons (FIX: Anomaly 2) ── */}
        {carouselImages.length > 1 && (
          <div
            className="shrink-0 relative bg-white"
            style={{ height: 64, borderTop: `1px solid ${primaryColor}12` }}
          >
            {/* Left scroll arrow */}
            <button
              className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center transition-opacity"
              style={{
                background: 'linear-gradient(to right, white 60%, transparent)',
                opacity: 1,
              }}
              onClick={() => thumbnailRef.current?.scrollBy({ left: -140, behavior: 'smooth' })}
              aria-label="Voir images précédentes"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: BRAND.noir }} />
            </button>

            {/* Thumbnail container — NO scrollbar (overflow-x: hidden) */}
            <div
              ref={thumbnailRef}
              className="flex gap-2 items-center h-full px-10"
              style={{
                overflowX: 'hidden',
                scrollBehavior: 'smooth',
                scrollSnapType: 'x mandatory',
              }}
            >
              {carouselImages.map((img, i) => (
                <button
                  key={extractImageId(img) + '-' + i}
                  data-thumb-idx={i}
                  className="shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200"
                  style={{
                    width: 44,
                    height: 44,
                    borderColor: i === currentIdx ? primaryColor : 'transparent',
                    opacity: i === currentIdx ? 1 : 0.5,
                    boxShadow: i === currentIdx ? `0 2px 8px ${primaryColor}30` : 'none',
                    scrollSnapAlign: 'center',
                  }}
                  onClick={() => goTo(i)}
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

            {/* Right scroll arrow */}
            <button
              className="absolute right-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center"
              style={{
                background: 'linear-gradient(to left, white 60%, transparent)',
              }}
              onClick={() => thumbnailRef.current?.scrollBy({ left: 140, behavior: 'smooth' })}
              aria-label="Voir images suivantes"
            >
              <ChevronRight className="w-4 h-4" style={{ color: BRAND.noir }} />
            </button>
          </div>
        )}

        {/* ── Product info bar — compact, always visible, no scroll (FIX: Anomaly 1) ── */}
        <div
          className="shrink-0 px-5 py-3 flex items-center gap-4"
          style={{ backgroundColor: BRAND.blanc, borderTop: `1px solid ${primaryColor}10` }}
        >
          {/* Title + Price */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm sm:text-base truncate" style={{ color: secondaryColor, fontFamily: "'Playfair Display', serif" }}>
              {title}
            </p>
            {price && (
              <p className="font-bold text-sm sm:text-base" style={{ color: primaryColor }}>
                {price}
              </p>
            )}
          </div>

          {/* CTA button — always visible, never clipped */}
          <Button
            className="shrink-0 h-11 px-5 text-sm font-bold gap-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
            style={{ backgroundColor: secondaryColor, color: BRAND.blanc }}
            onClick={() => window.open(conversionLink, '_blank')}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">
              {s?.conversionChannel === 'whatsapp' ? 'Commander via WhatsApp' :
               s?.conversionChannel === 'messenger' ? 'Commander via Messenger' :
               s?.conversionChannel === 'email' ? 'Commander par email' :
               'Commander'}
            </span>
            <span className="sm:hidden">Commander</span>
          </Button>

          {/* Share button */}
          {s?.enableSharing && (
            <Button
              variant="outline"
              className="shrink-0 h-11 w-11 p-0 rounded-xl"
              style={{ borderColor: `${primaryColor}30`, color: secondaryColor }}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Lien copié !');
              }}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* ── Optional: expandable description panel ── */}
        {(description || variants) && (
          <ProductInfoDrawer
            description={description}
            variants={variants}
            detailColumns={config.detailColumns}
            detailColumnsDef={detailColumns}
            getCellValue={getCellValue}
            row={row}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
          />
        )}
      </div>

      {/* ── Zoom overlay ── */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <ProductImage
              src={zoomImage}
              alt="Zoom"
              className="max-w-full max-h-full"
              objectFit="contain"
              fallbackClassName="w-full h-full"
            />
            <button
              className="absolute top-4 right-4 backdrop-blur-md rounded-full p-3 hover:bg-white/20 z-10 transition-all"
              onClick={() => setZoomImage(null)}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expandable Info Drawer — slides up from bottom for description/variants ──
function ProductInfoDrawer({
  description,
  variants,
  detailColumns,
  detailColumnsDef,
  getCellValue,
  row,
  primaryColor,
  secondaryColor,
  accentColor,
}: {
  description: string;
  variants: string;
  detailColumns?: string[];
  detailColumnsDef: Column[];
  getCellValue: (row: Row, slug: string) => string;
  row: Row;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="shrink-0 bg-white" style={{ borderTop: `1px solid ${primaryColor}10` }}>
      {/* Toggle button */}
      <button
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors"
        style={{ color: BRAND.grisMoyen }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Masquer les détails' : 'Voir les détails'}
        <ChevronRight
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(-90deg)' : 'rotate(90deg)' }}
        />
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-5 pb-4 space-y-2.5" style={{ maxHeight: '30vh', overflowY: 'auto' }}>
          {description && (
            <p className="text-sm leading-relaxed" style={{ color: BRAND.grisMoyen }}>{description}</p>
          )}

          {variants && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: BRAND.grisMoyen }}>Options disponibles</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.split(/[,;]/).filter(Boolean).map((v, i) => (
                  <Badge
                    key={i}
                    className="text-xs font-medium rounded-lg px-2.5 py-0.5"
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

          {detailColumns && detailColumns.length > 0 && (
            <div className="rounded-xl p-3" style={{ backgroundColor: `${accentColor}80` }}>
              <div className="grid grid-cols-2 gap-2">
                {detailColumns.map(slug => {
                  const col = detailColumnsDef.find(c => c.slug === slug);
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
      )}
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

  /**
   * Build carousel images for a product.
   * Key dedup strategy: use Drive file IDs to avoid showing the same image twice
   * (e.g., cover image that also appears in the gallery column).
   */
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

    // 1. Add cover image first
    if (config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      if (coverVal) {
        if (Array.isArray(coverVal)) {
          const coverImgs = parseImageUrls(coverVal);
          if (coverImgs.length > 0) addImage(resolveImageUrl(coverImgs[0], 1600));
        } else {
          const coverStr = typeof coverVal === 'string' ? coverVal : String(coverVal);
          const coverImgs = parseImageUrls(coverStr);
          if (coverImgs.length > 0) addImage(resolveImageUrl(coverImgs[0], 1600));
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
        const carouselImgs = parseImageUrls(carouselVal, separator);
        for (const img of carouselImgs) {
          addImage(resolveImageUrl(img, 1600));
        }
      }
    }

    // 3. If no carousel column but cover is IMAGE_ARRAY, add remaining cover images
    if (!config.carouselColumn && config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      if (coverVal) {
        const allCoverImgs = parseImageUrls(coverVal);
        // Skip the first one (already added as cover), add the rest
        for (let i = 1; i < allCoverImgs.length; i++) {
          addImage(resolveImageUrl(allCoverImgs[i], 1600));
        }
      }
    }

    return images;
  }, []);

  /** Get the total number of images for a product (for card badge) */
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

  // ── If a product is selected, show the full-page immersive view ──
  if (selectedProduct) {
    return (
      <ProductFullPage
        row={selectedProduct.row}
        detailColumns={selectedProduct.columns}
        section={selectedProduct.section}
        s={s}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        accentColor={accentColor}
        getCellValue={getCellValue}
        getCarouselImages={getCarouselImages}
        buildConversionLink={buildConversionLink}
        onClose={() => setSelectedProduct(null)}
      />
    );
  }

  // ── Default: catalog grid view ──
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
            const imageCount = getImageCount(row, config, columns);

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
                }}
              >
                {/* ── Format image strict: aspect-ratio 3/4, object-fit cover ── */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 4', overflow: 'hidden', background: BRAND.grisClair }}>
                  {coverUrl ? (
                    <img
                      src={resolveImageUrl(coverUrl, 800)}
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

                  {/* Image count badge — shows total images when > 1 */}
                  {imageCount > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: 'rgba(26,60,52,0.75)',
                        color: BRAND.blanc,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 12,
                        backdropFilter: 'blur(8px)',
                        zIndex: 2,
                      }}
                    >
                      <ImageIcon style={{ width: 12, height: 12 }} />
                      {imageCount}
                    </div>
                  )}
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
    </div>
  );
}
