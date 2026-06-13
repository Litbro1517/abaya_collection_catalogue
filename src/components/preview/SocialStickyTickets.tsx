'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Messenger SVG Icon (since lucide doesn't have it) ──
function MessengerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.907 1.2 5.426 3.15 7.1.165.141.263.345.274.564l.056 1.76c.018.554.595.916 1.1.69l1.963-.867a.878.878 0 0 1 .59-.045c.924.255 1.907.391 2.917.391 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm5.974 7.487l-2.832 4.488c-.424.672-1.333.808-1.932.29l-2.254-1.944a.706.706 0 0 0-.894-.002l-3.048 2.316c-.406.309-.937-.162-.677-.6l2.832-4.488c.424-.672 1.333-.808 1.932-.29l2.254 1.944a.706.706 0 0 0 .894.002l3.048-2.316c.406-.309.937.162.677.6z"/>
    </svg>
  );
}

interface TicketConfig {
  type: 'whatsapp' | 'messenger' | 'instagram';
  label: string;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
}

interface SocialStickyTicketsProps {
  whatsappNumber?: string;
  messengerLink?: string;
  instagramHandle?: string;
}

export function SocialStickyTickets({ whatsappNumber, messengerLink, instagramHandle }: SocialStickyTicketsProps) {
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Use callback to avoid direct setState in effect
  const showWidget = useCallback(() => setVisible(true), []);

  useEffect(() => {
    // Defer showing widget until after hydration
    const id = requestAnimationFrame(showWidget);
    return () => cancelAnimationFrame(id);
  }, [showWidget]);

  // Build ticket list from settings — only show if value is non-empty
  const tickets: TicketConfig[] = [];

  if (whatsappNumber && whatsappNumber.trim()) {
    const cleanNumber = whatsappNumber.replace(/[^0-9+]/g, '');
    tickets.push({
      type: 'whatsapp',
      label: 'Discuter sur WhatsApp',
      href: `https://wa.me/${cleanNumber}`,
      icon: <MessageCircle className="w-5 h-5 text-white" />,
      colorClass: 'social-sticky-ticket--whatsapp',
    });
  }

  if (messengerLink && messengerLink.trim()) {
    tickets.push({
      type: 'messenger',
      label: 'Discuter sur Messenger',
      href: messengerLink.startsWith('http') ? messengerLink : `https://m.me/${messengerLink}`,
      icon: <MessengerIcon className="w-5 h-5 text-white" />,
      colorClass: 'social-sticky-ticket--messenger',
    });
  }

  if (instagramHandle && instagramHandle.trim()) {
    const handle = instagramHandle.replace('@', '');
    tickets.push({
      type: 'instagram',
      label: 'Suivre sur Instagram',
      href: `https://instagram.com/${handle}`,
      icon: <Instagram className="w-5 h-5 text-white" />,
      colorClass: 'social-sticky-ticket--instagram',
    });
  }

  // Don't render if no tickets or not yet visible
  if (!visible || tickets.length === 0) return null;

  const handleTicketClick = (type: string, href: string, e: React.MouseEvent) => {
    // On mobile, toggle expanded state on first tap, open link on second
    const isMobile = window.innerWidth <= 640;
    if (isMobile && expandedTicket !== type) {
      e.preventDefault();
      setExpandedTicket(type);
      // Auto-collapse after 3 seconds
      setTimeout(() => setExpandedTicket(null), 3000);
      return;
    }
    // Push dataLayer event for tracking
    const dl = (window as unknown as Record<string, unknown[]>).dataLayer;
    if (dl) {
      dl.push({
        event: 'social_contact',
        social_channel: type,
      });
    }
    // Open link normally
    window.open(href, '_blank', 'noopener noreferrer');
  };

  return (
    <div className="social-sticky-container">
      {tickets.map(ticket => (
        <a
          key={ticket.type}
          className={cn(
            'social-sticky-ticket',
            ticket.colorClass,
            expandedTicket === ticket.type && 'ticket-expanded',
          )}
          href={ticket.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleTicketClick(ticket.type, ticket.href, e)}
          aria-label={ticket.label}
        >
          {ticket.icon}
          <span className="social-sticky-ticket-text">{ticket.label}</span>
        </a>
      ))}
    </div>
  );
}
