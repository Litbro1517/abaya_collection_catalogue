'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { Section, SectionConfig, Column, Row, CatalogSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Search, MessageCircle, Share2, X, ChevronLeft, ChevronRight,
  ZoomIn, ExternalLink, Mail, Instagram, ImageIcon, Lock, Loader2
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Image URL Resolution ──────────────────────────────────────────────────

function resolveImageUrl(url: string, size = 800): string {
  if (!url) return '';

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

  return url; // Regular URL, use as-is
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
  if (val.startsWith('http')) {
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

function ResolvedImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [error, setError] = useState(false);
  const resolvedSrc = resolveImageUrl(src);

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
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function CatalogPreview() {
  const { catalog, settings, setView, isAdmin, setIsAdmin } = useAppStore();
  const [sections, setSections] = useState<{ section: Section; columns: Column[]; rows: Row[] }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ row: Row; columns: Column[]; section: Section } | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Admin login dialog (only for non-admin visitors who click the lock icon)
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        setAdminPassword('');
      } else {
        const json = await res.json();
        setAdminError(json.error || 'Mot de passe incorrect');
      }
    } catch {
      setAdminError('Erreur de connexion');
    } finally {
      setAdminLoading(false);
    }
  };

  const s = settings || catalog?.settings;

  // Load section data
  const [sectionsLoaded, setSectionsLoaded] = useState(false);

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
          const res = await fetch(`/api/datasources/${dsId}`);
          if (res.ok) {
            const json = await res.json();
            loaded.push({
              section,
              columns: json.data?.columns || [],
              rows: json.data?.rows || [],
            });
          }
        } catch {
          loaded.push({ section, columns: [], rows: [] });
        }
      }

      if (!cancelled) {
        setSections(loaded);
        setSectionsLoaded(true);
      }
    };

    loadSections();
    return () => { cancelled = true; };
  }, [catalog, sectionsLoaded]);

  const getCellValue = (row: Row, slug: string): string => {
    const data = row.data as Record<string, string>;
    return data[slug] || '';
  };

  const getCarouselImages = (row: Row, config: SectionConfig): string[] => {
    if (!config.carouselColumn) return [];
    const val = getCellValue(row, config.carouselColumn);
    return parseImageUrls(val);
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
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r => {
      const data = r.data as Record<string, string>;
      return Object.values(data).some(v => String(v).toLowerCase().includes(q));
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: s?.backgroundColor || '#FAF8F5' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ backgroundColor: `${s?.backgroundColor || '#FAF8F5'}dd`, borderColor: s?.primaryColor ? `${s.primaryColor}20` : '#E8E2D9' }}>
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView('builder')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="flex-1">
            <h1 className="font-semibold" style={{ color: s?.secondaryColor || '#1A1A1A' }}>{catalog?.name || 'Mon Catalogue'}</h1>
          </div>
          {s?.enableSearch && (
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="h-9 pl-9 text-sm"
              />
            </div>
          )}
          {/* Subtle admin access — lock icon only visible to non-admins */}
          {!isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-30 hover:opacity-100 transition-opacity"
              onClick={() => setShowAdminLogin(true)}
              title="Accès administrateur"
            >
              <Lock className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Sections */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        {sections.map(({ section, columns, rows }) => {
          const config = section.config as SectionConfig;
          const filteredRows = filterRows(rows, config);
          const colsPerRow = config.columnsPerRow || 3;

          if (filteredRows.length === 0 && config.dataSourceId) return null;

          return (
            <div key={section.id} className="mb-10">
              {section.title && (
                <div className="mb-5">
                  <h2 className="text-2xl font-bold" style={{ color: s?.secondaryColor || '#1A1A1A' }}>{section.title}</h2>
                  {section.subtitle && <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>}
                </div>
              )}

              <div className={cn(
                'grid gap-4',
                colsPerRow === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                colsPerRow === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              )}>
                {filteredRows.map(row => {
                  const coverUrl = config.coverColumn ? getCellValue(row, config.coverColumn) : '';
                  const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
                  const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
                  const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'group cursor-pointer transition-all duration-200 hover:scale-[1.02]',
                        config.cardStyle === 'elevated' ? 'bg-white rounded-xl shadow-md hover:shadow-lg' :
                        config.cardStyle === 'bordered' ? 'bg-white rounded-xl border border-gray-200' :
                        'bg-white rounded-xl'
                      )}
                      onClick={() => {
                        setSelectedProduct({ row, columns, section });
                        setCarouselIdx(0);
                      }}
                    >
                      {/* Cover Image */}
                      {coverUrl && (
                        <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl bg-gray-100">
                          <ResolvedImage
                            src={coverUrl}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            fallbackClassName="w-full h-full"
                          />
                        </div>
                      )}

                      {/* Card Content */}
                      <div className="p-3 space-y-1">
                        {config.showTitle !== false && title && (
                          <h3 className="text-sm font-semibold line-clamp-2" style={{ color: s?.secondaryColor || '#1A1A1A' }}>{title}</h3>
                        )}
                        {config.showDescription !== false && description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
                        )}
                        {config.showPrice !== false && price && (
                          <p className="text-sm font-bold" style={{ color: s?.primaryColor || '#C9A84C' }}>{price}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Catalogue en préparation</p>
            <p className="text-sm mt-1">{isAdmin ? 'Ajoutez des sections dans l\'onglet Mise en page' : 'Revenez bientôt découvrir notre collection'}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t py-6" style={{ borderColor: `${s?.primaryColor || '#C9A84C'}20` }}>
        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <h3 className="font-semibold" style={{ color: s?.primaryColor || '#C9A84C' }}>{catalog?.name || 'Mon Catalogue'}</h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {s?.whatsappNumber && (
              <a href={`https://wa.me/${s.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-green-600 transition-colors flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </a>
            )}
            {s?.instagramHandle && (
              <a href={`https://instagram.com/${s.instagramHandle.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="hover:text-pink-600 transition-colors flex items-center gap-1">
                <Instagram className="w-3 h-3" /> Instagram
              </a>
            )}
            {s?.emailContact && (
              <a href={`mailto:${s.emailContact}`} className="hover:text-blue-600 transition-colors flex items-center gap-1">
                <Mail className="w-3 h-3" /> Contact
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Product Detail Sheet */}
      <Dialog open={!!selectedProduct} onOpenChange={v => { if (!v) setSelectedProduct(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (() => {
            const { row, columns: detailColumns, section } = selectedProduct;
            const config = section.config as SectionConfig;
            const carouselImages = getCarouselImages(row, config);
            const title = config.titleColumn ? getCellValue(row, config.titleColumn) : '';
            const price = config.priceColumn ? getCellValue(row, config.priceColumn) : '';
            const description = config.descriptionColumn ? getCellValue(row, config.descriptionColumn) : '';
            const variants = config.variantColumn ? getCellValue(row, config.variantColumn) : '';
            const coverUrl = config.coverColumn ? getCellValue(row, config.coverColumn) : '';
            const conversionLink = buildConversionLink(row, config);

            const currentImage = carouselImages[carouselIdx] || resolveImageUrl(coverUrl);

            return (
              <div className="space-y-4">
                {/* Carousel */}
                {(carouselImages.length > 0 || coverUrl) && (
                  <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    {currentImage ? (
                      <ResolvedImage
                        src={currentImage}
                        alt={title}
                        className="w-full h-full object-contain"
                        fallbackClassName="w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <ImageIcon className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {s?.enableZoom && currentImage && (
                      <button
                        className="absolute top-3 right-3 bg-white/80 rounded-full p-2 hover:bg-white transition"
                        onClick={() => setZoomImage(resolveImageUrl(currentImage, 1600))}
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    )}
                    {carouselImages.length > 1 && (
                      <>
                        <button
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 hover:bg-white"
                          onClick={() => setCarouselIdx((carouselIdx - 1 + carouselImages.length) % carouselImages.length)}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1.5 hover:bg-white"
                          onClick={() => setCarouselIdx((carouselIdx + 1) % carouselImages.length)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {carouselImages.map((_, i) => (
                            <button
                              key={i}
                              className={cn('w-2 h-2 rounded-full transition-all', i === carouselIdx ? 'bg-white w-4' : 'bg-white/50')}
                              onClick={() => setCarouselIdx(i)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Thumbnail strip */}
                {carouselImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {carouselImages.map((img, i) => (
                      <button
                        key={i}
                        className={cn('w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all', i === carouselIdx ? 'border-gold' : 'border-transparent')}
                        onClick={() => setCarouselIdx(i)}
                      >
                        <ResolvedImage
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                          fallbackClassName="w-full h-full"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Product info */}
                <div>
                  <h2 className="text-xl font-bold" style={{ color: s?.secondaryColor || '#1A1A1A' }}>{title}</h2>
                  {price && (
                    <p className="text-lg font-bold mt-1" style={{ color: s?.primaryColor || '#C9A84C' }}>{price}</p>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{description}</p>
                  )}
                </div>

                {/* Variants (colors/sizes) */}
                {variants && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Options disponibles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {variants.split(/[,;]/).filter(Boolean).map((v, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{v.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detail columns */}
                {config.detailColumns && config.detailColumns.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      {config.detailColumns.map(slug => {
                        const col = detailColumns.find(c => c.slug === slug);
                        if (!col) return null;
                        const val = getCellValue(row, slug);
                        if (!val) return null;
                        return (
                          <div key={slug} className="text-sm">
                            <span className="text-muted-foreground">{col.name}: </span>
                            <span className="font-medium">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Conversion button */}
                <Button
                  className="w-full h-12 text-base gap-2"
                  style={{ backgroundColor: s?.primaryColor || '#C9A84C', color: s?.primaryColor === '#1A1A1A' ? '#fff' : '#1A1A1A' }}
                  onClick={() => window.open(conversionLink, '_blank')}
                >
                  <MessageCircle className="w-5 h-5" />
                  {s?.conversionChannel === 'whatsapp' ? 'Commander via WhatsApp' :
                   s?.conversionChannel === 'messenger' ? 'Commander via Messenger' :
                   s?.conversionChannel === 'email' ? 'Commander par email' :
                   'Commander'}
                </Button>

                {/* Share button */}
                {s?.enableSharing && (
                  <Button variant="outline" className="w-full gap-2" onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Lien copié !');
                  }}>
                    <Share2 className="w-4 h-4" /> Partager ce produit
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      <Dialog open={!!zoomImage} onOpenChange={v => { if (!v) setZoomImage(null); }}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black">
          {zoomImage && (
            <div className="relative">
              <ResolvedImage
                src={zoomImage}
                alt="Zoom"
                className="w-full h-auto max-h-[80vh] object-contain"
                fallbackClassName="w-full h-[80vh]"
              />
              <button
                className="absolute top-3 right-3 bg-white/20 rounded-full p-2 hover:bg-white/40"
                onClick={() => setZoomImage(null)}
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Login Dialog (only visible when lock icon clicked) */}
      <Dialog open={showAdminLogin} onOpenChange={v => { if (!v) { setShowAdminLogin(false); setAdminError(''); } }}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-semibold">Accès Administrateur</h2>
              <p className="text-xs text-muted-foreground">Entrez le mot de passe pour modifier le catalogue</p>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <Input
                type="password"
                placeholder="Mot de passe"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                autoFocus
                className="h-10"
              />
              {adminError && (
                <p className="text-xs text-destructive">{adminError}</p>
              )}
              <Button type="submit" className="w-full h-10 bg-gold hover:bg-gold/90 text-gold-foreground" disabled={adminLoading || !adminPassword}>
                {adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Se connecter'}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
