# PROJECT_MAP.md — Abaya Collection Catalogue

## [TECH_STACK]
| Composant | Version | Notes |
|---|---|---|
| Runtime | Bun latest | Gestionnaire de paquets + runtime |
| Framework | Next.js 16.1.3 (App Router, Turbopack) | Route unique : / |
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
  │   ├─ page.tsx                    # Route UNIQUE (/) — CatalogPreview
  │   ├─ admin/page.tsx              # BuilderShell (admin)
  │   ├─ merci/page.tsx              # Post-commande → redirect /
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

## [ORPHANS_AND_PENDING]

### 🔴 Gelé — Hors scope V1, ne pas implémenter
- [ ] **Intégration tracking externe Zara** — Aucun code existant, spécification non fournie
- [ ] **Synchronisation colonnes Relation V2** — Relation actuelle fonctionne en lecture seule ; l'écriture croisée est gelée
- [ ] **Compression des médias** — Sharp installé mais aucun pipeline de compression configuré
- [ ] **Migration vers next-intl** — Package installé mais inutilisé ; le système custom fonctionne ; migration = réécriture complète
- [ ] **SSR i18n correct** — layout.tsx hard-code lang="fr" ; ThemeInjector override côté client ; correction SSR nécessite un refactor du layout
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

## [MILESTONES]
- ✅ S1–S5 : Réconciliation couleurs (READ + WRITE)
- ✅ P0 : PROJECT_MAP.md initialisé
- ✅ P1–P4 : Réparation RTL carrousel (Point A + B)
- ✅ P5 : Vérification VG1–VG7
- ✅ P6 : Restauration upload (route `/api/upload` hybride Supabase + fallback local)
- ✅ P7 : Traduction catégories footer (`cat.label` → `resolveT(cat.translations, cat.label)`)
- ✅ P8 : Bouton refresh admin verrouillé pendant sync + logo footer inversé sur fond sombre
- ✅ P9 : Double parcours WhatsApp/Landing restauré + lien de partage dynamique ?mode=
