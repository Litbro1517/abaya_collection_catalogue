'use client';

import LegalPageLayout from './LegalPageLayout';
import { SectionTitle, SubTitle, P, HighlightBox, IntroBox, BulletList, StepCard } from './LegalHelpers';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

export default function ConditionsGeneralesContent() {
  const { t } = useClientTranslation();

  return (
    <LegalPageLayout>
      <h1
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: 'var(--pivot-text)', fontFamily: "var(--font-playfair), serif" }}
      >
        {t('cgv.title')}
      </h1>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--pivot-text)' }}>
        <IntroBox k="cgv.intro" />

        {/* Article 1 — Processus de Commande */}
        <section>
          <SectionTitle k="cgv.s1.title" />
          <P k="cgv.s1.p1" className="mb-4" />

          <SubTitle k="cgv.s1.pathA.title" />
          <P k="cgv.s1.pathA.desc" className="mb-4" />
          <ol className="space-y-3 mb-6">
            <StepCard num={1} titleKey="cgv.s1.pathA.step1Title" descKey="cgv.s1.pathA.step1Desc" />
            <StepCard num={2} titleKey="cgv.s1.pathA.step2Title" descKey="cgv.s1.pathA.step2Desc" />
            <StepCard num={3} titleKey="cgv.s1.pathA.step3Title" descKey="cgv.s1.pathA.step3Desc" />
          </ol>

          <SubTitle k="cgv.s1.pathB.title" />
          <P k="cgv.s1.pathB.desc" className="mb-4" />
          <ol className="space-y-3 mb-6">
            <StepCard num={1} titleKey="cgv.s1.pathB.step1Title" descKey="cgv.s1.pathB.step1Desc" />
            <StepCard num={2} titleKey="cgv.s1.pathB.step2Title" descKey="cgv.s1.pathB.step2Desc" />
            <StepCard num={3} titleKey="cgv.s1.pathB.step3Title" descKey="cgv.s1.pathB.step3Desc" />
          </ol>

          <HighlightBox k="cgv.s1.suspensiveCondition" />
        </section>

        {/* Article 2 — Prix et Modalités de Paiement */}
        <section>
          <SectionTitle k="cgv.s2.title" />
          <P k="cgv.s2.p1" className="mb-4" />
          <HighlightBox k="cgv.s2.codHighlight" />
        </section>

        {/* Article 3 — Livraison */}
        <section>
          <SectionTitle k="cgv.s3.title" />
          <P k="cgv.s3.p1" className="mb-4" />
          <BulletList keys={['cgv.s3.li1', 'cgv.s3.li2', 'cgv.s3.li3', 'cgv.s3.li4']} />
        </section>

        {/* Article 4 — Retours, Échanges et Réclamations */}
        <section>
          <SectionTitle k="cgv.s4.title" />
          <P k="cgv.s4.p1" className="mb-4" />
          <BulletList keys={['cgv.s4.li1', 'cgv.s4.li2', 'cgv.s4.li3', 'cgv.s4.li4']} />
        </section>

        {/* Article 5 — Limitation de Responsabilité */}
        <section>
          <SectionTitle k="cgv.s5.title" />
          <P k="cgv.s5.p1" className="mb-4" />
          <P k="cgv.s5.p2" className="mb-4" />
          <P k="cgv.s5.p3" />
        </section>

        {/* Article 6 — Droit Applicable et Juridiction Compétente */}
        <section>
          <SectionTitle k="cgv.s6.title" />
          <P k="cgv.s6.p1" className="mb-4" />
          <P k="cgv.s6.p2" />
        </section>
      </div>
    </LegalPageLayout>
  );
}
