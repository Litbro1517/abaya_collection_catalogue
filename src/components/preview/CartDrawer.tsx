'use client';

import { useCartStore } from '@/lib/cart-store';
import { useClientTranslation } from '@/lib/i18n';
import { X, Plus, Minus, Trash2, ShoppingBag, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveHybridImageUrl } from '@/lib/media-utils';
import { pushDataLayer, buildEcommerceItem, parsePriceToNumber } from '@/lib/analytics';

/**
 * CartDrawer (VG34) — Slide-over cart drawer.
 *
 * Opens from the right side (LTR) / left side (RTL).
 * Shows cart items with quantity controls, remove button, total price,
 * and a "Checkout" button that navigates to /checkout.
 *
 * On PDP: addItem() only increments the header badge (drawer NOT opened).
 * On Home/Header: clicking the cart icon opens this drawer.
 */

interface Props {
  onCheckout?: () => void;
}

export function CartDrawer({ onCheckout }: Props) {
  const { t, rtl, formatPrice } = useClientTranslation();
  const { items, isDrawerOpen, closeDrawer, updateQuantity, removeItem, getTotalPrice } = useCartStore();
  const [checkingOut, setCheckingOut] = useState(false);

  const total = getTotalPrice();

  const handleCheckout = () => {
    // ── Lot 1: begin_checkout dataLayer event ──
    // Fires when the user clicks the Checkout button in the cart drawer.
    // Captures the full cart contents (items, total value) at the exact moment
    // the checkout flow is initiated.
    if (items.length > 0) {
      pushDataLayer({
        event: 'begin_checkout',
        ecommerce: {
          currency: 'MAD',
          value: parsePriceToNumber(total),
          items: items.map((item) =>
            buildEcommerceItem({
              id: item.productId,
              name: item.title,
              price: item.price,
              variant: `${item.color || ''} / ${item.size || ''}`.trim(),
              quantity: item.quantity,
            }),
          ),
        },
      });
    }
    setCheckingOut(true);
    closeDrawer();
    if (onCheckout) {
      onCheckout();
    }
    // VG34.3: No window.location fallback — caller must provide onCheckout
    setCheckingOut(false);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300',
          isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 z-[101] h-full w-full max-w-md bg-white shadow-2xl transition-transform duration-300 flex flex-col',
          rtl ? 'left-0' : 'right-0',
          isDrawerOpen
            ? 'translate-x-0'
            : rtl ? '-translate-x-full' : 'translate-x-full',
        )}
        style={{ backgroundColor: 'var(--bg-app, #fffefe)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-soft, #EAE4DC)' }}
        >
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--vert-deep, #14241E)' }}>
            <ShoppingBag className="w-4 h-4" style={{ color: 'var(--gold-accent, #C5A059)' }} />
            {t('cart.title')}
            {items.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
            )}
          </h2>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-full hover:bg-muted/50 transition-colors"
            aria-label={t('cart.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground/30" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">{t('cart.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-xl border"
                  style={{ borderColor: 'var(--border-soft, #EAE4DC)', backgroundColor: '#fff' }}
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted/30">
                    {item.image && (
                      <img
                        src={resolveHybridImageUrl(item.image, 150)}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--vert-deep, #14241E)' }}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.color && (
                        <span className="text-[10px] text-muted-foreground">{item.color}</span>
                      )}
                      {item.size && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-btn-secondary, #F7F4EE)', color: 'var(--vert-deep, #14241E)' }}>
                          {item.size}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold mt-1" style={{ color: 'var(--price-charcoal, #121212)' }}>
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="inline-flex items-center rounded-lg border"
                        style={{ borderColor: 'var(--border-soft, #EAE4DC)' }}
                      >
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-1 hover:bg-muted/30 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 text-xs font-bold" style={{ color: 'var(--vert-deep, #14241E)' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 hover:bg-muted/30 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        aria-label={t('cart.remove')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with total + checkout */}
        {items.length > 0 && (
          <div
            className="px-5 py-4 border-t shrink-0 space-y-3"
            style={{ borderColor: 'var(--border-soft, #EAE4DC)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: 'var(--vert-deep, #14241E)' }}>
                {t('cart.total')}
              </span>
              <span className="text-lg font-bold" style={{ color: 'var(--price-charcoal, #121212)' }}>
                {formatPrice(String(total))}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--vert-deep, #14241E)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--vert-hover, #1A2E27)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--vert-deep, #14241E)'; }}
            >
              {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" style={{ color: 'var(--gold-accent, #C5A059)' }} />}
              {t('cart.checkout')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
