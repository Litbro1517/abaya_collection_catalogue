'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientTranslation } from '@/lib/i18n';

// ── SocialStickyTickets ──
// Only renders a single WhatsApp badge on the right edge.
// Used exclusively in "Landing Page" mode (conversionChannel === 'landing').
// Email and Messenger links have been moved to the global Footer.

interface SocialStickyTicketsProps {
  whatsappNumber?: string;
  conversionChannel?: string; // 'whatsapp' | 'landing'
}

export function SocialStickyTickets({ whatsappNumber, conversionChannel }: SocialStickyTicketsProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const { t } = useClientTranslation();

  const showWidget = useCallback(() => setVisible(true), []);

  useEffect(() => {
    const id = requestAnimationFrame(showWidget);
    return () => cancelAnimationFrame(id);
  }, [showWidget]);

  // Only show in Landing Page mode with a configured WhatsApp number
  const isActive = conversionChannel === 'landing' && whatsappNumber && whatsappNumber.trim();

  if (!visible || !isActive) return null;

  const cleanNumber = whatsappNumber!.replace(/[^0-9+]/g, '');
  const href = `https://wa.me/${cleanNumber}`;

  const handleClick = (e: React.MouseEvent) => {
    const isMobile = window.innerWidth <= 640;
    if (isMobile && !expanded) {
      e.preventDefault();
      setExpanded(true);
      setTimeout(() => setExpanded(false), 3000);
      return;
    }
    // Push dataLayer event (Zaraz-compatible — SSR guard)
    if (typeof window !== 'undefined') {
      const dl = (window as unknown as Record<string, unknown[]>).dataLayer;
      if (dl) {
        dl.push({ event: 'social_contact', social_channel: 'whatsapp' });
      }
    }
    window.open(href, '_blank', 'noopener noreferrer');
  };

  return (
    <div className="social-sticky-container">
      <a
        className={cn(
          'social-sticky-ticket',
          'social-sticky-ticket--whatsapp',
          expanded && 'ticket-expanded',
        )}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-label={t('contact.chatWhatsApp')}
      >
        <MessageCircle className="w-5 h-5 text-white" />
        <span className="social-sticky-ticket-text">{t('contact.chatWhatsApp')}</span>
      </a>
    </div>
  );
}
