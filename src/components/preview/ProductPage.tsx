'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Section, SectionConfig, Column, ColumnConfig, Row } from '@/types';
import { COULEURS_DEFAULTS, normalizeCouleurKey } from '@/lib/constants';
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

// ── Color Hex Lookup (multi-strategy, case-insensitive, separator-tolerant) ──
function resolveColorHex(colorName: string, colorMap: Record<string, string>): string | null {
  // Strategy 1: Normalize key (lowercase + strip accents)
  const key = normalizeCouleurKey(colorName);
  if (colorMap[key]) return colorMap[key];

  // Strategy 2: Direct lowercase match
  const lower = colorName.toLowerCase().trim();
  if (colorMap[lower]) return colorMap[lower];

  // Strategy 3: Try normalizing spaces/commas (e.g., "bleu nuit" → "bleunuit")
  const collapsedKey = key.replace(/[\s,;]+/g, '');
  if (colorMap[collapsedKey]) return colorMap[collapsedKey];

  // Strategy 4: Try each word individually (for compound names like "Rose kachiri")
  // This helps when a compound name partially matches
  const words = colorName.trim().split(/[\s,;]+/).filter(Boolean);
  if (words.length > 1) {
    for (const word of words) {
      const wordKey = normalizeCouleurKey(word);
      if (colorMap[wordKey]) return colorMap[wordKey];
    }
  }

  // Strategy 5: Fallback to COULEURS_DEFAULTS
  if (COULEURS_DEFAULTS[key]) return COULEURS_DEFAULTS[key];
  const defaultCollapsed = collapsedKey;
  if (COULEURS_DEFAULTS[defaultCollapsed]) return COULEURS_DEFAULTS[defaultCollapsed];

  // Strategy 6: Try if it's already a hex color
  if (/^#[0-9a-fA-F]{3,8}$/.test(colorName)) return colorName;

  return null;
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
  messengerLink: string;
  emailContact: string;
  conversionMessage: string;
  primaryColor: string;
  secondaryColor: string;
  onBack: () => void;
}

export function ProductPage({
  row,
  columns: detailColumns,
  section,
  catalogName,
  conversionChannel,
  whatsappNumber,
  messengerLink,
  emailContact,
  conversionMessage,
  primaryColor,
  secondaryColor,
  onBack,
}: ProductPageProps) {
  const config = section.config as SectionConfig;
  const rawData = row.data as Record<string, unknown>;
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

  // ── ColorMap state (must be declared BEFORE colorData computation) ──
  const [colorMap, setColorMap] = useState<Record<string, string>>({});

  // ── Parse colors: colorColumn (ColorMap) → optionscouleurs fallback → variantColumn fallback ──
  // Priority 1: dedicated colorColumn (ColorMap-driven, COLOR type)
  const rawColorValue = config.colorColumn ? getCellValue(config.colorColumn) : '';
  const colorNames: string[] = rawColorValue
    ? rawColorValue.split(/[,;]/).map(v => v.trim()).filter(Boolean)
    : [];

  // Priority 2: look for an "optionscouleurs" or similar column in raw data
  const fallbackColorKeys = ['optionscouleurs', 'option-couleurs', 'couleurs'];
  let fallbackColorValue = '';
  if (colorNames.length === 0) {
    for (const key of fallbackColorKeys) {
      const val = getCellValue(key);
      if (val) { fallbackColorValue = val; break; }
    }
  }
  const fallbackColorNames = fallbackColorValue
    ? fallbackColorValue.split(/[,;]/).map(v => v.trim()).filter(Boolean)
    : [];

  // ── Parse variants into sizes (from variantColumn) ──
  const variantList = variants ? variants.split(/[,;]/).map(v => v.trim()).filter(Boolean) : [];
  const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|XXL|XXXL|\d{1,2})$/i;
  const sizes = variantList.filter(v => sizePattern.test(v));

  // Priority 3: extract non-size values from variantColumn (legacy fallback)
  const legacyColorNames = variantList.filter(v => !sizePattern.test(v));

  // Final color list: colorColumn → optionscouleurs → variantColumn non-size
  const finalColorNames = colorNames.length > 0
    ? colorNames
    : fallbackColorNames.length > 0
      ? fallbackColorNames
      : legacyColorNames;

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

  // ── Conversion link ──
  const conversionLink = (() => {
    if (conversionChannel === 'whatsapp' && whatsappNumber) {
      const msg = conversionMessage || `Bonjour, je souhaite commander :\n*${title}*\nPrix : ${price}`;
      return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg.replace('{product}', title))}`;
    }
    if (conversionChannel === 'messenger' && messengerLink) return messengerLink;
    if (conversionChannel === 'email' && emailContact) {
      return `mailto:${emailContact}?subject=${encodeURIComponent(`Commande : ${title}`)}`;
    }
    return '#';
  })();

  // ── State ──
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [imageLoaded, setImageLoaded] = useState<Set<number>>(new Set());

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Fetch color map from API (include ALL colors — no isActive/visible filter;
  // filtering is for admin UI only, not for hex resolution)
  useEffect(() => {
    fetch('/api/colormap')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) {
          const map: Record<string, string> = {};
          for (const c of json.data) {
            // Store by multiple keys for robust lookup
            map[c.name.toLowerCase()] = c.hex;
            map[c.slug] = c.hex;
            // Also store accent-stripped version
            const accentKey = normalizeCouleurKey(c.name);
            map[accentKey] = c.hex;
            // Store collapsed version (no spaces/commas)
            const collapsed = accentKey.replace(/[\s,;]+/g, '');
            if (collapsed !== accentKey) map[collapsed] = c.hex;
          }
          setColorMap(map);
        }
      })
      .catch(() => {});
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
      if (diff > 0) goNext(); else goPrev();
    }
  };

  // ── Share handler ──
  const handleShare = async () => {
    const shareData = {
      title: title || 'Produit',
      text: `${title}${price ? ` — ${price}` : ''}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    }
  };

  // ── Keyboard navigation for carousel ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, carouselImages.length]);

  const isEpuise = stockState === 'epuise';
  const isSurCommande = stockState === 'sur_commande';
  const sectionTitle = section.title || 'Collection';

  // ═══════════════════════════════════════════════════════════════════
  // ── RENDER ──
  // ═══════════════════════════════════════════════════════════════════

  return (
    <main className="product-page">
      {/* ── Breadcrumb ── */}
      <nav className="product-page-breadcrumb">
        <button onClick={onBack} className="breadcrumb-back" aria-label="Retour">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button className="breadcrumb-link" onClick={onBack}>{catalogName}</button>
        <span className="breadcrumb-sep">/</span>
        <button className="breadcrumb-link" onClick={onBack}>{sectionTitle}</button>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{title}</span>
      </nav>

      {/* ── Main Layout: Carousel + Info ── */}
      <div className="product-page-layout">
        {/* ═══════ LEFT: Carousel + Thumbnails ═══════ */}
        <div className="product-page-gallery">
          {/* Main Carousel */}
          {carouselImages.length > 0 ? (
            <section
              className="product-page-carousel"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="product-page-carousel-track"
                style={{ transform: `translateX(-${carouselIdx * 100}%)` }}
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
                  <button className="carousel-arrow left" onClick={goPrev} aria-label="Image précédente">‹</button>
                  <button className="carousel-arrow right" onClick={goNext} aria-label="Image suivante">›</button>

                  {/* Dots */}
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
                        <button className={carouselIdx === 0 ? 'active' : ''} onClick={() => goTo(0)} aria-label="Image 1" />
                        {carouselIdx > 3 && <span className="carousel-ellipsis">…</span>}
                        {Array.from({ length: carouselImages.length }, (_, i) => i)
                          .filter(i => i !== 0 && i !== carouselImages.length - 1 && Math.abs(i - carouselIdx) <= 2)
                          .map(i => (
                            <button key={i} className={i === carouselIdx ? 'active' : ''} onClick={() => goTo(i)} aria-label={`Image ${i + 1}`} />
                          ))}
                        {carouselIdx < carouselImages.length - 4 && <span className="carousel-ellipsis">…</span>}
                        <button
                          className={carouselIdx === carouselImages.length - 1 ? 'active' : ''}
                          onClick={() => goTo(carouselImages.length - 1)}
                          aria-label={`Image ${carouselImages.length}`}
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
                    aria-label={`Vignette ${i + 1}`}
                  >
                    <img
                      src={thumbUrl}
                      alt={`${title} vignette ${i + 1}`}
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

        {/* ═══════ RIGHT: Product Info ═══════ */}
        <div className="product-page-info">
          {/* ── Statut badge ── */}
          {statut === 'Nouveau' && stockState === 'en_stock' && (
            <div className="product-page-badge badge-nouveau">
              <span className="badge-dot" />
              Nouveau
            </div>
          )}

          {/* ── Title ── */}
          <h1 className="product-page-title">{title}</h1>

          {/* ── Price ── */}
          {price && (
            <div className="product-page-price-row">
              <span className="product-page-price">{price}</span>
              {isEpuise && <span className="product-page-status status-epuise">Épuisé</span>}
              {isSurCommande && <span className="product-page-status status-sur-commande">Sur commande</span>}
            </div>
          )}

          {/* ── Description ── */}
          {description && (
            <div className="product-page-section">
              <div className="product-page-section-title">Description</div>
              <p className="product-page-description">{description}</p>
            </div>
          )}

          {/* ── Color swatches (40×40px circles from ColorMap) ── */}
          {colorData.length > 0 && (
            <div className="product-page-section">
              <div className="product-page-section-title">
                Couleurs{selectedColor ? <span className="selected-value">: {selectedColor}</span> : ''}
              </div>
              <div className="product-page-colors">
                {colorData.map(({ name, hex }) => {
                  const isSelected = selectedColor === name;
                  return (
                    <button
                      key={name}
                      className={cn(
                        'product-page-color-circle',
                        isSelected && 'selected'
                      )}
                      onClick={() => setSelectedColor(isSelected ? null : name)}
                      title={name}
                      aria-label={`Couleur ${name}${isSelected ? ' (sélectionnée)' : ''}`}
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
              </div>
            </div>
          )}

          {/* ── Size selector ── */}
          {sizes.length > 0 && (
            <div className="product-page-section">
              <div className="product-page-section-title">
                Tailles{selectedSize ? <span className="selected-value">: {selectedSize}</span> : ''}
              </div>
              <div className="product-page-sizes">
                {sizes.map(size => (
                  <button
                    key={size}
                    className={cn(
                      'product-page-size-chip',
                      selectedSize === size && 'selected',
                      isEpuise && 'disabled'
                    )}
                    onClick={() => !isEpuise && setSelectedSize(selectedSize === size ? null : size)}
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
              <div className="product-page-section-title">Détails</div>
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
            {/* WhatsApp CTA */}
            <a
              className={cn('product-page-cta', isEpuise && 'cta-disabled')}
              href={isEpuise ? undefined : conversionLink}
              target={isEpuise ? undefined : '_blank'}
              rel={isEpuise ? undefined : 'noopener noreferrer'}
              onClick={isEpuise ? (e: React.MouseEvent) => e.preventDefault() : undefined}
              style={{
                backgroundColor: isEpuise ? BRAND.grisClair : '#25D366',
                color: isEpuise ? BRAND.grisMoyen : '#fff',
              }}
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              {isEpuise ? 'Produit épuisé' : isSurCommande ? 'Commander via WhatsApp' : 'Commander via WhatsApp'}
            </a>

            {/* Like + Share */}
            <div className="product-page-secondary-actions">
              <button
                className="product-page-icon-btn"
                onClick={() => setIsLiked(!isLiked)}
                aria-label="Favori"
              >
                <Heart className={cn('w-5 h-5', isLiked && 'fill-current')} style={{ color: isLiked ? '#EF4444' : BRAND.grisMoyen }} />
              </button>
              <button
                className="product-page-icon-btn"
                onClick={handleShare}
                aria-label="Partager"
              >
                <Share2 className="w-5 h-5" style={{ color: BRAND.grisMoyen }} />
              </button>
            </div>
          </div>

          {/* ── Share toast ── */}
          {showShareToast && (
            <div className="product-page-toast">
              <Check className="w-4 h-4" style={{ color: BRAND.vertFonce }} />
              Lien copié !
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile sticky CTA ── */}
      <div className="product-page-mobile-cta">
        <div className="mobile-cta-price-row">
          {price && <span className="mobile-cta-price">{price}</span>}
          {isEpuise && <span className="product-page-status status-epuise">Épuisé</span>}
          {isSurCommande && <span className="product-page-status status-sur-commande">Sur commande</span>}
        </div>
        <a
          className={cn('mobile-cta-button', isEpuise && 'cta-disabled')}
          href={isEpuise ? undefined : conversionLink}
          target={isEpuise ? undefined : '_blank'}
          rel={isEpuise ? undefined : 'noopener noreferrer'}
          onClick={isEpuise ? (e: React.MouseEvent) => e.preventDefault() : undefined}
          style={{
            backgroundColor: isEpuise ? BRAND.grisClair : '#25D366',
            color: isEpuise ? BRAND.grisMoyen : '#fff',
          }}
        >
          <MessageCircle className="w-4 h-4" />
          {isEpuise ? 'Épuisé' : 'Commander'}
        </a>
      </div>
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
