'use client';

import { SearchIcon } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import ProductCard from './ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[3/4] w-full rounded-t-xl" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}

export default function ProductGrid() {
  const { products, loading, page, totalPages, setPage, rows } = useAppStore();

  // Composite sort: Nouveau first (by row order), then Courant (by row order)
  const getStatut = (productId: string): 'Nouveau' | 'Courant' => {
    const row = rows.find(r => r.id === productId);
    if (!row) return 'Courant';
    const data = row.data as Record<string, unknown>;
    return (data.__statut__ as 'Nouveau' | 'Courant') || 'Courant';
  };

  const sortedProducts = [...products].sort((a, b) => {
    const aStatut = getStatut(a.id);
    const bStatut = getStatut(b.id);
    const aIsNouveau = aStatut === 'Nouveau' ? 0 : 1;
    const bIsNouveau = bStatut === 'Nouveau' ? 0 : 1;
    if (aIsNouveau !== bIsNouveau) return aIsNouveau - bIsNouveau;
    // Fallback to original order
    return 0;
  });

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-secondary">
          <SearchIcon className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-[family-name:var(--font-playfair)] text-lg font-semibold text-foreground">
          Aucun produit trouv&eacute;
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Essayez de modifier vos crit&egrave;res de recherche
        </p>
      </div>
    );
  }

  const hasMore = page < totalPages;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} statut={getStatut(product.id)} />
        ))}
      </div>

      {/* Loading more indicator */}
      {loading && products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={`more-${i}`} />
          ))}
        </div>
      )}

      {/* Load more button */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            className="rounded-xl border-border px-8 text-sm font-medium hover:border-gold hover:text-gold"
          >
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
}
