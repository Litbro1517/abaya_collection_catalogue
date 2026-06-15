'use client';

import { useState } from 'react';
import { Search, Lock, LayoutDashboard, Store, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchOverlay from './SearchOverlay';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

export default function Header() {
  const {
    isAdmin,
    setIsAdmin,
    setShowLoginModal,
    view,
    setView,
    searchQuery,
    setSearchQuery,
  } = useAppStore();

  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const { t } = useClientTranslation();

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    setSearchQuery(value);
  };

  const handleAdminClick = () => {
    if (isAdmin) {
      setView(view === 'gallery' ? 'admin' : 'gallery');
    } else {
      setShowLoginModal(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
          {/* Left side - Admin/lock icon on mobile, nothing on desktop */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAdminClick}
              className="size-9 text-muted-foreground hover:text-gold"
              aria-label={isAdmin ? t('header.toggleView') : t('header.adminLogin')}
            >
              {isAdmin ? (
                view === 'gallery' ? (
                  <LayoutDashboard className="size-4" />
                ) : (
                  <Store className="size-4" />
                )
              ) : (
                <Lock className="size-4" />
              )}
            </Button>
            {isAdmin && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {view === 'gallery' ? t('header.administration') : t('header.gallery')}
              </span>
            )}
          </div>

          {/* Center - Brand name on mobile */}
          <h1 className="font-[family-name:var(--font-playfair)] text-lg font-semibold tracking-wide text-foreground sm:hidden">
            Abaya Chic
          </h1>

          {/* Desktop: Brand on left + Search in center + Admin on right */}
          <div className="hidden flex-1 items-center gap-8 sm:flex">
            <h1 className="font-[family-name:var(--font-playfair)] text-xl font-bold tracking-wide text-gold whitespace-nowrap">
              Abaya Chic Collection
            </h1>
            <div className="relative mx-auto w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('header.searchProduct')}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-9 w-full rounded-xl border-border bg-secondary/50 pl-9 pr-9 text-sm placeholder:text-muted-foreground focus-visible:border-gold focus-visible:ring-gold/30"
              />
              {localSearch && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right side - Search icon on mobile, admin button on desktop */}
          <div className="flex items-center gap-2">
            {/* Mobile search icon */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMobileSearch(true)}
              className="size-9 text-muted-foreground hover:text-gold sm:hidden"
              aria-label={t('header.search')}
            >
              <Search className="size-4" />
            </Button>

            {/* Desktop admin button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdminClick}
              className="hidden gap-2 rounded-xl border-border text-sm hover:border-gold hover:text-gold sm:inline-flex"
            >
              {isAdmin ? (
                view === 'gallery' ? (
                  <>
                    <LayoutDashboard className="size-4" />
                    {t('header.admin')}
                  </>
                ) : (
                  <>
                    <Store className="size-4" />
                    {t('header.gallery')}
                  </>
                )
              ) : (
                <>
                  <Lock className="size-4" />
                  {t('header.admin')}
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile search overlay */}
      <SearchOverlay
        open={showMobileSearch}
        onClose={() => setShowMobileSearch(false)}
      />
    </>
  );
}
