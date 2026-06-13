'use client';

import { useState, type FormEvent } from 'react';
import { ShoppingBag, Loader2, CheckCircle2, User, Phone, MapPin, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

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

    // Validate
    if (!form.customerName.trim()) {
      setError('Veuillez entrer votre nom complet.');
      return;
    }
    if (!form.customerPhone.trim() || form.customerPhone.trim().length < 6) {
      setError('Veuillez entrer un numéro de téléphone valide.');
      return;
    }
    if (!form.customerCity.trim()) {
      setError('Veuillez entrer votre ville.');
      return;
    }
    if (!form.customerAddress.trim()) {
      setError('Veuillez entrer votre adresse de livraison.');
      return;
    }

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

      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de la commande. Veuillez réessayer.');
        return;
      }

      setSuccess(true);

      // Redirect to thank you page after a short delay
      const orderId = data.data?.id;
      setTimeout(() => {
        window.location.href = `/merci${orderId ? `?order_id=${orderId}` : ''}`;
      }, 800);
    } catch {
      setError('Erreur réseau. Veuillez vérifier votre connexion et réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="cod-form-success">
        <CheckCircle2 className="w-10 h-10" style={{ color: BRAND.vertFonce }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: BRAND.vertFonce, fontFamily: "'Playfair Display', serif" }}>
          Commande envoyée !
        </h3>
        <p style={{ fontSize: 14, color: BRAND.grisMoyen }}>
          Redirection en cours...
        </p>
      </div>
    );
  }

  return (
    <div className="cod-form-wrapper" id="cod-form">
      {/* Header */}
      <div className="cod-form-header">
        <div className="cod-form-header-icon">
          <ShoppingBag className="w-5 h-5" style={{ color: BRAND.dore }} />
        </div>
        <div>
          <h3 className="cod-form-title">Commander maintenant</h3>
          <p className="cod-form-subtitle">Paiement à la livraison (COD)</p>
        </div>
      </div>

      {/* Product summary */}
      {productName && (
        <div className="cod-form-product-summary">
          <span className="cod-form-product-name">{productName}</span>
          {productPrice && (
            <span className="cod-form-product-price">{productPrice}</span>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="cod-form-fields">
        {/* Name */}
        <div className="cod-form-field">
          <label className="cod-form-label" htmlFor="customer-name">
            Nom complet <span style={{ color: '#800020' }}>*</span>
          </label>
          <div className="cod-form-input-wrapper">
            <User className="cod-form-input-icon" />
            <input
              id="customer-name"
              type="text"
              className="cod-form-input"
              placeholder="Votre nom complet"
              value={form.customerName}
              onChange={e => handleChange('customerName', e.target.value)}
              disabled={isSubmitting}
              autoComplete="name"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="cod-form-field">
          <label className="cod-form-label" htmlFor="customer-phone">
            Téléphone <span style={{ color: '#800020' }}>*</span>
          </label>
          <div className="cod-form-input-wrapper">
            <Phone className="cod-form-input-icon" />
            <input
              id="customer-phone"
              type="tel"
              className="cod-form-input"
              placeholder="06XXXXXXXX"
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
          <label className="cod-form-label" htmlFor="customer-city">
            Ville <span style={{ color: '#800020' }}>*</span>
          </label>
          <div className="cod-form-input-wrapper">
            <MapPin className="cod-form-input-icon" />
            <input
              id="customer-city"
              type="text"
              className="cod-form-input"
              placeholder="Votre ville"
              value={form.customerCity}
              onChange={e => handleChange('customerCity', e.target.value)}
              disabled={isSubmitting}
              autoComplete="address-level2"
            />
          </div>
        </div>

        {/* Address */}
        <div className="cod-form-field">
          <label className="cod-form-label" htmlFor="customer-address">
            Adresse de livraison <span style={{ color: '#800020' }}>*</span>
          </label>
          <div className="cod-form-input-wrapper">
            <Home className="cod-form-input-icon" />
            <input
              id="customer-address"
              type="text"
              className="cod-form-input"
              placeholder="Adresse complète de livraison"
              value={form.customerAddress}
              onChange={e => handleChange('customerAddress', e.target.value)}
              disabled={isSubmitting}
              autoComplete="street-address"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="cod-form-error">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          className={cn('cod-form-submit', isSubmitting && 'cod-form-submit-loading')}
          disabled={isSubmitting}
          style={{
            backgroundColor: isSubmitting ? BRAND.grisClair : BRAND.vertFonce,
            color: isSubmitting ? BRAND.grisMoyen : BRAND.blanc,
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <ShoppingBag className="w-5 h-5" />
              Confirmer la commande
            </>
          )}
        </button>

        {/* Trust badge */}
        <p className="cod-form-trust">
          🔒 Vos données sont sécurisées · Paiement à la livraison
        </p>
      </form>
    </div>
  );
}
