'use client';

/**
 * GlobalCart (VG37 Axe 1) — Global cart persistence component.
 *
 * Mounted in the root layout (src/app/layout.tsx) so the cart header button
 * and drawer are visible on ALL routes (catalog, /merci, legal pages, etc.).
 *
 * Features:
 * - CartHeaderButton: floating cart icon with item count badge (always visible)
 * - CartDrawer: slide-over drawer for cart management (opens on click)
 * - Auto-clears cart on the /merci page (post-order ghost cart prevention)
 *
 * The checkout flow navigates to /checkout (multi-product) or falls back to
 * the first product's PDP for single-product checkout.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCartStore } from '@/lib/cart-store';
import { CartDrawer } from '@/components/preview/CartDrawer';
import { ShoppingBag } from 'lucide-react';

export function GlobalCart() {
  const pathname = usePathname();
  const { toggleDrawer, getTotalItems, clearCart, closeDrawer, triggerCheckout } = useCartStore();
  const count = getTotalItems();

  // VG37 Axe 1: Auto-clear cart on /merci page (prevents ghost carts after order)
  useEffect(() => {
    if (pathname === '/merci') {
      // Small delay to let the thank-you page render, then purge the cart
      const timer = setTimeout(() => {
        clearCart();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pathname, clearCart]);

  // Don't render the floating button on admin pages
  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      {/* Cart header button — floating, ALWAYS visible (VG37.1 Axe 2: removed count>0 gate).
          The badge numeric span keeps its own conditional rendering below. */}
      <button
        onClick={toggleDrawer}
        data-cta="cart-open"
        className="cart-header-button fixed top-4 z-50 flex items-center justify-center transition-all hover:scale-105"
        style={{
          right: '1rem',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
        aria-label="Open cart"
      >
        <ShoppingBag className="w-6 h-6" style={{ color: '#1A1A1A' }} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center font-bold"
            style={{
              width: '16px',
              height: '16px',
              minWidth: '16px',
              borderRadius: '50%',
              fontSize: '9px',
              backgroundColor: 'var(--gold-accent, #C5A059)',
              color: '#fff',
              border: '1.5px solid #FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            {count}
          </span>
        )}
      </button>

      {/* Cart Drawer — slide-over for cart management.
          VG37.1 Axe 1: onCheckout now uses triggerCheckout() from the store
          instead of the stub window.location.href='/'. CatalogPreview watches
          the checkoutTrigger counter and opens its checkout view. If on a
          non-catalog route, navigate to home first, then trigger. */}
      <CartDrawer onCheckout={() => {
        const items = useCartStore.getState().items;
        if (items.length === 0) return;
        closeDrawer();
        // If not on catalog page, navigate there first — the triggerCheckout
        // will be picked up by CatalogPreview on mount via the stored counter.
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          // Set trigger BEFORE navigation so CatalogPreview picks it up on load
          triggerCheckout();
          window.location.href = '/';
        } else {
          // Already on catalog — trigger directly
          triggerCheckout();
        }
      }} />
    </>
  );
}
