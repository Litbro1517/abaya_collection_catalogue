# ═══════════════════════════════════════════════════════════════════
# TRANSFERT TECHNIQUE — NOUVEAU CHAT Z.ai Code
# Projet : Abaya Collection Catalogue
# Date : 2025-07-28
# Session source : web-8a131cab-c525-40e7-b0c3-1589a045d154
# Chat ID source : 7dc01f46-77bc-4d07-b109-c0820d29c74d
# ═══════════════════════════════════════════════════════════════════

## 1. IDENTITÉ DU PROJET

**Nom** : Abaya Collection Catalogue
**Type** : Application web de catalogue de collection d'abayas (robes traditionnelles)
**Concept** : 3 piliers — DONNÉES (tables dynamiques type Google Sheets) / MISE EN PAGE (catalogue visuel) / PARAMÈTRES (config catalogue)
**Statut** : En développement actif, déployé sur Vercel

---

## 2. ACCÈS ET AUTORISATIONS

### GitHub
- **Repo** : `Litbro1517/abaya_collection_catalogue`
- **URL** : `https://github.com/Litbro1517/abaya_collection_catalogue`
- **Token** : `[GITHUB_TOKEN]` (voir variables d'environnement ou chat source pour la valeur)
- **Remote configuré** : `https://x-access-token:[GITHUB_TOKEN]@github.com/Litbro1517/abaya_collection_catalogue.git`
- **Règle** : GitHub = source de vérité. TOUJOURS push sur GitHub d'abord, Vercel déploie auto.

### Vercel
- **Projet** : `abaya-collection-catalogue-9dum`
- **URL production** : `https://abaya-collection-catalogue-9dum.vercel.app/`
- **API Token** : `[VERCEL_TOKEN]` (voir variables d'environnement ou chat source pour la valeur)
- **Build command** : `prisma generate && next build`

### Base de données (Supabase PostgreSQL)
- **DATABASE_URL** : `[SUPABASE_POOLER_URL]` (voir fichier .env local pour la valeur)
- **DIRECT_URL** : `[SUPABASE_DIRECT_URL]` (voir fichier .env local pour la valeur)
- **⚠️ IMPORTANT** : Le provider Prisma DOIT être `postgresql` (était `sqlite` par erreur, corrigé)

### Admin
- **Email** : `[ADMIN_EMAIL]` (voir chat source pour la valeur)
- **Mot de passe** : `[ADMIN_PASSWORD]` (voir chat source pour la valeur)
- **Rôle** : owner

### Chat source (pour récupérer le contexte)
- **Session ID** : `web-8a131cab-c525-40e7-b0c3-1589a045d154`
- **Chat ID** : `7dc01f46-77bc-4d07-b109-c0820d29c74d`

---

## 3. STACK TECHNIQUE

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Base de données | Prisma ORM → Supabase PostgreSQL |
| State | Zustand (client) + TanStack Query (server) |
| Table | @tanstack/react-table |
| Drag & Drop | @dnd-kit |
| Auth | Custom (cookie `admin_token`, pas NextAuth) |
| Icons | Lucide React |
| Animations | Framer Motion |
| Notifications | Sonner (toast) |
| AI SDK | z-ai-web-dev-sdk |

---

## 4. ARCHITECTURE DES FICHIERS CLÉS

```
/home/z/my-project/
├── prisma/schema.prisma          # Modèles DB (DataSource, Column, Row, Catalog, Section, Component, AdminUser, etc.)
├── src/
│   ├── app/
│   │   ├── page.tsx              # Route unique (/) — charge BuilderShell, CatalogPreview ou AdminDashboard
│   │   ├── api/
│   │   │   ├── auth/             # Auth login/check/logout/change-password/admins
│   │   │   ├── catalog/          # CRUD catalog + sections + components
│   │   │   ├── datasources/      # CRUD datasources + columns + rows + export
│   │   │   ├── google/           # OAuth + sync + session
│   │   │   └── settings/         # Catalog settings CRUD
│   │   └── middleware.ts         # Protection routes /admin + API auth + admin write
│   ├── components/
│   │   ├── BuilderShell.tsx      # Shell principal (sidebar 3 piliers + contenu)
│   │   ├── LoginModal.tsx        # Modal de connexion
│   │   ├── data/
│   │   │   ├── DataPillar.tsx    # Section Données complète (toolbar + table + sidebar)
│   │   │   ├── DataTable.tsx     # Table dynamique avec édition inline, statut, cadenas, sélection
│   │   │   ├── ColumnEditorDialog.tsx
│   │   │   ├── ColumnVisibilityDropdown.tsx
│   │   │   ├── CreateDataSourceDialog.tsx
│   │   │   ├── ImportCSVDialog.tsx
│   │   │   ├── GoogleSheetsBrowser.tsx
│   │   │   ├── GoogleConnectPanel.tsx
│   │   │   ├── SyncStatusIndicator.tsx
│   │   │   └── RelationManager.tsx
│   │   ├── layout/
│   │   │   ├── LayoutPillar.tsx
│   │   │   ├── SectionConfigurator.tsx
│   │   │   ├── SectionList.tsx
│   │   │   └── AddSectionDialog.tsx
│   │   ├── settings/
│   │   │   ├── SettingsPillar.tsx
│   │   │   └── AdminUserManager.tsx
│   │   ├── preview/
│   │   │   └── CatalogPreview.tsx  # Vue publique du catalogue
│   │   ├── admin/
│   │   │   └── AdminDashboard.tsx   # Dashboard admin
│   │   └── ui/                     # Composants shadcn/ui
│   ├── types/index.ts             # Types TypeScript (Column, Row, DataSource, Catalog, etc.)
│   ├── lib/
│   │   ├── store.ts               # Zustand store global
│   │   ├── db.ts                  # Prisma client singleton
│   │   └── utils.ts               # cn() utility
│   └── middleware.ts
├── .env                           # Variables d'environnement (DB URLs)
├── worklog.md                     # Journal de travail des agents
└── HANDOFF.md                     # Ce document
```

---

## 5. CHART GRAPHIQUE

| Couleur | Hex | Usage |
|---------|-----|-------|
| Or (primaire) | `#C9A84C` | Boutons, accents, highlights, or border |
| Vert forêt | `#1A3C34` | Accents secondaires |
| Crème (background) | `#FAF8F5` | Background principal |
| Beige | `#F5F0E8` | Background secondaire / accents |
| Noir | `#1A1A1A` | Texte, secondary color |

---

## 6. ÉTAT D'AVANCEMENT — FONCTIONNALITÉS IMPLÉMENTÉES

### ✅ Réalisées et déployées
1. **Architecture 3 piliers** : Données / Mise en page / Paramètres — navigation sidebar
2. **Section Données complète** :
   - CRUD tables de données (DataSource)
   - CRUD colonnes avec types (TEXT, NUMBER, CURRENCY, IMAGE, IMAGE_ARRAY, SELECT, MULTI_SELECT, RELATION, ARRAY, BOOLEAN, URL, STATUS)
   - CRUD lignes avec édition inline
   - Import CSV
   - Connexion Google Sheets + import + synchronisation
   - Export CSV
3. **Système Statut + Cadenas** :
   - Colonne STATUS avec badges (🟢 Nouveau / 🔵 Courant)
   - Verrouillage individuel par clic sur 🔒/🔓 (cadenas)
   - **Verrouillage/déverrouillage en masse par sélection** (checkbox → action bar → Verrouiller/Déverrouiller)
   - Double-clic pour éditer le statut (uniquement si déverrouillé)
   - Synchronisation différée : changements locaux → bouton Sync → DB
4. **Moteur de filtres** : Filtrer par colonne avec opérateurs (égal, contient, est vide, etc.) — fonctionne avec STATUS
5. **Tri standardisé** : Cliquer en-tête ou menu options colonne → tri croissant/décroissant
6. **Menu options colonne** : ChevronDown → popover avec Éditer, Renommer, Trier, Dupliquer, Ajouter à droite, Visibilité, Supprimer
7. **Bouton "+" sticky** : Bouton d'ajout de colonne flottant en bas à droite
8. **Section Mise en page** : Catalogue avec sections (collection, hero, featured, text), composants configurables
9. **Section Paramètres** : Général, Apparence, Conversion, Affichage, Admin (gestion utilisateurs)
10. **Authentification** : Login email/mot de passe + Google OAuth, sessions cookies
11. **Middleware** : Protection routes /admin et API sensibles
12. **Aperçu catalogue public** : Vue publique sans authentification

### 🔧 Fixes critiques récents (session précédente)
- **Prisma sqlite→postgresql** : Schema était `sqlite` au lieu de `postgresql` → DB totalement cassée en production
- **Middleware public_check** : `?public_check=true` était bloqué → login page ne chargeait pas
- **Reset mot de passe admin** : Réinitialisé (voir chat source pour la valeur)

---

## 7. RÔLES STRATÉGIQUES ET TECHNIQUES DE Z.ai Code

### Rôle principal
Développeur full-stack senior du projet Abaya Collection Catalogue. Intervient sur :
- **Développement frontend** : Composants React/Next.js, UI/UX, responsive, animations
- **Développement backend** : API routes, Prisma ORM, middleware, auth
- **DevOps** : Déploiement GitHub→Vercel, variables d'environnement, debugging production
- **Architecture** : Conception de features, refactoring, optimisation

### Compétences Skills disponibles
- **LLM** : Chat IA, génération de texte
- **VLM** : Analyse d'images, compréhension visuelle
- **Image Generation** : Génération d'images AI
- **ASR** : Speech-to-text
- **Web Search** : Recherche web en temps réel
- **Web Reader** : Extraction contenu de pages web
- **Charts** : Création de graphiques et diagrammes
- **PDF/DOCX/XLSX/PPT** : Création de documents

### Règles de travail
1. **GitHub = source de vérité** — toujours push d'abord
2. **API routes** (pas de server actions)
3. **shadcn/ui** pour les composants UI (déjà installés dans `src/components/ui/`)
4. **z-ai-web-dev-sdk** côté backend UNIQUEMENT (jamais client-side)
5. **Frontend d'abord** : coder le UI, puis le backend
6. **Pas de tests** à écrire
7. **Port 3000** uniquement pour le dev server
8. **Pas de `bun run build`** — utiliser `bun run lint` pour vérifier
9. **Footer sticky** si présent
10. **Responsive obligatoire**

---

## 8. TÂCHES EN ATTENTE / PRIORITÉS

### 🔴 Priorité haute — Demandées par l'utilisateur
1. **Statut automation** : Automatiser le cycle de vie du statut (ex: Nouveau → Courant après X temps ou action)
2. **Tri standardisé avancé** : Presets de tri (Nouveau d'abord, plus récent d'abord, etc.)
3. **Merchandising catalogue** : Améliorer la présentation visuelle du catalogue public

### 🟡 Priorité moyenne — Améliorations continues
4. **Amélioration UX filtres** : Plus d'opérateurs, filtres combinés visuels
5. **Export avancé** : PDF, formats multiples
6. **Notifications** : Alertes temps réel sur changements

### 🟢 Priorité basse — Ideas
7. **Multi-langue** : i18n (next-intl déjà installé)
8. **Thème sombre** : next-themes déjà installé
9. **PWA** : Mode hors-ligne

---

## 9. MODÈLE PRISMA — SCHÉMA COMPLET

```prisma
// PILLIER 1: DONNÉES
DataSource  → Column[], Row[], Relation[]
Column      → dataSourceId, type (TEXT/NUMBER/CURRENCY/IMAGE/IMAGE_ARRAY/SELECT/MULTI_SELECT/RELATION/ARRAY/BOOLEAN/URL/STATUS), config (Json), visible, order
Row         → dataSourceId, data (Json), order

// PILLIER 2: MISE EN PAGE
Catalog     → Section[], CatalogSettings?
Section     → catalogId, type (collection/hero/featured/text), config (Json), visible, order
Component   → sectionId, type (card/carousel/grid/detail/button/text/image), config (Json)

// PILLIER 3: PARAMÈTRES
CatalogSettings → language, currency, whatsapp, colors, fonts, etc.

// AUTH
AdminUser   → email, role (owner/admin/editor), status, passwordHash, googleSub
AdminSession → token, adminId, expiresAt
AuditLog    → adminId, action, entity, details

// GOOGLE
GoogleSession → accessToken, refreshToken, tokenExpiry
Settings      → key/value store
```

---

## 10. SYSTÈME STATUT/CADENAS — DÉTAIL TECHNIQUE

### Fonctionnement
- Chaque ligne stocke dans `data.__statut__` le statut (`'Nouveau'` ou `'Courant'`)
- Chaque ligne stocke dans `data.__statut_locked__` un booléen (`true` = verrouillé)
- **Cadenas individuel** : Clic sur 🔒/_unlock dans la cellule → toggle `__statut_locked__`
- **Verrouillage en masse** : Sélection de lignes (checkbox) → action bar → boutons Verrouiller/Déverrouiller
- **Double-clic** sur cellule statut : ouvre dropdown (uniquement si déverrouillé)
- **Synchronisation différée** : Changements stockés dans `pendingStatusChanges` (state local DataPillar) → bouton Sync → PATCH batch vers DB → refresh

### Flux de données
```
User action → onLocalStatusChange/onLocalLockToggle (DataPillar)
  → setPendingStatusChanges (local state overlay)
  → DataTable reads pendingStatusChanges as overlay to display
  → Sync button clicked → batch API call → DB updated → onRefresh()
```

---

## 11. POINTS D'ATTENTION / PIÈGES CONNUS

1. **Prisma provider** : DOIT rester `postgresql`. Ne JAMAIS remettre `sqlite`.
2. **Middleware** : Les requêtes `?public_check=true` doivent passer sans auth.
3. **.env** : Pas de guillemets autour des URLs dans le fichier .env.
4. **Slug immuable** : Ne JAMAIS modifier le slug d'une colonne (casserait les données existantes).
5. **Status column** : Le slug est `__statut__` (double underscore), pas le slug normal de la colonne.
6. **Cadenas** : Le lock state est stocké dans `data.__statut_locked__`, pas dans `config.statusLocked`.
7. **Vercel deploy** : Auto-deploy depuis GitHub main. Pas besoin de déployer manuellement.
8. **Dev server** : Toujours `bun run dev` en arrière-plan sur port 3000.
9. **Pas de port dans les URLs API** : Utiliser `?XTransformPort=XXXX` pour le gateway.

---

## 12. COMMANDES UTILES

```bash
# Démarrer le dev server
bun run dev

# Vérifier le code
bun run lint

# Push schema DB
bun run db:push

# Git push (avec token)
git push origin main

# Vérifier les logs du dev server
cat /home/z/my-project/dev.log | tail -50

# Prisma generate
bun run db:generate
```

---

## 13. COMMENT UTILISER CE DOCUMENT

Pour ouvrir un nouveau chat Z.ai Code avec tout le contexte :

1. Copier ce document dans le premier message du nouveau chat
2. Ajouter : "Voici le contexte technique complet de mon projet. Merci de le lire et de continuer le développement."
3. Spécifier la tâche souhaitée

L'agent Z.ai Code pourra :
- Accéder au repo GitHub avec le token fourni
- Accéder au projet local `/home/z/my-project/`
- Comprendre l'architecture et les conventions
- Reprendre le développement où il en est

---

*Document généré le 2025-07-28 — Session web-8a131cab-c525-40e7-b0c3-1589a045d154*
