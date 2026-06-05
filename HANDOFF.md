# ═══════════════════════════════════════════════════════════════════
# HANDOFF TECHNIQUE — Abaya Collection Catalogue
# Version 2.0 — Avec audit des erreurs du précédent agent
# Date : 2025-07-28
# ═══════════════════════════════════════════════════════════════════

## ⚠️ AVERTISSEMENT — LIRE AVANT DE CODER

Le précédent agent a commis des erreurs graves. Ce document inclut maintenant
un audit complet (Section 0) pour éviter de les reproduire.
Les tokens d'accès sont dans le fichier local NEW_CHAT_STARTER.md (pas sur GitHub).

---

## 0. AUDIT — ERREURS À NE PAS REPRODUIRE

### ❌ ERREUR 1 : Ne pas lire les documents de contexte
HANDOFF.md existait mais n'a JAMAIS été lu.
→ **RÈGLE** : TOUJOURS lire HANDOFF.md et worklog.md AVANT de coder.

### ❌ ERREUR 2 : Implémenter des features non demandées
4 "points" (A, B, C, D) implémentés sans demande de l'utilisateur.
→ **RÈGLE** : Ne coder QUE ce que l'utilisateur demande. JAMAIS de "bonus".

### ❌ ERREUR 3 : Prétendre ne pas avoir les accès
`git remote -v` montrait le token. L'agent a dit "Aucun token GitHub".
→ **RÈGLE** : Vérifier `git remote -v`, `.env`, fichiers locaux AVANT de dire "pas d'accès".

### ❌ ERREUR 4 : Confusion entre projets Vercel
2 projets Vercel liés au même repo. L'agent a configuré le mauvais.
→ **RÈGLE** : Projet principal = `abaya-collection-catalogue-9dum` (ID: prj_ww4qMlcWgJGGUcrgz6t13GZ4IQih).

### ❌ ERREUR 5 : Ne pas comprendre le pipeline de déploiement
GitHub push → Vercel auto-deploy. L'agent a essayé de déployer manuellement.
→ **RÈGLE** : Push GitHub = déploiement auto. Pas d'action manuelle.

### ❌ ERREUR 6 : Remplacer du code existant sans vérifier
Modifications risquant de casser le système Statut/Cadenas.
→ **RÈGLE** : Toujours vérifier les features existantes après chaque modification.

### ❌ ERREUR 7 : Commit massif
Un seul commit avec 4 features non demandées.
→ **RÈGLE** : Un commit par feature/fix. Message clair.

---

## 1. IDENTITÉ DU PROJET

**Nom** : Abaya Collection Catalogue
**Type** : Application web de catalogue de collection d'abayas
**Concept** : 3 piliers — DONNÉES / MISE EN PAGE / PARAMÈTRES
**Statut** : En production, développement actif
**Langue** : Français (100%)

---

## 2. ACCÈS ET AUTORISATIONS

### GitHub
- **Repo** : `Litbro1517/abaya_collection_catalogue`
- **URL** : https://github.com/Litbro1517/abaya_collection_catalogue
- **Token** : Voir fichier local NEW_CHAT_STARTER.md (pas de secrets sur GitHub)
- **Remote** : Configuré avec token dans l'URL — vérifier avec `git remote -v`
- **Règle ABSOLUE** : GitHub = source de vérité. Push d'abord, Vercel déploie auto.

### Vercel — PROJET PRINCIPAL
- **Nom** : `abaya-collection-catalogue-9dum`
- **ID** : `prj_ww4qMlcWgJGGUcrgz6t13GZ4IQih`
- **URL** : https://abaya-collection-catalogue-9dum.vercel.app/
- **Token** : Voir fichier local NEW_CHAT_STARTER.md
- **⚠️** Il existe un 2ème projet `my-project` — NE PAS l'utiliser comme référence

### Base de données (Supabase PostgreSQL)
- Voir fichier `.env` local pour DATABASE_URL et DIRECT_URL
- **⚠️ CRITIQUE** : Prisma provider = `postgresql` (JAMAIS sqlite)

### Admin
- Voir chat source ou NEW_CHAT_STARTER.md pour credentials

---

## 3. STACK TECHNIQUE

- Next.js 16 (App Router) + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM → Supabase PostgreSQL
- Zustand + TanStack Query
- Custom Auth (cookie admin_token)
- Lucide React + Framer Motion + Sonner

---

## 4. FICHIERS CLÉS

```
src/app/page.tsx              # Route UNIQUE (/)
src/app/middleware.ts          # Protection routes (public_check bypass !)
src/components/BuilderShell.tsx
src/components/data/DataTable.tsx      # TABLE PRINCIPALE — Statut, Cadenas, Sélection
src/components/data/DataPillar.tsx     # Toolbar + State pendingStatusChanges
src/components/data/ColumnEditorDialog.tsx
src/types/index.ts
src/lib/store.ts
```

---

## 5. CHART GRAPHIQUE

- Or primaire : #C9A84C
- Vert forêt : #1A3C34
- Crème bg : #FAF8F5
- Beige : #F5F0E8
- Noir : #1A1A1A
- **PAS d'indigo/bleu**

---

## 6. SYSTÈME STATUT/CADENAS — CRITIQUE

- `data.__statut__` = 'Nouveau' | 'Courant'
- `data.__statut_locked__` = true/false
- Cadenas individuel : clic 🔒/🔓
- Verrouillage en masse : sélection → action bar
- Double-clic : dropdown (si déverrouillé)
- Sync différée : pendingStatusChanges → bouton Sync → DB

---

## 7. PIÈGES CONNUS

1. Prisma = postgresql (JAMAIS sqlite)
2. Middleware : public_check doit passer
3. .env : pas de guillemets
4. Slug colonne : JAMAIS modifier
5. Status slug : __statut__ (double underscore)
6. Lock dans data.__statut_locked__
7. Vercel = auto-deploy depuis GitHub
8. Port 3000 uniquement
9. Pas de localhost:port dans fetch
10. Route unique : seulement /

---

## 8. TÂCHES EN ATTENTE

### 🔴 Haute priorité
1. Statut automation (Nouveau → Courant auto)
2. Tri avancé (presets)
3. Merchandising catalogue

---

*Version 2.0 — 2025-07-28*
