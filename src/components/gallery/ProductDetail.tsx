'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shirt } from 'lucide-react';
import type { Product } from '@/types';
import type { CarouselApi } from '@/components/ui/carousel';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import ContactButton from './ContactButton';

function ProductDetailContent({ product }: { product: Product }) {
  const { t, formatPrice } = useTranslation();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi | undefined>(undefined);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Track carousel slide changes
  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api, onSelect]);

  const images = [
    ...(product.imagePrincipale ? [product.imagePrincipale] : []),
    ...(product.imagesCarousel || []),
  ].filter(Boolean);

  return (
    <>
      {/* Image carousel */}
      <div className="relative">
        {images.length > 0 ? (
          <>
            <Carousel
              setApi={setApi}
              opts={{ loop: images.length > 1 }}
              className="w-full"
            >
              <CarouselContent className="-ml-0">
                {images.map((img, idx) => (
                  <CarouselItem key={idx} className="pl-0">
                    <div className="aspect-[3/4] w-full bg-secondary">
                      <img
                        src={img}
                        alt={`${product.nomProduit} - ${idx + 1}`}
                        className="size-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-2 size-8 border-none bg-black/30 text-white hover:bg-black/50" />
                  <CarouselNext className="right-2 size-8 border-none bg-black/30 text-white hover:bg-black/50" />
                </>
              )}
            </Carousel>

            {/* Dots */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => api?.scrollTo(idx)}
                    className={`size-2 rounded-full transition-all ${
                      currentSlide === idx
                        ? 'bg-white w-4'
                        : 'bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-secondary">
            <Shirt className="size-16 text-border" />
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <SheetHeader className="gap-1 p-0">
          <SheetTitle className="font-[family-name:var(--font-playfair)] text-xl font-bold leading-tight text-foreground">
            {product.nomProduit}
          </SheetTitle>
          {product.categorie?.nom && (
            <SheetDescription className="text-xs text-muted-foreground">
              {product.categorie.nom}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Price */}
        <p className="text-2xl font-bold text-gold">
          {formatPrice(product.prixVente)}
        </p>

        {/* Size selector */}
        {product.tailles && product.tailles.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{t('product.sizes')}</span>
            <div className="flex flex-wrap gap-2">
              {product.tailles.map((taille) => {
                const isSelected = selectedSize === taille;
                const isDisabled = !product.disponible;
                return (
                  <button
                    key={taille}
                    onClick={() => !isDisabled && setSelectedSize(taille)}
                    disabled={isDisabled}
                    className={`flex h-10 min-w-[3rem] items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-gold bg-gold/10 text-gold'
                        : isDisabled
                          ? 'cursor-not-allowed border-border bg-secondary/50 text-muted-foreground opacity-50'
                          : 'border-border bg-background text-foreground hover:border-gold/50'
                    }`}
                  >
                    {taille}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Color selector */}
        {product.couleurs && product.couleurs.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">{t('product.colors')}</span>
            <div className="flex flex-wrap gap-2.5">
              {product.couleurs.map((couleur, idx) => {
                const isSelected = selectedColor === couleur.hex;
                return (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedColor(couleur.hex)}
                        className={`flex size-6 items-center justify-center rounded-full transition-all ${
                          isSelected
                            ? 'ring-2 ring-gold ring-offset-2 ring-offset-background'
                            : 'ring-1 ring-border hover:ring-gold/50'
                        }`}
                        style={{ backgroundColor: couleur.hex }}
                        aria-label={couleur.nom}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {couleur.nom}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">{t('product.description')}</span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </div>
        )}

        {/* Stock indicator */}
        {!product.disponible && (
          <p className="text-sm font-medium text-destructive">
            {t('product.soldOut')}
          </p>
        )}

        {/* Spacer to push button to bottom */}
        <div className="flex-1" />
      </div>

      {/* Contact button - sticky at bottom */}
      <div className="sticky bottom-0 border-t border-border bg-card p-4">
        <ContactButton product={product} />
      </div>
    </>
  );
}

export default function ProductDetail() {
  const { selectedProduct, showProductDetail, setShowProductDetail, setSelectedProduct } =
    useAppStore();

  const product = selectedProduct;

  const handleClose = () => {
    setShowProductDetail(false);
    setSelectedProduct(null);
  };

  return (
    <Sheet open={showProductDetail} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        {product && <ProductDetailContent key={product.id} product={product} />}
      </SheetContent>
    </Sheet>
  );
}
