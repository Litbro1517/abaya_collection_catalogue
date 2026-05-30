'use client';

import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function CategoryFilter() {
  const { categories, activeCategory, setActiveCategory } = useAppStore();

  const sortedCategories = [...categories]
    .filter((c) => c.active)
    .sort((a, b) => a.ordre - b.ordre);

  const allCategories = [
    { id: 'tout', nom: 'Tout', slug: 'tout', ordre: 0, active: true },
    ...sortedCategories,
  ];

  return (
    <div className="w-full border-b border-border bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Mobile: horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none snap-x snap-mandatory sm:hidden">
          {allCategories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.slug)}
                className={cn(
                  'shrink-0 snap-start rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                )}
              >
                {cat.nom}
              </button>
            );
          })}
        </div>

        {/* Desktop: centered flex row */}
        <div className="hidden flex-wrap items-center justify-center gap-2 py-3 sm:flex">
          {allCategories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.slug)}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                )}
              >
                {cat.nom}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
