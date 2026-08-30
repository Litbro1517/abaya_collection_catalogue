'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';
import { validateMoroccanPhone } from '@/lib/phone-validation';

const BRAND = {
  vertFonce: '#1A3C34',
  dore: '#C9A84C',
  noir: '#1F1F1F',
  blanc: '#FFFFFF',
  grisClair: '#F0F0F0',
  grisMoyen: '#808080',
} as const;

interface CodFormProps {
  productId: string;
  productName: string;
  productPrice: string;
  /** Selected quantity (defaults to 1). Used to compute the total and send to API. */
  quantity?: number;
}

interface FormState {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
}

export function CodForm({ productId, productName, productPrice, quantity = 1 }: CodFormProps) {
  const { t, rtl, formatPrice } = useClientTranslation();

  // ━━ Fix: compute total = unit price × quantity ━━
  // The CodForm recap and the API payload must reflect the real order amount.
  const qty = quantity > 0 ? quantity : 1;
  const parseUnit = (s: string): number => {
    if (!s) return 0;
    const m = s.match(/[\d\s.,]+/);
    if (!m) return 0;
    return parseFloat(m[0].replace(/\s/g, '').replace(',', '.')) || 0;
  };
  const totalPriceStr = qty > 1 && parseUnit(productPrice) > 0
    ? formatPrice(parseUnit(productPrice) * qty)
    : productPrice;
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
    // ━━ Lot 3: Moroccan phone validation (replaces loose length < 6 check) ━━
    // Previously: form.customerPhone.trim().length < 6 — let through "12345", "abcde", etc.
    // Now: validateMoroccanPhone() checks the full Moroccan format (06/07/05, +212, 00212).
    if (!validateMoroccanPhone(form.customerPhone)) { setError(t('order.errorPhone')); return; }
    if (!form.customerCity.trim()) { setError(t('order.errorCity')); return; }
    if (!form.customerAddress.trim()) { setError(t('order.errorAddress')); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(),
          customerCity: form.customerCity.trim(), customerAddress: form.customerAddress.trim(),
          productName, productPrice: totalPriceStr, productQuantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || t('order.errorGeneric')); return; }
      // VG40: Direct redirect — no local success screen, no 800ms delay.
      // VG40.3: If on a landing page (/lp/), add from=lp so the Merci page
      // can hide the "Retour au catalogue" button (closed funnel isolation).
      const orderId = data.data?.id;
      const isLandingPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/lp/');
      const params = new URLSearchParams();
      if (orderId) params.set('order_id', orderId);
      if (isLandingPage) params.set('from', 'lp');
      const queryString = params.toString();
      window.location.href = `/merci${queryString ? `?${queryString}` : ''}`;
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
        <h3 style={{ fontSize: 18, fontWeight: 700, color: BRAND.vertFonce, fontFamily: "'Playfair Display', serif" }}>{t('order.sent')}</h3>
        <p style={{ fontSize: 14, color: BRAND.grisMoyen }}>{t('order.redirecting')}</p>
      </div>
    );
  }

  // VG34.9: No external labels — placeholders only, compact gap 5px
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-soft, #EAE4DC)',
    backgroundColor: '#FFFFFF',
    fontSize: '0.85rem',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-main, #14241E)',
    height: '38px',
  };

  return (
    <div className="cod-form-wrapper" id="cod-form" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Header — 1 line */}
      <div className="pdp-form-header" style={{ marginBottom: '8px' }}>
        <span className="pdp-form-title">{t('order.title')}</span>
        <span className="pdp-form-badge-cod">⚡ {t('order.cod')}</span>
      </div>

      {/* Form — 4 fields, NO external labels, placeholders only, gap 5px */}
      <form onSubmit={handleSubmit} className="cod-form-fields" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <input
          id="customer-name"
          type="text"
          style={inputStyle}
          placeholder={t('order.fullName')}
          value={form.customerName}
          onChange={e => handleChange('customerName', e.target.value)}
          disabled={isSubmitting}
          autoComplete="name"
        />
        <input
          id="customer-phone"
          type="tel"
          style={inputStyle}
          placeholder={t('order.phone')}
          value={form.customerPhone}
          onChange={e => handleChange('customerPhone', e.target.value)}
          disabled={isSubmitting}
          autoComplete="tel"
          dir="ltr"
        />
        <input
          id="customer-address"
          type="text"
          style={inputStyle}
          placeholder={t('order.address')}
          value={form.customerAddress}
          onChange={e => handleChange('customerAddress', e.target.value)}
          disabled={isSubmitting}
          autoComplete="street-address"
        />
        <input
          id="customer-city"
          type="text"
          style={inputStyle}
          placeholder={t('order.city')}
          value={form.customerCity}
          onChange={e => handleChange('customerCity', e.target.value)}
          disabled={isSubmitting}
          autoComplete="address-level2"
        />

        {/* Error */}
        {error && <div className="cod-form-error">{error}</div>}

        {/* Total line */}
        {productPrice && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', marginTop: '3px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--vert-deep, #14241E)' }}>
              {t('checkout.orderSummary')} :
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--price-charcoal, #121212)' }}>
              {/* Fix: show total (unit × qty) when quantity > 1, else unit price */}
              {totalPriceStr}
            </span>
          </div>
        )}

        {/* Submit button — compact 40px height */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            height: '40px',
            backgroundColor: isSubmitting ? BRAND.grisClair : 'var(--vert-deep, #14241E)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '3px',
            transition: 'background-color 0.2s ease',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--gold-accent, #C5A059)' }} />
              {t('order.sending')}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" style={{ color: 'var(--gold-accent, #C5A059)' }} strokeWidth={2.8} />
              {t('order.confirm')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
