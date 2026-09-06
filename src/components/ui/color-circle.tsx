'use client';

import { cn } from '@/lib/utils';

interface ColorCircleProps {
  /** Color name (displayed as tooltip on hover) */
  name: string;
  /** Hex color code for the fill */
  hex: string;
  /** Size in pixels — default 40 */
  size?: number;
  /** Whether this circle is currently selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS class */
  className?: string;
}

export function ColorCircle({
  name,
  hex,
  size = 40,
  selected = false,
  onClick,
  className,
}: ColorCircleProps) {
  return (
    <button
      type="button"
      className={cn(
        'group relative rounded-full transition-all duration-200 flex-shrink-0',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        selected ? 'ring-2 ring-offset-2' : 'hover:scale-110',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: hex,
        // For very light colors, add a subtle border
        ...(isLightColor(hex) ? { border: '1px solid rgba(0,0,0,0.12)' } : {}),
      }}
      onClick={onClick}
      title={name}
      aria-label={`Couleur: ${name}`}
    >
      {/* Tooltip on hover */}
      <span
        className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ color: '#2D2D2D' }}
      >
        {name}
      </span>
    </button>
  );
}

/**
 * isLightColor — Determine if a hex color is light (needs a border)
 */
function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.85;
}
