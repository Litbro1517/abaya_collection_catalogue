'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';

function MerciContent() {
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
    <div className="merci-page">
      <div className="merci-card">
        {/* Success icon */}
        <div className="merci-icon-wrapper">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>

        {/* Title */}
        <h1 className="merci-title">Commande confirmée !</h1>
        <p className="merci-subtitle">
          Merci pour votre commande. Notre équipe vous contactera prochainement pour confirmer la livraison.
        </p>

        {/* Order ID */}
        {orderId && (
          <div className="merci-order-id">
            Commande <span>#{orderId.slice(-8).toUpperCase()}</span>
          </div>
        )}

        {/* Details */}
        <div className="merci-details">
          <div className="merci-detail-row">
            <span className="merci-detail-label">Mode de paiement</span>
            <span className="merci-detail-value">Paiement à la livraison</span>
          </div>
          <div className="merci-detail-row">
            <span className="merci-detail-label">Statut</span>
            <span className="merci-detail-value" style={{ color: '#C9A84C' }}>En attente de confirmation</span>
          </div>
        </div>

        {/* Back button */}
        <a href="/" className="merci-back-btn">
          <ArrowLeft className="w-4 h-4" />
          Retour au catalogue
        </a>

        {/* Tracking notice */}
        <div className="merci-tracking">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Vous recevrez une confirmation par téléphone sous peu.</span>
        </div>
      </div>
    </div>
  );
}

export default function MerciPage() {
  return (
    <Suspense fallback={
      <div className="merci-page">
        <div className="merci-card" style={{ opacity: 0.6 }}>
          <div className="merci-icon-wrapper">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="merci-title">Chargement...</h1>
        </div>
      </div>
    }>
      <MerciContent />
    </Suspense>
  );
}
