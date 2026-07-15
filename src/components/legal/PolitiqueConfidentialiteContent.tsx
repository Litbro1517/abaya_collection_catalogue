'use client';

import LegalPageLayout from './LegalPageLayout';
import { SectionTitle, SubTitle, P, HighlightBox, IntroBox, BulletList } from './LegalHelpers';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

export default function PolitiqueConfidentialiteContent() {
  const { t } = useClientTranslation();

  return (
    <LegalPageLayout>
      <h1
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: 'var(--pivot-text)', fontFamily: "'Playfair Display', serif" }}
      >
        {t('privacy.title')}
      </h1>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--pivot-text)' }}>
        <IntroBox k="privacy.intro" />

        {/* Article 1 */}
        <section>
          <SectionTitle k="privacy.s1.title" />
          <P k="privacy.s1.p1" />
        </section>

        {/* Article 2 */}
        <section>
          <SectionTitle k="privacy.s2.title" />
          <SubTitle k="privacy.s2.subtitle1" />
          <P k="privacy.s2.catalogP1" className="mb-4" />
          <P k="privacy.s2.catalogP2" className="mb-4" />
          <SubTitle k="privacy.s2.subtitle2" />
          <P k="privacy.s2.whatsappIntro" className="mb-4" />
          <BulletList keys={[
            'privacy.s2.whatsappLi1',
            'privacy.s2.whatsappLi2',
            'privacy.s2.whatsappLi3',
            'privacy.s2.whatsappLi4',
          ]} />
          <HighlightBox k="privacy.s2.legalBasis" />
        </section>

        {/* Article 3 */}
        <section>
          <SectionTitle k="privacy.s3.title" />
          <P k="privacy.s3.p1" className="mb-4" />
          <BulletList keys={['privacy.s3.li1', 'privacy.s3.li2', 'privacy.s3.li3']} />
          <P k="privacy.s3.p2" />
        </section>

        {/* Article 4 */}
        <section>
          <SectionTitle k="privacy.s4.title" />
          <P k="privacy.s4.p1" />
        </section>

        {/* Article 5 */}
        <section>
          <SectionTitle k="privacy.s5.title" />
          <P k="privacy.s5.p1" className="mb-4" />
          <P k="privacy.s5.p2" />
        </section>

        {/* Article 6 */}
        <section>
          <SectionTitle k="privacy.s6.title" />
          <P k="privacy.s6.p1" className="mb-4" />
          <BulletList keys={['privacy.s6.li1', 'privacy.s6.li2', 'privacy.s6.li3', 'privacy.s6.li4']} />
          <HighlightBox k="privacy.s6.exerciseRights" />
          <P k="privacy.s6.cndp" className="mt-4" />
        </section>

        {/* Article 7 */}
        <section>
          <SectionTitle k="privacy.s7.title" />
          <P k="privacy.s7.p1" />
        </section>

        {/* Article 8 */}
        <section>
          <SectionTitle k="privacy.s8.title" />
          <P k="privacy.s8.p1" />
        </section>
      </div>
    </LegalPageLayout>
  );
}
