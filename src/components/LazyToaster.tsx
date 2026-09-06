'use client';

import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';

/**
 * MANDAT 4P — TBT Fix G: LazyToaster
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Client Component qui diffère le montage de <Toaster> (sonner, 65 KiB)
 * au prochain idle callback → hors fenêtre TBT critique.
 */
export function LazyToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('requestIdleCallback' in window) {
      const id = (window as Window & {
        requestIdleCallback: (cb: () => void) => number;
      }).requestIdleCallback(() => setMounted(true));
      return () => {
        (window as Window & {
          cancelIdleCallback: (id: number) => void;
        }).cancelIdleCallback(id);
      };
    }
    const timer = setTimeout(() => setMounted(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;
  return <Toaster position="bottom-right" richColors />;
}
