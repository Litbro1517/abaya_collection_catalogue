'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useClientTranslation } from '@/lib/i18n';

function MerciContent() {
  const { t, rtl } = useClientTranslation();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const tracked = useRef(false);

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

  return (
    <div className="merci-page" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="merci-card">
        {/* Success icon */}
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

        {/* Details */}
        <div className="merci-details">
          <div className="merci-detail-row">
            <span className="merci-detail-label">{t('thanks.paymentMode')}</span>
            <span className="merci-detail-value">{t('thanks.paymentCOD')}</span>
          </div>
          <div className="merci-detail-row">
            <span className="merci-detail-label">{t('thanks.status')}</span>
            <span className="merci-detail-value" style={{ color: '#C9A84C' }}>{t('thanks.statusPending')}</span>
          </div>
        </div>

        {/* Back button */}
        <a href="/" className="merci-back-btn">
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
