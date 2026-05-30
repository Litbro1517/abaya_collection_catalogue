import { create } from 'zustand';
import type { Product, Category, Couleur } from '@/types';

export type AppView = 'gallery' | 'admin';

interface AppState {
  // View
  view: AppView;
  setView: (view: AppView) => void;

  // Auth
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  showLoginModal: boolean;
  setShowLoginModal: (v: boolean) => void;

  // Categories
  categories: Category[];
  setCategories: (cats: Category[]) => void;
  activeCategory: string;
  setActiveCategory: (slug: string) => void;

  // Products
  products: Product[];
  setProducts: (products: Product[]) => void;
  totalProducts: number;
  setTotalProducts: (n: number) => void;
  page: number;
  setPage: (n: number) => void;
  totalPages: number;
  setTotalPages: (n: number) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Product Detail
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
  showProductDetail: boolean;
  setShowProductDetail: (v: boolean) => void;

  // Admin: Product Form
  showProductForm: boolean;
  setShowProductForm: (v: boolean) => void;
  editingProduct: Product | null;
  setEditingProduct: (p: Product | null) => void;

  // Loading
  loading: boolean;
  setLoading: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'gallery',
  setView: (view) => set({ view }),

  isAdmin: false,
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  showLoginModal: false,
  setShowLoginModal: (showLoginModal) => set({ showLoginModal }),

  categories: [],
  setCategories: (categories) => set({ categories }),
  activeCategory: 'tout',
  setActiveCategory: (activeCategory) => set({ activeCategory, page: 1 }),

  products: [],
  setProducts: (products) => set({ products }),
  totalProducts: 0,
  setTotalProducts: (totalProducts) => set({ totalProducts }),
  page: 1,
  setPage: (page) => set({ page }),
  totalPages: 1,
  setTotalPages: (totalPages) => set({ totalPages }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery, page: 1 }),

  selectedProduct: null,
  setSelectedProduct: (selectedProduct) => set({ selectedProduct }),
  showProductDetail: false,
  setShowProductDetail: (showProductDetail) => set({ showProductDetail }),

  showProductForm: false,
  setShowProductForm: (showProductForm) => set({ showProductForm }),
  editingProduct: null,
  setEditingProduct: (editingProduct) => set({ editingProduct }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}));
