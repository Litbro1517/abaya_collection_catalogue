import type { Metadata } from 'next';
import ConditionsGeneralesContent from '@/components/legal/ConditionsGeneralesContent';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — Abaya Collection Chic',
  description: 'Conditions générales de vente du site Abaya Collection Chic. Informations sur les commandes, la livraison, les retours et les modalités de paiement.',
};

export default function ConditionsGeneralesPage() {
  return <ConditionsGeneralesContent />;
}
