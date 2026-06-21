import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Mentions Légales — Abaya Collection Chic',
  description: 'Mentions légales du site Abaya Collection Chic. Informations sur l\'éditeur, l\'hébergement et les conditions d\'utilisation.',
};

export default function MentionsLegalesPage() {
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
          Mentions Légales
        </h1>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--pivot-text)' }}>
          {/* Intro */}
          <div
            className="rounded-lg p-6 border"
            style={{
              backgroundColor: 'var(--pivot-surface)',
              borderColor: 'var(--border-color, #E8E2D9)',
            }}
          >
            <p className="leading-relaxed">
              Conformément aux obligations légales imposées aux opérateurs de commerce en ligne par la <strong>loi n° 53-05 relative à l&apos;échange électronique de données juridiques</strong>, les informations ci-après sont portées à la connaissance de tout utilisateur accédant au présent catalogue numérique. Elles peuvent être reproduites à des fins légales ou réglementaires.
            </p>
          </div>

          {/* Section 1 — Éditeur du Catalogue */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              1. Éditeur du Catalogue
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Dénomination commerciale</p>
                <p className="text-sm font-medium">Abaya Collection</p>
              </div>
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Marque propriétaire</p>
                <p className="text-sm font-medium">Labellect</p>
              </div>
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Forme juridique</p>
                <p className="text-sm font-medium">Enseigne commerciale</p>
              </div>
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Domicile professionnel</p>
                <p className="text-sm font-medium">Marrakech, Royaume du Maroc</p>
              </div>
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">URL officielle du catalogue</p>
                <p className="text-sm font-medium">abayacollection.labellect.com</p>
              </div>
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Adresse électronique</p>
                <p className="text-sm font-medium">
                  <a href="mailto:abayacollect@gmail.com" style={{ color: 'var(--pivot-gold)' }}>
                    abayacollect@gmail.com
                  </a>
                </p>
              </div>
            </div>
            <div
              className="border-l-3 rounded-r-lg p-4 mt-4"
              style={{
                borderLeftColor: 'var(--pivot-brand)',
                backgroundColor: 'var(--pivot-surface)',
              }}
            >
              <p className="text-sm leading-relaxed">
                Le présent site internet et catalogue numérique est accessible à l&apos;adresse officielle <strong>abayacollection.labellect.com</strong>. Il est édité, exploité et géré sous la responsabilité exclusive de l&apos;enseigne commerciale <strong>Abaya Collection</strong>, propriété de la marque <strong>Labellect</strong>. L&apos;enseigne Abaya Collection constitue une entité commerciale autonome opérant sous l&apos;ombrelle de la marque Labellect, dont elle utilise l&apos;infrastructure numérique et le domaine d&apos;hébergement.
              </p>
            </div>
            <p className="mt-4">
              L&apos;enseigne commerciale Abaya Collection exerce une activité de vente en ligne de prêt-à-porter féminin, établie à Marrakech conformément à la réglementation commerciale marocaine en vigueur.
            </p>
          </section>

          {/* Section 2 — Hébergement et Infrastructure Technique */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              2. Hébergement et Infrastructure Technique
            </h2>
            <p className="mb-4">
              Le présent catalogue numérique est hébergé et distribué par les prestataires techniques suivants :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Hébergeur principal</p>
                <p className="text-sm font-medium leading-relaxed">
                  Vercel Inc.<br />
                  340 Pine Street, Suite 701<br />
                  San Francisco, CA 94104<br />
                  États-Unis d&apos;Amérique
                </p>
              </div>
              <div
                className="rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50 mb-1">Réseau de diffusion de contenu (CDN)</p>
                <p className="text-sm font-medium leading-relaxed">
                  Cloudflare Inc.<br />
                  101 Townsend Street<br />
                  San Francisco, CA 94107<br />
                  États-Unis d&apos;Amérique
                </p>
              </div>
            </div>
            <p>
              L&apos;éditeur a choisi ces prestataires en raison de leurs garanties techniques en matière de disponibilité, de sécurité et de performance. Les données de navigation transitent par les serveurs Cloudflare dans le cadre de la distribution du contenu et de la protection contre les attaques informatiques.
            </p>
          </section>

          {/* Section 3 — Propriété Intellectuelle */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              3. Propriété Intellectuelle
            </h2>
            <p className="mb-4">
              L&apos;intégralité des contenus diffusés sur le présent catalogue numérique — incluant, sans s&apos;y limiter, les textes descriptifs, photographies de produits, visuels, logos, identité graphique, typographies sélectionnées et agencement éditorial des pages — est la propriété exclusive de l&apos;éditeur ou fait l&apos;objet d&apos;une autorisation d&apos;utilisation accordée à son bénéfice.
            </p>
            <p>
              Toute reproduction, représentation, modification, publication, adaptation, transmission, dénaturation ou exploitation commerciale, totale ou partielle, de l&apos;un quelconque de ces éléments, par quelque moyen ou procédé que ce soit, sans l&apos;autorisation préalable, expresse et écrite de l&apos;éditeur, est strictement interdite. Une telle exploitation non autorisée est susceptible de constituer une contrefaçon sanctionnée conformément aux dispositions de la <strong>loi n° 2-00 relative aux droits d&apos;auteur et droits voisins</strong> ainsi qu&apos;aux articles pertinents du Code pénal marocain.
            </p>
          </section>

          {/* Section 4 — Traceurs de Mesure d'Audience */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              4. Traceurs de Mesure d&apos;Audience
            </h2>
            <p>
              Le présent catalogue utilise exclusivement des traceurs techniques à finalité statistique et analytique, opérés par <strong>Cloudflare Zaraz</strong>, solution de gestion des balises côté serveur (server-side tag management). Cette technologie traite les données de navigation de manière entièrement anonyme et agrégée : aucun cookie publicitaire, aucun identifiant personnel, aucun traceur de suivi comportemental inter-sites n&apos;est déposé sur le terminal du visiteur. Conformément à la réglementation applicable, l&apos;utilisation de ces traceurs à des fins exclusivement statistiques et anonymes ne requiert pas le recueil préalable du consentement de l&apos;utilisateur.
            </p>
          </section>

          {/* Section 5 — Liens Hypertextes et Plateformes Tierces */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              5. Liens Hypertextes et Plateformes Tierces
            </h2>
            <p className="mb-4">
              Le catalogue peut contenir des liens de redirection vers des applications ou plateformes tierces, notamment WhatsApp (Meta Platforms Ireland Limited) et Messenger, aux fins de traitement des commandes et de communication commerciale. L&apos;éditeur décline toute responsabilité quant au contenu, aux pratiques de confidentialité et aux conditions générales d&apos;utilisation propres à ces plateformes tierces, qui relèvent exclusivement de la responsabilité de leurs éditeurs respectifs. Il est conseillé au visiteur de prendre connaissance des politiques de confidentialité desdites plateformes.
            </p>
            <p>
              La mise en place d&apos;un lien hypertexte dirigeant vers le présent catalogue depuis un site ou une application tiers est subordonnée à l&apos;accord préalable et écrit de l&apos;éditeur. Pour toute demande en ce sens, veuillez prendre contact via le canal WhatsApp officiel ou par e-mail.
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
