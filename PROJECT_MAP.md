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
