# PROJECT_MAP.md — Abaya Collection Catalogue

## [TECH_STACK]
| Composant | Version | Notes |
|---|---|---|
| Runtime | Bun latest | Gestionnaire de paquets + runtime |
| Framework | Next.js 16.2.9 (App Router, Turbopack) | Routes : /, /mentions-legales, /politique-de-confidentialite, /conditions-generales |
| Langage | TypeScript 5 | Strict mode désactivé |
| Base de données | SQLite (local) / PostgreSQL (Vercel) | Switch automatique via scripts/switch-provider.js |
| ORM | Prisma 6.11+ | Schema : DataSource/Column/Row dynamique |
| UI | Tailwind CSS 4 + shadcn/ui (New York) | 50+ composants Radix |
| State | Zustand 5 (client) | localStorage persistence |
| i18n | Custom (dictionaries.ts) | FR/EN/AR — 418 clés × 3 locales |
| Auth | Custom cookie (admin_token) | AdminUser + AdminSession |
| Animation | Framer Motion 12 | Transitions produit |
| Images | Sharp + Google Drive proxy | ImageProxy via API |
| Upload | POST /api/upload (hybride) | Supabase Storage → fallback local `public/uploads/` |
| Déploiement | Vercel (auto depuis GitHub) | Projet : abaya-collection-catalogue-9dum |
| ⚠️ next-intl | ^4.3.4 installé mais **INUTILISÉ** | Aucune config, aucun middleware — ne pas supprimer (hors scope) |

## [SYSTEM_FLOW]

### Flux 1 : Chargement du catalogue public
1. Utilisateur visite `/` → `page.tsx` (client-side)
2. `CatalogPreview` monté → Zustand lit `catalog` (cache localStorage)
3. Si pas de cache → `GET /api/catalog` → sections + config
4. Pour chaque section visible → `GET /api/datasources/{id}?mode=meta` (colonnes) + `GET /api/datasources/{id}/rows?limit=200` (lignes)
5. `ColorMap` chargée → `GET /api/colormap` → résolution hex des color dots
6. Rendu : chaque carte produit lit `config.titleColumn`, `config.priceColumn`, `config.colorColumn`

### Flux 2 : Saisie couleur (WRITE-side)
1. Admin ouvre DataTable → `ColorCell` sur une ligne
2. Toggle/select couleurs → mise à jour locale `rowData[colSlug]`
3. `PUT /api/datasources/{id}/rows/{rowId}` → persistance en base
4. Alternatives : ColorSourceModal (import masse) ou quick-add (ColorMap + auto-select)

### Flux 3 : Changement de langue
1. Utilisateur clique Globe → sélection FR/EN/AR
2. `useAppStore.setClientLocale(loc)` → Zustand + localStorage
3. `useClientTranslation` re-render → `t()` utilise le nouveau locale
4. `ThemeInjector` update `<html dir="rtl|ltr">` + `<html lang="fr|en|ar">`

### Flux 4 : Tunnel de commande (COD)
1. CTA "Commander" → `CheckoutPage` (formulaire nom/tél/ville/adresse)
2. `POST /api/orders` → création Order en base
3. Redirect `/merci?order_id={id}` → recap + bouton "Retour au catalogue" (`href="/"`)

### Flux 5 : Upload logo/favicon (admin)
1. Admin clique bouton upload dans SettingsPillar → `ImageUpload` / `ImageUploader` composant
2. `POST /api/upload` (FormData avec fichier image)
3. **Branche A** (SUPABASE_URL + SUPABASE_ANON_KEY présentes) → upload vers bucket `assets/branding/` → URL publique Supabase
4. **Branche B** (clés absentes ou upload Supabase échoué) → fallback local `public/uploads/` → URL relative `/uploads/{filename}`
5. Réponse format strict : `{ data: { url, filename } }` → composant UI met à jour le champ settings

## [ARCHITECTURE]

```
prisma/schema.prisma
  ├─ Pillar 1 DATA
  │   ├─ DataSource { name, slug, sourceType, columns[], rows[] }
  │   ├─ Column { name, slug, type (TEXT|COLOR|CURRENCY|RELATION|…), config Json, visible }
  │   ├─ Row { data Json } ← couleurs dans data.__colors__
  │   └─ Relation { sourceTable, targetTable, sourceColumn, targetColumn }
  ├─ Pillar 2 LAYOUT
  │   ├─ Catalog { name, slug, published, sections[] }
  │   ├─ Section { config { dataSourceId, titleColumn, priceColumn, colorColumn, … } }
  │   └─ Component { type, config Json }
  ├─ Pillar 3 SETTINGS
  │   ├─ CatalogSettings { language, currency, primaryColor, whatsappNumber, … }
  │   ├─ ColorMap { name, slug, hex, visible, isActive }
  │   ├─ Category { slug, label, translations, subCategories[] }
  │   └─ Settings { key-value }
  ├─ AUTH
  │   ├─ AdminUser { email, role, passwordHash, googleSub }
  │   ├─ AdminSession { token, expiresAt }
  │   └─ AuditLog { action, entity, details }
  ├─ ORDERS
  │   └─ Order { productId, customerName, productColor, productSize, status }
  └─ GOOGLE
      └─ GoogleSession { accessToken, refreshToken, tokenExpiry }

src/
  ├─ app/
  │   ├─ page.tsx                    # Route / — Server Component (SEO) → renders HomeClient
  │   ├─ layout.tsx                  # Root layout — metadataBase + favicon + GTM removed (Zaraz)
  │   ├─ sitemap.ts                  # Dynamic sitemap.xml via Prisma + resolveAllProducts() + revalidate=3600
  │   ├─ robots.ts                   # Dynamic robots.txt via Prisma
  │   ├─ mentions-legales/page.tsx   # Mentions légales (SSR, charte Or/Vert)
  │   ├─ politique-de-confidentialite/page.tsx  # Politique confidentialité (SSR)
  │   ├─ conditions-generales/page.tsx          # Conditions générales (SSR)
  │   ├─ admin/page.tsx              # BuilderShell (admin)
  │   ├─ merci/page.tsx              # Post-commande → redirect / (dataLayer.push with SSR guard)
  │   ├─ product-meta/[slug]/        # SSR meta pour crawlers sociaux
  │   └─ api/                        # REST API complète
  │       ├─ datasources/[id]/        # CRUD + rows + columns + color-import
  │       ├─ catalog/                 # Sections + settings
  │       ├─ colormap/                # ColorMap CRUD + lookup + seed
  │       ├─ orders/                  # Commandes COD
  │       ├─ auth/                    # Login/register/admins
  │       ├─ google/                  # OAuth + Sheets + image-proxy
  │       ├─ upload/                   # POST upload hybride (Supabase + fallback local)
  │       └─ translate/               # Traduction LLM via z-ai-web-dev-sdk
  ├─ components/
  │   ├─ preview/
  │   │   ├─ CatalogPreview.tsx       # Catalogue public (1704 lignes)
  │   │   ├─ ProductPage.tsx          # Fiche produit + CARROUSEL CUSTOM
  │   │   ├─ CheckoutPage.tsx         # Tunnel COD
  │   │   └─ SocialStickyTickets.tsx  # Boutons flottants
  │   ├─ data/
  │   │   ├─ DataTable.tsx            # Table admin principale
  │   │   ├─ ColorCell.tsx            # WRITE couleurs (sélecteur + import)
  │   │   └─ ColorSourceModal.tsx     # Import masse couleurs
  │   ├─ layout/
  │   │   └─ SectionConfigurator.tsx  # Configure colorColumn, titleColumn…
  │   ├─ settings/
  │   │   └─ ColorMapManager.tsx      # Gestion palette couleurs
  │   ├─ BuilderShell.tsx             # Shell admin 3 piliers
  │   ├─ ThemeInjector.tsx            # RTL/LTR + thème dynamique
  │   └─ LoginModal.tsx               # Auth admin
  └─ lib/
      ├─ i18n/
      │   ├─ dictionaries.ts          # 418 clés × 3 locales (1568 lignes)
      │   ├─ useClientTranslation.ts  # Hook catalogue public
      │   └─ useTranslation.ts        # Hook admin
      ├─ color-utils.ts               # resolveColorHex, normalizeCouleurKey
      ├─ cache.ts                     # FROZEN_MODE localStorage
      ├─ store.ts                     # Zustand store
      ├─ supabase.ts                  # Supabase clients (publique + admin) + STORAGE_BUCKET
      └─ db.ts                        # PrismaClient singleton
```

## [CHART_GRAPHIQUE]
- Or primaire : #C9A84C
- Vert forêt : #1A3C34
- Crème bg : #FAF8F5
- Beige : #F5F0E8
- Noir : #1A1A1A
- **PAS d'indigo/bleu**
- CSS Pivot : 6 variables maîtres (--pivot-brand, --pivot-gold, --pivot-surface, --pivot-text, --pivot-danger, --pivot-whatsapp)

## [VERIFIABLE_GOALS]

| # | Objectif V1 | Critère de succès mesurable | Statut |
|---|---|---|---|
| VG1 | Dictionnaire i18n complet | 418 clés × 3 locales = 1254 traductions ; 0 clé vide ; 0 clé identique FR=AR (sauf placeholders techniques) | ✅ Vérifié (418×3, node) |
| VG2 | Bascule FR↔EN↔AR fluide | Clic langue → re-render immédiat ; `<html lang>` et `<html dir>` mis à jour ; pas de flash | ✅ Vérifié (browser: dir="rtl", lang="ar") |
| VG3 | RTL Arabe — Flèches carrousel inversées | Flèche gauche → image suivante ; flèche droite → image précédente ; positions visuelles inversées | ✅ Code vérifié (CSS: html.rtl .carousel-arrow.left/right swapped) |
| VG4 | RTL Arabe — Swipe inversé | Glisser à gauche → image précédente ; glisser à droite → image suivante | ✅ Code vérifié (rtl ? diff < 0 : diff > 0) → goNext() |
| VG5 | RTL Arabe — Clavier inversé | ArrowLeft → next ; ArrowRight → prev | ✅ Code vérifié (if (rtl) goNext() else goPrev()) |
| VG6 | RTL Arabe — Track carrousel | translateX inversé en RTL ; images défilent de droite à gauche | ✅ Code vérifié (rtl ? '' : '-' prefix) |
| VG7 | RTL Arabe — Pas de régression LTR | Retour en FR/EN → comportement carrousel inchangé | ✅ Vérifié (browser: dir="ltr" after FR switch) |
| VG8 | Upload logo/favicon fonctionnel | POST /api/upload → 200 + `{ data: { url, filename } }` ; validation MIME + taille ≤ 2MB ; fallback local si Supabase absent | ✅ Vérifié (curl: SVG upload → 200, no-file → 400, 3MB → 400, text/plain → 400) |
| VG9 | Catégories traduites dans le footer | Footer Col 3 utilise `resolveT(cat.translations, cat.label)` ; bascule FR↔EN↔AR vérifiée | ✅ Vérifié (prod: EN footer → Set/Dress/Accessories au lieu de Ensemble/Robe/Accessoires) |
| VG10 | Bouton refresh admin verrouillé pendant sync | `isRefreshing` state → bg-gray-100 fixe + pointer-events-none + spinner ; souris quitte = pas de saut visuel | ✅ Code vérifié (className conditionnel + animate-spin) |
| VG11 | Logo footer visible sur fond sombre | `filter: brightness(0) invert(1)` sur img logo → inversion couleurs pour visibilité | ✅ Vérifié (prod: filter appliqué, logo 100×30px visible) |
| VG12 | Double parcours WhatsApp + Landing | CTA desktop+mobile : `isLandingMode ? <button COD> : <a whatsappLink>` | ✅ Vérifié (prod: WhatsApp=`<a href="wa.me/...">`, Landing=`<button>`) |
| VG13 | Lien de partage dynamique | Input + copyShareLink incluent `?mode={conversionChannel}` | ✅ Vérifié (code: `${origin}?mode=${channel}`) |
| VG14 | CTA WhatsApp vert (#25D366) | `<a>` WhatsApp : backgroundColor #25D366 ; `<button>` Landing : noir inchangé | ✅ Vérifié (prod: rgb(37,211,102) vs rgba(0,0,0,0.89)) |
| VG15 | Colonne Couleur native garantie backend | Après suppression catalogue + ré-import CSV/Google : colonne Couleur présente ; 6 colonnes natives garanties ; CSV "Couleur"/"Color" mappé vers `__colors__` | ✅ Vérifié (lint 0 erreur, merge 43f9ab3) |
| VG16 | GTM supprimé → Cloudflare Zaraz | `import Script` orphelin supprimé ; `GTM_ID` const supprimée ; blocs `<Script>` et `<noscript>` supprimés ; `NEXT_PUBLIC_GTM_ID` retiré de deploy-v2.sh ; dataLayer.push() conservés avec garde SSR `typeof window !== 'undefined'` | ✅ Vérifié (lint 0 erreur, E2E browser) |
| VG17 | SEO dynamique serveur | page.tsx = Server Component ; `generateMetadata()` lit `__seo_metadata__` depuis Settings DB avec fallback statique ; metadataBase résolu dynamiquement ; OG + Twitter Cards + Canonical générés ; sitemap.ts + robots.ts natifs | ✅ Vérifié (E2E: og:title, og:image, twitter:card, canonical, robots meta tous présents) |
| VG18 | Pages réglementaires accessibles | /mentions-legales, /politique-de-confidentialite, /conditions-generales rendent en SSR avec metadata ; footer catalogue lien vers ces routes (plus de `href="#"`) ; charte Or/Vert respectée (CSS pivots uniquement) ; textes officiels V5 intégrés | ✅ COMPLÉTÉ & VALIDÉ V5 |
| VG19 | i18n pages réglementaires | Dictionnaire de traduction (`legal-translation-dictionary.json`) : 118 clés × 3 locales (FR + EN + AR complets, 0 TRANSLATE_PENDING) ; sources officielles V5 EN/AR intégrées ; préfixes `mentions.`, `privacy.`, `cgv.`, `legal.` ; fusionné PR #4, déployé sur main | ✅ DÉPLOYÉ — PR #4 MERGED |
| VG20 | Intégration i18n pages légales | 118 clés injectées dans `dictionaries.ts` ; 3 pages converties en composants client dynamiques via `useClientTranslation` ; `LegalPageLayout` gère RTL (`dir`) + footer i18n ; `\n` rendus en `<br/>` ; metadata SSR préservée ; PR #5 fusionnée | ✅ DÉPLOYÉ — PR #5 MERGED |
| VG21 | Tunnel WhatsApp dynamique | `buildWhatsappLink()` partagé (`src/lib/whatsapp.ts`) ; `whatsappLink` converti en `useMemo` dépendant de `[selectedColor, selectedSize, quantity, title, price, imageUrl]` ; message pré-rempli inclut `{product}`, `{color}`, `{size}`, `{quantity}`, `{price}`, `{image}` ; image produit (URL directe Google Drive `resolveDirectImageUrl(800)`) injectée pour aperçu WhatsApp ; `CatalogPreview.buildConversionLink()` refactorisé pour utiliser le shared util ; tunnel COD (`CheckoutPage.onCheckout`) inchangé ; 3 clés i18n singulières ajoutées (`product.color`, `product.size` FR/EN/AR) ; logique 3-cas (placeholders / custom greeting + structured body / default greeting) ; PR #6 + #7 fusionnées, vérifié E2E en production | ✅ DÉPLOYÉ — PR #6+7 MERGED |
| VG22 | WhatsApp Smart Logic multilingue | `resolveGreeting()` dans `whatsapp.ts` — résolution stricte `conversionMessages[locale]` → fallback hardcoded dans la langue du visiteur (NO FR fallback pour AR/EN) ; validation Gardien `handleWhatsappCtaClick` sur 2 CTAs WhatsApp (preventDefault + alert si `hasMissingVariant`) ; éditeur admin multilingue (onglets FR/EN/AR) dans SettingsPillar ; RadioGroup `defaultCatalogLanguage` dans onglet Général ; persistance hybride Cookie + LocalStorage (`setClientLocale` étendu) ; SSR `<html lang/dir>` dynamique via `cookies()` dans `layout.tsx` ; seed premier visiteur depuis DB dans `HomeClient.tsx` ; 6 clés i18n `whatsapp.greetingA/B` (FR/EN/AR) + 4 clés admin ; `SocialStickyTickets.tsx` NON touché (périmètre respecté) ; branche `evolue` merged puis supprimée | ✅ DÉPLOYÉ — BRANCHE EVOLUE MERGED |
| VG23 | Admin Orders — 4ème Pilier | `OrdersPillar` (KPI cards + table + filters + detail drawer) ; `OrdersTable` (@tanstack/react-table pattern + shadcn Table + Tabs status filter + search debounce) ; `OrderDetailSheet` (shadcn Sheet right-side + status update form + sonner toast) ; `OrderStatusBadge` (5 variants : pending/confirmed/shipped/delivered/cancelled) ; `PATCH /api/orders/[id]` (whitelist validation + `getCurrentAdmin()`) ; route `/admin/orders` (auth guard + redirect `?view=builder&pillar=orders`) ; `Pillar` type étendu (`'orders'`) ; BuilderShell 4ème icône ShoppingBag ; 34 clés i18n `adminOrder.*` × 3 locales ; zéro dépendance ajoutée (shadcn/ui + tanstack-table + date-fns existants) ; `CheckoutPage.tsx` NON touché (périmètre respecté) ; branche `evolue-admin-orders` merged puis supprimée | ✅ DÉPLOYÉ — BRANCHE MERGED |
| VG24 | Sécurisation API Orders (Plan V2) | Middleware : `/api/orders` ajouté à `ADMIN_WRITE_ROUTES` + exemption `isPublicOrderCreation` (POST client COD) ; Handler GET liste : `getCurrentAdmin()` — bloque PII anonyme (401) ; Handler PATCH : `getCurrentAdmin()` — bloque update anonyme (401) ; GET `[id]` reste public (page Merci, cuid entropy) ; POST reste public (tunnel COD) ; Defense in depth : middleware Guard #4 + auth handler ; Tests curl validés : POST=201, GET_liste=401, PATCH=401, GET_id=404 (route accessible) ; branche `evolue-admin-orders` merged puis supprimée | ✅ DÉPLOYÉ — BRANCHE MERGED |
| VG25 | Orders V4.1 — Refonte complète | i18n : 70 clés `adminOrder.*` (FR/EN/AR) + migration `order.*`→`adminOrder.*` (fix bug clés brutes) ; Prisma : `OrderHistory` (shadow table) + `Order.isDeleted` + `Order.deletedAt` (soft delete) ; Backend : GET search ILIKE + archived filter ; PATCH étendu (10 champs) + snapshot OrderHistory ; GET `/api/orders/[id]/history` ; POST restore field ; POST archive (delivered/confirmed only) ; POST restore bulk ; DELETE purge (10-day rule) ; GET export CSV (2 vues) ; Frontend : 7ème carte Dashboard + debounce corrigé (useRef) + Tabs active/archived + checkboxes + inline edit double-clic (pattern DataTable.tsx) + DataQualityIcon (vide/zéro/faible) + OrderDetailSheet historique diff rouge/vert + restauration + purge AlertDialog confirmation ; branche `feature/orders-refactor` merged puis supprimée | ✅ DÉPLOYÉ — CLÔTURÉ |
| VG28 | Catalog UI & Reorder — Carte épurée + Suprématie BDD | Carte produit : `group` sur `<article>`, bouton COMMANDER noir (#000) révélé au survol (`opacity:0` → `group-hover:opacity:100` + `focus-within` + `@media (hover:none)`), suppression badge images (🖼️ N) + badge Nouveau top-left ; badge réduction `-X%` DÉPLACÉ de la zone prix (bordeaux #800020) vers top-left image en corail adouci (#EF4444, `Math.round`) — prix barré conservé en zone prix ; bandeau statut « Pied d'image » italic + Sentence case (FR/AR/EN, null pour Courant) via `status-config.ts` ; Sort vitrine = `row.order` UNIQUE (purge priorité Nouveau rank-0 + tri stock) ; bouton Réorganiser admin (menu colonnes numériques non-natives, tri ascendant 1→N, persistance `PATCH /rows/batch` étendu au champ `order`) ; réutilise `discount-utils.ts` existant (DEBT-9 `computeDiscount`/`getCompareAtPrice`) ; correction bug latent batch route (`JSON.parse(r.data)` → `readRowData()` défensif, alignée sur le pattern déjà utilisé par la route single-row) ; vérifié E2E navigateur. **Audit** (commit `588d014`) : 5 axes validés, non-régression confirmée (fichiers vitaux + schema.prisma intacts), `eslint` 0 erreur/warning, `tsc` 0 nouvelle erreur. Note mineure non-bloquante : badge réduction ne flip pas en RTL (`left: 8px` fixe). *Renuméroté VG26→VG28 (collision d'ID avec la mission Sitemap dynamique déjà existante sous VG26).* | ✅ DÉPLOYÉE EN PRODUCTION — branche `feature/catalog-ui-and-reorder` mergée puis supprimée |
| VG29 | Status Badge Ribbon Redesign — Ruban épuré + 6 statuts BDD | **A. Blocage BDD résolu** : `__statut__` admin dropdown (DataTable.tsx) passe de 2 options codées en dur (Nouveau/Courant) à 7 options dynamiques via `STATUS_OPTIONS` (Courant + 6 statuts marketing) ; `resolveAdminStatusBadge()` génère le badge coloré dynamiquement (bg = couleur du statut, texte blanc) ; route `PUT /api/datasources/[id]/status` validée contre `STATUS_OPTIONS` (accepte Nouveauté/Stock limité/Offre limitée/Top Vente/Livraison Gratuite/Prix Choc/Courant, rejette le reste en 400) ; auto-compute `computeStatut()` → `'Nouveauté'` (au lieu de `'Nouveau'`) ; `config.options` synchronisé dans 4 routes (columns/import/google-sync×2/status). **B. Ruban épuré** : bandeau 100% largeur → ruban partiel bottom-left (`max-width: 60%`, `border-top-right-radius: 6px` = rounded-tr-md, 3 autres coins droits) ; hauteur ultra-ajustée au texte (`padding: 1.5px 12px`, pas de hauteur fixe) ; typographie `12px` (text-xs) + `font-weight: 600` (semibold) + `italic` + `leading-tight` (1.25) + `text-transform: none` (Sentence case). **Terminologie** : « Nouveau » officiellement remplacé par « Nouveauté » dans tout le système de statuts (status-config.ts + DataTable + DataPillar + status API). **Palette révisée** : Nouveauté=#06B6D4 (cyan), Stock limité=#F97316 (orange corail), Offre limitée=#EF4444 (rouge carmin), Top Vente=#EAB308 (jaune solaire), Livraison Gratuite=#10B981 (vert émeraude), Prix Choc=#D946EF (violet magenta). Alias-aware : legacy `'Nouveau'` résolut vers `'Nouveauté'` (rétrocompatibilité BDD existante). Filtre `is_nouveau` + tri `__statut__` alias-aware dans DataPillar. Vérifié E2E navigateur (6 rubans + Courant null) + API (PUT Nouveauté=200, PUT Bogus=400). **Audit** (commit `866787a`) : 4 axes validés (CSS exacte, dropdown 7 options, source unique STATUS_OPTIONS×3 routes, non-régression), aucune anomalie détectée, `eslint` 0 erreur/warning, `tsc` 0 nouvelle erreur. Bonus : filtre/tri `__statut__` alias-aware confirmés (rétrocompatibilité sans script de migration). | ✅ DÉPLOYÉE EN PRODUCTION — branche `feature/status-badge-ribbon-redesign` mergée puis supprimée |
| VG30 | Catalog Hide CTA Mobile — Masquage responsive du bouton COMMANDER | Bouton « COMMANDER » (`.product-card-hover-cta`) masqué totalement sur petits écrans (`< 768px` / mobile + tablettes compactes) via `@media (max-width: 767px) { display: none }` dans `globals.css`. `display:none` retire le bouton de l'arbre de rendu (non-interactif, aucune place réservée) et l'emporte sur les règles `opacity` existantes (`@media (hover:none) { opacity:1 }` et `group-hover:opacity:100`) — le CTA est donc invisible sur mobile quel que soit le mode hover. Desktop (≥ 768px) conserve exactement le comportement VG28 : `opacity:0` au repos → `group-hover:opacity:100` au survol. **Aucun changement JSX/React** — masquage CSS-only (le composant reste dans le DOM, aucune régression du render). **Aucun impact sur les autres éléments** : ruban de statut (Nouveauté, etc.), badge de réduction (-X%), et prix restent visibles sur tous les écrans. Vérifié E2E navigateur à 4 largeurs : 375px (display:none ✅), 767px (display:none ✅), 768px (display:block ✅), 1280px (display:block ✅). **Audit** (commit `dc3ef03`) : 3 axes validés, cascade CSS vérifiée précisément (règle mobile déclarée après `hover:none`, gagne à spécificité égale par ordre de source), ruban statut et badge réduction confirmés non impactés, non-régression confirmée, `eslint` 0 erreur/warning, `tsc` inchangé (84 erreurs préexistantes, aucun fichier TS touché). | ✅ DÉPLOYÉE EN PRODUCTION — branche `feature/catalog-hide-cta-mobile` mergée puis supprimée |
| VG31 | Status Ribbon AR Harmony — Harmonisation des étiquettes de statut | **A. Remplacement Livraison Gratuite → Trend** : statut `livraison_gratuite` renommé `trend` ; `bddValue: 'Livraison Gratuite'` → `'Trend'` ; `fr: 'Trend'`, `ar: 'ترند'`, `en: 'Trend'` ; aliases rétrocompatibles (`'livraison gratuite'`, `'توصيل مجاني'`, `'free shipping'`) conservés — les rows BDD existantes avec `'Livraison Gratuite'` résolvent automatiquement vers Trend. **B. Permutation des couleurs** : Nouveauté `#06B6D4` (cyan) → `#10B981` (vert émeraude) ; Trend `#10B981` (vert) → `#06B6D4` (cyan). Aucun nouveau code couleur créé — palette existante permutée. **C. Prix Choc AR** : `ar: 'تخفيض استثنائي'` → `ar: 'عرض خيالي'` (plus court, harmonieux) ; ancien label AR conservé comme alias. Autres statuts inchangés : Nouveauté (Nouveauté/جديد), Stock limité (كمية محدودة), Offre limitée (عرض محدود), Top Vente (الأكثر مبيعاً). **D. Harmonisation CSS** : `.product-card-status-band` `min-width: 88px` ajouté (rallonge les étiquettes à mot unique — Trend, ترند, Nouveauté, جديد — pour s'aligner sur le gabarit moyen des étiquettes à deux mots ~88-97px) ; `max-width: 60%` → `55%` (plus contenu, évite le débordement sur l'image). Vérifié E2E navigateur FR + AR : 7 rubans (6 statuts + 1 rétrocompatibilité Livraison Gratuite→Trend), couleurs exactes (Nouveauté=green, Trend=cyan), largeurs harmonisées (Trend 58px→88px, ترند 88px, جميع الـ AR labels ≤ 98px), `dir=rtl` + `lang=ar` confirmés en AR. | ⏳ EN ATTENTE D'AUDIT — branche `feature/status-ribbon-ar-harmony` |
| VG32 | Trust Guarantees Section — Section Garanties de Confiance (Vitrine + Admin) | **Volet Vitrine** (`TrustGuaranteesSection.tsx`) : 4 cartes garanties (Livraison Gratuite, Paiement à la Livraison, Garantie Qualité, Échange Facile) injectées au-dessus du `<footer>` dans `CatalogPreview.tsx`. Arrière-plan transparent (s'intègre sur crème #FAF8F5, aucun conteneur noir). Ligne supérieure séparatrice centrée (~65% largeur, gold-tinted `rgba(201,168,76,0.35)`). Icônes lucide-react (Truck, Banknote, ShieldCheck, RefreshCw) au contour fin doré (`#C9A84C`, `strokeWidth:1.5`) dans cercle vitré glassmorphism (`rgba(255,255,255,0.45)` + `backdrop-filter:blur(6px)` + bordure or `rgba(201,168,76,0.55)`). Titres anthracite doux (`#3D3D3D`, pas de noir pur). Tooltip bulle fluide au-dessus au survol/clic/focus (glassmorphism `rgba(255,255,255,0.92)` + `blur(8px)`, transition 300ms, flèche pointant vers le bas). Grille responsive : 1 col mobile / 2 cols tablette (`sm:`) / 4 cols desktop (`lg:`). Fallback : champs admin vides → dictionnaire `trust.*`. `isVisible=false` → rendu `null` (aucun espace vide). **Volet Admin** (`TrustGuaranteesPillar.tsx`) : 8ème onglet « Confiance » (`value="trust"`) dans `SettingsPillar.tsx` (grid-cols-7→8, icône `ShieldCheck`). Interrupteur `Switch` `isVisible` (Afficher/Cacher). Sélecteur onglets FR/EN/AR (pattern WhatsApp). 4 garanties × 2 champs (Titre `Input` + Description `Textarea`), `dir="rtl"` sur champs AR. Placeholder = texte par défaut du dictionnaire. Bouton Enregistrer (PUT `/api/catalog/settings`). **BDD** : `trustGuarantees Json? @map("trust_guarantees")` sur `CatalogSettings` (Prisma + `db:push`). **API** : `trustGuarantees` ajouté à `allowedFields`. **Types** : `TrustGuaranteesConfig` + `GuaranteeKey` + `TrustGuaranteeItem` + `SettingsTab` étendu `'trust'`. **Dictionnaire** : 8 clés `trust.*` × 3 locales (24 clés) — textes officiels du mandat. Vérifié E2E vitrine (4 titres, 4 colonnes desktop, icônes or, cercles glassmorphism, séparateur gold, bg transparent, au-dessus du footer). `eslint` 0 erreur, `tsc` 0 erreur dans `src/`. | ⏳ EN ATTENTE D'AUDIT — branche `feature/trust-guarantees-section` |
| VG33 | Hybrid Media Architecture — Drive + CDN, Picker, Smart Sync, Médiathèque | **Pillar 1 — Centralisation** (`src/lib/media-utils.ts`) : `DRIVE_FILE_ID_REGEX` universelle + `extractDriveFileId()` + `detectImageSource()` ('drive'|'cdn'|'unknown') + `resolveHybridImageUrl()` + `resolveProxyUrl()`. Déduplication : `CatalogPreview.tsx` + `ProductPage.tsx` refactorisés pour importer depuis `media-utils` (suppression ~120 lignes dupliquées). **Pillar 2 — Drive Picker** (`GoogleDrivePicker.tsx`) : modale officielle Google Drive API (GIS + Picker script tags dynamiques), multi-select Ctrl+Clic, filtre mime images uniquement. Injecté dans le menu 3-points de chaque colonne IMAGE/IMAGE_ARRAY de `DataTable.tsx`. Route `POST /api/catalog/media/picker-sync` : injecte les URLs Drive dans les cellules vides (IMAGE: 1 par cellule vide; IMAGE_ARRAY: append), upsert MediaAsset (status='drive'). Route `GET /api/google/picker-token` : token OAuth depuis session Google stockée. **Pillar 3 — Smart Sync CDN** (`POST /api/catalog/media/cdn-migrate`) : algorithme d'unicité (vérifie `MediaAsset` si file_id déjà attribué à un autre `rowId` → bloqué + alerte conflit), throttle 100ms entre requêtes Drive, conversion Sharp `.webp` (quality 82), upload Supabase Storage (fallback local `/public/uploads/media/`), update `Row.data` avec CDN URL + MediaAsset status='cdn'. Bouton colonne « ☁️ Exporter vers le CDN » + bouton bulk « ☁️ Exporter vers le CDN » dans la barre de sélection multiple. **Pillar 4 — MediaAsset model** : Prisma `MediaAsset` (fileId, rowId, dataSourceId, columnSlug, originalUrl, cdnUrl, status, fileName, mimeType, sizeBytes) + `@@unique([fileId, columnSlug])` (unicité par colonne) + 3 index. Relation `Row.mediaAssets[]`. `db:push` OK. **Pillar 5 — Médiathèque** (`MediaLibrary.tsx`) : grille stricte 3 colonnes (N° Ordre Système BDD | Nom Produit | Grille d'Images), badges source Drive/CDN, bouton suppression physique CDN (safety-check : bloque si URL encore référencée par un Row). Filtre « 🔍 Afficher les images orphelines » (CDN sans référence active). Routes `GET /api/catalog/media/list` (entries + orphansOnly) + `POST /api/catalog/media/delete` (409 si référencé). Bouton « Médiathèque » dans la barre d'outils DataPillar. **Dictionnaire** : 21 clés `media.*` × 3 locales (63 clés). Vérifié : `eslint` 0 erreur, `db:push` OK, media-utils unit test (6 URLs : Drive×3 formats → fileId+hybrid+proxy corrects, CDN×2 → passthrough, unknown → passthrough), E2E vitrine 12 cartes + trust section + footer (non-régression refactor). **Audit** (commit `17fe318`) : 4 axes validés (Picker restreint, grille 3 colonnes exacte, 4 routes fonctionnelles, non-régression fichiers vitaux/schema additif confirmée). Correction : `tsc` révèle en réalité 3 nouvelles erreurs (non 0 comme indiqué ci-dessus) — narrowing TS sur `window.google.picker` après `await` dans `GoogleDrivePicker.tsx` (code runtime correct, limite de TypeScript à travers une closure de Promise ; non-bloquant car `next.config.ts` a `ignoreBuildErrors: true`). 2 réserves supplémentaires identifiées : (1) `picker-sync` n'applique pas le même contrôle d'unicité cross-produit que `cdn-migrate` (upsert inconditionnel vs vérification+blocage) — à corriger en suivi ; (2) les 63 clés i18n `media.*` ajoutées ne sont utilisées nulle part (`MediaLibrary.tsx`/`GoogleDrivePicker.tsx` codent leurs libellés en dur en FR) — travail d'i18n préparé mais non branché. Aucune de ces réserves n'est bloquante pour la production. | ✅ DÉPLOYÉE EN PRODUCTION — branche `feature/hybrid-media-architecture` mergée puis supprimée |
| VG33.2 | Media Actions — Unlink/Relink/Delete + Drive Picker Universel + Sélection Multiple | Résout 4 blocages identifiés par l'audit post-VG33 : (A) **Blocage 409 supprimé** : la route `DELETE` ne bloque plus si l'image est référencée — elle retire d'abord l'URL de `Row.data` (unlink automatique) PUIS supprime le fichier physique CDN + le record MediaAsset. (B) **3 actions distinctes** : `POST /api/catalog/media/unlink` (casse le lien, fichier CDN conservé, `rowId=null` + `originalRowId` préservé, `status='orphan'`) ; `POST /api/catalog/media/relink` (restaure le lien via `originalRowId`, réinjecte l'URL CDN dans `Row.data`, `rowId=originalRowId` + `status='cdn'`, safety-check unicité 409) ; `POST /api/catalog/media/delete` (unlink + delete physique + delete record). Les 3 routes supportent le mode bulk (`items[]`). (C) **Drive Picker universel** : le bouton « 📁 Importer via Drive Picker » est désormais visible sur TOUTES les colonnes non-natives (pas seulement IMAGE/IMAGE_ARRAY) — si la colonne est TEXT, le Picker utilise le mode IMAGE_ARRAY (append) par défaut. (D) **Sélection multiple Médiathèque** : `MediaLibrary.tsx` refondue avec checkbox par image + checkbox select-all (en-tête) + checkbox par ligne + barre d'outils bulk (Casser le lien / Restaurer le lien / Supprimer). Boutons d'action par image (hover) : Unlink (si lié), Relink (si orpheline), Delete (toujours). Badges « orpheline » sur les images déliées. **Prisma** : `MediaAsset.rowId` devient `String?` (optional) + `onDelete: SetNull` (au lieu de Cascade) + `originalRowId String?` ajouté (mémoire du produit d'origine pour Relink 100% exact) + `status` étendu `'orphan'`. `db:push` OK. **Route list** : inclut désormais `mediaAssetId`, `originalRowId`, `isLinked` par image + entries orphelines intégrées (rowId='orphan'). Vérifié : `eslint` 0 erreur, `db:push` OK, API routes 401 (auth), E2E vitrine non-régression (trust section + footer). | ✅ DÉPLOYÉE EN PRODUCTION — branche `feature/vg332-media-actions` mergée |
| VG33.3 | CDN Gallery Cleanup — JSON format, dédoublonnage cross-colonnes, scanner bucket, réassociation auto | Résout 4 bugs identifiés par l'audit infrastructure CDN : (A) **Corruption carrousels/galeries** : `cdn-migrate/route.ts` L.225 utilisait `newUrls.join(', ')` pour IMAGE_ARRAY → le composant React recevait une string au lieu d'un tableau JSON, le badge passait de « X images » à « 1 image » et le carrousel cassait. **Fix** : `JSON.stringify(newUrls)` pour IMAGE_ARRAY (format JSON strict). La route `list` parse désormais les 3 formats : tableau natif (Array.isArray), JSON string (startsWith('[')), et legacy comma-separated (fallback). (B) **Cécité Médiathèque au bucket CDN** : la Médiathèque ne lisait que la BDD — aveugle aux fichiers physiques fantômes sur le bucket. **Fix** : nouvelle route `GET /api/catalog/media/scan-bucket` qui liste le contenu réel du bucket (Supabase `storage.list('media')` ou local `fs.readdir`) + compare avec BDD (MediaAsset + Row.data URLs) → identifie les `ghostFiles` (sur bucket mais non suivis). Nouvelle route `POST /api/catalog/media/purge-ghosts` (supprime les fichiers fantômes sélectionnés). `MediaLibrary.tsx` : nouveau toggle « Bucket CDN » avec stats (total/suivis/fantômes) + liste fantômes avec checkbox + bouton « Purger les fantômes ». (C) **Dédoublonnage cross-colonnes** : `cdn-migrate` vérifiait `fileId+columnSlug` (per-column) → la même image dans une colonne IMAGE individuelle ET la galerie IMAGE_ARRAY déclenchait 2 téléchargements (40 pour 20 images). **Fix** : la vérification `existingAsset` ne filtre plus par `columnSlug` — si un `fileId` a déjà un `cdnUrl` (statut 'cdn') dans N'IMPORTE QUELLE colonne, l'URL CDN est réutilisée (status 'skipped', pas de re-téléchargement). Le vrai conflit (file_id lié à un AUTRE row) est vérifié séparément. (D) **Réassociation automatique au réimport** : quand l'utilisateur supprime et réimporte une table, les URLs Drive étaient réimportées telles quelles, déclenchant un re-téléchargement CDN complet. **Fix** : `import/route.ts` et `google/sync/route.ts` fetch tous les `MediaAsset` existants (status='cdn') pour ce datasource AVANT la création des rows, construisent un `cdnAssetMap` (fileId→cdnUrl), et remplacent les URLs Drive par les URLs CDN déjà existantes dans chaque cellule (string + array). Le compteur `cdnReassociated` est retourné dans la réponse import. Aucun re-téléchargement nécessaire. Vérifié : `eslint` 0 erreur, scan-bucket API 200, purge-ghosts API 401 (auth), E2E vitrine non-régression. | ✅ DÉPLOYÉE EN PRODUCTION — branche `feat/vg33-cdn-gallery-cleanup` mergée |
| VG33.4 | Bulk Delete Image Columns — Module de nettoyage sécurisé | Outil de suppression définitive (Hard Delete) en masse des colonnes d'images individuelles (type IMAGE) qui encombrent la BDD après migration vers galerie IMAGE_ARRAY (~70 colonnes fantômes). **Composant** `DeleteColumnsMenu.tsx` (nouveau) : Popover avec recherche + liste des colonnes IMAGE cochables + bouton « Tout sélectionner » + section « Verrouillées » (IMAGE_ARRAY + natives + 1ère colonne) grisée avec icône cadenas. **Sécurité visuelle** : les colonnes Galerie (IMAGE_ARRAY) et natives (`__title__`, `__colors__`, `__statut__`, etc.) sont listées mais désactivées (disabled) — seul le type IMAGE est cochable. **Modale de confirmation** : affiche le nombre exact de colonnes à supprimer + liste détaillée + avertissement irréversibilité. **Route API** `DELETE /api/datasources/[id]/columns/bulk-delete` : `prisma.column.deleteMany` avec triple sécurité server-side : (1) `type: 'IMAGE'` obligatoire, (2) `dataSourceId` vérifié, (3) `id: { in: columnIds }`. Retourne `{ deleted, skipped }`. **Intégration** : bouton « Nettoyer colonnes » (icône Trash2, rouge) dans la barre d'outils DataPillar, juste après le dropdown « Masquer » (ColumnVisibilityDropdown). Vérifié : `eslint` 0 erreur, API 401 (auth-protected, route reachable), E2E vitrine non-régression. | ✅ DÉPLOYÉE EN PRODUCTION — branche `feature/vg334-bulk-delete-columns` mergée |
| VG34 | Checkout UI Integration — Tunnel d'achat multi-produits + Design System PDP | **Cart Store** (`src/lib/cart-store.ts`) : Zustand store `useCartStore` avec `addItem`/`removeItem`/`updateQuantity`/`clearCart` + `isDrawerOpen` + `getTotalItems`/`getTotalPrice` + persistance localStorage (`abaya-cart`). **Cart Drawer** (`CartDrawer.tsx`) : slide-over droit (LTR) / gauche (RTL) avec liste articles (image + titre + couleur + taille + prix + qty picker + remove), total, bouton checkout. Design system PDP : bg `--bg-app: #fffefe`, boutons `--vert-deep: #14241E` + accent or `--gold-accent: #C5A059`, bordures `--border-soft: #EAE4DC`, prix `--price-charcoal: #121212` (Noir Charbonné). **5ème garantie** : `sav` (Service Client 24/7, icône Headphones) ajoutée à `GuaranteeKey` + `TrustGuaranteesSection` (grid lg:grid-cols-5) + `TrustGuaranteesPillar` (default config) + dictionnaire `trust.sav.*` (FR/EN/AR). **CSS design system** : 12 variables CSS ajoutées à `globals.css` (`--bg-app`, `--vert-deep`, `--vert-hover`, `--gold-accent`, `--gold-aura`, `--border-soft`, `--bg-btn-secondary`, `--badge-red`, `--text-main`, `--text-muted`, `--price-charcoal`). **Prix** : `.product-card-price` color `var(--client-text-subtitle)` → `var(--price-charcoal, #121212)`. **Prisma** : `OrderItem` model (orderId, productId, productTitle, productPrice, productColor, productSize, productQuantity, productImage) + relation `Order.items[]`. `db:push` OK. **i18n** : 69 clés ajoutées (23 × 3 locales) : `trust.sav.*` (2), `cart.*` (10), `checkout.*` (10), `sav.*` (4) — FR/EN/AR complets. **Header** : `CartHeaderButton` (bouton flottant vert deep avec badge or + icône ShoppingBag) visible quand cart non vide. Vérifié : `eslint` 0 erreur, `db:push` OK, E2E vitrine non-régression (trust section + footer). | ⏳ EN ATTENTE D'AUDIT — branche `feature/checkout-ui-integration` |
| FX26 | Fix régressions V4.1.2 — Recherche cross-DB | `GET /api/orders` : correction du `$queryRaw` — `is_deleted = ${archived ? 1 : 0}` (integer SQLite) remplacé par `is_deleted = ${archived}` (booléen paramétré, compatible SQLite driver auto-conversion + PostgreSQL natif) ; commentaire mis à jour ; branche `feature/full-fix-v4.1.2` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX27 | Fix régressions V4.1.1 — Archivage cancelled | `POST /api/orders/archive` : ajout de `'cancelled'` dans le tableau `{ in: ['delivered', 'confirmed', 'cancelled'] }` ; message d'erreur utilisateur mis à jour pour refléter les 3 statuts éligibles ; branche `fix/orders-v4.1.1` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX28 | Fix régressions V4.1.1 — Badge i18n | `OrderStatusBadge.tsx` : suppression du champ `labelKey` obsolète (clés `order.status*` non existantes), ajout d'une prop `label?: string` (pattern controlled label) ; appelants mis à jour : `OrdersTable.tsx` L.340 et `OrderDetailSheet.tsx` L.124 passent `t(\`adminOrder.status_\${status}\`)` ; branche `fix/orders-v4.1.1` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX29 | Fix régressions V4.1.2 — Checkbox + Event Bubbling | `OrdersTable.tsx` : correction racine — `onCheckedChange` reçoit `CheckedState` (pas un DOM Event), `e?.stopPropagation()` était un no-op silencieux ; fix : `stopPropagation()` déplacé sur `onClick` du `TableCell` parent (checkbox + header) + `onClick` sur les `div` éditables (double-clic) + `TableCell` du badge statut ; branche `feature/full-fix-v4.1.2` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX30 | Fix régressions V4.1.2 — Calcul CA double comptage | `OrdersPillar.tsx` L.87 : suppression de `* (o.productQuantity || 1)` dans le `reduce()` du CA — `productPrice` est déjà le prix total (unit × quantité), pas le prix unitaire ; branche `feature/full-fix-v4.1.2` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX31 | Fix régressions V4.1.2 — Pagination fenêtre glissante | `OrdersTable.tsx` : remplacement du bloc pagination basique (prev/next + texte "1/N") par pagination à fenêtre glissante `generatePageButtons(currentPage, totalPages, delta=2)` : numéros cliquables, ellipses "…" pour les écarts, page active en `variant="default"`, boutons prev/next avec `aria-label` i18n ; 6 clés i18n ajoutées (`adminOrder.prevPage/nextPage` × 3 locales) ; branche `feature/full-fix-v4.1.2` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX32 | Audit V4.1.3 — Sync recherche + archivage + DataQualityIcon | `OrdersTable.tsx` : ajout `useEffect(() => { setSearchInput(search); }, [search])` pour synchroniser l'input local quand le parent reset la recherche (changement d'onglet/filtre) ; extension DataQualityIcon à `productColor` et `productSize` ; `OrdersPillar.tsx` : ajout `setSearch('')` dans `onViewChange` et `onStatusFilterChange` ; `archive/route.ts` : retrait de `'confirmed'` du tableau d'éligibilité (`delivered` + `cancelled` uniquement) ; branche `fix/orders-v4.1.3` | ✅ CORRIGÉ — DÉPLOYÉ |
| FX-SearchUnified | V4.1.5 — Recherche robuste cross-DB unifiée | `GET /api/orders` : **réécriture complète du bloc de recherche**. La V4.1.3 prétendait une recherche ILIKE fonctionnelle mais était **CASSÉE en production** (bug latent) : `LOWER(CAST(${field} AS TEXT))` interpolait `field` (chaîne JS) comme paramètre bindé Prisma → SQL `near "[object Object]": syntax error` → 500 silencieux → recherche ne renvoyait rien. Second bug : `Prisma.join(conditions, Prisma.sql\` AND \`)` convertissait le séparateur `Prisma.Sql` en `[object Object]`. **Correctif V4.1.5** : (1) noms de colonnes écrits en littéral SQL dans le template (pas d'interpolation) ; (2) séparateur `Prisma.join(conditions, ' AND ')` (string) ; (3) `ESCAPE '\\'` + échappement des jokers LIKE (`%`, `_`) pour traitement littéral ; (4) recherche étendue de 6 à **11 champs** (ajout `product_color`, `product_size`, `product_quantity` via `CAST AS TEXT`, `status`, `created_at` via `datetime(x/1000,'unixepoch')`) ; (5) `LOWER()` des deux côtés du LIKE pour casse insensible ASCII (SQLite) / Unicode (PostgreSQL) ; (6) mapping snake_case → camelCase préservé. Auth `getCurrentAdmin()`, format `{data, error}`, pagination `offset`/`limit` et chemin sans-recherche (Prisma standard) **intacts**. Tests curl validés (11 scénarios HTTP 200) ; branche `fix/search-unified-v4.1.5` merged puis supprimée ; déployé sur Vercel (`my-project` + `abaya-collection-catalogue-9dum`, commit `1a6e5fb`, readyState READY/PROMOTED) | ✅ DÉPLOYÉ ET EN PRODUCTION |
| FIX-Upload | Restauration route `/api/upload` | Régression identifiée le 19/07/2026 : `src/app/api/upload/route.ts` supprimé accidentellement au commit `f0ec683` (message de commit UUID, 14 fichiers touchés dont 13 en simple changement de mode Unix 644→755, 1 seul avec suppression réelle de contenu). Front-end (`ImageUploader.tsx`, `image-upload.tsx`) appelait toujours `POST /api/upload` → 404 en production, upload logo/favicon admin cassé. Restauré à l'identique (166 lignes) depuis l'état `c63470c` via `git checkout c63470c -- src/app/api/upload/route.ts`. Commit `5dde576`, poussé directement sur `main` | ✅ CORRIGÉ — DÉPLOYÉ |
| LAUNCH-01 | Finalisation lancement — DataLayer, WhatsApp fallback, nettoyage RGPD | **DataLayer e-commerce enrichi** (`src/app/merci/page.tsx`) : `dataLayer.push` de l'événement `purchase` désormais déclenché uniquement après le fetch complet de la commande (`useEffect` gated par `if (!order) return`), avec `transaction_id`, `value`, `currency: 'MAD'`, et `items[]` contenant `sku` (`order.productId`), `item_name`, `price`, `quantity`, `item_variant`, `item_size` — format compatible GA4/Meta Pixel. Le champ `sku` a été ajouté suite à l'audit ABAYA-AUDIT-FINAL qui avait identifié son absence. **Fallback WhatsApp** (`src/components/preview/CheckoutPage.tsx`) : en cas d'échec de `POST /api/orders` (erreur HTTP ou réseau), affichage automatique d'un lien `buildWhatsappLink()` pré-rempli (produit, prix, couleur, taille) permettant au client de finaliser sa commande via WhatsApp au lieu de perdre la conversion. **Nettoyage RGPD** : suppression complète de la dépendance `react-cookie-consent` (`package.json` + `bun.lock`), suppression du composant `src/components/CookieConsentBanner.tsx`, et retrait de son import/rendu dans `src/app/layout.tsx` — conformément à la nouvelle stratégie produit (mandat ABAYA-CLEAN-01), aucun résidu de bannière cookie ne subsiste. Audit sécurité re-confirmé : `middleware.ts`, `src/lib/auth.ts` et `src/app/api/orders/**` non modifiés ; `/api/orders/[id]/history` reste protégée par `getCurrentAdmin()`. Branche `feat/finalisation-lancement` (commits `1fe81a2` puis `7de7437`) fusionnée dans `main`, branche supprimée après validation | ✅ TERMINÉ — DÉPLOYÉ (commit `7de7437`) |

> **Note technique (VG25) — Édition inline :** Le pattern d'édition inline est basé sur `DataTable.tsx` (double-clic → `<Input>` autoFocus → Enter/blur save). Les fonctions d'animation (shake) et de verrouillage (lock) spécifiques à `DataTable.tsx` n'ont pas été implémentées ici, le contexte métier ne nécessitant pas de verrouillage de cellule.

| VG26 | Sitemap dynamique — Extraction produit | Module partagé `src/lib/products.ts` (resolveProduct + resolveAllProducts + slugify + image URL resolvers) extrait de `product-meta/[slug]/page.tsx` ; `product-meta/[slug]/page.tsx` refactorisé pour importer `resolveProduct` du module partagé (suppression de ~170 lignes dupliquées) ; `sitemap.ts` mis à jour : boucle sur `resolveAllProducts()` génère une URL `/?product=<slug>` par produit visible + `revalidate = 3600` (régénération horaire) ; Aucun composant client modifié ; Périmètre limité à `lib/` + `app/sitemap.ts` + `app/product-meta/[slug]/page.tsx` ; branche `feat/seo-sitemap-dynamic` merged puis supprimée | ✅ TERMINÉ |
| VG27 | Support alphabet arabe dans les slugs | `slugify()` modifiée dans `src/lib/products.ts` (server) ET `src/components/preview/CatalogPreview.tsx` (client) — regex `[^\p{L}\p{N}]+/gu` (Unicode property escapes) préserve tous les scripts (Latin, Arabe, etc.) au lieu de `[^a-z0-9]+` qui strippait l'arabe ; Compatibilité descendante totale (slugs FR existants inchangés : "abaya-chic-noir" reste "abaya-chic-noir") ; Slugs AR désormais préservés ("عباية راقية" → "عباية-راقية") ; Les 2 copies (server + client) synchronisées pour éviter les slugs divergents ; audité (ReDoS écarté, parité server/client confirmée, 3ème copie `import/route.ts` hors périmètre confirmée sans risque) ; branche `feat/arabic-slug-support` merged puis supprimée | ✅ TERMINÉ |

## [ORPHANS_AND_PENDING]

### 🔴 Gelé — Hors scope V1, ne pas implémenter
- [ ] **Intégration tracking externe Zara** — Aucun code existant, spécification non fournie
- [ ] **Synchronisation colonnes Relation V2** — Relation actuelle fonctionne en lecture seule ; l'écriture croisée est gelée
- [ ] **Compression des médias** — Sharp installé mais aucun pipeline de compression configuré
- [ ] **Migration vers next-intl** — Package installé mais inutilisé ; le système custom fonctionne ; migration = réécriture complète
- [ ] **SSR i18n correct** — layout.tsx hard-code lang="fr" ; ThemeInjector override côté client ; correction SSR nécessite un refactor du layout — ⚠️ PARTIEL: page.tsx est maintenant Server Component avec metadata SSR, mais `<html lang>` reste "fr" hardcodé
- [ ] **Statut automation** — Nouveau → Courant automatique non implémenté
- [ ] **Tri avancé (presets)** — Pas de presets de tri dans le catalogue

### 🟡 Surveillance — Existant mais fragile
- [ ] **next-intl mort** — Installé (^4.3.4), zéro utilisation. Ne pas supprimer (risque de casser le lockfile), mais ne pas ajouter de config
- [ ] **ThemeInjector vs SSR** — `<html lang>` corrigé côté client uniquement ; les crawlers voient toujours FR
- [ ] **Stabilité dev server** — Le serveur crash intermittemment lors de connexions browser simultanées (CatalogPreview.tsx = 1704 lignes)
- [ ] **Variables Supabase manquantes en local** — `.env` ne contient que `DATABASE_URL` ; SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY absentes → upload utilise le fallback local `public/uploads/`

### 🟢 Complété — Ne pas régresser
- [x] ColorMap seedée (7 couleurs)
- [x] Colonne `__colors__` (COLOR) créée dans Products
- [x] `config.colorColumn = "__colors__"` configuré
- [x] Données couleur migrées (couleur_rel_good → __colors__)
- [x] READ couleurs vérifié (color dots avec hex corrects)
- [x] Merci page redirect vers / (catalogue public)
- [x] Route `/api/upload` créée — logique hybride Supabase + fallback local (P1 upload restauré)
- [x] Colonne `__colors__` garantie côté backend (6 colonnes natives dans import + sync routes)
- [x] CSV "Couleur"/"Color" mappé vers `__colors__` via NATIVE_SLUG_MAP
- [x] Préservation couleurs admin lors des ré-imports Google Sync (preservedStockValues.colors)

## [MILESTONES]
- ✅ S1–S5 : Réconciliation couleurs (READ + WRITE)
- ✅ P0 : PROJECT_MAP.md initialisé
- ✅ P1–P4 : Réparation RTL carrousel (Point A + B)
- ✅ P5 : Vérification VG1–VG7
- ✅ P6 : Restauration upload (route `/api/upload` hybride Supabase + fallback local)
- ✅ P7 : Traduction catégories footer (`cat.label` → `resolveT(cat.translations, cat.label)`)
- ✅ P8 : Bouton refresh admin verrouillé pendant sync + logo footer inversé sur fond sombre
- ✅ P9 : Double parcours WhatsApp/Landing restauré + lien de partage dynamique ?mode=
- ✅ P10 : Footer SUIVEZ-NOUS → icônes sociales premium horizontales (Instagram, Facebook, TikTok, WhatsApp, Email) + champs facebookPage/tiktokHandle ajoutés (DB, types, API, admin, i18n)
- ✅ P11 : Upload pipeline restauré + garde catalogId null-safe + logo/favicon dans create block (branche feat/upload-route-v2)
- ✅ P12 : Colonne Couleur native garantie backend — patch chirurgical 7 points (branche feat/native-colors-fix, merge 43f9ab3)
- ✅ P13 : GTM nettoyé + Zaraz migration + dataLayer guards SSR (branche feat/seo-zaraz-legal)
- ✅ P14 : SEO serveur — page.tsx Server Component + generateMetadata dynamique + sitemap.ts + robots.ts + metadataBase (branche feat/seo-zaraz-legal)
- ✅ P15 : Pages réglementaires squelettes + footer liens câblés (branche feat/seo-zaraz-legal)
- ✅ P16 : Dictionnaire i18n pages réglementaires — 118 clés × 3 locales (FR/EN/AR complets) — traductions officielles V5 intégrées (branche feature/translations-v5)
- ✅ P17 : Intégration i18n pages légales — clés injectées dans dictionaries.ts + 3 pages dynamiques via useClientTranslation + RTL + \n→<br/> — PR #5 merged, déployé (branche feature/i18n-legal-integration)
- ✅ P18 : Tunnel WhatsApp dynamique — buildWhatsappLink() shared util + useMemo sur selectedColor/selectedSize/quantity + image produit injectée + logique 3-cas (custom greeting vs placeholders) — PR #6+#7 merged, déployé, vérifié E2E (branche fix/whatsapp-dynamic-v2 + fix/whatsapp-dynamic-v3)
- ✅ P19 : WhatsApp Smart Logic multilingue — resolveGreeting() + conversionMessages Json + validation Gardien + defaultCatalogLanguage + persistance hybride Cookie/LocalStorage + SSR <html lang> dynamique — branche evolue merged puis supprimée
- ✅ P20 : Admin Orders 4ème Pilier — OrdersPillar + OrdersTable + OrderDetailSheet + PATCH endpoint + /admin/orders route + 34 clés i18n adminOrder.* — déployé (branche evolue-admin-orders merged)
- ✅ P21 : Sécurisation API Orders (Plan V2) — middleware ADMIN_WRITE_ROUTES + exemption POST + getCurrentAdmin() GET liste + getCurrentAdmin() PATCH + tests curl validés — déployé (branche evolue-admin-orders merged)
- ✅ P22 : Orders V4.1 Refonte — i18n adminOrder.* + OrderHistory + search ILIKE + inline edit + archive/purge + DataQualityIcon — déployé (branche feature/orders-refactor merged)
- ✅ P25 (VG28) : Catalog UI & Reorder — 4 axes (carte épurée, bandeau statut pied d'image, suprématie BDD row.order, bouton Réorganiser) — déployé (branche `feature/catalog-ui-and-reorder` mergée)
- ✅ P26 (VG29) : Status Badge Ribbon Redesign — ruban épuré bottom-left + 6 statuts BDD + Nouveauté — déployé (branche `feature/status-badge-ribbon-redesign` mergée)
- ✅ P27 (VG30) : Catalog Hide CTA Mobile — masquage responsive du bouton COMMANDER (< 768px) — déployé (branche `feature/catalog-hide-cta-mobile` mergée)
- ⏳ P28 (VG31) : Status Ribbon AR Harmony — Trend remplace Livraison Gratuite + permutation couleurs + عرض خيالي + harmonisation CSS — branche `feature/status-ribbon-ar-harmony` (EN ATTENTE D'AUDIT, non fusionnée)
- ⏳ P29 (VG32) : Trust Guarantees Section — section garanties de confiance vitrine (4 cartes, tooltip, glassmorphism) + admin (8ème onglet, toggle isVisible, FR/EN/AR, fallback dictionnaire) — branche `feature/trust-guarantees-section` (EN ATTENTE D'AUDIT, non fusionnée)
- ✅ P30 (VG33) : Hybrid Media Architecture — Drive+CDN hybride, Drive Picker, Smart Sync CDN (unicité+throttle+webp), MediaAsset model, Médiathèque — déployé (branche `feature/hybrid-media-architecture` mergée), 3 réserves mineures non-bloquantes documentées
- ⏳ P30.2 (VG33.2) : Media Actions — Unlink/Relink/Delete + Drive Picker universel + sélection multiple Médiathèque — branche `feature/vg332-media-actions` (EN ATTENTE D'AUDIT, non fusionnée)
- ⏳ P30.3 (VG33.3) : CDN Gallery Cleanup — JSON format IMAGE_ARRAY + dédoublonnage cross-colonnes + scanner bucket CDN + réassociation auto au réimport — branche `feat/vg33-cdn-gallery-cleanup` (EN ATTENTE D'AUDIT, non fusionnée)
- ⏳ P30.4 (VG33.4) : Bulk Delete Image Columns — module de nettoyage sécurisé (DeleteColumnsMenu + bulk-delete API) — branche `feature/vg334-bulk-delete-columns` (EN ATTENTE D'AUDIT, non fusionnée)
- ⏳ P31 (VG34) : Checkout UI Integration — tunnel d'achat multi-produits (cart store + drawer + OrderItem + 5ème garantie + design system PDP + prix #121212 + i18n) — branche `feature/checkout-ui-integration` (EN ATTENTE D'AUDIT, non fusionnée)
- ✅ P23 : Sitemap dynamique — module products.ts partagé (resolveProduct + resolveAllProducts) + sitemap.ts boucle produits + revalidate=3600 — déployé (branche feat/seo-sitemap-dynamic merged)
- ✅ P24 : Support alphabet arabe dans les slugs — regex Unicode \p{L}\p{N} + sync server/client — déployé (branche feat/arabic-slug-support merged)

## [BUGFIX MAPPING NATIVE COLOR]

### Diagnostic du Bug
**Symptôme** : Après import de couleurs via ColorSourceModal (colonne texte → `__colors__`), le backend retourne un toast de succès ("121 couleur(s) non configurée(s) importée(s) en texte brut") mais la DataTable affiche des tirets — dans la colonne Couleur.

**Root Cause 1** : `onRefresh()` était appelé **sans** `forceNetwork: true` après l'import. Le cache admin (TTL 2 min) retournait les anciennes données sans les valeurs `__colors__` fraîchement écrites en BDD par l'API color-import.

**Root Cause 2** : Le chemin "Forcer la ré-importation" (`handleForceReimport`) ne déclenchait jamais `onConfigSaved()` → aucun `onRefresh()` du tout, quelle que soit l'issue (succès ou force-import).

**Root Cause 3** : `handleForceImportConfirm` ne déclenchait `onConfigSaved()` que si `mode === 'save'`, pas en mode `'reimport'`.

### Corrections appliquées (commit TBD)

| # | Fichier | Correction |
|---|---------|------------|
| 1 | `DataTable.tsx` | `onConfigSaved` callback : `onRefresh()` → `onRefresh({ forceNetwork: true })` pour forcer le rechargement réseau après import couleur |
| 2 | `ColorSourceModal.tsx` | `handleForceReimport` : ajout `onConfigSaved(currentConfig)` après succès (avant `onOpenChange(false)`) |
| 3 | `ColorSourceModal.tsx` | `handleForceImportConfirm` : `onConfigSaved(config)` toujours appelé (suppression de la condition `mode === 'save'`) |
| 4 | `DataTable.tsx` | `NATIVE_ORDER` : ajout `__colors__: 2` pour le tri correct de la colonne Couleur entre Sous-catégorie et Disponibilité |

### Flux corrigé (après fix)
1. User clique "Connecter" ou "Forcer la ré-importation" → `performImport()` → API écrit dans `row.data.__colors__`
2. `onConfigSaved(config)` est TOUJOURS appelé (save, reimport, force-import)
3. `onConfigSaved` → `onRefresh({ forceNetwork: true })` → `loadDataSourceData({ forceNetwork: true })`
4. Le cache est ignoré, les rows sont re-fetchés depuis l'API → `__colors__` est lisible → ColorCell affiche les dots

## [FEATURE NATIVE COLOR & REFRESH BUTTONS]

### Objectif A — Colonne Couleur Native (badge + protection)
**Problème** : `__colors__` manquait de `NATIVE_COLUMN_SLUGS` — la colonne Couleur affichait "Supprimer" au lieu du badge Native et de l'avertissement système.

**Correction** : Ajout `__colors__` à `NATIVE_COLUMN_SLUGS` dans `DataTable.tsx`.
- ✅ Badge jaune "Native" affiché dans l'en-tête de la colonne Couleur (identique à Stock)
- ✅ "Supprimer" remplacé par "Colonne système — suppression désactivée"
- ✅ Édition de type colonne désactivée (comme les autres colonnes natives)
- ✅ Tri correct via `NATIVE_ORDER`: Catégorie(0) → Sous-catégorie(1) → **Couleur(2)** → Disponibilité(3) → Stock(4) → Statut(5)

### Objectif B — Bouton "🔄 Rafraîchir la colonne"
**Ajout** dans le menu dropdown des en-têtes de colonnes :
- Visible uniquement pour `__stock__` et `col.type === 'COLOR'`
- Déclenche `onRefresh({ forceNetwork: true })` → bypass du cache admin → re-fetch réseau
- Toast info : `Rafraîchissement de « {col.name} »…`
- Icône : `RefreshCw` (ajouté aux imports lucide-react)

### Changements de types
- `DataTableProps.onRefresh` : `() => void` → `(options?: { forceNetwork?: boolean }) => void`
- `NativeCellProps.onRefresh` : même évolution
- `ColorCellProps.onRefresh` : même évolution

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|------------|
| 1 | `DataTable.tsx` | `NATIVE_COLUMN_SLUGS` : ajout `__colors__` |
| 2 | `DataTable.tsx` | Ajout bouton "🔄 Rafraîchir la colonne" pour Stock + Couleur |
| 3 | `DataTable.tsx` | Import `RefreshCw` depuis lucide-react |
| 4 | `DataTable.tsx` | Types `onRefresh` → accepte `{ forceNetwork?: boolean }` |
| 5 | `ColorCell.tsx` | Type `onRefresh` → accepte `{ forceNetwork?: boolean }` |

## [FIX UPLOAD PIPELINE & SETTINGS INITIALIZATION]

### Contexte
La route `/api/upload` avait été supprimée dans le commit 27e5611 (UI cleanup), rendant l'upload logo/favicon inopérant (404 systématique). De plus, le bloc de création `db.catalogSettings.create()` dans la route settings ne protégeait pas contre un `catalogId` vide — risquant un enregistrement orphelin en base vierge.

### Résolution 1 — Route Upload restaurée (`src/app/api/upload/route.ts`)
Nouvelle route POST avec **double circuit** :
- **Circuit A (Supabase Cloud)** : Si `SUPABASE_URL` + `SUPABASE_ANON_KEY` présentes → `getSupabaseAdmin()` → upload dans bucket `assets/branding/{filename}` avec `upsert: true` → URL publique Supabase retournée
- **Circuit B (Fallback local)** : Si Supabase indisponible ou échoué → écriture dans `public/uploads/{filename}` → URL relative `/uploads/{filename}` retournée
- **Validations** : MIME (7 types : jpeg, png, gif, svg, webp, ico, x-icon) + taille ≤ 2 MB + champ fichier requis
- **Réponse** : Format strict `{ data: { url, filename } }` — identique au contrat UI existant

### Résolution 2 — Garde catalogId (`src/app/api/catalog/settings/route.ts`)
- Avant : `catalogId: body.catalogId || (await db.catalog.findFirst())?.id || ''` → chaîne vide acceptée
- Après : Résolution via `resolvedCatalogId`, vérification null **avant** l'appel Prisma
- Si aucun catalogue trouvé → retour HTTP 400 avec message explicite : *"Impossible de créer les paramètres : aucun catalogue trouvé. Veuillez d'abord créer un catalogue."*
- Champs `logo` et `favicon` ajoutés au bloc `create()` pour persistance initiale

### Résolution 3 — Champs logo/favicon dans le create block
- `logo: body.logo || null` et `favicon: body.favicon || null` ajoutés dans `db.catalogSettings.create()`
- Les champs étaient déjà dans `allowedFields` (update) mais manquaient dans le create — corrigé

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|------------|
| 1 | `src/app/api/upload/route.ts` | **NOUVEAU** — Route POST upload hybride (Supabase + fallback local, 152 lignes) |
| 2 | `src/app/api/catalog/settings/route.ts` | Garde `resolvedCatalogId` null-safe + champs `logo`/`favicon` dans create |

### Branche fusionnée
`feat/upload-route-v2` (commit f7e8910) → merge fast-forward dans `main`

## [NATIVE COLORS BACKEND GUARANTEE]

### Contexte
La colonne `__colors__` était déclarée native côté frontend (`NATIVE_COLUMN_SLUGS` dans `DataTable.tsx`) mais n'était **jamais garantie** côté backend. Les routes d'importation CSV et Google Sync ne créaient que 5 colonnes natives, omettant systématiquement `__colors__`. Résultat : après suppression d'un catalogue et ré-importation, la colonne Couleur disparaissait complètement de l'interface.

### Diagnostic
**Bug** : `__colors__` était un "fantôme natif" — déclarée native en UI mais jamais créée par les routes backend. Sa survie dépendait uniquement du mécanisme conditionnel de préservation lors des ré-imports Google Sync (si elle existait déjà), mais sur un DataSource vierge elle n'était jamais créée.

**Fichiers responsables** :
- `import/route.ts` : `NATIVE_SLUG_MAP` sans `couleur`/`color`, `nativeColumns` à 5 entrées, `rowData` sans `__colors__`
- `sync/route.ts` : 5 upserts explicites (full import + delta sync), skip-list sans `__colors__`, `preservedStockValues` sans `colors`, log "5 native columns"

### Résolution — Patch chirurgical 7 points (commit 05ba779, merge 43f9ab3)

| # | Fichier | Point | Correction |
|---|---------|-------|------------|
| 1 | `import/route.ts` | P1 — Mapping | Ajout `'couleur': '__colors__'` + `'color': '__colors__'` dans `NATIVE_SLUG_MAP` |
| 2 | `import/route.ts` | P2 — Structure | Ajout `{ slug: '__colors__', name: 'Couleur', type: 'COLOR', order: -6, config: {} }` en tête de `nativeColumns` |
| 3 | `import/route.ts` | P3 — Données | Ajout `if (rowData.__colors__ === undefined) rowData.__colors__ = '';` |
| 4 | `sync/route.ts` | P4 — Full Import | Ajout 6ème upsert `__colors__` (COLOR, order: -6) avant `__statut__` |
| 5 | `sync/route.ts` | P5 — Delta Sync | `hasColorsColumn` + 6ème upsert + `__colors__` dans `deltaNativeNamePatterns` |
| 6 | `sync/route.ts` | P6 — Préservation | `nc.slug === '__colors__'` dans skip-list + commentaire 5→6 |
| 7 | `sync/route.ts` | P7 — Documentation | Commentaires/logs 5→6 + `nativeNamePatterns` + `sheetColorsValue` + `rowData.__colors__` + `preservedStockValues.colors` + restauration `updatedData.__colors__` + filtre exclusion `c.slug !== '__colors__'` |

### Colonnes natives garanties (6)
| Slug | Name | Type | Order |
|---|---|---|---|
| `__colors__` | Couleur | COLOR | -6 |
| `__category__` | Catégorie | SELECT | -5 |
| `__sub_category__` | Sous-catégorie | SELECT | -4 |
| `__disponibilite__` | Disponibilité | BOOLEAN | -3 |
| `__stock__` | Stock | NUMBER | -2 |
| `__statut__` | Statut | STATUS | -1 |

### Cycle de vie ColorMap (référence complète)
```
ColorMap (authoritative palette)         Row.data.__colors__ (comma-separated names)
  ├─ /api/colormap (CRUD)                 ├─ WRITE: ColorCell toggle → PUT rows
  ├─ /api/colormap/lookup (batch resolve)  ├─ WRITE: ColorSourceModal → POST color-import
  ├─ /api/colormap/seed (14 couleurs)      ├─ READ: CatalogPreview → resolveColorHex() → dots
  └─ /api/colormap/import (bulk create)    └─ READ: ColorMapManager → usage counter
```

### Branche fusionnée
`feat/native-colors-fix` (commit 05ba779) → merge `--no-ff` dans `main` (commit 43f9ab3)

## [GTM CLEANUP & CLOUDFLARE ZARAZ MIGRATION]

### Contexte
Le site utilisait Google Tag Manager (GTM) via `next/script` avec la variable d'environnement `NEXT_PUBLIC_GTM_ID`. La migration vers Cloudflare Zaraz rend ce script inutile et l'import orphelin bloquait le build.

### Modifications appliquées

| # | Fichier | Point | Modification |
|---|---------|-------|-------------|
| 1 | `src/app/layout.tsx` | a — Import | Suppression `import Script from 'next/script'` (import orphelin) |
| 2 | `src/app/layout.tsx` | b — Const | Suppression `const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || ''` |
| 3 | `src/app/layout.tsx` | c — Script bloc | Suppression bloc `{GTM_ID && (<Script id="gtm-head">...)}` (L.67-79) |
| 4 | `src/app/layout.tsx` | d — Noscript bloc | Suppression bloc `{GTM_ID && (<noscript><iframe...>)}` (L.81-90) |
| 5 | `deploy-v2.sh` | L.23, L.66 | Suppression mentions `NEXT_PUBLIC_GTM_ID` — remplacé par note Zaraz |
| 6 | `src/app/merci/page.tsx` | L.41-51 | Conservation dataLayer.push + ajout garde `typeof window !== 'undefined'` |
| 7 | `src/components/preview/SocialStickyTickets.tsx` | L.46-50 | Conservation dataLayer.push + ajout garde `typeof window !== 'undefined'` |

### dataLayer.push() conservés (Zaraz-compatible)
Les appels `window.dataLayer.push()` sont conservés car Cloudflare Zaraz les intercepte côté client. La garde SSR empêche toute exécution côté serveur.

## [SEO SERVER RENDERING]

### Contexte
La racine `/` était un composant client (`'use client'`), ce qui empêchait Google Bot d'indexer les métadonnées dynamiques. Le layout hard-codait `metadataBase` non résolu.

### Modifications appliquées

| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/app/page.tsx` | **Réécriture** — Server Component qui importe `HomeClient` et exporte `generateMetadata()` |
| 2 | `src/components/HomeClient.tsx` | **NOUVEAU** — Logique client extraite de l'ancien page.tsx |
| 3 | `src/app/layout.tsx` | Ajout `metadataBase` résolu dynamiquement depuis `Settings.__seo_metadata__` |
| 4 | `src/app/sitemap.ts` | **NOUVEAU** — Sitemap dynamique via Prisma (4 routes statiques) |
| 5 | `src/app/robots.ts` | **NOUVEAU** — Robots.txt dynamique (allow /, disallow /admin et /api/) |

### Schéma SEO dynamique
- **Source** : Table `Settings` avec clé `__seo_metadata__`
- **Format valeur** : JSON `{ title, description, ogImage, canonicalUrl }`
- **Fallback** : Si la clé n'existe pas en DB ou JSON invalide → métadonnées statiques par défaut
- **metadataBase** : Résolu depuis `canonicalUrl` dans `__seo_metadata__` ou fallback `https://abaya-collection-catalogue-9dum.vercel.app`
- **Métadonnées générées** : og:title, og:description, og:image, og:url, og:site_name, og:locale, twitter:card, twitter:title, twitter:description, twitter:image, canonical, robots

## [PAGES RÉGLEMENTAIRES]

### Contexte
Le footer contenait des liens `href="#"` vers des pages réglementaires inexistantes. Les 3 routes statiques ont été créées avec contenu placeholder, puis les textes officiels V5 ont été injectés depuis le fichier `documents-legaux-abaya-v5.html` (PR #3 fusionnée).

### Routes créées

| Route | Fichier | Metadata |
|---|---------|----------|
| `/mentions-legales` | `src/app/mentions-legales/page.tsx` | title + description SSR |
| `/politique-de-confidentialite` | `src/app/politique-de-confidentialite/page.tsx` | title + description SSR |
| `/conditions-generales` | `src/app/conditions-generales/page.tsx` | title + description SSR |

### Charte graphique respectée
- Couleurs via CSS pivots : `var(--pivot-brand)`, `var(--pivot-gold)`, `var(--pivot-surface)`, `var(--pivot-text)`
- Aucune valeur hex brute (`#C9A84C` → `var(--pivot-gold)`)
- Typographie : `'Playfair Display', serif` pour les titres

### Footer mis à jour
- `CatalogPreview.tsx` : `<a href="#">` → `<a href="/mentions-legales">`, `<a href="/politique-de-confidentialite">`, `<a href="/conditions-generales">`

### ✅ CONTENU V5 INTÉGRÉ
Les textes définitifs des 3 pages ont été injectés depuis le fichier `documents-legaux-abaya-v5.html` (Éditeur : Abaya Collection, E-mail : abayacollect@gmail.com). Branche : `feat/legal-content-v5`.

### Branche
`feat/seo-zaraz-legal` (créée depuis main@88872d9)

---
Date de déploiement : 16/07/2026
## Dette Technique à traiter

Section ouverte le 18/07/2026 après implémentation de V4.1.5 (FX-SearchUnified) sur la branche `fix/search-unified-v4.1.5`. Items à traiter dans une prochaine itération (non bloquants pour la validation du correctif actuel). Chaque item est référencé dans le code par un commentaire `// TODO(DEBT-N)`.

| ID | Priorité | Module | Description | Fichier / Localisation |
|---|---|---|---|---|
| `DEBT-1` | Moyenne | Recherche | **TODO — Migration PostgreSQL de `datetime()`** : la fonction `datetime(created_at/1000, 'unixepoch')` est SQLite-spécifique. Prisma stocke les `DateTime` en epoch-ms sous SQLite, d'où la division par 1000 et le format `unixepoch`. Lors d'une migration vers PostgreSQL (via `scripts/switch-provider.js`), `CAST(created_at AS TEXT)` retourne directement une chaîne ISO 8601 — il faudra remplacer cette seule ligne du `WHERE`. Marqueur `TODO(DEBT-1)` laissé en commentaire inline au-dessus du bloc de recherche. | `src/app/api/orders/route.ts` — clause `datetime(...)` dans le `whereClause` |
| `DEBT-2` | Haute | Pagination | **TODO — Renforcement du guard de pagination** : les appels `parseInt(searchParams.get('limit') ...)` et `parseInt(searchParams.get('offset') ...)` retournent `NaN` sur une entrée invalide (ex. `?limit=abc`). Actuellement, `NaN` se propage dans `take`/`skip` (chemin sans recherche) ou `LIMIT`/`OFFSET` (chemin avec recherche) et peut produire un comportement imprévisible. Ajouter des vérifications `Number.isFinite()` avec repli explicite sur les valeurs par défaut (`limit=50`, `offset=0`). Marqueur `TODO(DEBT-2)` laissé en commentaire inline au niveau du parsing `limit`/`offset`. | `src/app/api/orders/route.ts` — lignes de parsing `limit` / `offset` |
| `DEBT-3` | Haute | Recherche | **TODO — Limite de longueur (200 caractères) sur le paramètre `search`** : actuellement `search` est non borné. Une chaîne très longue (ex. 1 Mo) serait quand même échappée puis injectée dans 11 clauses `LIKE` via `$queryRaw`, ce qui peut dégrader les performances (vecteur de DoS léger). Ajouter `search.slice(0, 200)` avant la construction du pattern `q`. Marqueur `TODO(DEBT-3)` laissé en commentaire inline au niveau de la récupération du paramètre `search`. | `src/app/api/orders/route.ts` — ligne de récupération du paramètre `search` |
| `DEBT-4` | Moyenne | Slugs (i18n) | **TODO — Fragmentation des slugs arabes diacritisés (tashkeel)** : la fonction `slugify()` (VG27) supprime les accents combinants latins via la plage `\u0300-\u036f`, mais ne couvre pas la plage des diacritiques arabes (`\u064B`-`\u0652` : fatha, damma, kasra, sukun, shadda, etc.). Ces marques (catégorie Unicode `Mn`, ni `\p{L}` ni `\p{N}`) sont donc capturées par la regex `[^\p{L}\p{N}]+` et converties en tirets, fragmentant le mot lettre par lettre pour un titre produit saisi avec tashkeel (ex. `"عَبَايَة"` → `"ع-ب-اي-ة"` au lieu de `"عباية"`). Correctif : ajouter `\u064B-\u0652` (et éventuellement `\u0653-\u0655`, `\u0670`) à la liste des marques strippées avant la regex Unicode. Impact actuel limité (les titres produits saisis par les vendeurs contiennent rarement des harakat), mais à corriger avant un usage catalogue intensif en arabe standard diacritisé. Identifié lors de l'audit `ABAYA-AUDIT-ARABIC-SLUGS`. | `src/lib/products.ts` + `src/components/preview/CatalogPreview.tsx` — fonction `slugify()` (les 2 copies synchronisées) |
| `DEBT-5` | Haute | UX Email & Clipboard | **✅ RÉSOLU — Méthode Hybride native implémentée sur Footer + ProductPage** (mission `ABAYA-EMAIL-UX-RESET`, branche `feat/email-ux-fresh`). Deux failles UX corrigées avec approche robuste et compatible tous navigateurs : (1) **Footer CatalogPreview.tsx** — l'ancien `<a href="mailto:...">` échouait silencieusement sur mobile sans client mail configuré. Remplacé par `<button onClick={handleEmailClick}>` qui tente `navigator.clipboard.writeText(email)` (guard `if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function')`), affiche `toast.success` sonner si succès, puis déclenche `window.location.href = mailto:` dans un bloc `finally` **inconditionnel** — garantit l'ouverture du client mail même si clipboard échoue ou absent. (2) **ProductPage.tsx handleShare** — l'ancien code appelait `await navigator.clipboard.writeText(...)` sans vérifier l'existence de l'API → `TypeError` sur anciens navigateurs ou contexte non sécurisé (HTTP, Safari privé). Refactor en cascade 3 étapes : `navigator.share` (Web Share API native, guard `typeof navigator.share === 'function'`) → fallback `navigator.clipboard` avec guard + `await` explicite + `toast.success` sonner → fallback ultime `setShowShareToast` state local. Ajout `import { toast } from 'sonner'` dans les 2 fichiers + 3 clés i18n `footer.emailCopied` (FR/EN/AR). **Non-régression vérifiée** : `CheckoutPage.tsx` non touché, `middleware.ts` non touché, routes API non touchées, `merci/page.tsx` dataLayer non touché. | `src/components/preview/CatalogPreview.tsx` (handler `handleEmailClick` + footer button) ; `src/components/preview/ProductPage.tsx` (handler `handleShare` refactorisé) ; `src/lib/i18n/dictionaries.ts` (clé `footer.emailCopied` FR/EN/AR) |
| `DEBT-6` | Haute | UX Contact Modal | **↩️ REVERTED — ContactModal retiré** (mission `ABAYA-EXEC-2026-07-20`, branche `refactor/contact-footer-currency`). La modale de contact DEBT-6 a été retirée du projet. Fichiers supprimés : `src/components/preview/ContactModal.tsx`, `src/app/api/contact/route.ts`. Modèle Prisma `ContactMessage` supprimé de `prisma/schema.prisma`. State `contactModalOpen` + import `ContactModal` retirés de `CatalogPreview.tsx`. 33 clés i18n `contact.*` (title, subtitle, yourEmail, yourMessage, messagePlaceholder, send, sending, success, errorEmail, errorMessage, errorSend × 3 locales) supprimées. Retour à la Méthode Hybride DEBT-5 (clipboard + mailto fallback `finally`). **Migration BDD** : table `contact_messages` droppée via `prisma db push`. | `src/components/preview/CatalogPreview.tsx` (retrait import + state + rendu) ; `src/lib/i18n/dictionaries.ts` (suppression 33 clés) ; `prisma/schema.prisma` (suppression modèle) ; `src/app/api/contact/` (dossier supprimé) ; `src/components/preview/ContactModal.tsx` (fichier supprimé) |
| `DEBT-7` | Moyenne | UX Footer Email dissocié | **✅ RÉSOLU — Email dissocié des réseaux sociaux dans le footer** (mission `ABAYA-EXEC-2026-07-20`, branche `refactor/contact-footer-currency`). L'email n'est plus mêlé visuellement aux icônes Instagram/Facebook/TikTok/WhatsApp. Nouveau bloc dédié « Contact e-mail » avec : icône enveloppe `Mail` lucide dans un conteneur doré (`bg-[#C9A84C]/15`), adresse email visible en texte (truncate 180px, `dir="ltr"` pour cohérence RTL), `title={s.emailContact}` pour tooltip, clic déclenche `handleEmailClick` (Méthode Hybride DEBT-5 : clipboard + `mailto:` fallback `finally`). Condition d'affichage du bloc social : `whatsappNumber \|\| messengerLink \|\| instagramHandle \|\| facebookPage \|\| tiktokHandle` (emailContact retiré de la condition → bloc social s'affiche même sans email). Ajout clé i18n `footer.contactEmail` × 3 locales (FR/EN/AR). | `src/components/preview/CatalogPreview.tsx` L.1661-1746 (footer restructuré) ; `src/lib/i18n/dictionaries.ts` (clé `footer.contactEmail` FR/EN/AR) |
| `DEBT-8` | Haute | Devise UI vs Système | **✅ RÉSOLU — Séparation étanche couche UI / couche système** (mission `ABAYA-EXEC-2026-07-20`, branche `refactor/contact-footer-currency`). **Couche UI visiteur** : `formatPriceWithCurrency(price, currency, 'ui')` substitue le symbole `MAD` → `Dhs` (D majuscule + hs minuscules, indifféremment de la locale FR/EN/AR) via `UI_CURRENCY_SYMBOL_OVERRIDE`. Le hook `useClientTranslation.formatPrice` passe `displayMode: 'ui'` par défaut. **Couche Système (inchangée)** : `formatPriceWithCurrency(price, currency)` (sans 3e arg = `'system'` par défaut) garde `MAD` pour : admin panel, métadonnées SEO (Schema.org `priceCurrency`), dataLayer analytics (GA4/Meta Pixel `currency: 'MAD'`), structure BDD (`CatalogSettings.currency = 'MAD'`). Le code ISO 4217 `MAD` reste la source de vérité système — seul l'affichage visiteur change. | `src/lib/i18n/dictionaries.ts` L.2180-2219 (`UI_CURRENCY_SYMBOL_OVERRIDE` + `formatPriceWithCurrency` avec param `displayMode`) ; `src/lib/i18n/useClientTranslation.ts` L.27-31 (hook passe `'ui'`) |
| `DEBT-9` | Haute | Discount natif (compareAtPrice) | **✅ RÉSOLU — Colonne native `__compare_at_price__` + affichage prix barré et badge discount** (mission `ABAYA-EXEC-2026-07-20`, branche `refactor/contact-footer-currency`). **Architecture** : pas de modèle `Product` Prisma dédié (produits stockés dans `Row.data` JSON via DataSource/Column/Row). Implémentation via slug natif `__compare_at_price__` parallèle à `__colors__`, `__statut__`, `__stock__`. **Backend** : `NATIVE_SLUG_MAP` étendu dans `import/route.ts` avec mapping multilingue (`prix_barre`, `ancien_prix`, `compare_at_price`, `old price`, etc. → `__compare_at_price__`). **Utilitaire partagé** `src/lib/discount-utils.ts` : `computeDiscount(price, compareAtPrice)` retourne `{ hasDiscount, compareAtPrice, percentage }` avec `Math.round((originalPrice - currentPrice) / originalPrice * 100)` (entier sans virgule, sanity check 1-99%). `getCompareAtPrice(rowData)` lit le slug depuis `Row.data`. **Affichage UI** : CatalogPreview.tsx (carte produit L.1574-1632) — prix actuel + prix barré gris `line-through` + badge rouge `-X%` (couleur `--pivot-danger #800020`). ProductPage.tsx (fiche détail L.825-864 desktop + L.1068-1093 mobile sticky CTA) — même pattern adapté. Ajout 2 clés i18n `product.discount` + `product.originalPrice` × 3 locales. **Comportement** : si `compareAtPrice` absent ou ≤ price → pas de discount (affichage normal). | `src/lib/discount-utils.ts` (nouveau fichier utilitaire) ; `src/app/api/datasources/[id]/import/route.ts` L.123-134 (NATIVE_SLUG_MAP étendu) ; `src/components/preview/CatalogPreview.tsx` L.1574-1632 (carte) ; `src/components/preview/ProductPage.tsx` L.258-264 (useMemo discount) + L.825-864 (desktop) + L.1068-1093 (mobile) ; `src/lib/i18n/dictionaries.ts` (clés `product.discount` + `product.originalPrice` FR/EN/AR) |
| `DEBT-10` | Moyenne | Traduction auto à la volée | **✅ RÉSOLU — Hook `useAutoTranslatedText` avec cache multi-niveaux** (mission `ABAYA-EXEC-2026-07-20`, branche `refactor/contact-footer-currency`). **Architecture mono-champ BDD** : les titres/descriptions produits restent stockés dans une seule langue (généralement FR ou AR selon le vendeur). **Hook client** `src/lib/useAutoTranslatedText.ts` : `useAutoTranslatedText(text, locale)` déclenche la traduction à la volée via `POST /api/translate` (z-ai-web-dev-sdk LLM, déjà existant pour les catégories). **Cache multi-niveaux** : (1) cache mémoire React `useRef` + `Map` partagée entre instances — évite re-renders ; (2) cache localStorage TTL 30 jours (`abaya_translation_<lang>:<text>` keys) — persiste entre sessions ; (3) file d'attente `pendingRequests` — évite doublons de requêtes HTTP pour le même texte. **Optimisation** : si `targetLang === 'fr'` → retourne le texte brut (les vendeurs rédigent majoritairement en français). **Comportement** : affiche le texte original immédiatement (pas de flash), puis met à jour quand la traduction arrive (re-render React). En cas d'échec API → retourne le texte original (pas de crash). **Intégration ProductPage** : `translatedTitle = useAutoTranslatedText(title, locale)` + `translatedDescription = useAutoTranslatedText(description, locale)`. Le `<h1>` et la `<p>` description utilisent les versions traduites. Variant `useAutoTranslatedTexts(texts[], locale)` pour batch (listes produits). | `src/lib/useAutoTranslatedText.ts` (nouveau fichier hook) ; `src/components/preview/ProductPage.tsx` L.24 (import) + L.259-263 (hook appelé sur title + description) + L.830 (h1) + L.880 (p description) + L.1154 (Sheet description) |
| `DEBT-8-repair` | Haute | Devise RTL — isolation bidirectionnelle | **✅ RÉSOLU — Composant `<PriceText>` avec `dir="ltr"` + `unicodeBidi: "isolate"`** (mission `ABAYA-REPAIR-DEBTS-2026-07`, branche `fix/debt8-9-10-repair`). **Problème** : en locale arabe (RTL), le navigateur inversait visuellement `"230 Dhs"` → `"Dhs 230"` à l'écran, même si le texte source était correct. **Solution** : nouveau composant `src/components/PriceText.tsx` qui enveloppe le prix formaté dans un `<span dir="ltr" style={{ unicodeBidi: 'isolate' }}>`. Cela force le navigateur à rendre le contenu LTR même dans un parent RTL, sans modifier le texte source. **Intégration** : tous les affichages de prix dans CatalogPreview (carte produit) et ProductPage (desktop + mobile sticky CTA) utilisent `<PriceText>{formatPrice(price)}</PriceText>` au lieu de `{formatPrice(price)}`. Le prix barré (compareAtPrice) utilise `<PriceText strikethrough>` pour combiner isolation LTR + line-through. **Justification architecture** : la solution agit au niveau HTML/CSS (isolation bidirectionnelle Unicode) plutôt qu'au niveau du formatage texte — c'est la seule approche robuste cross-navigateur qui respecte le standard Unicode Bidirectional Algorithm. | `src/components/PriceText.tsx` (nouveau composant) ; `src/components/preview/CatalogPreview.tsx` L.1584 + L.1598 (carte) ; `src/components/preview/ProductPage.tsx` L.837 + L.851 (desktop) + L.1083 (mobile) |
| `DEBT-9-repair` | Haute | Discount — mapping `Ancien_prix` + parsePriceValue robuste | **✅ RÉSOLU — Étension NATIVE_SLUG_MAP + renforcement `parsePriceValue`** (mission `ABAYA-REPAIR-DEBTS-2026-07`, branche `fix/debt8-9-10-repair`). **Problème 1** : la colonne admin `Ancien_prix` (avec A majuscule) n'était pas explicitement mappée — le `.toLowerCase()` la convertissait en `ancien_prix` qui était déjà dans la map, mais le manque de variante explicite créait une fragilité. **Solution 1** : `NATIVE_SLUG_MAP` étendu avec 18 variantes explicites couvrant `ancien_prix`, `ancien prix`, `ancienprix`, `prix_ancien`, `prix ancien`, `prix_barre`, `prix_barré`, `prixbarré`, `prix original`, `prix_original`, `originalprice`, `original price`, `compare_at_price`, `compareatprice`, `compare at price`, `old price`, `oldprice`, `prix de référence`, `prix_reference` → `__compare_at_price__`. **Problème 2** : `parsePriceValue` ne gérait pas correctement les formats mixtes (espace + virgule, virgule + point) et ne validait pas les types non-string. **Solution 2** : refonte complète avec détection de format (français vs US), guards explicites (null, undefined, boolean, NaN, Infinity), fallback single-digit, sanity check final. Gère : `"299 DH"` → 299, `"1 299,50 DH"` → 1299.50, `"1,299.50 DH"` → 1299.50, `"299,50"` → 299.50, `"Prix: 299, ancien: 399"` → 299 (premier groupe uniquement). | `src/app/api/datasources/[id]/import/route.ts` L.123-146 (NATIVE_SLUG_MAP étendu) ; `src/lib/discount-utils.ts` L.29-103 (parsePriceValue refondu) |
| `DEBT-10-repair` | Haute | Traduction auto — détection langue source + extension CatalogPreview | **✅ RÉSOLU — Détection Unicode + extension grille catalogue** (mission `ABAYA-REPAIR-DEBTS-2026-07`, branche `fix/debt8-9-10-repair`). **Problème 1** : le court-circuit `if (targetLang === 'fr')` empêchait la traduction des produits rédigés en arabe vers le français. Si un vendeur saisissait `"عباية شيك"` et que le visiteur passait en FR, aucune traduction n'était déclenchée. **Solution 1** : remplacement du court-circuit aveugle par une **détection automatique de langue source** via les plages Unicode : `detectTextLanguage(text)` compte les caractères arabes (U+0600-U+06FF) vs latins (a-zA-Z). Si le texte est majoritairement arabe et que la cible est `fr` ou `en` → traduction déclenchée. Si le texte est latin et que la cible est `ar` → traduction déclenchée. Sinon (même écriture) → court-circuit légitime. **Problème 2** : `useAutoTranslatedText` n'était pas appliqué sur la grille CatalogPreview (cartes produit), uniquement sur ProductPage (fiche détail). **Solution 2** : création d'un sous-composant `ProductCardTitle` qui encapsule l'appel au hook (pour respecter les règles des hooks React — pas d'appel dans une boucle `.map()`). Le rendu du titre carte produit utilise `<ProductCardTitle title={title} locale={locale} />` au lieu de `<strong>{title}</strong>`. **Justification architecture** : la détection Unicode est plus robuste qu'un paramètre `sourceLang` explicite (que l'admin devrait configurer manuellement) — elle s'adapte automatiquement à la langue réelle du contenu, même si le vendeur mélange FR et AR dans le même catalogue. | `src/lib/useAutoTranslatedText.ts` L.139-189 (detectTextLanguage + needsTranslation) ; `src/components/preview/CatalogPreview.tsx` L.280-283 (ProductCardTitle) + L.1545-1548 (utilisation) |

### Audit de clôture — Mission ABAYA-AUDIT-2026-07-20

**Verdict : 🟢 VALIDÉ (GO MERGE)** — les 5 transformations ci-dessus (DEBT-6 revert, DEBT-7, DEBT-8, DEBT-9, DEBT-10) ont été auditées en profondeur (patch `bc54512` appliqué et testé en isolation, hors branche distante) :
- Fidélité au mandat vérifiée point par point (suppression physique ContactModal, dissociation footer email, étanchéité devise UI/système sur 3 couches, formule de discount testée empiriquement sur 11 cas limites, cache 3 niveaux + bypass FR + absence de crash sur échec traduction).
- Non-régression confirmée sur le noyau critique : `CheckoutPage.tsx`, `middleware.ts`, `api/orders/**`, `api/upload/route.ts`, `merci/page.tsx` — aucun touché.
- `eslint .` : 0 erreur, 0 warning. `tsc --noEmit` : 0 nouvelle erreur (84 préexistantes sur `main`, inchangées). Aucune dépendance ajoutée.
- `next build` bloqué uniquement par une limite réseau de l'environnement d'audit (Google Fonts inaccessible) — reproduit à l'identique sur `main` non modifié, donc non imputable au patch.
- 2 points mineurs non bloquants relevés : (1) le point du mandat sur `Schema.org priceCurrency` est sans objet, aucune implémentation JSON-LD n'existant dans le projet ; (2) le lien email est passé de `<a href="mailto:">` à `<button>`, perdant le filet de sécurité "no-JS" — à surveiller si la robustesse hors-JS redevient une priorité.

### Audit de réparation — Mission ABAYA-AUDIT-REPAIR-DEBTS-2026-07 (DEBT-8/9/10 repair)

**Verdict : 🟢 GO MERGE** — le patch `fix-debt8-9-10-repair.patch` (commit `c59d73c`) a été appliqué sur branche d'audit isolée depuis `main@89e0a59`, audité point par point, et validé :

- **DEBT-8-repair** (PriceText RTL) : ✅ Composant `PriceText.tsx` avec `dir="ltr"` + `unicodeBidi: 'isolate'`. Couverture complète : CatalogPreview (carte prix + prix barré) + ProductPage (desktop prix + prix barré + mobile sticky CTA) = 5 surfaces. Prix toujours "230 Dhs" (montant gauche, Dhs droite) en RTL.
- **DEBT-9-repair** (Discount mapping + parsePriceValue) : ✅ `NATIVE_SLUG_MAP` étendu à 18 variantes explicites (`ancien_prix`, `Ancien_prix` via `.toLowerCase()`, `prix_barre`, `compare_at_price`, etc.). `parsePriceValue` refondu avec 16 tests empiriques validés (formats FR/US/mixtes, null/undefined/boolean/NaN/Infinity, single-digit, multi-groupes).
- **DEBT-10-repair** (Traduction auto) : ✅ `detectTextLanguage` (Unicode U+0600-U+06FF vs a-zA-Z) remplace le court-circuit `targetLang === 'fr'` aveugle. `needsTranslation` déclenche la traduction seulement si écritures diffèrent. `ProductCardTitle` sous-composant respecte les règles hooks React (pas d'appel dans `.map()`).
- **Conformité** : FR/EN/AR couverts (PriceText agit au niveau HTML, indépendant de la locale). Non-régression : CheckoutPage, middleware, orders, upload, merci — aucun fichier noyau critique touché par le patch.
- **Lint** : 0 erreur. **Build** : Exit 0 (43+ pages).
- **Note mineure non bloquante** : `useAutoTranslatedTexts` (variant batch, non utilisé dans le code) conserve le court-circuit `targetLang === 'fr'` — code mort, pas d'impact.

### Production Repair — Mission ABAYA-REPAIR-PROD-2026-07 (DEBT-8/9/10 production fix)

**Statut : ✅ DÉPLOYÉ EN PRODUCTION — Mission ABAYA-REPAIR-PROD-2026-07 clôturée (merge vers main + push distant + branche temporaire supprimée)**

3 causes racines identifiées et corrigées :

**Anomalie 1 — `Ancien_prix` non mappé (Google Sync)** : la route `google/sync/route.ts` avait une liste `nativeNamePatterns` **séparée** de celle de `import/route.ts`, avec seulement 5 entrées — `__compare_at_price__` en était absent. Les données de production (sync Google Sheets) ne mappraient jamais `Ancien_prix` vers `__compare_at_price__`. **Fix** : ajout de `__compare_at_price__` (18 variantes) à `nativeNamePatterns` (full import L.362) ET `deltaNativeNamePatterns` (delta sync L.820). Aussi ajouté `__compare_at_price__` au `nativeColumns` upsert de `import/route.ts` (7ème colonne native, type CURRENCY).

**Anomalie 2 — Discount invisible (conséquence de #1)** : `getCompareAtPrice(row.data)` lisait `row.data.__compare_at_price__` qui était `undefined` pour les données Google-synced → `computeDiscount` retournait `hasDiscount: false`. **Aucun code change nécessaire** dans `discount-utils.ts`, `CatalogPreview.tsx` ou `ProductPage.tsx` — le fix amont (Anomalie 1) résout automatiquement l'affichage.

**Anomalie 3 — Traduction auto silencieuse (API bug)** : deux bugs composés dans `/api/translate` : (a) `sourceLang` defaultait à `'fr'` même pour texte arabe → prompt LLM absurde ("translate Arabic from French"). (b) Ligne 78 `translations[source] = text.trim()` **écrasait** la traduction française du LLM avec le texte arabe original. **Fix** : ajout de `detectSourceLang()` (Unicode ranges, même logique que le hook client) + conditionnel `if (!translations[source])` au lieu d'overwrite systématique. Aussi : `useAutoTranslatedText` envoie désormais `sourceLang` dans le body, et cache key prefix bumpé de `abaya_translation_` à `abaya_translation_v2_` pour invalider les entrées stale.

### Native Discount Column — Mission ABAYA-NATIVE-DISCOUNT-COLUMN

**Statut : ✅ DÉPLOYÉE EN PRODUCTION**

4 modifications structurelles pour faire de `__compare_at_price__` une vraie colonne native (7ème) :

1. **DataTable.tsx** : `__compare_at_price__` ajouté à `NATIVE_COLUMN_SLUGS` (badge Native + non-supprimable) et `NATIVE_ORDER` position 3.
2. **columns/route.ts** : Fallback API — `NATIVE_COLUMNS_FALLBACK` (7 colonnes), GET upsert + inject si manquante.
3. **scripts/backfill-compare-at-price.ts** : Script migration — parcourt DataSources, crée colonne si absente.
4. **discount-utils.ts** : `Math.round()` déjà utilisé (L.135) — pourcentage entier, aucun changement.

**Audit (commit `ee7dc8c`)** : 4 points de contrôle validés (positionnement DataTable, fallback GET avec clé unique `dataSourceId_slug` confirmée en base, script de migration idempotent, documentation fidèle) ; non-régression confirmée sur le noyau critique ; `eslint` 0 erreur/warning ; `tsc` 0 nouvelle erreur. Verdict 🟢 GO — mergé dans `main`.

**Décision sur le script de migration `backfill-compare-at-price.ts` : NON EXÉCUTÉ, fallback API retenu.** Justification : le mécanisme de fallback dans `columns/route.ts` (point 2 ci-dessus) est auto-suffisant et déjà vérifié sûr — chaque `DataSource` ancien reçoit automatiquement sa colonne `__compare_at_price__` dès son prochain appel `GET /columns`, sans action manuelle requise, avec upsert idempotent (`update: {}` en no-op si déjà présente). Le script de backfill devient donc redondant pour la correction fonctionnelle ; il n'apporte qu'un gain marginal (éviter l'écriture différée au premier accès). À l'inverse, l'exécuter à l'aveugle contre la base de production sans accès de vérification directe à cette base représente un risque disproportionné par rapport au bénéfice. Le script reste disponible dans le dépôt pour exécution manuelle ultérieure si un besoin de backfill immédiat (avant tout accès admin) se présentait.

---

## Clôture Finalisation Lancement — 19/07/2026

Fusion de `feat/finalisation-lancement` dans `main` (commit de merge, contenu validé `7de7437`). Tâches de finalisation marquées **Terminées** :
- [x] DataLayer e-commerce enrichi (transaction_id, value, currency, items[] avec sku) — voir entrée `LAUNCH-01`
- [x] Fallback WhatsApp sur échec API checkout — voir entrée `LAUNCH-01`
- [x] Nettoyage RGPD (suppression react-cookie-consent + CookieConsentBanner) — voir entrées `LAUNCH-01` (mandat ABAYA-CLEAN-01)
- [x] Restauration route `/api/upload` (régression `f0ec683`) — voir entrée `FIX-Upload`

Branche `feat/finalisation-lancement` supprimée après validation post-déploiement (mandat ABAYA-MERGE-01-FINAL).

## [CATALOG UI & REORDER — VG26 / P25]

### Contexte
L'exploration a révélé une surcharge visuelle des cartes produits (bouton d'achat doré permanent, badge images 🖼️ N, badge Nouveau massif top-left, badge réduction bordeaux dans la zone de prix), une instabilité du tri vitrine (priorité automatique Nouveau+en_stock rang 0 réinitialisant le marchandisage à chaque rafraîchissement) et l'absence d'outil de réorganisation pérenne en base de données.

### Architecture livrée (4 axes)

#### Axe 1 — Carte produit épurée (`CatalogPreview.tsx` + `globals.css`)
- `group` ajouté sur `<article className="product-card group">`.
- Bouton « COMMANDER » noir (#000000) texte blanc (#FFFFFF), `rounded-full`, masqué au repos (`opacity:0`) révélé au survol via `.product-card.group:hover .product-card-hover-cta { opacity:1 }` (+ `focus-within` + `@media (hover:none)` pour tactile).
- Suppression de l'indicateur d'images (🖼️ N) — `.product-card-count` retiré du DOM et du CSS.
- Suppression du badge Nouveau top-left (déplacé vers le bandeau Axe 2).
- Badge de réduction `-X%` DÉPLACÉ de la zone de prix (bordeaux `#800020`) vers le top-left de l'image, corail adouci (#EF4444), pourcentage entier (`Math.round`). Le prix barré (strikethrough) est conservé dans la zone de prix.
- CSS mort purgé : `.product-card-micro-cta*`, `.product-card-count`, `.badge-nouveau` retirés ; règle RTL mise à jour.

#### Axe 2 — Bandeau statut « Pied d'image » (`src/lib/status-config.ts`)
- Module centralisé `STATUS_CONFIG` : 6 statuts marketing (Nouveau, Stock limité, Offre limitée, Top vente, Livraison gratuite, Prix choc) × FR/AR/EN + couleur vive.
- `resolveMarketingStatus(rawStatut, locale)` : résout `row.data.__statut__` → label localisé + couleur. Retourne `null` pour « Courant » / valeur inconnue → aucun bandeau (cas nul).
- Rendu : `.product-card-status-band` ancré `bottom:0` de l'image ; texte `font-style:italic`, `text-transform:none` (Sentence case — première lettre majuscule uniquement, PAS d'UPPERCASE), remplissant quasi toute la hauteur du bandeau (1-2px de marge).
- `dir` adapté au locale (rtl pour AR).

#### Axe 3 — Purge des tris parasites & Suprématie BDD (`CatalogPreview.tsx`)
- `allProducts` useMemo : le tri composite (Nouveau+en_stock rang 0 → stock state → row.order) est remplacé par `items.sort((a, b) => a.row.order - b.row.order)`.
- `row.order` (base de données) est désormais l'UNIQUE source de vérité du classement vitrine.
- Vérifié E2E : après réordonnancement BDD, la vitrine suit exactement le nouvel ordre (le produit « Nouveau » n'est plus priorisé).

#### Axe 4 — Bouton « Réorganiser » (`DataPillar.tsx` + `batch/route.ts`)
- Bouton « Réorganiser » ajouté dans la barre d'outils de la table admin (icône `ArrowRightLeft`).
- Popover listant EXCLUSIVEMENT les colonnes numériques non-natives (`type === 'NUMBER'` hors `__category__`, `__sub_category__`, `__colors__`, `__disponibilite__`, `__stock__`, `__statut__`).
- Au clic : tri ascendant (1 → N) de toutes les lignes selon la colonne choisie (valeurs manquantes en dernier, stable), assignation `order = idx + 1`, persistance via `PATCH /api/datasources/[id]/rows/batch` (`{ updates: [{ id, order }] }`).
- Rechargement réseau forcé (`forceNetwork: true`) après persistance.
- Route batch étendue : le format `updates` accepte désormais `order?: number` (écrit `Row.order`) ; correction d'un bug latent (`JSON.parse(r.data)` échouait car Prisma retourne un objet — `readRowData()` défensif ajouté, écriture objet cohérente avec la route PUT single-row).

### Réutilisation de l'existant (DEBT-9)
Le module `src/lib/discount-utils.ts` (DEBT-9) existait déjà sur le point d'ancrage `13ec46e` : `computeDiscount(price, compareAtPrice)` → `{ hasDiscount, compareAtPrice, percentage }` et `getCompareAtPrice(rowData)`. Ces fonctions sont RÉUTILISÉES telles quelles — aucun doublon créé. Le badge de réduction existant (bordeaux, zone de prix) a été RELOCALISÉ vers le top-left de l'image en corail (#EF4444).

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/lib/status-config.ts` | Dictionnaire centralisé des statuts marketing (FR/AR/EN + couleurs) + `resolveMarketingStatus()` |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/components/preview/CatalogPreview.tsx` | `group` sur article ; purge tri composite → `row.order` seul ; suppression badge images + badge Nouveau top-left ; badge réduction RELOCALISÉ de la zone prix vers top-left image (corail) ; bandeau statut pied d'image ; hover CTA noir ; hoist `discount` (réutilise DEBT-9) ; retrait `getImageCount` (inutilisé) ; import `resolveMarketingStatus` |
| 2 | `src/app/globals.css` | Nouvelles classes : `.product-card-discount-badge`, `.product-card-hover-cta(--disabled)`, `.product-card-status-band(-text)` ; purge `.product-card-micro-cta*`, `.product-card-count`, `.badge-nouveau` ; règle RTL + responsive mises à jour |
| 3 | `src/components/data/DataPillar.tsx` | Bouton « Réorganiser » + Popover (colonnes numériques non-natives) ; `handleReorderByColumn()` (tri ascendant + persistance batch + reload) ; `REORDER_NATIVE_SLUGS` ; états `reorderPopoverOpen`/`reordering` |
| 4 | `src/app/api/datasources/[id]/rows/batch/route.ts` | Support champ `order` (Axe 4) ; `readRowData()` défensif (string OR object) ; écriture objet cohérente avec PUT single-row ; corrige bug latent `JSON.parse(r.data)` |

### Branche
`feature/catalog-ui-and-reorder` (créée depuis `main@13ec46e`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [STATUS BADGE RIBBON REDESIGN — VG29 / P26]

### Contexte
L'audit post-VG28 a révélé deux problèmes : (A) le blocage de gestion BDD — la colonne `__statut__` dans l'admin (DataPillar/DataTable) restreignait la sélection aux 2 valeurs historiques (Nouveau/Courant), empêchant les administrateurs de sélectionner les nouveaux statuts commerciaux (Stock limité, Offre limitée, Top Vente, etc.) ; (B) le défaut d'ergonomie du bandeau vitrine — le bandeau 100% pleine largeur au bas de l'image « amputait » le textile, avec une hauteur excessive par rapport à la typographie flottant au milieu d'un grand vide.

### A. Blocage BDD résolu (Admin)
- **DataTable.tsx `<select>`** : remplacement des 2 `<option>` codées en dur par `STATUS_OPTIONS.map(opt => ...)` (source de vérité unique depuis `status-config.ts`). 7 options : Courant + 6 statuts marketing.
- **DataTable.tsx badge** : remplacement du rendu codé en dur (Nouveau=emerald, Courant=gray) par `resolveAdminStatusBadge(displayStatut)` — résout dynamiquement la couleur + le label depuis `STATUS_CONFIG`. Badge coloré (bg = couleur du statut, texte blanc) pour les statuts marketing ; badge gris « Courant » pour le cas nul.
- **`PUT /api/datasources/[id]/status`** : validation `statut !== 'Nouveau' && statut !== 'Courant'` (qui rejetait tous les nouveaux statuts en 400) remplacée par `STATUS_OPTIONS.includes(statut)` — accepte les 7 valeurs, rejette le reste.
- **`computeStatut()` (auto-compute)** : `'Nouveau'` → `'Nouveauté'` (terminologie officielle).
- **`config.options`** synchronisé dans 4 routes backend : `columns/route.ts`, `import/route.ts`, `google/sync/route.ts` (×2), `status/route.ts` — utiliseient `['Nouveau', 'Courant']` codé en dur, désormais `STATUS_OPTIONS.map(o => o.value)`.

### B. Ruban épuré « Designer Tag » (Storefront)
- **`globals.css .product-card-status-band`** : `left:0; right:0; height:22px` (pleine largeur) → `left:0; bottom:0; max-width:60%` (ruban partiel bottom-left) + `border-top-right-radius: 6px` (rounded-tr-md — seul coin arrondi, 3 autres droits) + `padding: 1.5px 12px` (ultra-ajusté au texte, pas de hauteur fixe).
- **`.product-card-status-band-text`** : `font-size: 13px → 12px` (text-xs) + `font-weight: 600` (semibold) + `line-height: 1.25` (leading-tight) + italic + Sentence case (`text-transform: none`) préservés.
- Largeur adaptive selon le texte (81px à 128px mesurés selon le libellé).

### Terminologie — « Nouveau » → « Nouveauté »
Remplacement officiel dans tout le système de statuts :
- `status-config.ts` : clé `nouveau` → `nouveaute`, `fr: 'Nouveau'` → `fr: 'Nouveauté'`, `bddValue: 'Nouveauté'`.
- Alias rétrocompatibles : `'nouveauté'` + `'nouveau'` (les rows BDD existantes avec `'Nouveau'` résolvent vers `'Nouveauté'` automatiquement).
- DataPillar : preset de tri « Nouveau » → « Nouveauté » (label + emoji ✨) ; filtre `is_nouveau` alias-aware (`['nouveauté', 'nouveau']`).
- Sort comparator `__statut__` : alias-aware (reconnaît `'Nouveauté'` + legacy `'Nouveau'`).

### Palette révisée (VG29)
| Statut | BDD Value | FR | AR | Couleur |
|---|---|---|---|---|
| Nouveauté | `Nouveauté` | Nouveauté | جديد | #06B6D4 (cyan) |
| Stock limité | `Stock limité` | Stock limité | كمية محدودة | #F97316 (orange corail) |
| Offre limitée | `Offre limitée` | Offre limitée | عرض محدود | #EF4444 (rouge carmin) |
| Top Vente | `Top Vente` | Top Vente | الأكثر مبيعاً | #EAB308 (jaune solaire) |
| Livraison Gratuite | `Livraison Gratuite` | Livraison Gratuite | توصيل مجاني | #10B981 (vert émeraude) |
| Prix Choc | `Prix Choc` | Prix Choc | تخفيض استثنائي | #D946EF (violet magenta) |
| Courant | `Courant` | (aucun) | (aucun) | (cas nul — pas de ruban) |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/lib/status-config.ts` | **Réécrit** — clé `nouveau`→`nouveaute`, palette révisée (6 couleurs), `bddValue` field, `STATUS_OPTIONS` export (single source of truth), `resolveAdminStatusBadge()` helper ; aliases rétrocompatibles (nouveau + nouveauté) |
| 2 | `src/components/data/DataTable.tsx` | `<select>` dynamique depuis `STATUS_OPTIONS` ; badge dynamique via `resolveAdminStatusBadge()` (couleur + label) ; import `STATUS_OPTIONS` + `resolveAdminStatusBadge` |
| 3 | `src/app/api/datasources/[id]/status/route.ts` | Validation `STATUS_OPTIONS.includes()` (accepte 7 valeurs) ; `computeStatut()` → `'Nouveauté'` ; `config.options` dynamique ; import `STATUS_OPTIONS` + `STATUS_NULL` |
| 4 | `src/app/globals.css` | `.product-card-status-band` : ruban partiel bottom-left (`max-width:60%`, `border-top-right-radius:6px`, `padding:1.5px 12px`) ; `.product-card-status-band-text` : `12px`/`600`/`1.25` ; responsive mobile ajusté |
| 5 | `src/app/api/datasources/[id]/columns/route.ts` | `NATIVE_COLUMNS_FALLBACK` `__statut__` config.options → `STATUS_OPTIONS.map()` ; import `STATUS_OPTIONS` |
| 6 | `src/app/api/datasources/[id]/import/route.ts` | `nativeColumns` `__statut__` config.options → `STATUS_OPTIONS.map()` ; import `STATUS_OPTIONS` |
| 7 | `src/app/api/google/sync/route.ts` | 2 occurrences `config.options` → `STATUS_OPTIONS.map()` ; import `STATUS_OPTIONS` |
| 8 | `src/components/data/DataPillar.tsx` | Filtre `is_nouveau` alias-aware ; tri `__statut__` alias-aware (Nouveauté + legacy Nouveau) ; preset « Nouveau » → « Nouveauté » (✨) |

### Branche
`feature/status-badge-ribbon-redesign` (créée depuis `main@c6f036b`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [CATALOG HIDE CTA MOBILE — VG30 / P27]

### Contexte
Sur les petits écrans (mobiles et petites tablettes, `< 768px`), l'absence de pointeur physique rend le survol hover imprévisible ou permanent. Le bouton « COMMANDER » (`.product-card-hover-cta`), conçu pour apparaître au survol sur desktop, s'affichait ou restait visible sur mobile tactile — masquant le visuel du vêtement et surchargeant l'interface.

### Solution — Masquage CSS responsive (display:none)
Ajout d'un bloc `@media (max-width: 767px)` dans `globals.css` qui applique `display: none` à `.product-card-hover-cta`. Le bouton est retiré de l'arbre de rendu sur mobile — non-interactif, aucune place réservée.

**Pourquoi `display: none` et non `opacity: 0` ou `visibility: hidden` ?**
- `display: none` retire l'élément de l'arbre de rendu → aucune place réservée, non-interactif, inaccessible au focus clavier.
- `opacity: 0` garderait l'élément dans le layout (place réservée) et accessible au focus.
- `visibility: hidden` garderait aussi la place réservée.
- `display: none` l'emporte sur les règles `opacity` existantes (`@media (hover:none) { opacity:1 }` et `group-hover:opacity:100`) — le CTA est donc invisible sur mobile quel que soit le mode hover.

### Sécurité Desktop préservée
- Desktop (≥ 768px) : le bloc `@media (max-width: 767px)` ne s'applique pas → le CTA conserve exactement le comportement VG28 : `opacity: 0` au repos → `group-hover:opacity:100` au survol + `focus-within` + `@media (hover:none)` pour grands écrans tactiles.
- Le composant React reste dans le DOM à toutes les résolutions (masquage CSS-only, aucune régression du render).

### Aucun impact sur les autres éléments
- Ruban de statut (Nouveauté, Stock limité, etc.) : visible sur tous les écrans (non ciblé par la règle).
- Badge de réduction (-X%) : visible sur tous les écrans.
- Prix : visible sur tous les écrans.
- Vérifié E2E : 2 rubans + 3 prix présents sur mobile (375px) après masquage du CTA.

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/app/globals.css` | Ajout bloc `@media (max-width: 767px) { .product-card-hover-cta { display: none; } }` après le bloc `@media (hover: none)` ; commentaire du bloc `@media (hover: none)` précisé (« large touchscreens ≥768px ») |

### Vérification E2E navigateur (4 breakpoints)
| Viewport | CTA display | Attendu | Statut |
|---|---|---|---|
| 375px (iPhone SE) | `none` | hidden | ✅ |
| 767px (juste sous le breakpoint) | `none` | hidden | ✅ |
| 768px (au breakpoint md:) | `block` | visible | ✅ |
| 1280px (desktop) | `block` | visible | ✅ |

### Branche
`feature/catalog-hide-cta-mobile` (créée depuis `main@6c50116`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [STATUS RIBBON AR HARMONY — VG31 / P28]

### Contexte
L'analyse visuelle des cartes produits a révélé plusieurs incohérences : (A) déséquilibre des formats en AR — les mots uniques courts (جديد) génèrent des bandeaux trop étroits, tandis que les expressions longues (تخفيض استثنائي) s'étirent disproportionnément ; (B) le statut « Livraison Gratuite » ne doit plus apparaître comme statut de produit individuel (livraison désormais offerte globalement) — remplacé par « Trend » ; (C) permutation des couleurs (vert → Nouveauté, cyan → Trend) ; (D) les mots uniques (FR et AR) paraissent isolés et trop petits par rapport aux étiquettes à deux mots.

### A. Remplacement Livraison Gratuite → Trend
- `status-config.ts` : clé `livraison_gratuite` → `trend` ; `bddValue: 'Livraison Gratuite'` → `'Trend'` ; `fr/en: 'Trend'`, `ar: 'ترند'`.
- **Aliases rétrocompatibles** : `'livraison gratuite'`, `'توصيل مجاني'`, `'free shipping'` conservés dans le tableau `aliases` — les rows BDD existantes avec `'Livraison Gratuite'` résolvent automatiquement vers Trend (aucune migration de données nécessaire).
- Vérifié E2E : une row avec `__statut__: 'Livraison Gratuite'` affiche le ruban « Trend » / « ترند » avec la couleur cyan.

### B. Permutation des couleurs (palette existante, aucun nouveau code)
| Statut | Avant (VG29) | Après (VG31) |
|---|---|---|
| Nouveauté | `#06B6D4` (cyan) | `#10B981` (vert émeraude) |
| Trend (ex-Livraison Gratuite) | `#10B981` (vert) | `#06B6D4` (cyan) |
Autres statuts inchangés : Stock limité=`#F97316`, Offre limitée=`#EF4444`, Top Vente=`#EAB308`, Prix Choc=`#D946EF`.

### C. Prix Choc AR — libellé harmonisé
- `ar: 'تخفيض استثنائي'` → `ar: 'عرض خيالي'` (plus court, harmonieux — évite le bandeau trop long qui débordait sur l'image).
- Ancien label AR `'تخفيض استثنائي'` conservé comme alias (rétrocompatibilité BDD).

### D. Harmonisation CSS du ruban
**Justification des choix CSS** :
- `min-width: 88px` : les étiquettes à deux mots mesurent entre 81px (Prix Choc) et 97px (Offre limitée) — moyenne ~88px. Les mots uniques (Trend=58px, ترند, nouveau=88px) étaient trop étroits. `min-width: 88px` rallonge les mots uniques pour s'aligner sur le gabarit moyen des étiquettes à deux mots, créant une grille visuellement régulière.
- `max-width: 60%` → `55%` : réduction de 5% pour contenir les libellés AR longs (الأكثر مبيعاً = 98px) et éviter tout débordement sur l'image du produit. 55% d'une carte ~300px = ~165px, largement suffisant pour tous les libellés.
- `padding: 1.5px 12px` inchangé (hauteur ultra-ajustée au texte préservée).
- `border-top-right-radius: 6px` inchangé (rounded-tr-md préservé).

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/lib/status-config.ts` | Clé `livraison_gratuite`→`trend` ; `bddValue`/`fr`/`ar`/`en` → Trend/ترند ; couleurs permutées (Nouveauté=green, Trend=cyan) ; Prix Choc AR → عرض خيالي ; aliases rétrocompatibles ; en-tête doc VG31 |
| 2 | `src/app/globals.css` | `.product-card-status-band` : `min-width: 88px` ajouté, `max-width: 60%`→`55%` ; commentaire VG31 |

### Vérification E2E navigateur
**FR locale** (7 rubans) :
| Statut | Texte | Couleur | Largeur |
|---|---|---|---|
| Nouveauté | Nouveauté | rgb(16,185,129) green ✅ | 88px |
| Stock limité | Stock limité | rgb(249,115,22) orange ✅ | 93px |
| Offre limitée | Offre limitée | rgb(239,68,68) red ✅ | 97px |
| Top Vente | Top Vente | rgb(234,179,8) yellow ✅ | 88px |
| Trend | Trend | rgb(6,182,212) cyan ✅ | 88px (was 58px) |
| Prix Choc | Prix Choc | rgb(217,70,239) magenta ✅ | 88px |
| Legacy (Livraison Gratuite) | Trend | rgb(6,182,212) cyan ✅ | 88px (rétrocompatibilité) |

**AR locale** (htmlDir=rtl, htmlLang=ar, 7 rubans) :
| Statut | Texte AR | Couleur | Largeur |
|---|---|---|---|
| Nouveauté | جديد | rgb(16,185,129) green ✅ | 88px |
| Stock limité | كمية محدودة | orange ✅ | 98px |
| Offre limitée | عرض محدود | red ✅ | 96px |
| Top Vente | الأكثر مبيعاً | yellow ✅ | 88px |
| Trend | ترند | rgb(6,182,212) cyan ✅ | 88px |
| Prix Choc | عرض خيالي | magenta ✅ | 94px |
| Legacy | ترند | cyan ✅ | 88px (rétrocompatibilité) |

### Branche
`feature/status-ribbon-ar-harmony` (créée depuis `main@599e3ca`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [TRUST GUARANTEES SECTION — VG32 / P29]

### Contexte
Le mandat vise à renforcer la confiance des visiteurs en affichant 4 garanties commerciales (Livraison Gratuite, Paiement à la Livraison, Garantie Qualité, Échange Facile) juste au-dessus du footer de la vitrine, avec un volet admin permettant de personnaliser les textes en FR/EN/AR ou de cacher la section.

### Volet Vitrine (`src/components/TrustGuaranteesSection.tsx` — nouveau)
- **Point d'injection** : `<TrustGuaranteesSection />` inséré au-dessus du `<footer>` dans `CatalogPreview.tsx` (ligne ~1655).
- **Arrière-plan** : transparent (s'intègre sur crème #FAF8F5, aucun conteneur noir/séparé).
- **Ligne séparatrice** : `div.h-px` centrée, `w-[65%] max-w-[700px]`, gold-tinted `rgba(201,168,76,0.35)`.
- **Iconographie** : lucide-react (Truck, Banknote, ShieldCheck, RefreshCw) dans cercle vitré glassmorphism : `bg rgba(255,255,255,0.45)` + `backdrop-filter:blur(6px)` + bordure or `1.5px solid rgba(201,168,76,0.55)`. Icônes or `#C9A84C`, `strokeWidth:1.5`.
- **Typographie** : titres anthracite doux `#3D3D3D` (pas de noir pur).
- **Tooltip** : bulle fluide au-dessus de chaque carte au survol/clic/focus — `bg rgba(255,255,255,0.92)` + `blur(8px)`, transition `opacity+translate-y 300ms`, flèche CSS pointant vers le bas. Mobile : `onClick` toggle (tap pour ouvrir/fermer).
- **Responsivité** : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (1 col mobile, 2×2 tablette, 4 cols desktop).
- **Fallback** : champs admin vides → `t('trust.{key}.title')` / `t('trust.{key}.desc')` du dictionnaire.
- **isVisible=false** : `return null` (aucun espace vide).

### Volet Admin (`src/components/settings/TrustGuaranteesPillar.tsx` — nouveau)
- **8ème onglet** « Confiance » (`value="trust"`) dans `SettingsPillar.tsx` — `grid-cols-7`→`grid-cols-8`, icône `ShieldCheck`.
- **Interrupteur** `Switch` contrôlé par `config.isVisible` — si Cacher, la section vitrine disparaît entièrement.
- **Sélecteur de langues** : onglets FR/EN/AR (pattern WhatsApp, `Tabs` + `TabsList` + `TabsTrigger`).
- **4 garanties × 2 champs** : Titre (`Input` court) + Description (`Textarea` 3 rows). `dir="rtl"` appliqué sur tous les champs quand l'onglet Arabe est sélectionné.
- **Placeholder** = texte par défaut du dictionnaire (indique visuellement le fallback).
- **Save** : bouton « Enregistrer » → `handleSave({ trustGuarantees: config })` → `PUT /api/catalog/settings`.

### Infrastructure
- **Prisma** : `trustGuarantees Json? @map("trust_guarantees")` sur `CatalogSettings` + `bun run db:push`.
- **Types** (`src/types/index.ts`) : `GuaranteeKey` (`'livraison'|'paiement'|'qualite'|'retour'`) + `TrustGuaranteeItem` (`{title, description}`) + `TrustGuaranteesConfig` (`{isVisible, items}`) + `CatalogSettings.trustGuarantees` + `SettingsTab` étendu `'trust'`.
- **API** (`src/app/api/catalog/settings/route.ts`) : `'trustGuarantees'` ajouté à `allowedFields`.
- **Dictionnaire** (`src/lib/i18n/dictionaries.ts`) : 8 clés `trust.{key}.title` + `trust.{key}.desc` × 3 locales = 24 clés. Textes officiels du mandat (livraison/paiement/qualite/retour).

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/components/TrustGuaranteesSection.tsx` | Composant vitrine — 4 cartes garanties + tooltip + glassmorphism + séparateur |
| 2 | `src/components/settings/TrustGuaranteesPillar.tsx` | Composant admin — toggle isVisible + onglets FR/EN/AR + 4×2 champs + save |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `prisma/schema.prisma` | `trustGuarantees Json? @map("trust_guarantees")` sur `CatalogSettings` |
| 2 | `src/types/index.ts` | `TrustGuaranteesConfig` + `GuaranteeKey` + `TrustGuaranteeItem` + `CatalogSettings.trustGuarantees` + `SettingsTab` `'trust'` |
| 3 | `src/app/api/catalog/settings/route.ts` | `'trustGuarantees'` dans `allowedFields` |
| 4 | `src/lib/i18n/dictionaries.ts` | 24 clés `trust.*` (8 × 3 locales) — textes officiels |
| 5 | `src/components/preview/CatalogPreview.tsx` | Import + `<TrustGuaranteesSection />` au-dessus du `<footer>` |
| 6 | `src/components/settings/SettingsPillar.tsx` | Import `TrustGuaranteesPillar` + `ShieldCheck` + onglet « Confiance » (`grid-cols-8`) + `<TabsContent value="trust">` |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅
- `tsc --noEmit` : 0 erreur dans `src/` ✅ (1 erreur préexistante dans `.next/dev/types/validator.ts` auto-généré, hors scope)
- `bun run db:push` : colonne `trust_guarantees` ajoutée à SQLite ✅
- E2E vitrine : 4 titres rendus (Livraison Gratuite, Paiement à la Livraison, Garantie Qualité, Échange Facile), 4 colonnes desktop (285.5px×4), 4 cercles glassmorphism (bg rgba(255,255,255,0.45), bordure rgba(201,168,76,0.55)), icônes or (rgb(201,168,76)), séparateur gold 700px, bg transparent, positionné au-dessus du footer ✅

### Branche
`feature/trust-guarantees-section` (créée depuis `main@be3d655`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [HYBRID MEDIA ARCHITECTURE — VG33 / P30]

### Contexte
Le mandat résout 4 problèmes : (A) dépendance Google Drive sujette aux erreurs 429 (pas un CDN) + risque SEO ; (B) ingestion lourde en 3 étapes pour de simples ajustements d'images ; (C) risque de doublons (aucun contrôle d'unicité des file_id Drive) ; (D) danger lors de la suppression (effacer une cellule peut rompre l'accès au fichier).

### Pillar 1 — Centralisation & Rendus Hybrides (`src/lib/media-utils.ts`)
- `DRIVE_FILE_ID_REGEX` universelle : `drive.google.com/file/d/`, `/open?id=`, `/uc?id=`, `lh3.googleusercontent.com/d/`, `/api/google/image-proxy?id=`.
- `extractDriveFileId(url)` : string | null.
- `detectImageSource(url)` : 'drive' | 'cdn' | 'unknown' (Supabase + /uploads/ = CDN).
- `resolveHybridImageUrl(url, size)` : Drive → `lh3.googleusercontent.com/d/ID=w{size}` (ultra-rapide), CDN/unknown → passthrough.
- `resolveProxyUrl(url, size)` : Drive → `/api/google/image-proxy?id=ID&sz={size}` (fallback), CDN/unknown → passthrough.
- **Déduplication** : `CatalogPreview.tsx` + `ProductPage.tsx` refactorisés (suppression ~120 lignes dupliquées de `resolveDirectImageUrl`/`resolveProxyImageUrl`/`extractImageId`). Import depuis `media-utils` via alias (`resolveHybridImageUrl as resolveDirectImageUrl`).

### Pillar 2 — Ingestion Directe Google Drive Picker
- `GoogleDrivePicker.tsx` : modale officielle Google Drive API. Charge GIS + Picker scripts dynamiquement. Token OAuth depuis `GET /api/google/picker-token` (session Google stockée). Multi-select Ctrl+Clic, filtre mime images. On select → `POST /api/catalog/media/picker-sync`.
- `POST /api/catalog/media/picker-sync` : injecte URLs Drive dans cellules. IMAGE : 1 URL par cellule vide (row order asc). IMAGE_ARRAY : append aux URLs existantes. Upsert MediaAsset (status='drive').
- Intégré dans le menu 3-points (`colOptionsOpen`) de chaque colonne IMAGE/IMAGE_ARRAY dans `DataTable.tsx` : « 📁 Importer via Drive Picker ».

### Pillar 3 — Migration Ciblée & Algorithme d'Unicité (Smart Sync)
- `POST /api/catalog/media/cdn-migrate` : pour chaque row, extrait file_ids Drive.
  1. **Uniqueness check** : `MediaAsset.findFirst({ fileId, columnSlug, rowId: { not: row.id } })` → si trouvé, BLOCK + report conflit.
  2. **Throttle 100ms** entre requêtes Drive (respect quotas).
  3. **Download** Drive → `lh3.googleusercontent.com/d/ID=w1200`.
  4. **Sharp webp** : `sharp(buffer).webp({ quality: 82 }).toBuffer()`.
  5. **Upload** Supabase Storage `assets/media/{fileId}.webp` (upsert) → `cdnUrl` = public URL. Fallback local `/public/uploads/media/`.
  6. **Update** `Row.data` avec CDN URL + `MediaAsset` status='cdn'.
- Bouton colonne « ☁️ Exporter vers le CDN » dans le menu 3-points (DataTable).
- Bouton bulk « ☁️ Exporter vers le CDN » dans la barre de sélection multiple (DataTable) — itère sur toutes les colonnes IMAGE/IMAGE_ARRAY.

### Pillar 4 — Modèle MediaAsset
```prisma
model MediaAsset {
  id            String   @id @default(cuid())
  fileId        String   @map("file_id")
  rowId         String   @map("row_id")
  row           Row      @relation(fields: [rowId], references: [id], onDelete: Cascade)
  dataSourceId  String   @map("data_source_id")
  columnSlug    String   @map("column_slug")
  originalUrl   String   @map("original_url")
  cdnUrl        String?  @map("cdn_url")
  fileName      String?  @map("file_name")
  mimeType      String?  @map("mime_type")
  sizeBytes     Int?     @map("size_bytes")
  status        String   @default("drive")  // 'drive' | 'migrating' | 'cdn' | 'failed'
  @@unique([fileId, columnSlug])
  @@index([rowId])
  @@index([dataSourceId])
  @@index([fileId])
}
```
Relation `Row.mediaAssets MediaAsset[]` ajoutée. `db:push` OK.

### Pillar 5 — Espace Média Épuré (Médiathèque)
- `MediaLibrary.tsx` : grille stricte 3 colonnes :
  1. **N° Ordre Système (BDD)** : `Row.order` (index fixe immuable 1..N).
  2. **Nom du Produit** : titre exact (titleColumn best-effort).
  3. **Grille d'Images** : miniatures visuelles + badge source (Drive bleu / CDN vert) + bouton suppression physique CDN (hover).
- Filtre « 🔍 Afficher les images orphelines » : CDN URLs sans référence active dans un Row.
- `GET /api/catalog/media/list?dataSourceId=...&orphansOnly=true` : entries + orphans.
- `POST /api/catalog/media/delete` : safety-check (409 si cdnUrl encore référencée par un Row) → delete Supabase/local + delete MediaAsset.
- Bouton « Médiathèque » (icône Images) dans la barre d'outils `DataPillar.tsx` → Dialog `MediaLibrary`.

### Dictionnaire
21 clés `media.*` × 3 locales (63 clés) : `media.pickerTitle`, `media.pickerBtn`, `media.exportCdnCol`, `media.exportCdnSel`, `media.migrating`, `media.migrateSuccess`, `media.migrateConflict`, `media.migrateError`, `media.libraryTitle`, `media.colOrder`, `media.colProduct`, `media.colImages`, `media.sourceDrive`, `media.sourceCdn`, `media.orphanFilter`, `media.deleteBtn`, `media.deleteConfirm`, `media.deleteSuccess`, `media.deleteBlocked`, `media.noMedia`, `media.injected`.

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/lib/media-utils.ts` | Centralisation : regex, detectImageSource, resolveHybridImageUrl, resolveProxyUrl |
| 2 | `src/components/admin/GoogleDrivePicker.tsx` | Modale Drive Picker officielle (GIS + Picker API) |
| 3 | `src/components/admin/MediaLibrary.tsx` | Médiathèque 3 colonnes + filtre orphelins + suppression CDN |
| 4 | `src/app/api/catalog/media/picker-sync/route.ts` | Injection URLs Drive dans cellules + upsert MediaAsset |
| 5 | `src/app/api/catalog/media/cdn-migrate/route.ts` | Smart Sync : unicité + throttle + webp + upload CDN |
| 6 | `src/app/api/catalog/media/list/route.ts` | Liste médiathèque + filtre orphelins |
| 7 | `src/app/api/catalog/media/delete/route.ts` | Suppression physique CDN (safety-check 409) |
| 8 | `src/app/api/google/picker-token/route.ts` | Token OAuth pour Drive Picker client-side |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `prisma/schema.prisma` | Model `MediaAsset` + relation `Row.mediaAssets[]` |
| 2 | `src/components/preview/CatalogPreview.tsx` | Import `media-utils` (suppression ~60 lignes dupliquées) |
| 3 | `src/components/preview/ProductPage.tsx` | Import `media-utils` (suppression ~60 lignes dupliquées) |
| 4 | `src/components/data/DataTable.tsx` | Drive Picker + CDN export dans menu 3-points + bulk CDN export |
| 5 | `src/components/data/DataPillar.tsx` | Bouton « Médiathèque » + Dialog MediaLibrary |
| 6 | `src/lib/i18n/dictionaries.ts` | 63 clés `media.*` (21 × 3 locales) |

### Vérifications
- `bun run db:push` : table `media_assets` créée ✅
- `bun run lint` : 0 erreur, 0 warning ✅
- `tsc --noEmit` : 0 erreur dans `src/` ✅
- media-utils unit test (6 URLs) : Drive×3 formats → fileId+hybrid+proxy corrects, CDN×2 → passthrough, unknown → passthrough ✅
- E2E vitrine : 12 cartes + trust section + footer (non-régression refactor) ✅

### Branche
`feature/hybrid-media-architecture` (créée depuis `main@8acf9d4`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [MEDIA ACTIONS — VG33.2 / P30.2]

### Contexte
L'audit post-VG33 a identifié 4 blocages : (A) suppression impossible (409 cercle vicieux) ; (B) Drive Picker invisible sur colonnes TEXT ; (C) impossible de « casser le lien » sans détruire l'image ; (D) pas de sélection multiple.

### A. Blocage 409 supprimé — 3 actions distinctes
| Action | Route | Comportement |
|---|---|---|
| **Unlink** (Casser le lien) | `POST /api/catalog/media/unlink` | Retire l'URL de `Row.data` (IMAGE: clear, IMAGE_ARRAY: filter). Fichier CDN conservé. `MediaAsset.rowId=null`, `originalRowId=previous rowId`, `status='orphan'`. Bulk via `items[]`. |
| **Relink** (Restaurer le lien) | `POST /api/catalog/media/relink` | Lit `originalRowId`, réinjecte `cdnUrl` dans `Row.data[columnSlug]` (append si absent). Vérifie unicité (409 si cdnUrl déjà référencée par un autre row). `MediaAsset.rowId=originalRowId`, `status='cdn'`. Bulk via `items[]`. |
| **Delete** (Suppression définitive) | `POST /api/catalog/media/delete` | 1. Unlink automatique (retire URL de Row.data). 2. Delete fichier physique CDN (Supabase/local). 3. Delete record MediaAsset. **Plus de 409** — l'action supprime tout. Bulk via `items[]`. |

### B. Drive Picker universel (DataTable.tsx)
- Le bouton « 📁 Importer via Drive Picker » est désormais visible sur **TOUTES les colonnes non-natives** (pas seulement IMAGE/IMAGE_ARRAY).
- Si la colonne est TEXT/CURRENCY/etc, le Picker utilise le mode `IMAGE_ARRAY` (append) par défaut.
- Condition : `!isNativeColumn(col.slug)` au lieu de `col.type === 'IMAGE' || col.type === 'IMAGE_ARRAY'`.

### C. Prisma — MediaAsset rowId optionnel + originalRowId
- `rowId` : `String` → `String?` (optional). `onDelete: Cascade` → `SetNull` (supprimer un Row orphanise les MediaAssets au lieu de les supprimer).
- `originalRowId String?` : nouveau champ — mémoire du produit d'origine pour Relink 100% exact.
- `status` : nouveau valeur `'orphan'` ajoutée.

### D. Sélection multiple Médiathèque (MediaLibrary.tsx refondue)
- Checkbox par image + checkbox select-all (en-tête) + checkbox par ligne.
- Barre d'outils bulk : « Casser le lien » / « Restaurer le lien » / « Supprimer » + « Désélectionner ».
- Boutons d'action par image (hover) : Unlink (ambre, si lié) / Relink (bleu, si orpheline + originalRowId) / Delete (rouge, toujours).
- Badge « orpheline » sur les images déliées + opacité réduite.

### E. Route list enrichie
`GET /api/catalog/media/list` inclut désormais par image : `mediaAssetId`, `originalRowId`, `isLinked` + entries orphelines intégrées (rowId='orphan').

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/app/api/catalog/media/unlink/route.ts` | Action Unlink (casser le lien, bulk) |
| 2 | `src/app/api/catalog/media/relink/route.ts` | Action Relink (restaurer le lien, bulk, safety-check) |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `prisma/schema.prisma` | `rowId String?` + `onDelete: SetNull` + `originalRowId String?` + status 'orphan' |
| 2 | `src/app/api/catalog/media/delete/route.ts` | Réécrit : unlink auto + delete physique + delete record (no 409) + bulk |
| 3 | `src/app/api/catalog/media/list/route.ts` | Enrichi : mediaAssetId, originalRowId, isLinked + orphans intégrés |
| 4 | `src/components/admin/MediaLibrary.tsx` | Refondu : checkboxes + bulk toolbar + per-image Unlink/Relink/Delete + badge orpheline |
| 5 | `src/components/data/DataTable.tsx` | Drive Picker universel (`!isNativeColumn` au lieu de IMAGE/IMAGE_ARRAY) |
| 6 | `PROJECT_MAP.md` | VG33.2 + P30.2 + section documentation |

### Vérifications
- `bun run db:push` : schema sync OK (rowId optionnel, originalRowId ajouté) ✅
- `bun run lint` : 0 erreur, 0 warning ✅
- API routes 401 (auth-protected, route reachable) ✅
- E2E vitrine : trust section + footer (non-régression) ✅

### Branche
`feature/vg332-media-actions` (créée depuis `main@b3d8f60`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [CDN GALLERY CLEANUP — VG33.3 / P30.3]

### Contexte
L'audit infrastructure CDN a identifié 4 bugs : (A) corruption carrousels/galeries (join(', ') au lieu de JSON.stringify) ; (B) Médiathèque aveugle au bucket CDN physique (fichiers fantômes) ; (C) dédoublonnage manquant cross-colonnes (40 téléchargements pour 20 images) ; (D) pas de réassociation auto au réimport.

### A. Restauration du format JSON galerie (cdn-migrate/route.ts)
- **Bug** : `data[columnSlug] = newUrls.join(', ')` pour IMAGE_ARRAY → le composant React recevait une string « url1, url2 » au lieu d’un tableau JSON. Le badge passait de « X images » à « 1 image » et le carrousel cassait.
- **Fix** : `data[columnSlug] = JSON.stringify(newUrls)` pour IMAGE_ARRAY (format JSON strict `'["url1","url2"]'`).
- **Route list** : parse désormais les 3 formats — tableau natif (`Array.isArray`), JSON string (`startsWith('[')` → `JSON.parse`), legacy comma-separated (fallback `split(/[,;]/)`).

### B. Scanner physique bucket CDN (Médiathèque)
- **Nouvelle route** `GET /api/catalog/media/scan-bucket?dataSourceId=...` : liste le contenu réel du bucket (Supabase `storage.from('assets').list('media')` ou local `fs.readdir('/public/uploads/media/')`), compare avec BDD (MediaAsset + Row.data URLs) → `ghostFiles` (sur bucket mais non suivis).
- **Nouvelle route** `POST /api/catalog/media/purge-ghosts` : supprime les fichiers fantômes sélectionnés (batch Supabase `remove()` ou local `unlink`).
- **MediaLibrary.tsx** : nouveau toggle « Bucket CDN » avec stats (total/suivis/fantômes) + liste fantômes avec checkbox + bouton « Purger les fantômes ».

### C. Dédoublonnage cross-colonnes (cdn-migrate/route.ts)
- **Bug** : la vérification `selfAsset` utilisait `fileId_columnSlug` (per-column) → la même image dans une colonne IMAGE individuelle ET la galerie IMAGE_ARRAY déclenchait 2 téléchargements (40 pour 20 images).
- **Fix** : la vérification `existingAsset` ne filtre plus par `columnSlug` — si un `fileId` a déjà un `cdnUrl` (statut 'cdn') dans N'IMPORTE QUELLE colonne, l'URL CDN est réutilisée (status 'skipped', pas de re-téléchargement). Le vrai conflit (file_id lié à un AUTRE row) est vérifié séparément.

### D. Réassociation automatique au réimport (import/route.ts + google/sync/route.ts)
- **Bug** : quand l'utilisateur supprime et réimporte une table, les URLs Drive étaient réimportées telles quelles, déclenchant un re-téléchargement CDN complet.
- **Fix** : avant la création des rows, fetch tous les `MediaAsset` existants (status='cdn') pour ce datasource → construit `cdnAssetMap` (fileId→cdnUrl). Pour chaque cellule (string ou array), remplace les URLs Drive par les URLs CDN déjà existantes. Le compteur `cdnReassociated` est retourné dans la réponse import.
- **Aucun re-téléchargement nécessaire** — les images déjà migrées sont réassociées automatiquement.

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/app/api/catalog/media/scan-bucket/route.ts` | Scan physique bucket CDN (Supabase/local) + comparaison BDD → ghostFiles |
| 2 | `src/app/api/catalog/media/purge-ghosts/route.ts` | Suppression fichiers fantômes (batch Supabase/local) |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/app/api/catalog/media/cdn-migrate/route.ts` | IMAGE_ARRAY: `join(', ')` → `JSON.stringify(newUrls)` ; dédoublonnage cross-colonnes (existingAsset sans columnSlug) |
| 2 | `src/app/api/catalog/media/list/route.ts` | Parse IMAGE_ARRAY: 3 formats (array natif, JSON string, legacy comma) |
| 3 | `src/app/api/datasources/[id]/import/route.ts` | Auto-réassociation: fetch cdnAssetMap + remplacement URLs Drive → CDN dans chaque cellule |
| 4 | `src/app/api/google/sync/route.ts` | Auto-réassociation: même logique que import/route.ts |
| 5 | `src/components/admin/MediaLibrary.tsx` | Toggle « Bucket CDN » + stats + liste fantômes + checkbox + bouton purge |
| 6 | `PROJECT_MAP.md` | VG33.3 + P30.3 + section documentation |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅
- `scan-bucket` API : 200 (retourne bucketFiles/ghostFiles/trackedFiles) ✅
- `purge-ghosts` API : 401 (auth-protected, route reachable) ✅
- E2E vitrine : trust section + footer (non-régression) ✅

### Branche
`feat/vg33-cdn-gallery-cleanup` (créée depuis `main@8a26ade`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [BULK DELETE IMAGE COLUMNS — VG33.4 / P30.4]

### Contexte
Après migration des images individuelles vers la galerie unifiée (IMAGE_ARRAY), ~70 colonnes d'images individuelles (Image 1, Image 2, ...) restaient en BDD, simplement masquées (visible=false). Cela alourdissait la structure, surchargeait les requêtes et ralentissait le rendu. Aucun outil de suppression groupée n'existait — la suppression manuelle une par une était fastidieuse et risquée.

### Solution — Module de nettoyage sécurisé

#### Composant `DeleteColumnsMenu.tsx` (nouveau)
- **Popover** avec recherche + liste des colonnes IMAGE cochables.
- **Bouton « Tout sélectionner »** pour les colonnes IMAGE éligibles (filtrées par recherche).
- **Section « Verrouillées »** : les colonnes Galerie (IMAGE_ARRAY) + natives (`__title__`, `__colors__`, `__statut__`, etc.) + 1ère colonne sont listées mais **désactivées** (disabled) avec icône cadenas `Lock`.
- **Modale de confirmation** : affiche le nombre exact de colonnes à supprimer + liste détaillée (noms) + avertissement sur l'irréversibilité + bouton « Confirmer la suppression (N) ».
- **Sécurité visuelle** : seules les colonnes de type `IMAGE` sont cochables. Les colonnes vitales ne peuvent pas être sélectionnées.

#### Route API `DELETE /api/datasources/[id]/columns/bulk-delete` (nouvelle)
- **Body** : `{ columnIds: string[] }`
- **Triple sécurité server-side** :
  1. `type: 'IMAGE'` obligatoire — seules les colonnes IMAGE peuvent être supprimées.
  2. `dataSourceId` vérifié — les colonnes doivent appartenir au datasource spécifié.
  3. `id: { in: columnIds }` — seules les colonnes dont l'ID est dans la liste sont supprimées.
- **Exécution** : `prisma.column.deleteMany` (Hard Delete définitif).
- **Réponse** : `{ data: { deleted: number, skipped: number } }` — `skipped` = colonnes non-IMAGE ou n'appartenant pas au datasource.

#### Intégration DataPillar
- Bouton « Nettoyer colonnes » (icône `Trash2`, rouge destructif) dans la barre d'outils DataPillar, juste après le dropdown « Masquer » (ColumnVisibilityDropdown).
- `onDeleted` callback → `loadDataSourceData({ forceNetwork: true })` pour rafraîchir le tableau.

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/components/data/DeleteColumnsMenu.tsx` | Composant frontend — Popover + sélection + modale confirmation |
| 2 | `src/app/api/datasources/[id]/columns/bulk-delete/route.ts` | Route API — deleteMany IMAGE + triple sécurité |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/components/data/DataPillar.tsx` | Import `DeleteColumnsMenu` + bouton dans la barre d'outils |
| 2 | `PROJECT_MAP.md` | VG33.4 + P30.4 + section documentation |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅
- `bulk-delete` API : 401 (auth-protected, route reachable) ✅
- E2E vitrine : trust section + footer (non-régression) ✅

### Branche
`feature/vg334-bulk-delete-columns` (créée depuis `main@d86a824`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [CHECKOUT UI INTEGRATION — VG34 / P31]

### Contexte
Le mandat vise à transformer l'application d'un achat mono-produit vers un tunnel d'achat multi-produits avec panier, tout en transposant le design system raffiné de la PDP sur le checkout.

### Architecture livrée

#### 1. Cart Store Zustand (`src/lib/cart-store.ts` — nouveau)
- `useCartStore` avec `persist` middleware (localStorage `abaya-cart`).
- `CartItem` : id (productId:color:size), productId, title, price, color, size, quantity, image.
- Actions : `addItem` (merge si même id), `removeItem`, `updateQuantity`, `clearCart`, `openDrawer`, `closeDrawer`, `toggleDrawer`.
- Computed : `getTotalItems()`, `getTotalPrice()` (parse price string → number).

#### 2. Cart Drawer (`src/components/preview/CartDrawer.tsx` — nouveau)
- Slide-over droit (LTR) / gauche (RTL) avec overlay.
- Liste articles : image (resolveHybridImageUrl) + titre + couleur + taille (badge) + prix + qty picker (+/-) + remove.
- Footer : total + bouton checkout (vert deep + accent or).
- Design system PDP : `--bg-app`, `--vert-deep`, `--gold-accent`, `--border-soft`, `--price-charcoal`.

#### 3. CSS Design System (`src/app/globals.css`)
- 12 variables CSS ajoutées : `--bg-app: #fffefe`, `--vert-deep: #14241E`, `--vert-hover: #1A2E27`, `--gold-accent: #C5A059`, `--gold-aura`, `--border-soft: #EAE4DC`, `--bg-btn-secondary: #F7F4EE`, `--badge-red: #70001B`, `--text-main: #14241E`, `--text-muted: #706B63`, `--price-charcoal: #121212`.
- Prix : `.product-card-price` color → `var(--price-charcoal, #121212)` (Noir Charbonné).

#### 4. 5ème garantie (Service Client 24/7)
- `GuaranteeKey` étendu : `'sav'` ajouté.
- `TrustGuaranteesSection` : `GUARANTEE_META` + `Headphones` icon + grid `lg:grid-cols-5`.
- `TrustGuaranteesPillar` : `GUARANTEE_META` + `Headphones` + `buildDefaultConfig` inclut `sav`.
- Dictionnaire : `trust.sav.title` + `trust.sav.desc` × 3 locales.

#### 5. Prisma OrderItem
- `OrderItem` model : orderId, productId, productTitle, productPrice, productColor, productSize, productQuantity, productImage + `@@index([orderId])`.
- Relation `Order.items OrderItem[]` ajoutée.
- `db:push` OK.

#### 6. i18n (69 clés × 3 locales)
- `trust.sav.*` (2 clés) : Service Client 24/7.
- `cart.*` (10 clés) : title, empty, close, remove, total, checkout, added.
- `checkout.*` (10 clés) : title, subtitle, cod, fullName, phone, city, address, confirm, orderSummary, processing.
- `sav.*` (4 clés) : delivery.title, delivery.desc, aftersales.title, aftersales.desc — textes officiels du mandat.

#### 7. Header Cart Badge
- `CartHeaderButton` : bouton flottant (fixed top-right) vert deep avec badge or (count) + icône ShoppingBag.
- Visible uniquement quand `getTotalItems() > 0`.
- Clic → `toggleDrawer()` (ouvre le CartDrawer).

### Fichiers créés
| # | Fichier | Rôle |
|---|---------|------|
| 1 | `src/lib/cart-store.ts` | Zustand store multi-produit (persist localStorage) |
| 2 | `src/components/preview/CartDrawer.tsx` | Slide-over cart drawer (design system PDP) |

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `prisma/schema.prisma` | `OrderItem` model + `Order.items[]` relation |
| 2 | `src/app/globals.css` | 12 variables CSS design system + prix `--price-charcoal: #121212` |
| 3 | `src/types/index.ts` | `GuaranteeKey` étendu `'sav'` |
| 4 | `src/components/TrustGuaranteesSection.tsx` | 5ème garantie `sav` + `Headphones` icon + grid lg:grid-cols-5 |
| 5 | `src/components/settings/TrustGuaranteesPillar.tsx` | 5ème garantie `sav` + `Headphones` + default config |
| 6 | `src/lib/i18n/dictionaries.ts` | 69 clés i18n (trust.sav + cart + checkout + sav) × 3 locales |
| 7 | `src/components/preview/CatalogPreview.tsx` | Import CartDrawer + CartHeaderButton + rendu |
| 8 | `PROJECT_MAP.md` | VG34 + P31 + section documentation |

### Vérifications
- `bun run db:push` : table `order_items` créée ✅
- `bun run lint` : 0 erreur, 0 warning ✅
- E2E vitrine : trust section + footer (non-régression) ✅

### Branche
`feature/checkout-ui-integration` (créée depuis `main@ce43b54`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [VG34.1 — RECTIFICATION POST-AUDIT NO-GO]

### Contexte
L'audit du commit `a0b1edd` a identifié 3 anomalies bloquantes (🔴 NO-GO). Cette rectification les résout toutes les 3 sur la même branche `feature/checkout-ui-integration`.

### Anomalie 1 — Panier déconnecté (addItem non appelé) → RÉSOLUE
- **ProductPage.tsx** : `useCartStore` importé + `handleAddToCart()` fonction qui appelle `addItem()` avec productId, title, price, color, size, image. Bouton « Ajouter au panier » (vert deep #14241E + accent or #C5A059) ajouté sous le CTA existant. Incrémente le badge du header SANS ouvrir le drawer (comportement PDP conforme au mandat).
- **CatalogPreview.tsx** : le hover CTA « COMMANDER » appelle désormais `cartAddItem()` + `cartOpenDrawer()` (quick buy : ajoute au panier + ouvre le drawer). `useCartStore` importé dans le composant principal.

### Anomalie 2 — Prix non harmonisé (#121212) → RÉSOLUE
- `.product-page-price` : `var(--client-text-price)` → `var(--price-charcoal, #121212)` ✅
- `.product-hero-price` : `var(--client-text-price)` → `var(--price-charcoal, #121212)` ✅
- `.mobile-cta-price` : `var(--client-text-price)` → `var(--price-charcoal, #121212)` ✅
- `.product-card-price` : déjà `var(--price-charcoal, #121212)` (VG34) ✅
- `CartDrawer.tsx` : prix articles + total en `var(--price-charcoal, #121212)` ✅
- Le gold shimmer (décoratif) conserve `var(--client-text-price)` (effet de brillance, pas un prix).

### Anomalie 3 — Polices arabes manquantes (Beiruti & Tajawal) → RÉSOLUE
- **layout.tsx** : `Beiruti` (titres, weights 400-700) + `Tajawal` (corps, weights 400-700) importés via `next/font/google` avec variables CSS `--font-beiruti` + `--font-tajawal`. Appliqués au `<body>` className.
- **globals.css** : règles CSS `html[lang="ar"]` qui appliquent Beiruti aux titres (h1-h6, .product-page-title, .product-card-title, etc.) et Tajawal au corps (p, span, label, input, button, a, div).

### Fichiers modifiés (rectification)
| # | Fichier | Correction |
|---|---------|------------|
| 1 | `src/components/preview/ProductPage.tsx` | Import `useCartStore` + `handleAddToCart()` + bouton « Ajouter au panier » |
| 2 | `src/components/preview/CatalogPreview.tsx` | Import `useCartStore` + hover CTA → `cartAddItem()` + `cartOpenDrawer()` |
| 3 | `src/app/globals.css` | Prix #121212 (product-page-price, product-hero-price, mobile-cta-price) + AR font CSS rules |
| 4 | `src/app/layout.tsx` | Import `Beiruti` + `Tajawal` via `next/font/google` + variables CSS + `<body>` className |
| 5 | `PROJECT_MAP.md` | Section VG34.1 rectification |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅
- `addItem()` appelé dans ProductPage (handleAddToCart) + CatalogPreview (hover CTA) ✅
- 4 localisations prix → `var(--price-charcoal, #121212)` ✅
- Beiruti + Tajawal chargés via next/font/google + CSS `html[lang="ar"]` ✅

---
Date de mise à jour : 22/07/2026

## [VG34.2 — CORRECTIONS CONSOLIDATED (Post-Audit NO-GO Phase 2)]

### Contexte
L'audit post-VG34.1 a identifié 4 axes d'anomalies sur main@4c918a8. Cette correction consolidée les résout toutes sur la branche `fix/vg34-corrections-consolidated`.

### Axe A — PDP & CodForm
- **CodForm.tsx** (266 lignes, orphelin) → **réintégré dans ProductPage.tsx** : importé et rendu inline sous les boutons CTA (formulaire COD direct sur la PDP).
- **TrustGuaranteesSection** → **importé dans ProductPage.tsx** : rendu sous la galerie d'images (entre le carousel et la colonne détails).

### Axe B — Navigation & Cart
- **Hover CTA** (CatalogPreview.tsx) : `cartAddItem + cartOpenDrawer` → **`setSelectedProduct`** (ouvre la PDP au lieu du drawer).
- **CartDrawer checkout** : `window.location.href = '/?checkout=true'` → **callback `onCheckout`** passé par CatalogPreview qui déclenche `setCheckoutData` (checkout view sans rechargement).
- **Header badge** : `backgroundColor: var(--vert-deep, #14241E)` → **`rgba(255,255,255,0.9)` + backdrop-filter** (cercle blanc vitré au lieu du vert en dur).

### Axe C — Crash Admin Confiance
- **TrustGuaranteesPillar.tsx L.130** : `config.items[key][lang]` → **`config.items[key]?.[lang] ?? { title: '', description: '' }`** (optional chaining + fallback).
- **L.67** (updateItem) : même garde-fou défensif. Les configs legacy à 4 clés (pré-VG34) ne crashent plus.

### Axe D — i18n
- 9 libellés hardcoded FR dans TrustGuaranteesPillar → **remplacés par `t('trust.admin.*')`** (sectionTitle, toggleLabel, toggleDesc, editLang, default, fieldTitle, fieldDesc, emptyHint, save).
- 27 clés i18n `trust.admin.*` ajoutées (9 × 3 locales FR/EN/AR) dans dictionaries.ts.

### Fichiers modifiés
| # | Fichier | Correction |
|---|---------|------------|
| 1 | `src/components/settings/TrustGuaranteesPillar.tsx` | P0 crash fix (optional chaining) + i18n (9 libellés → t()) |
| 2 | `src/components/preview/ProductPage.tsx` | Import CodForm + TrustGuaranteesSection + rendu |
| 3 | `src/components/preview/CatalogPreview.tsx` | Hover CTA → PDP + header badge blanc + CartDrawer onCheckout callback |
| 4 | `src/lib/i18n/dictionaries.ts` | 27 clés trust.admin.* (9 × 3 locales) |
| 5 | `PROJECT_MAP.md` | Section VG34.2 |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅

### Branche
`fix/vg34-corrections-consolidated` (créée depuis `main@4c918a8`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [VG34.5 — PDP LAYOUT RESTRUCTURE (pdp-grid injection)]

### Contexte
Le rappel de mission a identifié que les micro-correctifs VG34.3 n'avaient pas réorganisé la mise en page globale. Cette injection remplace la structure `product-page-layout` par la grille `pdp-grid` du code de référence.

### Restructuration effectuée

#### ProductPage.tsx — Remplacement complet de la mise en page
Ancienne structure (supprimée) :
```
<main className="product-page">
  <div className="product-page-layout">     ← flex, pas grid
    <div className="product-page-gallery">  ← colonne gauche
    <div className="product-page-info">     ← colonne droite
      <div className="product-page-info-inner">
```

Nouvelle structure (injectée) :
```
<main className="product-page pdp-wrapper">
  <div className="pdp-grid">                ← CSS grid 1.1fr 1fr @850px
    <div className="pdp-gallery-section">   ← colonne gauche
      <div className="pdp-main-image-frame">← galerie
      <div className="pdp-thumbnail-row">   ← miniatures
      <div className="pdp-under-image-space">← social + guarantees
    <div className="pdp-details-section">   ← colonne droite
      <h1 className="pdp-product-title">    ← titre Playfair
      <div className="pdp-price-row">       ← prix #121212
      <div className="pdp-sizes-row">       ← tailles
      <div className="pdp-qty-picker">      ← quantité
      <div className="pdp-cta-duo-container">← duo boutons
        <button className="pdp-btn-buy-now">  ← vert deep + gold
        <button className="pdp-btn-add-cart"> ← beige
      <CodForm>                             ← formulaire COD gold border
  <div className="pdp-conversion-texts-container"> ← SAV blocks
```

#### Classes `.pdp-*` appliquées (35 occurrences dans ProductPage.tsx)
- `pdp-wrapper`, `pdp-grid`, `pdp-gallery-section`, `pdp-main-image-frame`, `pdp-thumbnail-row`, `pdp-thumb-box`, `pdp-under-image-space`, `pdp-social-icons-group`, `pdp-social-circle-btn`, `pdp-guarantees-row`, `pdp-guarantee-item`, `pdp-guarantee-circle-icon`, `pdp-guarantee-label`, `pdp-details-section`, `pdp-product-title`, `pdp-price-row`, `pdp-current-price`, `pdp-old-price`, `pdp-discount-badge`, `pdp-sizes-row`, `pdp-size-btn`, `pdp-qty-picker`, `pdp-qty-btn`, `pdp-qty-val`, `pdp-cta-duo-container`, `pdp-btn-buy-now`, `pdp-btn-add-cart`, `pdp-conversion-texts-container`, `pdp-sav-block`, `pdp-sav-title`, `pdp-sav-description`

#### globals.css — 56 classes `.pdp-*` + 12 variables VG34
- Bloc VG34 design system restauré (`--bg-app`, `--vert-deep`, `--gold-accent`, `--border-soft`, `--price-charcoal`, etc.)
- CodForm gold border (`2px solid var(--gold-accent)`)
- 56 classes `.pdp-*` injectées (wrapper, grid responsive, gallery, social, guarantees, details, sizes, qty, CTA duo, COD form, SAV blocks) + règles RTL `html[lang="ar"]`

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/components/preview/ProductPage.tsx` | Restructuration complète : `product-page-layout` → `pdp-wrapper` + `pdp-grid` |
| 2 | `src/app/globals.css` | 56 classes `.pdp-*` + 12 variables VG34 + CodForm gold border + RTL |
| 3 | `PROJECT_MAP.md` | Section VG34.5 |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅
- 35 classes `.pdp-*` dans ProductPage.tsx ✅
- 56 classes `.pdp-*` dans globals.css ✅
- 12 variables VG34 dans globals.css ✅
- Anciennes classes (`product-page-layout`, `product-page-gallery`, `product-page-info-inner`) supprimées du JSX ✅

### Branche
`feat/pdp-redesign-and-ui-fixes` (recréée depuis `main@fabfd71`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [VG34.6 — PDP PIXEL-PERFECT LAYOUT]

### 5 Corrections chirurgicales

#### FIX 1 — Alignement supérieur du Titre (Haut Image = Haut Titre)
- `.pdp-grid` : `align-items: flex-start` ajouté → les colonnes galerie et détails démarrent au même niveau Y.

#### FIX 2 — Cadre d'image fixe & Ratio d'Or (Zéro Déformation)
- `.pdp-main-image-frame` : `height: 480px` → `aspect-ratio: 1 / 1.618` (Nombre d'Or φ≈1.618) + `max-height: 600px`.
- `.product-page-img` : `object-fit: cover` → l'image s'adapte au cadre fixe, jamais l'inverse.
- `.product-page-carousel-slide` : `height: 100%` pour remplir le cadre.

#### FIX 3 — Miniatures en mini-slider avec flèches
- `.pdp-thumbnail-row` : `overflow-x: auto` + `scroll-behavior: smooth` + `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` (scrollbar cachée).
- `.pdp-thumb-slider-wrapper` : conteneur relatif pour les flèches.
- `.pdp-thumb-arrow` (left/right) : boutons circulaires blancs avec bordure `--border-soft`, position absolute, `scrollBy({ left: ±160, behavior: 'smooth' })` au clic.
- JSX : flèches `<` et `>` encadrant la rangée de miniatures.

#### FIX 4 — Couleurs limitées à 5 + pastille +N + Modal
- `MAX_VISIBLE_COLORS` : 11 → **5** (max 5 pastilles visibles).
- `colorOverflow` : déclenché si > 5 (au lieu de > 12).
- Container couleurs : `grid grid-cols-6` → **`flex flex-nowrap`** avec `gap: 10px` (une seule ligne, espacement resserré).
- Pastille `+N` conservée (ouvre le Sheet/Modal existant avec toutes les couleurs).

#### FIX 5 — Compactage du rythme vertical
- `.pdp-details-section` : `gap: 18px` → **`gap: 12px`** (compacté).
- `.product-page-section` dans détails : `margin-bottom: 0` + `gap: 6px`.
- `.product-page-section-title` : `margin-bottom: 2px`.

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/app/globals.css` | FIX 1 (align-items) + FIX 2 (aspect-ratio + object-fit) + FIX 3 (thumbnail slider + arrows + hidden scrollbar) + FIX 5 (gap 12px) |
| 2 | `src/components/preview/ProductPage.tsx` | FIX 3 (arrows JSX) + FIX 4 (MAX_VISIBLE_COLORS=5 + flex nowrap) |
| 3 | `PROJECT_MAP.md` | Section VG34.6 |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅
- FIX 1: `align-items: flex-start` ✅
- FIX 2: `aspect-ratio: 1 / 1.618` + `object-fit: cover` ✅
- FIX 3: `pdp-thumb-slider-wrapper` + `pdp-thumb-arrow` + `scrollbar-width: none` ✅
- FIX 4: `MAX_VISIBLE_COLORS = 5` + `flex-nowrap` ✅
- FIX 5: `gap: 12px` ✅

### Branche
`fix/pdp-pixel-perfect-layout` (créée depuis `main@fb39cb1`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [VG34.7 — PDP REFINEMENT & COD FORM REFOCUS]

### Corrections appliquées

#### A. Dilatation et déformation de l'image principale
- `.pdp-gallery-section` : `max-width: 480px` ajouté → la colonne galerie ne peut pas s'élargir au-delà de 480px.
- `.pdp-main-image-frame` : `aspect-ratio: 1 / 1.618` (Ratio d'Or) + `object-fit: cover` (déjà en place depuis VG34.6, confirmé intact).

#### B. Refonte du Formulaire COD (CodForm.tsx)
- **Supprimé** : toutes les icônes SVG intérieures (User, Phone, MapPin, Home), `cod-form-input-wrapper`, `cod-form-input-icon`, `cod-form-product-summary`, `cod-form-trust` (texte de réassurance sous le bouton), `cod-form-header-icon` (icône ShoppingBag), `cod-form-label` gras → remplacés par des labels fins (`pdp-form-label`).
- **En-tête 1 ligne** : `.pdp-form-header` avec titre à droite + badge COD `⚡` à gauche (rouge/orange).
- **4 champs épurés** : `.pdp-input-field` (paddings 14px, bordures `--border-soft`, pas d'icônes). Labels `pdp-form-label` non gras avec `margin-bottom: 2px`.
- **Total à payer** : ligne récapitulative dynamique juste au-dessus du bouton avec `formatPrice(productPrice)` + bordures top/bottom `--border-soft`.
- **Bouton** : `.pdp-btn-confirm-order` (vert deep `--vert-deep`) avec icône Check doré (`--gold-accent`). Suppression du pied de page sous le bouton.

#### C. Flèches de miniatures inversées + scrollBy corrigé
- Flèche gauche : `‹` → **`›`** (pointe vers l'extérieur gauche en RTL).
- Flèche droite : `›` → **`‹`** (pointe vers l'extérieur droit en RTL).
- `scrollBy` : `±160` → **`±200`** (défilement plus ample).

#### D. Déséquilibre du rythme vertical et alignement des icônes
- `.pdp-under-image-space` : `justify-content: space-between` + `flex-grow: 1` → répartition égale (miniatures ↔ social = social ↔ garanties).
- `.pdp-guarantee-circle-icon` : `44px` → **`36px`** (réduit, garde la dominance visuelle).
- `.pdp-social-circle-btn` : `flex-shrink: 0` ajouté + SVG `18px` explicite (plus visibles mais restent plus petits que les garanties).

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/components/preview/CodForm.tsx` | Refonte complète : suppression icônes/headers/trust, 4 champs épurés, total line, bouton vert deep + Check doré |
| 2 | `src/app/globals.css` | FIX A (max-width 480px galerie) + FIX D (guarantee 36px, social flex-shrink, under-image space-between) |
| 3 | `src/components/preview/ProductPage.tsx` | FIX C (flèches inversées + scrollBy 200) |
| 4 | `PROJECT_MAP.md` | Section VG34.7 |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅

### Branche
`fix/pdp-refinement-and-cod-form` (créée depuis `main@e5a7b5b`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026

## [VG34.8 — PDP RESPONSIVE REFINEMENT]

### Corrections appliquées

#### A. Hauteur instable de l'image principale
- `.pdp-main-image-frame` : `aspect-ratio: 1 / 1.75` (cadre portrait allongé, +10% vs golden ratio 1.618) + `max-height: 620px` + `min-height: 400px` + `object-fit: cover` strict → hauteur fixe, aucune fluctuation selon la taille du fichier image.

#### B. Hauteur excessive du Formulaire COD
- `.pdp-form-label` : `font-weight: 700` → **`400`** (non gras) + `font-size: 0.85rem` → **`0.8rem`** (12-13px) + `color: var(--vert-deep)` → **`var(--text-muted)`** (discret).
- `.pdp-input-field` : `padding: 14px 16px` → **`10px 14px`** + `border-radius: 10px` → **`8px`** + `height: 40px` fixe (compact).
- CodForm `gap: 8px` → **`6px`** (espacement vertical réduit).

#### C. Proportions et espacements des icônes
- **Icônes réseaux sociaux** : `38px` → **`40px`** cercles + `gap: 12px` → **`15px`** + SVG `18px` → **`20px`** (plus visibles, `!important` pour override lucide).
- **Icônes de garantie** : `36px` → **`50px`** cercles + `gap: 16px` → **`20px`** (harmonisées, dominantes vs social 40px).
- **Ligne de séparation** : `padding-top: 5px` → **`0`** + `border-top: none` ajouté (séparateur supprimé).
- **Espace vertical** : `gap: 18px` → **`14px`** + `min-height: 120px` → **`100px`** (plus fluide).

#### D. Sens des flèches de miniatures
- Flèche gauche : `›` → **`‹`** (pointe vers l'extérieur gauche).
- Flèche droite : `‹` → **`›`** (pointe vers l'extérieur droit).
- `scrollBy: ±200` conservé (défilement fluide).

### Fichiers modifiés
| # | Fichier | Modification |
|---|---------|-------------|
| 1 | `src/app/globals.css` | FIX A (aspect-ratio 1/1.75) + FIX B (label font-weight 400, input height 40px) + FIX C (social 40px, guarantee 50px, border-top none, gap 14px) |
| 2 | `src/components/preview/ProductPage.tsx` | FIX D (flèches ‹ gauche, › droite) |
| 3 | `src/components/preview/CodForm.tsx` | FIX B (gap 6px) |
| 4 | `PROJECT_MAP.md` | Section VG34.8 |

### Vérifications
- `bun run lint` : 0 erreur, 0 warning ✅

### Branche
`fix/pdp-responsive-refinement` (créée depuis `main@b95f7bd`) — **EN ATTENTE D'AUDIT** (aucune fusion sur main).

---
Date de mise à jour : 22/07/2026
