'use client';

import Link from 'next/link';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';
import type { ReactNode } from 'react';

interface LegalPageLayoutProps {
  children: ReactNode;
}

export default function LegalPageLayout({ children }: LegalPageLayoutProps) {
  const { t, dir } = useClientTranslation();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pivot-surface)' }} dir={dir}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border-color, #E8E2D9)' }}>
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--pivot-brand)' }}
          >
            {t('legal.backToCatalog')}
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto max-w-3xl w-full px-6 py-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6" style={{ backgroundColor: 'var(--pivot-brand)' }}>
        <div className="mx-auto max-w-3xl px-6 flex flex-wrap items-center gap-4 text-xs text-white/70">
          <Link href="/mentions-legales" className="hover:text-white transition-colors">{t('legal.footerMentions')}</Link>
          <Link href="/politique-de-confidentialite" className="hover:text-white transition-colors">{t('legal.footerPrivacy')}</Link>
          <Link href="/conditions-generales" className="hover:text-white transition-colors">{t('legal.footerCgv')}</Link>
          <Link href="/politique-de-retour" className="hover:text-white transition-colors">{t('legal.footerReturns')}</Link>
          <span className="ml-auto text-white/50">{t('legal.footerCopyright').replace('{year}', String(year))}</span>
        </div>
      </footer>
    </div>
  );
}
