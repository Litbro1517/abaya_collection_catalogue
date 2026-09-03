import Link from 'next/link';

/**
 * 404 Not Found — Custom branded page.
 *
 * Uses the Abaya Collection visual identity (gold + deep green + cream background)
 * with a clear message and a CTA back to the catalog.
 */
export default function NotFound() {
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

      {/* 404 number */}
      <h1
        className="text-6xl sm:text-7xl font-bold mb-4"
        style={{ color: '#1A3C34', fontFamily: "var(--font-playfair), serif" }}
      >
        404
      </h1>

      {/* Message */}
      <p
        className="text-lg sm:text-xl font-medium mb-2 text-center"
        style={{ color: '#1A3C34' }}
      >
        Page introuvable
      </p>
      <p className="text-sm text-center max-w-md mb-8" style={{ color: '#808080' }}>
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>

      {/* CTA */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-105"
        style={{ backgroundColor: '#1A3C34' }}
      >
        Retour au catalogue
      </Link>
    </div>
  );
}
