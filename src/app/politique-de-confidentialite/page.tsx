import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — Abaya Collection Chic',
  description: 'Politique de confidentialité du site Abaya Collection Chic. Informations sur la collecte, l\'utilisation et la protection de vos données personnelles.',
};

export default function PolitiqueConfidentialitePage() {
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
          Politique de Confidentialité
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
              La protection des données personnelles de nos clients constitue un engagement fondamental d&apos;Abaya Collection. La présente politique de confidentialité décrit, de manière transparente et exhaustive, les données que nous traitons, les finalités poursuivies, les droits dont vous disposez et les mesures mises en œuvre pour assurer la sécurité de vos informations. Elle est établie en conformité avec la <strong>loi marocaine n° 09-08 relative à la protection des personnes physiques à l&apos;égard du traitement des données à caractère personnel</strong> et, à titre complémentaire, avec les principes du <strong>Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679)</strong>.
            </p>
          </div>

          {/* Article 1 — Responsable du Traitement */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              1. Responsable du Traitement
            </h2>
            <p>
              Le responsable du traitement des données à caractère personnel collectées dans le cadre de l&apos;utilisation du présent catalogue et de la passation de commandes est <strong>l&apos;enseigne commerciale Abaya Collection</strong>, dont le siège d&apos;exploitation est établi à Marrakech, Royaume du Maroc. Elle peut être contactée via le canal WhatsApp officiel du catalogue ou à l&apos;adresse électronique suivante : <strong><a href="mailto:abayacollect@gmail.com" style={{ color: 'var(--pivot-gold)' }}>abayacollect@gmail.com</a></strong>.
            </p>
          </section>

          {/* Article 2 — Nature des Données Collectées et Bases Légales */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              2. Nature des Données Collectées et Bases Légales
            </h2>

            <h3
              className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3"
              style={{ color: 'var(--pivot-text)' }}
            >
              2.1 — Données collectées sur le catalogue numérique
            </h3>
            <p className="mb-4">
              Le catalogue ne collecte <strong>aucune donnée nominative</strong> et n&apos;enregistre aucune information bancaire ou financière directement sur sa plateforme. Aucun formulaire de saisie de données personnelles identifiantes n&apos;est présenté au visiteur lors de sa navigation.
            </p>
            <p className="mb-4">
              Des données de navigation anonymes et agrégées (pages consultées, durée de visite, type d&apos;appareil, pays d&apos;origine approximatif) sont collectées à des fins exclusivement statistiques via <strong>Cloudflare Zaraz</strong>. Ces données, traitées de manière anonymisée, ne permettent en aucun cas d&apos;identifier personnellement un utilisateur et ne sont pas transmises à des tiers à des fins commerciales.
            </p>

            <h3
              className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3"
              style={{ color: 'var(--pivot-text)' }}
            >
              2.2 — Données communiquées volontairement via WhatsApp
            </h3>
            <p className="mb-4">
              Lorsqu&apos;un client initie une commande et bascule vers l&apos;application WhatsApp, il transmet volontairement et de sa propre initiative les informations personnelles nécessaires au traitement de ladite commande. Ces données comprennent :
            </p>
            <ul className="space-y-2 pl-6 mb-4">
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Nom et prénom du destinataire</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Adresse complète de livraison (rue, ville, code postal)</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Numéro de téléphone (inhérent à l&apos;utilisation de l&apos;application WhatsApp)</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Références précises de la commande (modèle, taille, coloris souhaités)</span>
              </li>
            </ul>
            <div
              className="border-l-3 rounded-r-lg p-4 mt-4"
              style={{
                borderLeftColor: 'var(--pivot-brand)',
                backgroundColor: 'var(--pivot-surface)',
              }}
            >
              <p className="text-sm leading-relaxed">
                <strong style={{ color: 'var(--pivot-brand)' }}>Base légale du traitement :</strong> Le traitement des données personnelles communiquées via WhatsApp est fondé sur l&apos;exécution d&apos;un contrat de vente (art. 6.1.b du RGPD ; art. 7 de la loi marocaine n° 09-08) auquel le Client est partie. Ces données sont utilisées exclusivement aux fins du traitement, de la préparation, de l&apos;expédition de la commande et du suivi du service après-vente.
              </p>
            </div>
          </section>

          {/* Article 3 — Finalités du Traitement */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              3. Finalités du Traitement
            </h2>
            <p className="mb-4">
              Les données personnelles communiquées par le Client dans le cadre de sa commande sont traitées aux seules fins suivantes, limitativement énumérées :
            </p>
            <ul className="space-y-2 pl-6 mb-4">
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Traitement, préparation et expédition de la commande confirmée ;</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Communication relative au suivi de l&apos;acheminement et de la livraison du colis ;</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}>Traitement des demandes d&apos;échange, de retour ou de réclamation relevant du service après-vente.</span>
              </li>
            </ul>
            <p>
              Ces données ne font l&apos;objet d&apos;aucune utilisation à des fins de prospection commerciale non sollicitée (démarchage, marketing direct). Elles ne sont en aucun cas cédées, vendues, louées ou transmises à des tiers à des fins commerciales propres.
            </p>
          </section>

          {/* Article 4 — Durée de Conservation des Données */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              4. Durée de Conservation des Données
            </h2>
            <p>
              Les données à caractère personnel relatives aux commandes sont conservées pour la durée strictement nécessaire à l&apos;exécution du contrat de vente et au traitement d&apos;éventuelles réclamations ou litiges, soit une durée maximale de <strong>douze (12) mois</strong> à compter de la date de livraison effective. À l&apos;issue de cette période de conservation, les données sont définitivement supprimées ou anonymisées de telle sorte qu&apos;elles ne permettent plus l&apos;identification de la personne concernée.
            </p>
          </section>

          {/* Article 5 — Cookies et Traceurs Techniques */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              5. Cookies et Traceurs Techniques
            </h2>
            <p className="mb-4">
              Le catalogue utilise exclusivement des traceurs de mesure d&apos;audience à finalité analytique et statistique, opérés par <strong>Cloudflare Zaraz</strong>, solution de proxy de balises côté serveur. Cette technologie traite les données de navigation de manière <strong>entièrement anonyme et agrégée</strong> : aucun identifiant personnel, aucun cookie publicitaire, aucun traceur de profilage comportemental inter-sites n&apos;est déposé ou stocké sur le terminal du visiteur.
            </p>
            <p>
              Conformément aux dispositions de la <strong>loi marocaine n° 09-08</strong> et à la réglementation européenne applicable, le recours à ces traceurs à finalité purement statistique et anonyme ne requiert pas le recueil préalable du consentement de l&apos;utilisateur, dans la mesure où aucune donnée personnelle identifiante n&apos;est collectée ou traitée à cette occasion.
            </p>
          </section>

          {/* Article 6 — Vos Droits sur vos Données Personnelles */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              6. Vos Droits sur vos Données Personnelles
            </h2>
            <p className="mb-4">
              Conformément aux dispositions de la <strong>loi marocaine n° 09-08</strong> et aux principes du <strong>RGPD</strong>, vous disposez des droits suivants à l&apos;égard des données personnelles que vous avez communiquées dans le cadre d&apos;une commande :
            </p>
            <ul className="space-y-3 pl-6 mb-4">
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Droit d&apos;accès (art. 7 loi 09-08 / art. 15 RGPD) :</strong> obtenir la confirmation que vos données font l&apos;objet d&apos;un traitement et, le cas échéant, en recevoir une copie lisible.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Droit de rectification (art. 9 loi 09-08 / art. 16 RGPD) :</strong> obtenir la correction, sans délai injustifié, des données inexactes ou incomplètes vous concernant.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Droit à l&apos;effacement (art. 20 loi 09-08 / art. 17 RGPD) :</strong> demander la suppression de vos données personnelles, sous réserve des obligations légales de conservation incombant au responsable du traitement.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Droit d&apos;opposition (art. 12 loi 09-08 / art. 21 RGPD) :</strong> vous opposer, pour des motifs légitimes tenant à votre situation particulière, au traitement de vos données personnelles.</span>
              </li>
            </ul>
            <div
              className="border-l-3 rounded-r-lg p-4 mt-4"
              style={{
                borderLeftColor: 'var(--pivot-brand)',
                backgroundColor: 'var(--pivot-surface)',
              }}
            >
              <p className="text-sm leading-relaxed">
                <strong style={{ color: 'var(--pivot-brand)' }}>Comment exercer vos droits :</strong> Pour toute demande relative à vos données personnelles, veuillez nous contacter directement via notre conversation WhatsApp officielle ou par e-mail à <em>abayacollect@gmail.com</em>. Toute demande recevable fera l&apos;objet d&apos;une réponse dans un délai maximum de <strong>trente (30) jours calendaires</strong> à compter de sa réception.
              </p>
            </div>
            <p className="mt-4">
              En cas de réponse insatisfaisante ou d&apos;absence de réponse dans le délai imparti, vous disposez du droit d&apos;introduire une réclamation auprès de la <strong>Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP)</strong>, autorité de contrôle marocaine compétente en la matière, dont les coordonnées sont disponibles sur le site officiel <em>www.cndp.ma</em>.
            </p>
          </section>

          {/* Article 7 — Sécurité des Données */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              7. Sécurité des Données
            </h2>
            <p>
              Le responsable du traitement met en œuvre toutes les mesures techniques et organisationnelles appropriées afin de garantir la sécurité, la confidentialité et l&apos;intégrité des données personnelles communiquées par les Clients, notamment contre tout accès non autorisé, toute perte, altération ou divulgation accidentelle. Les échanges de données transitant via WhatsApp bénéficient du chiffrement de bout en bout inhérent à ladite application.
            </p>
          </section>

          {/* Article 8 — Évolution de la Présente Politique */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              8. Évolution de la Présente Politique
            </h2>
            <p>
              Le responsable du traitement se réserve le droit d&apos;apporter des modifications à la présente politique de confidentialité à tout moment, notamment afin de refléter les évolutions législatives, réglementaires ou technologiques applicables. La date de la dernière mise à jour est systématiquement indiquée en en-tête du présent document. La poursuite de l&apos;utilisation du catalogue après la mise en ligne d&apos;une version actualisée de cette politique vaut acceptation des modifications intervenues. Il est conseillé aux utilisateurs de consulter régulièrement ce document.
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
