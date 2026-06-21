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
              Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent l&apos;ensemble des relations commerciales entre <strong>l&apos;enseigne commerciale Abaya Collection</strong>, dont le siège d&apos;exploitation est établi à Marrakech (Royaume du Maroc), et tout acheteur (ci-après « le Client ») passant commande via le présent catalogue numérique ou toute landing page associée. Elles sont rédigées et applicables conformément à la <strong>loi n° 31-08 édictant des mesures de protection du consommateur</strong> et à la <strong>loi n° 53-05 relative à l&apos;échange électronique de données juridiques</strong>. Toute commande implique l&apos;adhésion pleine et entière du Client aux présentes CGV, qui prévalent sur tout autre document contractuel.
            </p>
          </div>

          {/* Article 1 — Processus de Commande */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              1. Processus de Commande
            </h2>
            <p className="mb-4">
              Toute commande est soumise à la disponibilité effective des articles présentés et à la validation expresse et concordante des deux parties. Le catalogue ne constitue pas une offre ferme de vente au sens juridique du terme, mais une invitation à contracter. L&apos;enseigne commerciale Abaya Collection propose deux parcours de commande distincts, selon le canal d&apos;accès emprunté par le Client.
            </p>

            <h3
              className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3"
              style={{ color: 'var(--pivot-text)' }}
            >
              Parcours A — Tunnel publicitaire via WhatsApp
            </h3>
            <p className="mb-4">
              Ce parcours s&apos;adresse aux Clients ayant accédé au catalogue à la suite d&apos;une annonce publicitaire diffusée sur les réseaux sociaux ou toute autre plateforme de diffusion numérique.
            </p>
            <ol className="space-y-3 mb-6">
              <li
                className="flex gap-3 items-start rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--pivot-brand)',
                    color: 'white',
                  }}
                >
                  1
                </span>
                <div>
                  <strong className="block mb-1 text-sm">Accès au catalogue et sélection de l&apos;article</strong>
                  <span className="text-sm leading-relaxed">
                    Le Client, redirigé depuis l&apos;annonce publicitaire vers le catalogue numérique, parcourt les articles disponibles et consulte les caractéristiques de chaque produit (modèle, coloris, taille). En actionnant le bouton de commande de l&apos;article souhaité, il manifeste son intention d&apos;achat. Aucune donnée personnelle n&apos;est collectée à cette étape.
                  </span>
                </div>
              </li>
              <li
                className="flex gap-3 items-start rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--pivot-brand)',
                    color: 'white',
                  }}
                >
                  2
                </span>
                <div>
                  <strong className="block mb-1 text-sm">Redirection automatique vers WhatsApp</strong>
                  <span className="text-sm leading-relaxed">
                    Le Client est automatiquement redirigé vers l&apos;application WhatsApp avec un message pré-rempli récapitulant les références du produit sélectionné. L&apos;initiation de cette conversation constitue une démarche volontaire du Client et s&apos;effectue sous sa seule responsabilité.
                  </span>
                </div>
              </li>
              <li
                className="flex gap-3 items-start rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--pivot-brand)',
                    color: 'white',
                  }}
                >
                  3
                </span>
                <div>
                  <strong className="block mb-1 text-sm">Validation écrite de la commande</strong>
                  <span className="text-sm leading-relaxed">
                    La commande est définitivement formée uniquement à compter de la confirmation écrite et explicite du vendeur sur WhatsApp, portant sur : la disponibilité et les références exactes de l&apos;article (modèle, taille, coloris), l&apos;adresse précise de livraison communiquée par le Client, et le montant total de la commande frais de port inclus. Toute commande non confirmée par échange écrit est réputée inexistante et ne saurait engager le vendeur.
                  </span>
                </div>
              </li>
            </ol>

            <h3
              className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3"
              style={{ color: 'var(--pivot-text)' }}
            >
              Parcours B — Tunnel landing page &amp; accès organique
            </h3>
            <p className="mb-4">
              Ce parcours s&apos;adresse aux Clients ayant accédé au catalogue directement, par référencement organique (moteurs de recherche) ou via une landing page dédiée.
            </p>
            <ol className="space-y-3 mb-6">
              <li
                className="flex gap-3 items-start rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--pivot-brand)',
                    color: 'white',
                  }}
                >
                  1
                </span>
                <div>
                  <strong className="block mb-1 text-sm">Sélection de l&apos;article et soumission du formulaire de commande</strong>
                  <span className="text-sm leading-relaxed">
                    Le Client sélectionne l&apos;article de son choix sur le catalogue ou la landing page et renseigne un formulaire de commande sécurisé comprenant les informations suivantes : nom et prénom du destinataire, numéro de téléphone et adresse complète de livraison. La soumission du formulaire constitue une demande d&apos;achat ferme de la part du Client, sans que cela n&apos;emporte encore formation définitive du contrat de vente.
                  </span>
                </div>
              </li>
              <li
                className="flex gap-3 items-start rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--pivot-brand)',
                    color: 'white',
                  }}
                >
                  2
                </span>
                <div>
                  <strong className="block mb-1 text-sm">Confirmation de réception de la demande</strong>
                  <span className="text-sm leading-relaxed">
                    À l&apos;issue de la soumission, le Client est automatiquement redirigé vers une page de remerciement affichant le récapitulatif complet de sa demande (article, taille, coloris, coordonnées de livraison). Cette page constitue un simple accusé de réception de la demande et ne vaut en aucun cas confirmation définitive de la commande.
                  </span>
                </div>
              </li>
              <li
                className="flex gap-3 items-start rounded-lg p-4 border"
                style={{
                  backgroundColor: 'var(--pivot-surface)',
                  borderColor: 'var(--border-color, #E8E2D9)',
                }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--pivot-brand)',
                    color: 'white',
                  }}
                >
                  3
                </span>
                <div>
                  <strong className="block mb-1 text-sm">Confirmation verbale par appel téléphonique</strong>
                  <span className="text-sm leading-relaxed">
                    Le vendeur procède à un appel téléphonique de confirmation auprès du Client dans les meilleurs délais suivant la réception de la demande. Cet appel a pour objet de vérifier la disponibilité de l&apos;article, de confirmer les références exactes de la commande (modèle, taille, coloris), l&apos;adresse de livraison, et le montant total frais de port inclus. La commande n&apos;est définitivement formée et validée qu&apos;à l&apos;issue de cet échange téléphonique et de l&apos;accord verbal exprès des deux parties.
                  </span>
                </div>
              </li>
            </ol>

            <div
              className="border-l-3 rounded-r-lg p-4"
              style={{
                borderLeftColor: 'var(--pivot-brand)',
                backgroundColor: 'var(--pivot-surface)',
              }}
            >
              <p className="text-sm leading-relaxed">
                <strong style={{ color: 'var(--pivot-brand)' }}>Condition suspensive de validité de toute commande :</strong> Quel que soit le parcours de commande emprunté, aucune commande ne saurait être considérée comme ferme, définitivement conclue ou susceptible d&apos;engager l&apos;une ou l&apos;autre des parties tant qu&apos;elle n&apos;a pas fait l&apos;objet, selon le parcours concerné, soit d&apos;une <strong>validation écrite réciproque par échange WhatsApp</strong> (Parcours A), soit d&apos;une <strong>validation verbale expresse par appel téléphonique</strong> (Parcours B). Toute demande en attente de l&apos;une de ces confirmations est réputée à l&apos;état d&apos;intention non engageante. Le paiement demeure dans tous les cas exclusivement dû en espèces, auprès du livreur, au moment de la réception effective du colis (Cash on Delivery).
              </p>
            </div>
          </section>

          {/* Article 2 — Prix et Modalités de Paiement */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              2. Prix et Modalités de Paiement
            </h2>
            <p className="mb-4">
              Les prix affichés sur le catalogue sont exprimés en <strong>Dirhams Marocains (MAD)</strong>, toutes taxes comprises. Le vendeur se réserve le droit de modifier ses tarifs à tout moment et sans préavis ; toutefois, les produits sont facturés sur la base du prix convenu et confirmé lors de l&apos;échange WhatsApp, lequel fait foi entre les parties.
            </p>
            <div
              className="border-l-3 rounded-r-lg p-4"
              style={{
                borderLeftColor: 'var(--pivot-brand)',
                backgroundColor: 'var(--pivot-surface)',
              }}
            >
              <p className="text-sm leading-relaxed">
                <strong style={{ color: 'var(--pivot-brand)' }}>Mode de règlement unique — Paiement à la livraison (Cash on Delivery) :</strong> Le règlement s&apos;effectue exclusivement en espèces, auprès du livreur, au moment de la réception du colis. Aucun paiement anticipé, virement bancaire ou règlement par voie électronique n&apos;est requis ni sollicité. Toute demande de paiement préalable à la livraison émanant d&apos;un tiers doit être considérée comme frauduleuse et signalée immédiatement au vendeur.
              </p>
            </div>
          </section>

          {/* Article 3 — Livraison */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              3. Livraison
            </h2>
            <p className="mb-4">
              Les livraisons sont assurées exclusivement sur l&apos;ensemble du territoire du <strong>Royaume du Maroc</strong>. Aucune expédition à destination de l&apos;étranger n&apos;est proposée à ce jour. Les dispositions suivantes régissent les conditions d&apos;expédition et de livraison :
            </p>
            <ul className="space-y-2 pl-6">
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Délai de traitement :</strong> Les commandes confirmées sont préparées et expédiées dans un délai de un (1) à deux (2) jours ouvrables suivant la confirmation écrite sur WhatsApp.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Délai de livraison :</strong> Le délai estimé de livraison est de deux (2) à cinq (5) jours ouvrables à compter de la date d&apos;expédition, selon la zone géographique de destination. Ces délais sont communiqués à titre indicatif et ne constituent pas un engagement contractuel susceptible d&apos;engager la responsabilité du vendeur en cas de dépassement imputable au transporteur ou à un cas de force majeure.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Frais de port :</strong> Le montant des frais de livraison est communiqué au Client et validé par ses soins lors de la confirmation finale de la commande sur WhatsApp, préalablement à tout traitement et expédition de l&apos;envoi.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Suivi de colis :</strong> Un numéro de suivi est transmis au Client par WhatsApp dès la prise en charge effective du colis par le transporteur partenaire, permettant un suivi en temps réel de l&apos;acheminement.</span>
              </li>
            </ul>
          </section>

          {/* Article 4 — Retours, Échanges et Réclamations */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              4. Retours, Échanges et Réclamations
            </h2>
            <p className="mb-4">
              Conformément aux dispositions de la <strong>loi n° 31-08 relative à la protection du consommateur</strong> et aux usages commerciaux applicables, le Client bénéficie d&apos;un droit à l&apos;échange ou à la réclamation en cas de non-conformité avérée du produit reçu par rapport à la commande confirmée. Est considéré comme non conforme tout article erroné ou présentant un défaut de fabrication constaté objectivement à la réception du colis.
            </p>
            <ul className="space-y-2 pl-6">
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Délai de signalement :</strong> Toute demande d&apos;échange ou réclamation doit être notifiée au vendeur dans un délai de <strong>quarante-huit (48) heures</strong> suivant la réception du colis, directement via la conversation WhatsApp officielle, accompagnée de photographies probantes du défaut ou de la non-conformité constatée.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>État des articles retournés :</strong> Seuls les articles retournés dans leur état d&apos;origine sont éligibles à l&apos;échange : non portés, non lavés, avec les étiquettes d&apos;origine intactes et dans leur emballage initial préservé.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Prise en charge des frais de retour :</strong> Les frais de retour sont intégralement supportés par le vendeur uniquement lorsque la non-conformité ou l&apos;erreur de préparation est reconnue et avérée de sa part. Dans tous les autres cas, ils demeurent à la charge du Client.</span>
              </li>
              <li className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:w-[5px] before:h-[5px] before:rounded-full" style={{ color: 'var(--pivot-brand)' }}>
                <span style={{ color: 'var(--pivot-text)' }}><strong>Modalités d&apos;échange :</strong> Les demandes d&apos;échange sont examinées et traitées au cas par cas, en concertation avec le Client. Il est précisé qu&apos;aucun remboursement en numéraire n&apos;est possible après livraison et acceptation effective du colis par le Client.</span>
              </li>
            </ul>
          </section>

          {/* Article 5 — Limitation de Responsabilité */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              5. Limitation de Responsabilité
            </h2>
            <p className="mb-4">
              La responsabilité du vendeur ne saurait être engagée pour tout préjudice indirect résultant d&apos;un retard de livraison imputable à un transporteur tiers, à un événement constitutif de force majeure au sens de la législation marocaine, ou à une erreur commise par le Client lors de la communication de ses coordonnées de livraison.
            </p>
            <p className="mb-4">
              Les photographies des articles présentées sur le catalogue sont reproduites avec le souci de la fidélité la plus exacte possible aux produits réels. Néanmoins, le vendeur ne saurait être tenu responsable de légères variations de teinte ou de rendu susceptibles d&apos;apparaître en raison des paramètres d&apos;affichage propres à chaque écran ou appareil, ces variations ne constituant pas un défaut de conformité au sens légal.
            </p>
            <p>
              Le présent catalogue est accessible via une connexion internet ; le vendeur décline toute responsabilité quant aux éventuelles interruptions d&apos;accès liées à des opérations de maintenance, à des défaillances techniques du réseau ou à tout événement indépendant de sa volonté.
            </p>
          </section>

          {/* Article 6 — Droit Applicable et Juridiction Compétente */}
          <section>
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--pivot-brand)', fontFamily: "'Playfair Display', serif" }}
            >
              6. Droit Applicable et Juridiction Compétente
            </h2>
            <p className="mb-4">
              Les présentes Conditions Générales de Vente sont soumises au droit marocain, et notamment aux dispositions de la <strong>loi n° 31-08 édictant des mesures de protection du consommateur</strong> et de la <strong>loi n° 53-05 relative à l&apos;échange électronique de données juridiques</strong>.
            </p>
            <p>
              En cas de différend relatif à la formation, à l&apos;interprétation ou à l&apos;exécution des présentes CGV, les parties s&apos;engagent à rechercher en premier lieu une résolution amiable. À défaut d&apos;accord amiable dans un délai raisonnable, les tribunaux compétents du ressort de la ville de <strong>Marrakech</strong> seront seuls habilités à connaître et à trancher le litige.
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
