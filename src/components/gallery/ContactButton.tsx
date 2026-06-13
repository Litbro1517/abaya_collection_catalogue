'use client';

import { MessageCircle, Instagram, ExternalLink, Mail } from 'lucide-react';
import type { Product, Canal } from '@/types';
import {
  buildWhatsAppUrl,
  buildInstagramUrl,
  buildEmailUrl,
} from '@/lib/constants';
import { useTranslation } from '@/lib/i18n';

interface ContactButtonProps {
  product: Product;
}

const canalConfig: Record<
  Canal,
  {
    labelKey: string;
    color: string;
    icon: React.ReactNode;
    getUrl: (product: Product) => string;
  }
> = {
  whatsapp: {
    labelKey: 'contact.whatsapp',
    color: '#25D366',
    icon: <MessageCircle className="size-5" />,
    getUrl: (product) => buildWhatsAppUrl(product.nomProduit, product.prixVente),
  },
  instagram: {
    labelKey: 'contact.instagram',
    color: '#E1306C',
    icon: <Instagram className="size-5" />,
    getUrl: () => buildInstagramUrl(),
  },
  landing: {
    labelKey: 'contact.landing',
    color: '#C9A84C',
    icon: <ExternalLink className="size-5" />,
    getUrl: (product) => product.lienCommande || '#',
  },
  email: {
    labelKey: 'contact.email',
    color: '#1A1A1A',
    icon: <Mail className="size-5" />,
    getUrl: (product) => buildEmailUrl(product.nomProduit),
  },
};

export default function ContactButton({ product }: ContactButtonProps) {
  const { t } = useTranslation();
  const config = canalConfig[product.canalCommande];
  const url = config.getUrl(product);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ backgroundColor: config.color }}
    >
      {config.icon}
      {t(config.labelKey)}
    </a>
  );
}
