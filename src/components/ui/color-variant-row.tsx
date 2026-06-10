'use client';

import { useState, useEffect, useRef } from 'react';
import { ColorCircle } from './color-circle';
import { generateDefaultHex } from '@/lib/color-utils';

interface ColorEntry {
  name: string;
  hex: string;
}

interface ColorVariantRowProps {
  /** Raw color names string (e.g. "Rose, Chibi, Beij") */
  colorNames: string;
  /** Currently selected color name */
  selectedColor?: string;
  /** Callback when a color circle is clicked */
  onColorSelect?: (colorName: string) => void;
  /** Circle size — default 40 */
  circleSize?: number;
}

// ━━━ ColorMap Cache with TTL invalidation ━━━━━━━━━━━━━━━━━━━━━━━━━
// Cache expires after 60 seconds so admin edits propagate automatically
let colorMapCache: Map<string, string> | null = null;
let colorMapCacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

// Export invalidation function for manual cache busting
export function invalidateColorMapCache() {
  colorMapCache = null;
  colorMapCacheTimestamp = 0;
}

async function fetchColorMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (colorMapCache && (now - colorMapCacheTimestamp) < CACHE_TTL_MS) {
    return colorMapCache;
  }
  try {
    const res = await fetch('/api/colormap');
    if (!res.ok) return colorMapCache || new Map();
    const json = await res.json();
    const map = new Map<string, string>();
    if (json.data && Array.isArray(json.data)) {
      for (const entry of json.data) {
        map.set(entry.name.toLowerCase(), entry.hex);
        map.set(entry.slug, entry.hex);
      }
    }
    colorMapCache = map;
    colorMapCacheTimestamp = now;
    return map;
  } catch {
    return colorMapCache || new Map();
  }
}

function parseAndNormalize(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function ColorVariantRow({
  colorNames,
  selectedColor,
  onColorSelect,
  circleSize = 40,
}: ColorVariantRowProps) {
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map());
  const prevColorNamesRef = useRef(colorNames);

  // Fetch color map on mount and when colorNames changes
  useEffect(() => {
    let cancelled = false;

    // Invalidate cache when switching products so fresh data is fetched
    if (prevColorNamesRef.current !== colorNames) {
      invalidateColorMapCache();
    }

    fetchColorMap().then(map => {
      if (!cancelled) {
        setColorMap(new Map(map));
        prevColorNamesRef.current = colorNames;
      }
    });

    return () => { cancelled = true; };
  }, [colorNames]);

  const parsedNames = parseAndNormalize(colorNames);
  if (parsedNames.length === 0) return null;

  const colorEntries: ColorEntry[] = parsedNames.map(name => {
    const lower = name.toLowerCase();
    const hex = colorMap.get(lower) || generateDefaultHex(name);
    return { name, hex };
  });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {colorEntries.map(entry => (
        <ColorCircle
          key={entry.name}
          name={entry.name}
          hex={entry.hex}
          size={circleSize}
          selected={selectedColor === entry.name}
          onClick={onColorSelect ? () => onColorSelect(entry.name) : undefined}
        />
      ))}
    </div>
  );
}
