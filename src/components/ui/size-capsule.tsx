'use client';

import { cn } from '@/lib/utils';

interface SizeCapsuleProps {
  /** Size label (e.g. "M", "L", "XL") */
  label: string;
  /** Whether this capsule is selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
}

export function SizeCapsule({
  label,
  selected = false,
  onClick,
  className,
}: SizeCapsuleProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-200',
        'border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        selected
          ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
          : 'bg-transparent border-[#2D2D2D]/20 hover:border-[#2D2D2D]/50',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      style={{ color: selected ? '#fff' : '#1A1A1A' }}
      onClick={onClick}
      aria-label={`Taille: ${label}`}
    >
      {label}
    </button>
  );
}
