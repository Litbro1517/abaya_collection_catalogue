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
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { buildMultiProductWhatsappLink } from '@/lib/whatsapp';
import { validateMoroccanPhone } from '@/lib/phone-validation';
import { getStoredAttribution } from '@/lib/utm-capture';

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

// ── Variant payload passed from ProductPage / CatalogPreview ──
// VG37.4 Phase 2: Evolved from single-product to multi-product structure.
// Each cart item becomes a CheckoutItem. The total price is computed dynamically.
export interface CheckoutItem {
  productId: string;
  productTitle: string;
  productPrice: string; // raw price cell value (e.g. "299")
  productImage: string; // resolved proxy URL for the recap thumbnail
  selectedColor: string | null;
  selectedColorHex: string | null;
  selectedSize: string | null;
  quantity: number;
}

export interface CheckoutPayload {
  items: CheckoutItem[]; // multi-product array (was single product fields)
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
  const settings = useAppStore(s => s.settings);
  const whatsappNumber = settings?.whatsappNumber || '';
  const [form, setForm] = useState<FormState>({
    customerName: '',
    customerPhone: '',
    customerCity: '',
    customerAddress: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);

  // VG37.4 Phase 2: Multi-product calculations
  const items = product.items;
  const totalNum = items.reduce((sum, item) => {
    return sum + parsePriceNumber(item.productPrice) * item.quantity;
  }, 0);
  const totalFormatted = formatPrice(totalNum);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

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
    if (!validateMoroccanPhone(form.customerPhone)) {
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

    // VG37.4 Phase 2: Send multi-product payload to API.
    // The API creates one Order record per cart item (same customer info).
    // ━━ MANDAT 4P — Attribution UTM dans le payload commande ━━
    const attribution = getStoredAttribution();
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.productId,
            productName: item.productTitle,
            productPrice: item.productPrice,
            productColor: item.selectedColor || null,
            productSize: item.selectedSize || null,
            productQuantity: item.quantity,
            productImage: item.productImage || null,
          })),
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          customerCity: form.customerCity.trim(),
          customerAddress: form.customerAddress.trim(),
          totalPrice: totalFormatted,
          attribution, // UTM/fbclid/gclid pour persistance best-effort côté API
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        // API error (500, 400, etc.) — activate WhatsApp fallback
        setApiFailed(true);
        setError(data.error || t('order.errorGeneric'));
        return;
      }

      setSuccess(true);

      const orderId = data.data?.id;
      setTimeout(() => {
        window.location.href = `/merci${orderId ? `?order_id=${orderId}` : ''}`;
      }, 800);
    } catch {
      // Network error — activate WhatsApp fallback
      setApiFailed(true);
      setError(t('order.errorNetwork'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── WhatsApp fallback link (when API fails) ──
  // Lot 3: Multi-product fallback — loops over ALL cart items (no truncation).
  // Previously: used only firstItem + "(+N autres)" summary → lost variant details.
  // Now: buildMultiProductWhatsappLink emits a structured block per item with
  // title, color, size, quantity, unit price — plus a grand total line.
  const whatsappFallbackLink = whatsappNumber && items.length > 0
    ? buildMultiProductWhatsappLink({
        phone: whatsappNumber,
        items: items.map(item => ({
          title: item.productTitle,
          price: item.productPrice,
          color: item.selectedColor || null,
          size: item.selectedSize || null,
          quantity: item.quantity,
        })),
        totalFormatted,
        totalQuantity,
        customMessage: settings?.conversionMessage || undefined,
        conversionMessages: settings?.conversionMessages || null,
        locale: useAppStore.getState().clientLocale,
        flux: 'A',
        labels: {
          greeting: t('whatsapp.message'),
          greetingA: t('whatsapp.greetingA'),
          greetingB: t('whatsapp.greetingB'),
          priceLabel: t('product.price'),
          colorLabel: t('product.color'),
          sizeLabel: t('product.size'),
          quantityLabel: t('product.quantity'),
          totalLabel: t('whatsapp.total'),
          itemsLabel: t('whatsapp.items'),
          subtotalLabel: t('whatsapp.subtotal'),
        },
      })
    : '#';

  if (success) {
    return (
      <div className="cod-form-success" dir={rtl ? 'rtl' : 'ltr'}>
        <CheckCircle2 className="w-10 h-10" style={{ color: BRAND.vertFonce }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: BRAND.vertFonce, fontFamily: "var(--font-playfair), serif" }}>
          {t('order.sent')}
        </h3>
        <p style={{ fontSize: 14, color: BRAND.grisMoyen }}>
          {t('order.redirecting')}
        </p>
      </div>
    );
  }

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

          {/* VG37.4 Phase 2: Multi-product recap — iterate over all cart items */}
          {items.map((item, idx) => {
            const itemUnitPrice = parsePriceNumber(item.productPrice);
            const itemTotal = itemUnitPrice * item.quantity;
            const itemUnitFormatted = itemUnitPrice > 0 ? formatPrice(itemUnitPrice) : item.productPrice;
            const itemTotalFormatted = formatPrice(itemTotal);
            return (
              <div key={idx} className="checkout-recap-product" style={idx > 0 ? { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-soft, #EAE4DC)' } : undefined}>
                {item.productImage ? (
                  <div className="checkout-recap-thumb">
                    <img
                      src={item.productImage}
                      alt={item.productTitle}
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
                  <span className="checkout-recap-product-name">{item.productTitle}</span>
                  <span className="checkout-recap-product-price">{itemUnitFormatted}</span>
                  {/* Variant summary for this item */}
                  <div style={{ fontSize: '12px', color: BRAND.grisMoyen, marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {item.selectedColor && <span>{t('checkout.color')}: {item.selectedColor}</span>}
                    {item.selectedSize && <span>{t('checkout.size')}: {item.selectedSize}</span>}
                    <span>{t('checkout.quantity')}: {item.quantity}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: BRAND.noir, marginTop: '4px', display: 'block' }}>
                    {itemTotalFormatted}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="checkout-recap-total">
            <span className="checkout-recap-total-label">{t('checkout.total')} ({totalQuantity} {totalQuantity > 1 ? 'articles' : 'article'})</span>
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

            {/* WhatsApp fallback — shown only when API submission fails */}
            {apiFailed && whatsappNumber && (
              <div className="cod-form-fallback" style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '12px 16px',
                marginTop: '12px',
              }}>
                <p style={{ fontSize: '13px', color: '#166534', marginBottom: '8px', fontWeight: 500 }}>
                  Le système de commande en ligne est temporairement indisponible.
                  Vous pouvez finaliser votre commande via WhatsApp :
                </p>
                <a
                  href={whatsappFallbackLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#25D366',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Commander via WhatsApp
                </a>
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
