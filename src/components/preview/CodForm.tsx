'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';

// ── Brand Constants (matching ProductPage) ──
const BRAND = {
  vertFonce: '#1A3C34',
  dore: '#C9A84C',
  beige: '#F5F0E8',
  noir: '#1F1F1F',
  blanc: '#FFFFFF',
  grisClair: '#F0F0F0',
  grisMoyen: '#808080',
} as const;

interface CodFormProps {
  productId: string;
  productName: string;
  productPrice: string;
}

interface FormState {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
}

export function CodForm({ productId, productName, productPrice }: CodFormProps) {
  const { t, rtl, formatPrice } = useClientTranslation();
  const [form, setForm] = useState<FormState>({
    customerName: '',
    customerPhone: '',
    customerCity: '',
    customerAddress: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.customerName.trim()) { setError(t('order.errorName')); return; }
    if (!form.customerPhone.trim() || form.customerPhone.trim().length < 6) { setError(t('order.errorPhone')); return; }
    if (!form.customerCity.trim()) { setError(t('order.errorCity')); return; }
    if (!form.customerAddress.trim()) { setError(t('order.errorAddress')); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          customerCity: form.customerCity.trim(),
          customerAddress: form.customerAddress.trim(),
          productName,
          productPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || t('order.errorGeneric')); return; }
      setSuccess(true);
      const orderId = data.data?.id;
      setTimeout(() => { window.location.href = `/merci${orderId ? `?order_id=${orderId}` : ''}`; }, 800);
    } catch {
      setError(t('order.errorNetwork'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="cod-form-success" dir={rtl ? 'rtl' : 'ltr'}>
        <CheckCircle2 className="w-10 h-10" style={{ color: BRAND.vertFonce }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: BRAND.vertFonce, fontFamily: "'Playfair Display', serif" }}>
          {t('order.sent')}
        </h3>
        <p style={{ fontSize: 14, color: BRAND.grisMoyen }}>{t('order.redirecting')}</p>
      </div>
    );
  }

  return (
    <div className="cod-form-wrapper" id="cod-form" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Header — 1 line: title right, COD badge left */}
      <div className="pdp-form-header" style={{ marginBottom: '10px' }}>
        <span className="pdp-form-title">{t('order.title')}</span>
        <span className="pdp-form-badge-cod">⚡ {t('order.cod')}</span>
      </div>

      {/* Form — 4 clean fields, no icons, thin labels */}
      <form onSubmit={handleSubmit} className="cod-form-fields" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Name */}
        <div className="pdp-form-group">
          <label className="pdp-form-label" htmlFor="customer-name" style={{ marginBottom: '2px' }}>
            {t('order.fullName')}
          </label>
          <input
            id="customer-name"
            type="text"
            className="pdp-input-field"
            placeholder={t('order.fullNamePlaceholder')}
            value={form.customerName}
            onChange={e => handleChange('customerName', e.target.value)}
            disabled={isSubmitting}
            autoComplete="name"
          />
        </div>

        {/* Phone */}
        <div className="pdp-form-group">
          <label className="pdp-form-label" htmlFor="customer-phone" style={{ marginBottom: '2px' }}>
            {t('order.phone')}
          </label>
          <input
            id="customer-phone"
            type="tel"
            className="pdp-input-field"
            placeholder={t('order.phonePlaceholder')}
            value={form.customerPhone}
            onChange={e => handleChange('customerPhone', e.target.value)}
            disabled={isSubmitting}
            autoComplete="tel"
            dir="ltr"
          />
        </div>

        {/* Address */}
        <div className="pdp-form-group">
          <label className="pdp-form-label" htmlFor="customer-address" style={{ marginBottom: '2px' }}>
            {t('order.address')}
          </label>
          <input
            id="customer-address"
            type="text"
            className="pdp-input-field"
            placeholder={t('order.addressPlaceholder')}
            value={form.customerAddress}
            onChange={e => handleChange('customerAddress', e.target.value)}
            disabled={isSubmitting}
            autoComplete="street-address"
          />
        </div>

        {/* City */}
        <div className="pdp-form-group">
          <label className="pdp-form-label" htmlFor="customer-city" style={{ marginBottom: '2px' }}>
            {t('order.city')}
          </label>
          <input
            id="customer-city"
            type="text"
            className="pdp-input-field"
            placeholder={t('order.cityPlaceholder')}
            value={form.customerCity}
            onChange={e => handleChange('customerCity', e.target.value)}
            disabled={isSubmitting}
            autoComplete="address-level2"
          />
        </div>

        {/* Error */}
        {error && <div className="cod-form-error">{error}</div>}

        {/* Total line — just above button */}
        {productPrice && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border-soft, #EAE4DC)', borderBottom: '1px solid var(--border-soft, #EAE4DC)', marginTop: '4px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--vert-deep, #14241E)' }}>
              {t('checkout.orderSummary')} :
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--price-charcoal, #121212)' }}>
              {formatPrice(productPrice)}
            </span>
          </div>
        )}

        {/* Submit button — dark, with gold checkmark */}
        <button
          type="submit"
          className="pdp-btn-confirm-order"
          disabled={isSubmitting}
          style={{ marginTop: '4px' }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--gold-accent, #C5A059)' }} />
              {t('order.sending')}
            </>
          ) : (
            <>
              <Check className="w-5 h-5" style={{ color: 'var(--gold-accent, #C5A059)' }} strokeWidth={2.8} />
              {t('order.confirm')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
