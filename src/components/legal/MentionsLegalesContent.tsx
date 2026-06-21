'use client';

import LegalPageLayout from './LegalPageLayout';
import { SectionTitle, P, InfoCell, HighlightBox, IntroBox } from './LegalHelpers';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

export default function MentionsLegalesContent() {
  const { t } = useClientTranslation();

  return (
    <LegalPageLayout>
      <h1
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: 'var(--pivot-text)', fontFamily: "'Playfair Display', serif" }}
      >
        {t('mentions.title')}
      </h1>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--pivot-text)' }}>
        <IntroBox k="mentions.intro" />

        {/* Section 1 — Éditeur du Catalogue */}
        <section>
          <SectionTitle k="mentions.s1.title" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <InfoCell labelKey="mentions.s1.denomination" valueKey="mentions.s1.denominationValue" />
            <InfoCell labelKey="mentions.s1.brand" valueKey="mentions.s1.brandValue" />
            <InfoCell labelKey="mentions.s1.legalForm" valueKey="mentions.s1.legalFormValue" />
            <InfoCell labelKey="mentions.s1.domicile" valueKey="mentions.s1.domicileValue" />
            <InfoCell labelKey="mentions.s1.url" valueKey="mentions.s1.urlValue" />
            <InfoCell labelKey="mentions.s1.email" valueKey="mentions.s1.emailValue" />
          </div>
          <HighlightBox k="mentions.s1.highlightBox" />
          <P k="mentions.s1.activity" className="mt-4" />
        </section>

        {/* Section 2 — Hébergement */}
        <section>
          <SectionTitle k="mentions.s2.title" />
          <P k="mentions.s2.intro" className="mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <InfoCell labelKey="mentions.s2.host" valueKey="mentions.s2.hostValue" />
            <InfoCell labelKey="mentions.s2.cdn" valueKey="mentions.s2.cdnValue" />
          </div>
          <P k="mentions.s2.justification" />
        </section>

        {/* Section 3 — Propriété Intellectuelle */}
        <section>
          <SectionTitle k="mentions.s3.title" />
          <P k="mentions.s3.p1" className="mb-4" />
          <P k="mentions.s3.p2" />
        </section>

        {/* Section 4 — Traceurs */}
        <section>
          <SectionTitle k="mentions.s4.title" />
          <P k="mentions.s4.p1" />
        </section>

        {/* Section 5 — Liens Hypertextes */}
        <section>
          <SectionTitle k="mentions.s5.title" />
          <P k="mentions.s5.p1" className="mb-4" />
          <P k="mentions.s5.p2" />
        </section>
      </div>
    </LegalPageLayout>
  );
}
