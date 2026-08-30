'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Error boundary — catches server-side and runtime errors (500).
 *
 * Displays a branded error page with:
 * - A "Réessayer" button that calls reset() to re-render the route
 * - A "Retour à l'accueil" link
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#FAF8F5' }}
    >
      {/* Brand emblem */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8"
        style={{ background: 'linear-gradient(135deg, #C9A84C, #E8D48B, #C9A84C)' }}
      >
        <span className="text-3xl font-bold" style={{ color: '#1A3C34' }}>A</span>
      </div>

      {/* Error message */}
      <h1
        className="text-4xl sm:text-5xl font-bold mb-4"
        style={{ color: '#1A3C34', fontFamily: "'Playfair Display', serif" }}
      >
        Une erreur est survenue
      </h1>
      <p className="text-sm text-center max-w-md mb-8" style={{ color: '#808080' }}>
        Nous nous excusons pour ce désagrément. Veuillez réessayer ou revenir à l'accueil.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-105"
          style={{ backgroundColor: '#1A3C34' }}
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:scale-105"
          style={{ backgroundColor: 'transparent', border: '1px solid #1A3C34', color: '#1A3C34' }}
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
