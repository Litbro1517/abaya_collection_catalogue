'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useClientTranslation } from '@/lib/i18n';
import { pushDataLayer } from '@/lib/analytics';

// ── Order type (matches the Prisma Order model) ──
interface OrderData {
  id: string;
  productId: string;
  productName: string | null;
  productPrice: string | null;
  productColor: string | null;
  productSize: string | null;
  productQuantity: number;
  productImage: string | null;
  status: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  createdAt: string;
}

function MerciContent() {
  const { t, rtl } = useClientTranslation();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const fromLandingPage = searchParams.get('from') === 'lp'; // VG40.3: closed funnel isolation
  const tracked = useRef(false);

  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderItems, setOrderItems] = useState<OrderData[]>([]); // VG41: multi-product items
  const [loading, setLoading] = useState(!!orderId);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // ── Color hex resolution (harmonized with CheckoutPage) ──
  // The Order model stores only the color NAME (productColor). To render a
  // colored chip consistent with the checkout recap, we resolve the hex from
  // the same ColorMap (single source of truth) via /api/colormap/lookup.
  const [colorHex, setColorHex] = useState<string | null>(null);

  // Push conversion tracking event once the order data is loaded.
  // Enriched dataLayer for Meta/Google conversion tracking (Zaraz-compatible).
  // Includes: value, currency, transaction_id, and items array (GA4/Meta Pixel standard).
  // ━━ Lot 3: Multi-product payload — maps ALL orderItems, not just the first ━━
  // Previously: items[] contained only `order` (single product), even for multi-cart
  // orders. This underreported revenue (only first item's price) and lost variant
  // details for secondary items in GA4/Meta.
  // Now: items[] is mapped from the full orderItems array. The `value` field is
  // the sum of all items' (price × quantity), giving the true total.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (tracked.current) return;
    if (!order) return; // Wait for order data to be fetched
    if (!orderItems || orderItems.length === 0) return; // Wait for items array

    tracked.current = true;

    // Helper: parse numeric price from a possibly-formatted string ("290.00 DH" → 290.00)
    const parsePrice = (s: string | null | undefined): number => {
      if (!s) return 0;
      const m = s.match(/[\d.,]+/);
      if (!m) return 0;
      return parseFloat(m[0].replace(/\s/g, '').replace(',', '.')) || 0;
    };

    // Build the GA4 items array from the FULL orderItems array (multi-product).
    // Each item gets: item_id, item_name, price, quantity, item_variant, item_size.
    // ━━ Lot 3 Correctif: Isolated variants — each item reads ONLY its own fields ━━
    // Previously: item_variant/size fell back to order.productColor/Size, causing
    // an accessory without size to inherit the main garment's size (data pollution).
    // Now: secondary items read exclusively item.productColor / item.productSize.
    // If a field is null, it stays null (no cross-item inheritance).
    const ga4Items = orderItems.map((item, idx) => ({
      item_id: idx === 0 ? order.id : `${order.id}-${idx + 1}`,  // primary uses order id, others get suffix
      sku: item.productId || 'N/A',
      item_name: item.productName || 'Unknown',
      price: parsePrice(item.productPrice),
      quantity: item.productQuantity || 1,
      item_variant: item.productColor || undefined,
      item_size: item.productSize || undefined,
    }));

    // True total value = sum of (item.price × item.quantity) across all items
    const numericValue = ga4Items.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0,
    );

    // MANDAT 4P — Tracking reliability fix:
    // Previously: `if (dl)` guard meant the purchase event was SILENTLY DROPPED
    // when `window.dataLayer` was not yet initialized (e.g. GTM/Zaraz snippet
    // not yet executed, or placeholder GTM-XXXXXXX still in place). This caused
    // loss of conversion tracking data.
    // Now: use the centralized `pushDataLayer` helper which explicitly initializes
    // `window.dataLayer = []` if missing before pushing — guaranteeing the
    // purchase event is ALWAYS recorded, with try/catch safety + SSR guard.
    pushDataLayer({
      event: 'purchase',
      ecommerce: {
        transaction_id: order.id,
        value: numericValue,
        currency: 'MAD',
        items: ga4Items,
      },
      // Flat fields for Meta Pixel compatibility
      value: numericValue,
      currency: 'MAD',
      transaction_id: order.id,
      order_id: order.id,
    });
  }, [order, orderItems]);

  // Fetch the real order data for the recap
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.data) {
          setOrder(json.data as OrderData);
          // VG41: Store all related items for multi-product display
          setOrderItems(json.items ? (json.items as OrderData[]) : [json.data as OrderData]);
        } else {
          setFetchError(json.error || 'not_found');
        }
      } catch {
        if (!cancelled) setFetchError('network');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  // ── Resolve color hex from ColorMap (single source of truth) ──
  // Triggered whenever the order's productColor name changes. Uses the same
  // /api/colormap/lookup endpoint that validates colors in admin, so the
  // Merci page chip is always consistent with the admin-validated palette.
  useEffect(() => {
    const colorName = order?.productColor;
    if (!colorName) {
      setColorHex(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = `/api/colormap/lookup?names=${encodeURIComponent(colorName)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const arr = Array.isArray(json?.data) ? json.data : [];
        const match = arr.find((c: { name: string; hex: string | null }) => c.name === colorName);
        setColorHex(match?.hex ?? null);
      } catch {
        // Network error — leave colorHex null (chip simply not rendered)
      }
    })();
    return () => { cancelled = true; };
  }, [order?.productColor]);

  const na = t('checkout.notSelected');
  const productName = order?.productName || '';
  const productPrice = order?.productPrice || '';
  const hasRecap = !!order && (!!productName || !!productPrice);

  // VG41: Calculate total from all items (multi-product)
  const totalItems = orderItems.length || 1;
  const totalQuantity = orderItems.reduce((sum, item) => sum + (item.productQuantity || 1), 0);

  // VG41.2: Calculate the REAL total — sum of (unit price × quantity) for all items.
  // Previously, the total was just the primary order's productPrice (single article price).
  function parsePriceNumber(raw: string | null): number {
    if (!raw) return 0;
    const match = String(raw).match(/[\d.,]+/);
    if (!match) return 0;
    const cleaned = match[0].replace(/\s/g, '').replace(/,(?=\d{2}$)/, '.').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  const calculatedTotal = orderItems.reduce((sum, item) => {
    return sum + parsePriceNumber(item.productPrice) * (item.productQuantity || 1);
  }, 0);
  // Format the total using the same currency suffix as the individual prices
  const totalFormatted = calculatedTotal > 0
    ? `${calculatedTotal} Dhs`
    : productPrice; // fallback to stored price if calculation fails

  return (
    <div className="merci-page" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="merci-card">
        {/* Success icon — harmonized style (40px gold CheckCircle2 in cream wrapper) */}
        <div className="merci-icon-wrapper">
          <CheckCircle2 className="w-5 h-5" style={{ color: '#C9A84C' }} />
        </div>

        {/* Title */}
        <h1 className="merci-title">{t('thanks.title')}</h1>
        <p className="merci-subtitle">
          {order?.customerName
            ? `${t('thanks.subtitle')} ${order.customerName} !`
            : t('thanks.subtitle')}
        </p>

        {/* Order ID */}
        {orderId && (
          <div className="merci-order-id">
            {t('thanks.orderLabel')} <span>#{orderId.slice(-8).toUpperCase()}</span>
          </div>
        )}

        {/* ━━ VG41: Multi-product order recap ━━ */}
        {loading ? (
          <div className="merci-recap merci-recap--loading">
            <span className="merci-recap-loading-text">{t('thanks.loading')}</span>
          </div>
        ) : hasRecap ? (
          <div className="merci-recap">
            <div className="merci-recap-head">
              <h2 className="merci-recap-title">{t('thanks.recapTitle')}</h2>
              {totalItems > 1 && (
                <span className="text-xs text-muted-foreground">({totalItems} articles)</span>
              )}
            </div>

            {/* VG41: Iterate over all order items */}
            {orderItems.map((item, idx) => (
              <div key={idx} style={idx > 0 ? { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #EAE4DC' } : undefined}>
                {/* Product line: thumbnail + name */}
                <div className="merci-recap-product">
                  {item.productImage ? (
                    <div className="merci-recap-thumb">
                      <img src={item.productImage} alt={item.productName || ''} loading="lazy" decoding="async" />
                    </div>
                  ) : (
                    <div className="merci-recap-thumb merci-recap-thumb--empty">
                      <ShoppingBag className="w-5 h-5" style={{ color: '#808080' }} />
                    </div>
                  )}
                  <div className="merci-recap-product-info">
                    <span className="merci-recap-product-name">{item.productName || ''}</span>
                    {item.productPrice && (
                      <span className="text-xs text-muted-foreground">{item.productPrice}</span>
                    )}
                  </div>
                </div>

                {/* Variant summary */}
                <dl className="merci-recap-list">
                  <div className="merci-recap-row">
                    <dt className="merci-recap-key">{t('checkout.color')}</dt>
                    <dd className="merci-recap-val merci-recap-val--color">
                      {item.productColor ? (
                        <span>{item.productColor}</span>
                      ) : na}
                    </dd>
                  </div>
                  <div className="merci-recap-row">
                    <dt className="merci-recap-key">{t('checkout.size')}</dt>
                    <dd className="merci-recap-val">
                      {item.productSize ? (
                        <span className="merci-size-pill">{item.productSize}</span>
                      ) : na}
                    </dd>
                  </div>
                  <div className="merci-recap-row">
                    <dt className="merci-recap-key">{t('checkout.quantity')}</dt>
                    <dd className="merci-recap-val">{item.productQuantity || 1}</dd>
                  </div>
                </dl>
              </div>
            ))}

            {/* Total amount to pay — VG41.2: calculated from sum of all items × quantity */}
            {totalFormatted && (
              <div className="merci-recap-total">
                <span className="merci-recap-total-label">{t('thanks.amountPaid')} ({totalQuantity} {totalQuantity > 1 ? 'articles' : 'article'})</span>
                <span className="merci-recap-total-value">{totalFormatted}</span>
              </div>
            )}

            {/* Trust mention */}
            <div className="merci-cod-box" role="note">
              <div className="merci-cod-box-icon">
                <Truck className="w-4 h-4" style={{ color: '#1A3C34' }} />
              </div>
              <p className="merci-cod-box-text">
                <span className="merci-cod-box-lead">{t('thanks.paymentModeCod')}</span>
              </p>
            </div>
          </div>
        ) : null}

        {/* Status detail — single unique line (Statut only; "Mode de paiement" doublon removed) */}
        <div className="merci-details">
          <div className="merci-detail-row">
            <span className="merci-detail-label">{t('thanks.status')}</span>
            <span className="merci-detail-value" style={{ color: '#C9A84C' }}>{t('thanks.statusPending')}</span>
          </div>
        </div>

        {/* Back button — navigates to public catalog root.
            Sets a sessionStorage flag so the home page forces `view: 'preview'`
            BEFORE first render, preventing admin session state (localStorage
            `abaya_admin_state` + default Zustand `view: 'builder'`) from
            hijacking the navigation into the admin BuilderShell. */}
        {/* VG40.3: Hide "Retour au catalogue" when the order comes from a landing page (closed funnel) */}
        {!fromLandingPage && (
          <a
            href="/"
            className="merci-back-btn"
            onClick={() => {
              try { sessionStorage.setItem('merci_return', '1'); } catch { /* ignore */ }
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('thanks.backToCatalog')}
          </a>
        )}

        {/* Tracking notice */}
        <div className="merci-tracking">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>{t('thanks.trackingNotice')}</span>
        </div>
      </div>
    </div>
  );
}

export default function MerciPage() {
  const { t } = useClientTranslation();
  return (
    <Suspense fallback={
      <div className="merci-page">
        <div className="merci-card" style={{ opacity: 0.6 }}>
          <div className="merci-icon-wrapper">
            <CheckCircle2 className="w-5 h-5" style={{ color: '#C9A84C' }} />
          </div>
          <h1 className="merci-title">{t('thanks.loading')}</h1>
        </div>
      </div>
    }>
      <MerciContent />
    </Suspense>
  );
}
