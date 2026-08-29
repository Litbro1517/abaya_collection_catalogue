import type { Metadata } from 'next';
import ReturnPolicyContent from '@/components/legal/ReturnPolicyContent';

export const metadata: Metadata = {
  title: 'Politique de Retour et d\u2019\u00C9change \u2014 Abaya Collection Chic',
  description: 'Politique de retour et d\u2019\u00E9change du site Abaya Collection Chic. Conditions d\u2019inspection, d\u00E9lai de r\u00E9clamation, frais de retour et mode de traitement.',
};

export default function ReturnPolicyPage() {
  return <ReturnPolicyContent />;
}
