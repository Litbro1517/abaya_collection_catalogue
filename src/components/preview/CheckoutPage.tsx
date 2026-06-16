'use client';

import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Home,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';

// ── Brand Constants (matching ProductPage / CodForm) ──
const BRAND = {
  vertFonce: '#1A3C34',
  dore: '#C9A84C',
  beige: '#F5F0E8',
  noir: '#1F1F1F',
  blanc: '#FFFFFF',
  grisClair: '#F0F0F0',
  grisMoyen: '#808080',
  bordeaux: '#800020',
} as const;

// ── Variant payload passed from ProductPage ──
export interface CheckoutPayload {
  productId: string;
  productTitle: string;
  productPrice: string; // raw price cell value (e.g. "299")
  productImage: string; // resolved proxy URL for the recap thumbnail
  selectedColor: string | null;
  selectedColorHex: string | null;
  selectedSize: string | null;
  quantity: number;
}

interface CheckoutPageProps {
  product: CheckoutPayload;
  onBack: () => void;
}

interface FormState {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
}

// Parse a raw price cell value into a number (handles "299", "299.00", "299 DH", etc.)
function parsePriceNumber(raw: string): number {
  if (!raw) return 0;
  const match = String(raw).match(/[\d.,]+/);
  if (!match) return 0;
  // Normalize: remove thousands separators, keep decimal point
  const cleaned = match[0].replace(/\s/g, '').replace(/,(?=\d{2}$)/, '.').replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function CheckoutPage({ product, onBack }: CheckoutPageProps) {
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

  const unitPriceNum = parsePriceNumber(product.productPrice);
  const totalNum = unitPriceNum * product.quantity;
  const totalFormatted = formatPrice(totalNum);
  const unitFormatted = unitPriceNum > 0 ? formatPrice(unitPriceNum) : product.productPrice;

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.customerName.trim()) {
      setError(t('order.errorName'));
      return;
    }
    if (!form.customerPhone.trim() || form.customerPhone.trim().length < 6) {
      setError(t('order.errorPhone'));
      return;
    }
    if (!form.customerCity.trim()) {
      setError(t('order.errorCity'));
      return;
    }
    if (!form.customerAddress.trim()) {
      setError(t('order.errorAddress'));
      return;
    }

    setIsSubmitting(true);

    // Enrich productName with the selected variants so the admin sees them in the order.
    const variantParts: string[] = [];
    if (product.selectedColor) variantParts.push(`${t('checkout.color')}: ${product.selectedColor}`);
    if (product.selectedSize) variantParts.push(`${t('checkout.size')}: ${product.selectedSize}`);
    if (product.quantity > 1) variantParts.push(`${t('checkout.quantity')}: ${product.quantity}`);
    const enrichedProductName = variantParts.length > 0
      ? `${product.productTitle} (${variantParts.join(' · ')})`
      : product.productTitle;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.productId,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          customerCity: form.customerCity.trim(),
          customerAddress: form.customerAddress.trim(),
          productName: enrichedProductName,
          productPrice: totalFormatted,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || t('order.errorGeneric'));
        return;
      }

      setSuccess(true);

      const orderId = data.data?.id;
      setTimeout(() => {
        window.location.href = `/merci${orderId ? `?order_id=${orderId}` : ''}`;
      }, 800);
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
        <p style={{ fontSize: 14, color: BRAND.grisMoyen }}>
          {t('order.redirecting')}
        </p>
      </div>
    );
  }

  const na = t('checkout.notSelected');

  return (
    <main className="checkout-page" dir={rtl ? 'rtl' : 'ltr'}>
      {/* ── Back / breadcrumb ── */}
      <div className="checkout-topbar">
        <button
          type="button"
          className="checkout-back-btn"
          onClick={onBack}
          aria-label={t('checkout.back')}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('checkout.back')}</span>
        </button>
      </div>

      <header className="checkout-header">
        <h1 className="checkout-title">{t('checkout.title')}</h1>
      </header>

      <div className="checkout-grid">
        {/* ═══ LEFT / TOP — Récapitulatif Couture ═══ */}
        <section className="checkout-recap" aria-label={t('checkout.recapTitle')}>
          <div className="checkout-recap-head">
            <h2 className="checkout-recap-title">{t('checkout.recapTitle')}</h2>
          </div>

          {/* Product line: thumbnail + title + unit price */}
          <div className="checkout-recap-product">
            {product.productImage ? (
              <div className="checkout-recap-thumb">
                <img
                  src={product.productImage}
                  alt={product.productTitle}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="checkout-recap-thumb checkout-recap-thumb--empty">
                <ShoppingBag className="w-6 h-6" style={{ color: BRAND.grisMoyen }} />
              </div>
            )}
            <div className="checkout-recap-product-info">
              <span className="checkout-recap-product-name">{product.productTitle}</span>
              <span className="checkout-recap-product-price">{unitFormatted}</span>
            </div>
          </div>

          {/* Variant summary list */}
          <dl className="checkout-recap-list">
            <div className="checkout-recap-row">
              <dt className="checkout-recap-key">{t('checkout.color')}</dt>
              <dd className="checkout-recap-val checkout-recap-val--color">
                {product.selectedColor ? (
                  <>
                    {product.selectedColorHex && (
                      <span
                        className="checkout-color-chip"
                        style={{ backgroundColor: product.selectedColorHex }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{product.selectedColor}</span>
                  </>
                ) : na}
              </dd>
            </div>

            <div className="checkout-recap-row">
              <dt className="checkout-recap-key">{t('checkout.size')}</dt>
              <dd className="checkout-recap-val">
                {product.selectedSize ? (
                  <span className="checkout-size-pill">{product.selectedSize}</span>
                ) : na}
              </dd>
            </div>

            <div className="checkout-recap-row">
              <dt className="checkout-recap-key">{t('checkout.quantity')}</dt>
              <dd className="checkout-recap-val">{product.quantity}</dd>
            </div>
          </dl>

          {/* Total */}
          <div className="checkout-recap-total">
            <span className="checkout-recap-total-label">{t('checkout.total')}</span>
            <span className="checkout-recap-total-value">{totalFormatted}</span>
          </div>

          {/* COD reassurance block */}
          <div className="checkout-cod-box" role="note">
            <div className="checkout-cod-box-icon">
              <Truck className="w-5 h-5" style={{ color: BRAND.vertFonce }} />
            </div>
            <div className="checkout-cod-box-text">
              <strong className="checkout-cod-box-title">{t('checkout.paymentCod')}</strong>
              <span className="checkout-cod-box-sub">{t('checkout.codReassure')}</span>
            </div>
          </div>
        </section>

        {/* ═══ RIGHT / BOTTOM — Clean order form ═══ */}
        <section className="checkout-form" aria-label={t('checkout.formTitle')}>
          <div className="checkout-form-head">
            <h2 className="checkout-form-title">{t('checkout.formTitle')}</h2>
            <span className="checkout-cod-badge">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('checkout.codBadge')}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="checkout-form-fields" noValidate>
            {/* Name */}
            <div className="cod-form-field">
              <label className="cod-form-label" htmlFor="ck-customer-name">
                {t('order.fullName')} <span style={{ color: BRAND.bordeaux }}>{t('order.required')}</span>
              </label>
              <div className="cod-form-input-wrapper">
                <User className="cod-form-input-icon" />
                <input
                  id="ck-customer-name"
                  type="text"
                  className="cod-form-input"
                  placeholder={t('order.fullNamePlaceholder')}
                  value={form.customerName}
                  onChange={e => handleChange('customerName', e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="cod-form-field">
              <label className="cod-form-label" htmlFor="ck-customer-phone">
                {t('order.phone')} <span style={{ color: BRAND.bordeaux }}>{t('order.required')}</span>
              </label>
              <div className="cod-form-input-wrapper">
                <Phone className="cod-form-input-icon" />
                <input
                  id="ck-customer-phone"
                  type="tel"
                  className="cod-form-input"
                  placeholder={t('order.phonePlaceholder')}
                  value={form.customerPhone}
                  onChange={e => handleChange('customerPhone', e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="tel"
                  dir="ltr"
                />
              </div>
            </div>

            {/* City */}
            <div className="cod-form-field">
              <label className="cod-form-label" htmlFor="ck-customer-city">
                {t('order.city')} <span style={{ color: BRAND.bordeaux }}>{t('order.required')}</span>
              </label>
              <div className="cod-form-input-wrapper">
                <MapPin className="cod-form-input-icon" />
                <input
                  id="ck-customer-city"
                  type="text"
                  className="cod-form-input"
                  placeholder={t('order.cityPlaceholder')}
                  value={form.customerCity}
                  onChange={e => handleChange('customerCity', e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="address-level2"
                />
              </div>
            </div>

            {/* Address */}
            <div className="cod-form-field">
              <label className="cod-form-label" htmlFor="ck-customer-address">
                {t('order.address')} <span style={{ color: BRAND.bordeaux }}>{t('order.required')}</span>
              </label>
              <div className="cod-form-input-wrapper">
                <Home className="cod-form-input-icon" />
                <input
                  id="ck-customer-address"
                  type="text"
                  className="cod-form-input"
                  placeholder={t('order.addressPlaceholder')}
                  value={form.customerAddress}
                  onChange={e => handleChange('customerAddress', e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="street-address"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="cod-form-error" role="alert">
                {error}
              </div>
            )}

            {/* Submit — black CTA, consistent with product page */}
            <button
              type="submit"
              className={cn('cod-form-submit', isSubmitting && 'cod-form-submit-loading')}
              disabled={isSubmitting}
              style={{
                backgroundColor: isSubmitting ? BRAND.grisClair : 'rgb(0 0 0 / 89%)',
                color: isSubmitting ? BRAND.grisMoyen : 'rgb(255, 255, 255)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('order.sending')}
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  {t('order.confirm')}
                </>
              )}
            </button>

            <p className="cod-form-trust">{t('order.secureData')}</p>
          </form>
        </section>
      </div>
    </main>
  );
}
