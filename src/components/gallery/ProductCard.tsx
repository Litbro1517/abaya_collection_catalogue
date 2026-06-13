'use client';

import { Shirt, Star, MessageCircle, Instagram, ExternalLink, Mail } from 'lucide-react';
import type { Product, Canal } from '@/types';
import { useAppStore } from '@/lib/store';
import { CANAUX } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
  statut?: 'Nouveau' | 'Courant';
}

const canalIcons: Record<Canal, React.ReactNode> = {
  whatsapp: <MessageCircle className="size-4" />,
  instagram: <Instagram className="size-4" />,
  landing: <ExternalLink className="size-4" />,
  email: <Mail className="size-4" />,
};

function getCanalColor(canal: Canal): string {
  const found = CANAUX.find((c) => c.value === canal);
  return found?.color ?? '#C9A84C';
}

export default function ProductCard({ product, statut }: ProductCardProps) {
  const { setSelectedProduct, setShowProductDetail } = useAppStore();
  const { t, formatPrice } = useTranslation();

  const handleClick = () => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const canalColor = getCanalColor(product.canalCommande);

  return (
    <button
      onClick={handleClick}
      className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-luxury product-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
    >
      {/* Image container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-xl bg-secondary">
        {product.imagePrincipale ? (
          <img
            src={product.imagePrincipale}
            alt={product.nomProduit}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-secondary">
            <Shirt className="size-12 text-border" />
          </div>
        )}

        {/* Nouveau badge */}
        {statut === 'Nouveau' && (
          <Badge className="absolute left-2 top-2 gap-1 border-none bg-emerald-700 text-white text-[10px] font-semibold shadow-sm z-10">
            {t('product.new')}
          </Badge>
        )}

        {/* Featured badge */}
        {product.featured && (
          <Badge className="absolute left-2 top-2 gap-1 border-none bg-gold text-gold-foreground text-[10px] font-semibold shadow-sm">
            <Star className="size-3 fill-current" />
            {t('product.featured')}
          </Badge>
        )}

        {/* Canal indicator */}
        <div
          className="absolute bottom-2 right-2 flex size-10 items-center justify-center rounded-full text-white shadow-md transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: canalColor }}
        >
          {canalIcons[product.canalCommande]}
        </div>

        {/* Hover overlay - Commander */}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center bg-gradient-to-t from-black/70 to-black/0 py-4 transition-transform duration-300 group-hover:translate-y-0">
          <span className="text-sm font-semibold tracking-wide text-white">
            {t('product.commander')}
          </span>
        </div>
      </div>

      {/* Card content */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Product name */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
          {product.nomProduit}
        </h3>

        {/* Color dots */}
        {product.couleurs && product.couleurs.length > 0 && (
          <div className="flex items-center gap-1">
            {product.couleurs.slice(0, 5).map((couleur, idx) => (
              <span
                key={idx}
                className="size-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: couleur.hex }}
                title={couleur.nom}
              />
            ))}
            {product.couleurs.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                +{product.couleurs.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <p className="text-base font-bold text-gold">
          {formatPrice(product.prixVente)}
        </p>
      </div>
    </button>
  );
}
