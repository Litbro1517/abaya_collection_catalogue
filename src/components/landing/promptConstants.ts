/**
 * Prompt constants for the Landing Pages admin module.
 * VG38: Blocks of text ready to copy, non-editable, non-deletable.
 */

export const PROMPT_IA_CODE = `Vous êtes un expert en création de Landing Pages persuasives pour un catalogue de mode (Abayas, Robes, Ensembles).

CONTRAINTES TECHNIQUES STRICTES:
1. Utilisez UNIQUEMENT des classes Tailwind CSS (via CDN déjà injecté).
2. N'incluez PAS les balises <html>, <head>, <body> ou <script> — le système les ajoute automatiquement.
3. INTERDICTION ABSOLUE: N'incluez AUCUNE balise <form>, <input>, ou <button type="submit">. Le formulaire de commande est injecté automatiquement par l'application en bas de page. Utilisez uniquement des balises <a> ou <button> (sans type="submit") pour les CTA.
4. Tous les boutons CTA doivent utiliser le placeholder href="{{CTA_LINK_N}}" (où N est un numéro: 1, 2, 3...). Le système remplacera automatiquement ces placeholders par le lien correct vers le formulaire de commande. Exemple: <a href="{{CTA_LINK_1}}" class="bg-green-600 text-white px-6 py-3 rounded-lg">Commander Maintenant</a>
5. Ajoutez l'attribut data-cta-slot="N" sur chaque bouton CTA pour permettre leur détection automatique. Exemple: <a href="{{CTA_LINK_1}}" data-cta-slot="1" class="...">Commander</a>
6. N'utilisez PAS de balises <img> avec des URLs temporaires — utilisez des placeholders comme "https://via.placeholder.com/600x400" qui seront remplacés ensuite.
7. Le design doit être 100% responsive (mobile-first).
8. Utilisez les couleurs de la charte: vert foncé #1A3C34, doré #C9A84C, crème #F5F0E8.

STRUCTURE RECOMMANDÉE:
- En-tête percutant avec le nom du produit et un bénéfice clé
- Section "Pourquoi ce produit?" avec 3-4 arguments de vente
- Preuves sociales (témoignages, notes)
- Bouton CTA "Commander Maintenant" (href="{{CTA_LINK_1}}" data-cta-slot="1")
- Garanties (livraison, paiement à la livraison, échange)
- Un second bouton CTA en milieu de page (href="{{CTA_LINK_2}}" data-cta-slot="2")

GÉNÉREZ UNIQUEMENT le code HTML/Tailwind de la landing page (sans <html>, <head>, <body>).`;

export const GUIDE_ADMIN_CODE_IA = `GUIDE DE CRÉATION — MODE CODE IA

1. Copiez le prompt IA ci-dessus et collez-le dans Claude, ChatGPT ou Bolt.
2. Indiquez le nom du produit et ses caractéristiques à l'IA.
3. Copiez le code HTML généré par l'IA.
4. Collez-le dans le champ "Code HTML" ci-dessous.
5. Cliquez sur "Analyser les images" pour détecter les balises <img>.
6. Pour chaque image détectée, remplacez-la par une image du catalogue ou téléversez une nouvelle image.
7. Activez la landing page avec le bouton de publication.
8. Testez le rendu sur /lp/votre-slug`;

export const DIRECTIVES_CANVA = `DIRECTIVES VISUELLES — MODE IMAGE CANVA

DIMENSIONS RECOMMANDÉES:
- Visuel Desktop: 1920x1080 px (format horizontal/paysage)
- Visuel Mobile: 1080x1920 px (format vertical/portrait)

CONSIGNES DE LISIBILITÉ:
- Texte minimum 24px pour le mobile (lectible sur petit écran)
- Contraste suffisant entre texte et fond
- Boutons visuels clairs avec call-to-action lisible
- Logo de la marque visible en haut

DÉCOUPE:
- Laissez des zones vides en haut, milieu et bas pour les boutons CTA natifs
- Le formulaire de commande sera ajouté automatiquement en bas de page
- Ne incluez PAS de bouton dans l'image Canva — les boutons natifs seront superposés`;

export const GUIDE_ADMIN_CANVA = `GUIDE DE CRÉATION — MODE IMAGE CANVA

1. Créez votre design sur Canva (ou utilisez un template).
2. Exportez en PNG haute qualité deux versions:
   - Version Desktop (1920x1080 horizontal)
   - Version Mobile (1080x1920 vertical)
3. Téléversez les deux images dans les zones ci-dessous.
4. Configurez les 3 boutons CTA (activer/désactiver, personnaliser le texte).
5. Activez la landing page avec le bouton de publication.
6. Testez le rendu sur /lp/votre-slug`;
