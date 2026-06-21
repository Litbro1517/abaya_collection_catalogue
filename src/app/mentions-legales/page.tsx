import type { Metadata } from 'next';
import MentionsLegalesContent from '@/components/legal/MentionsLegalesContent';

export const metadata: Metadata = {
  title: 'Mentions Légales — Abaya Collection Chic',
  description: 'Mentions légales du site Abaya Collection Chic. Informations sur l\'éditeur, l\'hébergement et les conditions d\'utilisation.',
};

export default function MentionsLegalesPage() {
  return <MentionsLegalesContent />;
}
