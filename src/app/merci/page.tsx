'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useClientTranslation } from '@/lib/i18n';

// ── Order type (matches the Prisma Order model) ──
interface OrderData {
  id: string;
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
  const tracked = useRef(false);

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(!!orderId);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Push conversion tracking event once on mount
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const dl = (window as unknown as Record<string, unknown[]>).dataLayer;
    if (dl) {
      dl.push({
        event: 'purchase',
        order_id: orderId || 'unknown',
      });
    }
  }, [orderId]);

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

  const na = t('checkout.notSelected');
  const productName = order?.productName || '';
  const productPrice = order?.productPrice || '';
  const hasRecap = !!order && (!!productName || !!productPrice);

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
          {t('thanks.subtitle')}
        </p>

        {/* Order ID */}
        {orderId && (
          <div className="merci-order-id">
            {t('thanks.orderLabel')} <span>#{orderId.slice(-8).toUpperCase()}</span>
          </div>
        )}

        {/* ━━ Real order recap (Étape 3) ━━ */}
        {loading ? (
          <div className="merci-recap merci-recap--loading">
            <span className="merci-recap-loading-text">{t('thanks.loading')}</span>
          </div>
        ) : hasRecap ? (
          <div className="merci-recap">
            <div className="merci-recap-head">
              <h2 className="merci-recap-title">{t('thanks.recapTitle')}</h2>
            </div>

            {/* Product line: thumbnail + name */}
            <div className="merci-recap-product">
              {order!.productImage ? (
                <div className="merci-recap-thumb">
                  <img
                    src={order!.productImage}
                    alt={productName}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="merci-recap-thumb merci-recap-thumb--empty">
                  <ShoppingBag className="w-5 h-5" style={{ color: '#808080' }} />
                </div>
              )}
              <div className="merci-recap-product-info">
                <span className="merci-recap-product-name">{productName}</span>
              </div>
            </div>

            {/* Variant summary list */}
            <dl className="merci-recap-list">
              <div className="merci-recap-row">
                <dt className="merci-recap-key">{t('checkout.color')}</dt>
                <dd className="merci-recap-val">
                  {order!.productColor ? order!.productColor : na}
                </dd>
              </div>
              <div className="merci-recap-row">
                <dt className="merci-recap-key">{t('checkout.size')}</dt>
                <dd className="merci-recap-val">
                  {order!.productSize ? (
                    <span className="merci-size-pill">{order!.productSize}</span>
                  ) : na}
                </dd>
              </div>
              <div className="merci-recap-row">
                <dt className="merci-recap-key">{t('checkout.quantity')}</dt>
                <dd className="merci-recap-val">{order!.productQuantity || 1}</dd>
              </div>
            </dl>

            {/* Total amount to pay */}
            {productPrice && (
              <div className="merci-recap-total">
                <span className="merci-recap-total-label">{t('thanks.amountPaid')}</span>
                <span className="merci-recap-total-value">{productPrice}</span>
              </div>
            )}

            {/* Trust mention — single unique line: "Mode de règlement : Paiement à la livraison (COD)" */}
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
