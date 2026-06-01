'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, ColumnConfig, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Search, MessageCircle, Share2, ChevronLeft, ChevronRight,
  Mail, Instagram, ImageIcon, BookOpen, Heart,
  ShoppingBag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Brand Charte Constants ──
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

// ═══════════════════════════════════════════════════════════════════════════
// ── PRODUCT PAGE — Glide-like: Hero + Fields + Square Carousel + CTA ──
// ═══════════════════════════════════════════════════════════════════════════

function ProductPage({
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
  onBack,
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
  onBack: () => void;
}) {
  const config = section.config as SectionConfig;
  const carouselImages = getCarouselImages(row, config, detailColumns);
  const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
  const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
  const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
  const variants = config.variantColumn ? getCellValue(row, config.variantColumn) : '';
  const conversionLink = buildConversionLink(row, config);

  // Cover image (first image)
  const coverImage = carouselImages[0] || '';

  // Parse variants
  const variantList = variants ? variants.split(/[,;]/).map(v => v.trim()).filter(Boolean) : [];
  const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|\d{1,2})$/i;
  const sizes = variantList.filter(v => sizePattern.test(v));
  const colors = variantList.filter(v => !sizePattern.test(v));

  // Carousel state
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Collect detail fields
  const detailFields: { label: string; value: string }[] = [];
  if (price) detailFields.push({ label: 'Prix', value: price });
  if (description) detailFields.push({ label: 'Description', value: description });
  if (sizes.length > 0) detailFields.push({ label: 'Tailles', value: sizes.join(', ') });
  if (colors.length > 0) detailFields.push({ label: 'Couleurs', value: colors.join(', ') });

  // Add detail columns from config
  if (config.detailColumns && config.detailColumns.length > 0) {
    for (const slug of config.detailColumns) {
      const col = detailColumns.find(c => c.slug === slug);
      if (!col) continue;
      const val = getCellValue(row, slug);
      if (!val) continue;
      // Avoid duplicates
      if (!detailFields.some(f => f.label === col.name)) {
        detailFields.push({ label: col.name, value: val });
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BRAND.blanc }}>
      {/* ── Back button ── */}
      <div style={{ maxWidth: 1270, margin: '0 auto', width: '100%', padding: '16px 32px 0' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: BRAND.grisMoyen, background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <main className="flex-1" style={{ maxWidth: 1270, margin: '0 auto', width: '100%', padding: '18px 32px 48px' }}>

        {/* ── Product Hero: thumbnail + title/desc ── */}
        <section className="product-hero">
          {coverImage ? (
            <img
              className="product-hero-thumb"
              src={resolveImageUrl(coverImage, 300)}
              alt={title}
            />
          ) : (
            <div className="product-hero-thumb" style={{ background: BRAND.grisClair, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon className="w-8 h-8" style={{ color: BRAND.grisMoyen, opacity: 0.4 }} />
            </div>
          )}

          <div className="product-hero-text">
            <h1 style={{ fontFamily: "'Playfair Display', serif" }}>{title}</h1>
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

        {/* ── Glide Carousel: square, no thumbnails ── */}
        {carouselImages.length > 0 && (
          <section
            className="glide-carousel"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={resolveImageUrl(carouselImages[carouselIdx], 1600)}
              alt={`${title} - ${carouselIdx + 1}`}
            />

            {carouselImages.length > 1 && (
              <>
                <button className="carousel-arrow left" onClick={goPrev} aria-label="Image précédente">
                  ‹
                </button>
                <button className="carousel-arrow right" onClick={goNext} aria-label="Image suivante">
                  ›
                </button>

                <div className="carousel-dots">
                  {carouselImages.map((_, i) => (
                    <button
                      key={i}
                      className={i === carouselIdx ? 'active' : ''}
                      onClick={() => goTo(i)}
                      aria-label={`Image ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── WhatsApp CTA ── */}
        <a
          className="whatsapp-cta"
          href={conversionLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundColor: primaryColor, color: BRAND.noir }}
        >
          {s?.conversionChannel === 'whatsapp' ? 'Commander via WhatsApp' :
           s?.conversionChannel === 'messenger' ? 'Commander via Messenger' :
           s?.conversionChannel === 'email' ? 'Commander par email' :
           'Commander'}
        </a>
      </main>
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
  const { catalog, settings, isAdmin, setView } = useAppStore();
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

    if (config.carouselColumn) {
      const carouselVal = rawData[config.carouselColumn];
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

    if (!config.carouselColumn && config.coverColumn) {
      const coverVal = rawData[config.coverColumn];
      if (coverVal) {
        const allCoverImgs = parseImageUrls(coverVal);
        for (let i = 1; i < allCoverImgs.length; i++) {
          addImage(resolveImageUrl(allCoverImgs[i], 1600));
        }
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

  // ── If a product is selected, show the product page ──
  if (selectedProduct) {
    return (
      <ProductPage
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
        onBack={() => setSelectedProduct(null)}
      />
    );
  }

  // ── Default: catalog grid view ──
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 shadow-md" style={{ backgroundColor: secondaryColor }}>
        <div style={{ maxWidth: 1270, margin: '0 auto', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B, #C9A84C)', backgroundSize: '200% 200%' }}>
              <span className="text-sm font-bold" style={{ color: BRAND.noir }}>A</span>
            </div>
            <h1 className="font-bold text-base sm:text-lg text-white truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
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
          <div style={{ maxWidth: 1270, margin: '0 auto', padding: '8px 32px', display: 'flex', gap: 8, overflowX: 'auto' }} className="no-scrollbar">
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

      {/* ── Error ── */}
      {loadError && (
        <div style={{ maxWidth: 1270, margin: '0 auto', padding: '16px 32px', width: '100%' }}>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${BRAND.bordeaux}10`, border: `1px solid ${BRAND.bordeaux}30` }}>
            <p className="text-sm" style={{ color: BRAND.bordeaux }}>{loadError}</p>
            <button onClick={() => { setSectionsLoaded(false); setLoadError(null); }} className="text-xs underline mt-1" style={{ color: BRAND.bordeaux }}>Réessayer</button>
          </div>
        </div>
      )}

      {/* ── Product Gallery ── */}
      <main
        className="flex-1"
        style={{
          maxWidth: 1270,
          margin: '0 auto',
          width: '100%',
          padding: '24px 32px 48px',
        }}
      >
        {/* Section title */}
        {sections.length > 0 && sections[0].section.title && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: secondaryColor, fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
              {sections[0].section.title}
            </h2>
            {sections[0].section.subtitle && (
              <p style={{ color: BRAND.grisMoyen, fontSize: 15, marginTop: 8 }}>{sections[0].section.subtitle}</p>
            )}
            <div style={{ width: 48, height: 2, marginTop: 12, borderRadius: 2, backgroundColor: primaryColor }} />
          </div>
        )}

        {/* ── Glide-like grid: 4 cols desktop, 3 cols tablet, 2 cols mobile ── */}
        <div className="catalog-grid">
          {paginatedProducts.map(({ row, columns, section, config }) => {
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
              <button
                key={row.id}
                className="product-card"
                onClick={() => setSelectedProduct({ row, columns, section })}
              >
                {/* Image: aspect-ratio 4/3, object-fit cover, no hover effects */}
                <div className="product-card-image-wrap">
                  {coverUrl ? (
                    <img
                      src={resolveImageUrl(coverUrl, 800)}
                      alt={title}
                      loading="lazy"
                      className="product-card-img"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const parent = el.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="product-card-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${BRAND.grisMoyen}" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`;
                        }
                      }}
                    />
                  ) : (
                    <div className="product-card-placeholder">
                      <ImageIcon style={{ width: 40, height: 40, color: BRAND.grisMoyen, opacity: 0.3 }} />
                    </div>
                  )}

                  {/* Like button */}
                  <button
                    onClick={(e) => toggleLike(row.id, e)}
                    className="product-card-like"
                    style={{ background: isLiked ? '#FEE2E2' : 'rgba(255,255,255,0.9)' }}
                  >
                    <Heart className={isLiked ? 'fill-current' : ''} style={{ width: 14, height: 14, color: isLiked ? '#EF4444' : BRAND.grisMoyen }} />
                  </button>

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
              </button>
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

      {/* ── Footer ── */}
      <footer className="mt-auto py-4 sm:py-5" style={{ backgroundColor: secondaryColor }}>
        <div style={{ maxWidth: 1270, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B)' }}>
              <span className="text-[10px] font-bold" style={{ color: BRAND.noir }}>A</span>
            </div>
            <span className="font-semibold text-xs sm:text-sm text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              {catalog?.name || 'Abaya Chic Collection'}
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

      {/* ── Scoped Glide-like styles ── */}
      <style jsx global>{`
        /* ── Catalog Grid ── */
        .catalog-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          column-gap: 20px;
          row-gap: 36px;
        }

        @media (max-width: 900px) {
          .catalog-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .catalog-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 10px;
            row-gap: 24px;
          }
        }

        /* ── Product Card ── */
        .product-card {
          display: block;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .product-card-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          border-radius: 10px;
          background: #f1f1f1;
        }

        .product-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .product-card-placeholder {
          width: 100%;
          aspect-ratio: 4 / 3;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #F5F0E8;
        }

        .product-card-like {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }

        .product-card-count {
          position: absolute;
          bottom: 8px;
          left: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
          background-color: rgba(26,60,52,0.75);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 12px;
          z-index: 2;
        }

        .product-card-title {
          display: block;
          margin-top: 10px;
          font-size: 16px;
          line-height: 1.2;
          color: #111;
          font-weight: 600;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .product-card-price {
          display: block;
          margin-top: 3px;
          color: #707070;
          font-size: 15px;
          font-weight: 400;
        }

        @media (max-width: 640px) {
          .product-card-title,
          .product-card-price {
            font-size: 13px;
          }
        }

        /* ── Product Hero ── */
        .product-hero {
          min-height: 120px;
          display: grid;
          grid-template-columns: 120px 1fr;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .product-hero-thumb {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 10px;
        }

        .product-hero-text h1 {
          margin: 0 0 8px;
          font-size: 24px;
          line-height: 1.2;
          color: #111;
        }

        .product-hero-text p {
          margin: 0;
          color: #707070;
          font-size: 15px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (max-width: 640px) {
          .product-hero {
            grid-template-columns: 72px 1fr;
            min-height: 72px;
          }

          .product-hero-thumb {
            width: 72px;
            height: 72px;
          }

          .product-hero-text h1 {
            font-size: 18px;
          }

          .product-hero-text p {
            font-size: 13px;
          }
        }

        /* ── Product Fields ── */
        .product-fields {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 28px;
          margin: 24px 0 32px;
        }

        .product-field span {
          display: block;
          color: #707070;
          font-size: 14px;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .product-field strong {
          display: block;
          font-size: 15px;
          font-weight: 500;
          color: #111;
          word-break: break-word;
        }

        @media (max-width: 640px) {
          .product-fields {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        /* ── Glide Carousel ── */
        .glide-carousel {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          border-radius: 10px;
          background: #f2f2f2;
        }

        .glide-carousel img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .carousel-arrow {
          position: absolute;
          top: 50%;
          width: 44px;
          height: 56px;
          transform: translateY(-50%);
          border: 0;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.16);
          color: white;
          font-size: 34px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .carousel-arrow:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        .carousel-arrow.left {
          left: 12px;
        }

        .carousel-arrow.right {
          right: 12px;
        }

        .carousel-dots {
          position: absolute;
          bottom: 14px;
          left: 50%;
          display: flex;
          gap: 6px;
          transform: translateX(-50%);
          flex-wrap: wrap;
          justify-content: center;
          max-width: 90%;
        }

        .carousel-dots button {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          transition: background 0.2s;
        }

        .carousel-dots button.active {
          background: white;
        }

        /* ── WhatsApp CTA ── */
        .whatsapp-cta {
          display: block;
          margin-top: 24px;
          padding: 15px 18px;
          border-radius: 12px;
          text-align: center;
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          transition: opacity 0.2s;
        }

        .whatsapp-cta:hover {
          opacity: 0.9;
        }

        @media (max-width: 640px) {
          .whatsapp-cta {
            position: sticky;
            bottom: 12px;
            z-index: 20;
          }
        }
      `}</style>
    </div>
  );
}
