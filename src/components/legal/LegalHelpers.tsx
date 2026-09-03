'use client';

import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

/** Renders a translation value that may contain \n as <br/> tags */
function T({ k }: { k: string }) {
  const { t } = useClientTranslation();
  const text = t(k);
  return (
    <>
      {text.split('\\n').map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </>
  );
}

/** Section title */
function SectionTitle({ k }: { k: string }) {
  const { t } = useClientTranslation();
  return (
    <h2
      className="text-lg font-semibold mb-4"
      style={{ color: 'var(--pivot-brand)', fontFamily: "var(--font-playfair), serif" }}
    >
      {t(k)}
    </h2>
  );
}

/** Subtitle (h3) */
function SubTitle({ k }: { k: string }) {
  const { t } = useClientTranslation();
  return (
    <h3
      className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3"
      style={{ color: 'var(--pivot-text)' }}
    >
      {t(k)}
    </h3>
  );
}

/** Paragraph from translation key */
function P({ k, className = '' }: { k: string; className?: string }) {
  const { t } = useClientTranslation();
  return <p className={className}>{t(k)}</p>;
}

/** Info grid cell */
function InfoCell({ labelKey, valueKey }: { labelKey: string; valueKey: string }) {
  const { t } = useClientTranslation();
  const value = t(valueKey);
  return (
    <div
      className="rounded-lg p-4 border"
      style={{ backgroundColor: 'var(--pivot-surface)', borderColor: 'var(--border-color, #E8E2D9)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">{t(labelKey)}</p>
      <p className="text-sm font-medium leading-relaxed">
        {value.split('\\n').map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Highlight box with brand left border */
function HighlightBox({ k }: { k: string }) {
  const { t } = useClientTranslation();
  return (
    <div
      className="border-l-3 rounded-r-lg p-4 mt-4"
      style={{ borderLeftColor: 'var(--pivot-brand)', backgroundColor: 'var(--pivot-surface)' }}
    >
      <p className="text-sm leading-relaxed">{t(k)}</p>
    </div>
  );
}

/** Intro box */
function IntroBox({ k }: { k: string }) {
  const { t } = useClientTranslation();
  return (
    <div
      className="rounded-lg p-6 border mb-8"
      style={{ backgroundColor: 'var(--pivot-surface)', borderColor: 'var(--border-color, #E8E2D9)' }}
    >
      <p className="leading-relaxed">{t(k)}</p>
    </div>
  );
}

/** Bullet list from translation keys */
function BulletList({ keys }: { keys: string[] }) {
  const { t } = useClientTranslation();
  return (
    <ul className="space-y-2 pl-6">
      {keys.map((k) => (
        <li
          key={k}
          className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full"
          style={{ color: 'var(--pivot-brand)' }}
        >
          <span style={{ color: 'var(--pivot-text)' }}>{t(k)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Step card for CGV process */
function StepCard({ num, titleKey, descKey }: { num: number; titleKey: string; descKey: string }) {
  const { t } = useClientTranslation();
  return (
    <li
      className="flex gap-3 items-start rounded-lg p-4 border"
      style={{ backgroundColor: 'var(--pivot-surface)', borderColor: 'var(--border-color, #E8E2D9)' }}
    >
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ backgroundColor: 'var(--pivot-brand)', color: 'white' }}
      >
        {num}
      </span>
      <div>
        <strong className="block mb-1 text-sm">{t(titleKey)}</strong>
        <span className="text-sm leading-relaxed">{t(descKey)}</span>
      </div>
    </li>
  );
}

export { T, SectionTitle, SubTitle, P, InfoCell, HighlightBox, IntroBox, BulletList, StepCard };
