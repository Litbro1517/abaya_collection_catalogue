/**
 * Cart Store (VG34) — Zustand store for multi-product cart.
 *
 * Manages cart items with productId, title, price, color, size, quantity, image.
 * Persisted to localStorage for cross-session continuity.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string; // unique cart item id (productId + color + size)
  productId: string;
  title: string;
  price: string;
  color: string;
  size: string;
  quantity: number;
  image: string;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

function makeCartItemId(productId: string, color: string, size: string): string {
  return `${productId}:${color}:${size}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (item) => {
        const id = makeCartItemId(item.productId, item.color, item.size);
        const quantity = item.quantity ?? 1;
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === id ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          const newItem: CartItem = { ...item, id, quantity };
          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity < 1) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        }));
      },

      clearCart: () => set({ items: [] }),

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getTotalPrice: () =>
        get().items.reduce((sum, i) => {
          const price = parseFloat(String(i.price).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          return sum + price * i.quantity;
        }, 0),
    }),
    {
      name: 'abaya-cart',
      partialize: (state) => ({ items: state.items }), // don't persist isDrawerOpen
    },
  ),
);
