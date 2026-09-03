'use client';

import LegalPageLayout from './LegalPageLayout';
import { SectionTitle, SubTitle, P, IntroBox, BulletList } from './LegalHelpers';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

/**
 * Return and Exchange Policy — legal page content.
 *
 * Mirrors the structure of ConditionsGeneralesContent.tsx (same LegalPageLayout,
 * same LegalHelpers) so the styling is byte-identical to the existing legal pages.
 *
 * Texts are pulled from the i18n dictionaries under the `returns.*` namespace
 * (added in dictionaries.ts for FR/EN/AR). The text content comes verbatim from
 * the provided policy document (no word changed).
 */
export default function ReturnPolicyContent() {
  const { t } = useClientTranslation();

  return (
    <LegalPageLayout>
      <h1
        className="text-2xl sm:text-3xl font-bold mb-8"
        style={{ color: 'var(--pivot-text)', fontFamily: "var(--font-playfair), serif" }}
      >
        {t('returns.title')}
      </h1>

      <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--pivot-text)' }}>
        <IntroBox k="returns.intro" />

        {/* Section 1 — Inspection Right Upon Delivery */}
        <section>
          <SectionTitle k="returns.s1.title" />
          <P k="returns.s1.p1" className="mb-4" />
        </section>

        {/* Section 2 — Exchange Conditions and Complaints */}
        <section>
          <SectionTitle k="returns.s2.title" />
          <P k="returns.s2.p1" className="mb-4" />
          <BulletList keys={['returns.s2.li1', 'returns.s2.li2']} />
        </section>

        {/* Section 3 — Notification Period and Condition of Items */}
        <section>
          <SectionTitle k="returns.s3.title" />

          <SubTitle k="returns.s3.sub1" />
          <P k="returns.s3.p1" className="mb-6" />

          <SubTitle k="returns.s3.sub2" />
          <P k="returns.s3.p2" className="mb-4" />
        </section>

        {/* Section 4 — Return Shipping Costs */}
        <section>
          <SectionTitle k="returns.s4.title" />
          <BulletList keys={['returns.s4.li1', 'returns.s4.li2']} />
        </section>

        {/* Section 5 — Processing Method */}
        <section>
          <SectionTitle k="returns.s5.title" />
          <P k="returns.s5.p1" className="mb-4" />
        </section>
      </div>
    </LegalPageLayout>
  );
}
