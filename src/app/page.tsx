'use client';

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import Header from '@/components/gallery/Header';
import CategoryFilter from '@/components/gallery/CategoryFilter';
import ProductGrid from '@/components/gallery/ProductGrid';
import ProductDetail from '@/components/gallery/ProductDetail';
import LoginModal from '@/components/gallery/LoginModal';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function Home() {
  const {
    view,
    isAdmin,
    setCategories,
    setProducts,
    setTotalProducts,
    setTotalPages,
    activeCategory,
    searchQuery,
    page,
    setLoading,
  } = useAppStore();

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch {
      // Silent fail
    }
  }, [setCategories]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '24',
      });
      if (activeCategory && activeCategory !== 'tout') {
        params.set('category', activeCategory);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const res = await fetch(`/api/products?${params}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        setTotalProducts(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [page, activeCategory, searchQuery, setProducts, setTotalProducts, setTotalPages, setLoading]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth');
        if (res.ok) {
          const json = await res.json();
          if (json.authenticated) {
            useAppStore.getState().setIsAdmin(true);
          }
        }
      } catch {
        // Not authenticated
      }
    };
    checkAuth();
  }, []);

  // Admin dashboard
  if (view === 'admin' && isAdmin) {
    return (
      <TooltipProvider>
        <AdminDashboard />
      </TooltipProvider>
    );
  }

  // Public gallery
  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <CategoryFilter />

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Hero section - only when no search/filter active */}
          {!searchQuery && activeCategory === 'tout' && (
            <div className="mb-8">
              {/* Hero Banner */}
              <div className="relative overflow-hidden rounded-2xl mb-6">
                <img
                  src="/hero-banner.png"
                  alt="Abaya Chic Collection"
                  className="w-full h-48 sm:h-64 md:h-80 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center">
                  <div className="px-6 sm:px-10 max-w-lg">
                    <h2 className="font-[family-name:var(--font-playfair)] text-2xl sm:text-4xl font-bold text-white leading-tight">
                      Nouvelle Collection
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-white/80">
                      Decouvrez nos abayas, ensembles et robes elegants
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="h-px w-8 bg-gold" />
                      <span className="text-xs sm:text-sm text-gold font-medium tracking-widest uppercase">
                        Marrakech
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search results header */}
          {searchQuery && (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Resultats pour &laquo; <span className="font-medium text-foreground">{searchQuery}</span> &raquo;
              </p>
            </div>
          )}

          {/* Category title when filtering */}
          {activeCategory !== 'tout' && !searchQuery && (
            <div className="mb-6">
              <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-tight sm:text-3xl capitalize">
                {activeCategory}
              </h2>
            </div>
          )}

          <ProductGrid />
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-gold">
                  Abaya Chic Collection
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mode islamique feminine — Marrakech, Maroc
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:items-end">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <a
                    href="https://wa.me/212600000000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gold transition-colors"
                  >
                    WhatsApp
                  </a>
                  <span className="text-border">|</span>
                  <a
                    href="https://instagram.com/abayachiccollection"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gold transition-colors"
                  >
                    Instagram
                  </a>
                  <span className="text-border">|</span>
                  <a
                    href="mailto:contact@abayachic.ma"
                    className="hover:text-gold transition-colors"
                  >
                    Contact
                  </a>
                </div>
                <p className="text-[11px] text-muted-foreground/60">
                  &copy; {new Date().getFullYear()} Abaya Chic Collection. Tous droits reserves.
                </p>
              </div>
            </div>
          </div>
        </footer>

        {/* Modals & Sheets */}
        <ProductDetail />
        <LoginModal />
      </div>
    </TooltipProvider>
  );
}
