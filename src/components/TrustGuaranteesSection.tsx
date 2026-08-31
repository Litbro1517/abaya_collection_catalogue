'use client';

import { useState } from 'react';
import { Truck, Banknote, ShieldCheck, RefreshCw, Headphones } from 'lucide-react';
import type { ComponentType, CSSProperties } from 'react';
import { useAppStore } from '@/lib/store';
import { useClientTranslation } from '@/lib/i18n';
import type { TrustGuaranteesConfig, GuaranteeKey } from '@/types';
import { cn } from '@/lib/utils';

/**
 * TrustGuaranteesSection (VG32) — vitrine component.
 *
 * Displays 4 trust guarantees (Livraison, Paiement, Qualité, Échange) above
 * the footer, directly on the cream background (#FAF8F5). No separate
 * background container.
 *
 * Features:
 * - Top separator line (~65% width, centered, gold-tinted)
 * - Gold thin-outline lucide icons in glassmorphism circles
 * - Anthracite titles (#3D3D3D, not pure black)
 * - Tooltip bubble on hover / tap / focus (fluid transition, appears above)
 * - Responsive: 1 col mobile, 2×2 tablet, 4 cols desktop
 * - Fallback: empty admin fields → dictionary defaults (trust.*)
 * - isVisible=false → renders nothing (no empty space)
 */

type IconType = ComponentType<{ className?: string; style?: CSSProperties; strokeWidth?: number }>;

const GUARANTEE_META: ReadonlyArray<{ key: GuaranteeKey; Icon: IconType }> = [
  { key: 'livraison', Icon: Truck },
  { key: 'paiement', Icon: Banknote },
  { key: 'qualite', Icon: ShieldCheck },
  { key: 'retour', Icon: RefreshCw },
  { key: 'sav', Icon: Headphones },
];

export function TrustGuaranteesSection({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { t, locale, rtl } = useClientTranslation();
  const settings = useAppStore(s => s.settings);
  const config: TrustGuaranteesConfig | null = settings?.trustGuarantees ?? null;

  // If admin set isVisible=false, render nothing (no empty space)
  if (config?.isVisible === false) return null;

  // Resolve title/desc with fallback to dictionary
  const resolveItem = (key: GuaranteeKey): { title: string; desc: string } => {
    const adminItem = config?.items?.[key]?.[locale];
    const title = (adminItem?.title ?? '').trim() || t(`trust.${key}.title`);
    const desc = (adminItem?.description ?? '').trim() || t(`trust.${key}.desc`);
    return { title, desc };
  };

  const isCompact = variant === 'compact';

  return (
    <section
      className={isCompact ? 'w-full py-0' : 'w-full py-10 sm:py-12'}
      style={{ backgroundColor: 'transparent' }}
      dir={rtl ? 'rtl' : 'ltr'}
      aria-label={t('trust.livraison.title') ? 'Trust guarantees' : undefined}
    >
      <div className={isCompact ? 'w-full' : 'mx-auto px-4'} style={isCompact ? undefined : { maxWidth: 1270 }}>
        {/* Top separator line — ONLY in full variant (catalog page).
            VG35.0 Fix A: removed in compact (PDP) variant to eliminate parasitic line. */}
        {!isCompact && (
          <div className="flex justify-center mb-8 sm:mb-10">
            <div
              className="h-px w-[65%] max-w-[700px]"
              style={{ backgroundColor: 'rgba(201, 168, 76, 0.35)' }}
            />
          </div>
        )}

        {/* Responsive grid: compact = 5 cols inline (PDP under-image), full = responsive (catalog) */}
        <div className={isCompact
          ? 'grid grid-cols-5 gap-2 sm:gap-3'
          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8'
        }>
          {GUARANTEE_META.map(({ key, Icon }) => {
            const { title, desc } = resolveItem(key);
            return (
              <TrustCard key={key} Icon={Icon} title={title} desc={desc} rtl={rtl} compact={isCompact} />
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── TrustCard: icon circle + title + hover/tap tooltip ────────────────────

function TrustCard({
  Icon,
  title,
  desc,
  rtl,
  compact = false,
}: {
  Icon: IconType;
  title: string;
  desc: string;
  rtl: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center text-center group cursor-pointer select-none"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(o => !o);
        }
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="button"
      aria-expanded={open}
    >
      {/* Tooltip bubble — appears above on hover / tap / focus */}
      <div
        className={cn(
          'absolute bottom-full mb-3 z-30 w-[230px] max-w-[90vw] rounded-xl px-4 py-3 text-xs leading-relaxed shadow-lg transition-all duration-300 pointer-events-none',
          open
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2 invisible'
        )}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(201, 168, 76, 0.3)',
          color: '#3D3D3D',
        }}
        dir={rtl ? 'rtl' : 'ltr'}
      >
        {desc}
        {/* Arrow pointing down */}
        <div
          className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid rgba(255, 255, 255, 0.92)',
          }}
        />
      </div>

      {/* Glassmorphism circle with gold-bordered icon — compact uses smaller circle for PDP column */}
      <div
        className={cn(
          'rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105',
          compact ? 'w-10 h-10 mb-2' : 'w-12 h-12 mb-3'
        )}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: '1.5px solid rgba(201, 168, 76, 0.55)',
          boxShadow: '0 2px 8px rgba(201, 168, 76, 0.12)',
        }}
      >
        {/* Fix: uniform black stroke icons inside gold-bordered circles */}
        <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: '#1A1A1A' }} strokeWidth={1.5} />
      </div>

      {/* Title — anthracite doux (not pure black). Compact = smaller text for PDP. */}
      <span
        className={cn('font-semibold leading-snug', compact ? 'text-[0.7rem]' : 'text-sm')}
        style={{ color: '#3D3D3D' }}
      >
        {title}
      </span>
    </div>
  );
}
