import type { Metadata } from 'next';
import PolitiqueConfidentialiteContent from '@/components/legal/PolitiqueConfidentialiteContent';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — Abaya Collection Chic',
  description: 'Politique de confidentialité du site Abaya Collection Chic. Informations sur la collecte, l\'utilisation et la protection de vos données personnelles.',
};

export default function PolitiqueConfidentialitePage() {
  return <PolitiqueConfidentialiteContent />;
}
