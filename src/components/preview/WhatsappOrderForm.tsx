'use client';

/**
 * WhatsappOrderForm (VG36 — Axis A)
 *
 * Isolated WhatsApp conversion form for the PDP (catalog) tunnel.
 * Completely separate from CodForm.tsx (Landing Page / COD tunnel).
 *
 * Design goals:
 * - 2 mandatory fields only: الاسم الكامل + العنوان والمدينة
 * - Green WhatsApp button (#25D366) with Arabic label إرسال الطلب عبر واتساب
 * - Validates variant selection (size/color) + 2 fields BEFORE generating wa.me URL
 * - Generates a complete pre-filled WhatsApp message
 * - CodForm.tsx remains untouched → Landing Page tunnel fully intact
 *
 * Isolation: This component does NOT import CodForm, does NOT call /api/orders,
 * and does NOT touch the cart store. It only builds a wa.me URL and opens it.
 */

import { useState, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useClientTranslation } from '@/lib/i18n';

const WHATSAPP_GREEN = '#25D366';
const WHATSAPP_GREEN_DARK = '#1DA851';

interface WhatsappOrderFormProps {
  productName: string;
  productPrice: string;
  selectedColor: string | null;
  selectedSize: string | null;
  whatsappNumber: string;
  locale: string;
  /** When true, a required variant (size/color) is missing → block submission */
  hasMissingVariant: boolean;
  /** Called when submission is blocked due to missing variant → parent shows red alert */
  onVariantMissing?: () => void;
}

interface FormState {
  customerName: string;
  customerAddress: string;
}

export function WhatsappOrderForm({
  productName,
  productPrice,
  selectedColor,
  selectedSize,
  whatsappNumber,
  locale,
  hasMissingVariant,
  onVariantMissing,
}: WhatsappOrderFormProps) {
  const { t, rtl, formatPrice } = useClientTranslation();
  const [form, setForm] = useState<FormState>({
    customerName: '',
    customerAddress: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  /**
   * Builds the WhatsApp message text.
   * Structure: Produit, Variante (couleur/taille), Prix, Nom complet, Adresse/Ville.
   * Uses Arabic labels (the form header is Arabic: معلومات خاصة بالطلب).
   */
  const buildWhatsAppMessage = (): string => {
    const lines: string[] = [];
    // Greeting
    lines.push(locale === 'ar' ? 'مرحباً، أود طلب المنتج التالي:' : 'Bonjour, je souhaite commander le produit suivant :');
    lines.push('');
    // Product
    lines.push(`📦 ${locale === 'ar' ? 'المنتج' : 'Produit'}: ${productName}`);
    // Variant
    const variantParts: string[] = [];
    if (selectedColor) variantParts.push(`${locale === 'ar' ? 'اللون' : 'Couleur'}: ${selectedColor}`);
    if (selectedSize) variantParts.push(`${locale === 'ar' ? 'المقاس' : 'Taille'}: ${selectedSize}`);
    if (variantParts.length > 0) {
      lines.push(`🎨 ${locale === 'ar' ? 'الخيارات' : 'Variante'}: ${variantParts.join(' | ')}`);
    }
    // Price
    if (productPrice) {
      lines.push(`💰 ${locale === 'ar' ? 'السعر' : 'Prix'}: ${formatPrice(productPrice)}`);
    }
    lines.push('');
    // Customer info
    lines.push(`👤 ${locale === 'ar' ? 'الاسم الكامل' : 'Nom complet'}: ${form.customerName.trim()}`);
    lines.push(`📍 ${locale === 'ar' ? 'العنوان والمدينة' : 'Adresse et ville'}: ${form.customerAddress.trim()}`);
    return lines.join('\n');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Variant gate — block if size/color missing
    if (hasMissingVariant) {
      onVariantMissing?.();
      setError(locale === 'ar' ? 'يرجى اختيار المقاس/اللون أولاً' : 'Veuillez sélectionner la taille/couleur d\'abord');
      return;
    }

    // 2. Field validation — both mandatory
    if (!form.customerName.trim()) {
      setError(locale === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Veuillez saisir votre nom complet');
      return;
    }
    if (!form.customerAddress.trim()) {
      setError(locale === 'ar' ? 'يرجى إدخال العنوان والمدينة' : 'Veuillez saisir votre adresse et ville');
      return;
    }

    // 3. WhatsApp number check
    const cleanPhone = (whatsappNumber || '').replace(/[^\d]/g, '');
    if (!cleanPhone) {
      setError(locale === 'ar' ? 'رقم واتساب غير متوفر' : 'Numéro WhatsApp non configuré');
      return;
    }

    // 4. Generate wa.me URL and open
    setIsSending(true);
    const message = buildWhatsAppMessage();
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Brief delay for UX feedback (spinner), then open WhatsApp
    setTimeout(() => {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      setIsSending(false);
    }, 400);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border-soft, #EAE4DC)',
    backgroundColor: '#FFFFFF',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-main, #14241E)',
    height: '42px',
    transition: 'border-color 0.2s ease',
  };

  return (
    <div className="whatsapp-order-form-wrapper" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Header — Arabic: معلومات خاصة بالطلب */}
      <div className="whatsapp-form-header" style={{
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: 'var(--vert-deep, #14241E)',
          fontFamily: locale === 'ar' ? 'var(--font-tajawal), Tajawal, sans-serif' : 'inherit',
        }}>
          {locale === 'ar' ? 'معلومات خاصة بالطلب' : t('order.title')}
        </span>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 600,
          color: WHATSAPP_GREEN_DARK,
          backgroundColor: 'rgba(37, 211, 102, 0.1)',
          padding: '2px 8px',
          borderRadius: '6px',
        }}>
          WhatsApp
        </span>
      </div>

      {/* Form — 2 fields only */}
      <form onSubmit={handleSubmit} className="whatsapp-form-fields" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {/* Field 1: الاسم الكامل (required) */}
        <input
          type="text"
          style={inputStyle}
          placeholder={locale === 'ar' ? 'الاسم الكامل *' : (t('order.fullName') + ' *')}
          value={form.customerName}
          onChange={e => handleChange('customerName', e.target.value)}
          disabled={isSending}
          autoComplete="name"
          required
        />

        {/* Field 2: العنوان والمدينة (required) */}
        <input
          type="text"
          style={inputStyle}
          placeholder={locale === 'ar' ? 'العنوان والمدينة *' : (t('order.address') + ' *')}
          value={form.customerAddress}
          onChange={e => handleChange('customerAddress', e.target.value)}
          disabled={isSending}
          autoComplete="street-address"
          required
        />

        {/* Error message */}
        {error && (
          <div style={{
            fontSize: '0.8rem',
            color: '#EF4444',
            padding: '6px 10px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderRadius: '6px',
            textAlign: rtl ? 'right' : 'left',
          }}>
            {error}
          </div>
        )}

        {/* Price recap line */}
        {productPrice && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            marginTop: '2px',
          }}>
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--vert-deep, #14241E)',
            }}>
              {locale === 'ar' ? 'المجموع' : t('checkout.orderSummary')} :
            </span>
            <span style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--price-charcoal, #121212)',
            }}>
              {formatPrice(productPrice)}
            </span>
          </div>
        )}

        {/* WhatsApp green button: إرسال الطلب عبر واتساب */}
        <button
          type="submit"
          disabled={isSending}
          style={{
            width: '100%',
            height: '44px',
            backgroundColor: isSending ? WHATSAPP_GREEN_DARK : WHATSAPP_GREEN,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: isSending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '4px',
            transition: 'background-color 0.2s ease, transform 0.15s ease',
            fontFamily: locale === 'ar' ? 'var(--font-tajawal), Tajawal, sans-serif' : 'inherit',
            boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
          }}
          onMouseDown={(e) => { if (!isSending) e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FFFFFF' }} />
              {locale === 'ar' ? 'جاري الإرسال...' : 'Envoi...'}
            </>
          ) : (
            <>
              <Send className="w-4 h-4" style={{ color: '#FFFFFF' }} />
              {locale === 'ar' ? 'إرسال الطلب عبر واتساب' : 'Envoyer la commande via WhatsApp'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
