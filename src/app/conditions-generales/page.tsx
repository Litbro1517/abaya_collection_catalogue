import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — Abaya Collection Chic',
  description: 'Conditions générales de vente du site Abaya Collection Chic. Informations sur les commandes, la livraison, les retours et les modalités de paiement.',
};

export default function ConditionsGeneralesPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pivot-surface)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border-color, #E8E2D9)' }}>
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--pivot-brand)' }}
          >
            ← Retour au catalogue
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto max-w-3xl w-full px-6 py-10">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-8"
          style={{ color: 'var(--pivot-text)', fontFamily: "'Playfair Display', serif" }}
        >
          Conditions Générales de Vente
        </h1>

        {/* ── PLACEHOLDER CONTENT ── */}
        {/* Les textes définitifs seront insérés à partir du fichier documents-legaux-abaya-v2.html
            fourni au message suivant. Structure de référence ci-dessous. */}
        <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--pivot-text)' }}>
          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              1. Objet
            </h2>
            <p className="mb-2">
              <strong>Éditeur :</strong> Abaya Collection
            </p>
            <p className="mb-2">
              <strong>Contact :</strong>{' '}
              <a href="mailto:abayacollect@gmail.com" style={{ color: 'var(--pivot-gold)' }}>
                abayacollect@gmail.com
              </a>
            </p>
            <p className="opacity-60 italic">
              [Le texte définitif sera inséré depuis documents-legaux-abaya-v2.html]
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              2. Produits et prix
            </h2>
            <p className="opacity-60 italic">
              [Le texte définitif sera inséré depuis documents-legaux-abaya-v2.html]
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              3. Commande et paiement
            </h2>
            <p className="opacity-60 italic">
              [Le texte définitif sera inséré depuis documents-legaux-abaya-v2.html]
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              4. Livraison
            </h2>
            <p className="opacity-60 italic">
              [Le texte définitif sera inséré depuis documents-legaux-abaya-v2.html]
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              5. Droit de rétractation et retours
            </h2>
            <p className="opacity-60 italic">
              [Le texte définitif sera inséré depuis documents-legaux-abaya-v2.html]
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              6. Responsabilité
            </h2>
            <p className="opacity-60 italic">
              [Le texte définitif sera inséré depuis documents-legaux-abaya-v2.html]
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6" style={{ backgroundColor: 'var(--pivot-brand)' }}>
        <div className="mx-auto max-w-3xl px-6 flex flex-wrap items-center gap-4 text-xs text-white/70">
          <Link href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link>
          <Link href="/politique-de-confidentialite" className="hover:text-white transition-colors">Politique de confidentialité</Link>
          <Link href="/conditions-generales" className="hover:text-white transition-colors">Conditions générales</Link>
          <span className="ml-auto text-white/50">&copy; {new Date().getFullYear()} Abaya Collection Chic</span>
        </div>
      </footer>
    </div>
  );
}
