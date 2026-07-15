# NOTE_REOUVERTURE_MARKETING.md — Mémoire Post-Publication V1

> Ce document liste exclusivement les chantiers reportés après la publication de la V1.
> Aucun élément ci-dessous ne doit être entamé avant la réouverture marketing validée.

---

## État de la V1 Stable

- **HEAD** : commit `43f9ab3` — Merge feat/native-colors-fix
- **Statut** : Production fonctionnelle, 15 vérifiables validés (VG1–VG15)
- **Déploiement** : Vercel (auto depuis GitHub), projet `abaya-collection-catalogue-9dum`

## Branches Archivées (maintenance temporaire)

| Branche | Dernier commit | Objet | Action |
|---|---|---|---|
| `feat/native-colors-fix` | `05ba779` | Patch 7-points __colors__ (mergeé dans main) | Conserver 30 jours puis supprimer |
| `feat/upload-route-v2` | `f7e8910` | Route upload + garde catalogId (mergeé dans main) | Conserver 30 jours puis supprimer |

---

## Chantiers Reportés (Post-Lancement)

### 1. Gestion dynamique des variantes WhatsApp
- **État actuel** : `conversionChannel` est un champ statique dans CatalogSettings (`"whatsapp"` par défaut). Le bascuule WhatsApp ↔ Landing est opérationnel mais le channel n'est pas configurable dynamiquement par section ou par produit.
- **Reporté car** : Nécessite une refonte du modèle Section.config et du CatalogPreview pour supporter une logique de routage par variante. Impact UI lourd.
- **Réouverture** : Ajouter un sélecteur de canal par section dans SectionConfigurator + routage conditionnel dans CatalogPreview.

### 2. Intégration des polices officielles de la charte graphique
- **État actuel** : `fontFamily: "inter"` par défaut dans CatalogSettings. Les polices arabes (Amiri, Tajawal) et françaises (Playfair Display, etc.) de la marque ne sont pas intégrées.
- **Reporté car** : Nécessite l'ajout de Google Fonts ou font-files locaux, la gestion du chargement conditionnel (FR ↔ AR), et la mise à jour du ThemeInjector. Charge perf à évaluer.
- **Réouverture** : Intégrer les fonts via `next/font`, ajouter les variants dans CatalogSettings, adapter le CSS dynamique.

### 3. Compression et optimisation des médias
- **État actuel** : Sharp installé mais aucun pipeline de compression. Les images Google Drive sont servies via proxy sans optimisation.
- **Reporté car** : Nécessite un worker de traitement d'image + cache CDN. Hors scope V1.
- **Réouverture** : Ajouter un endpoint `/api/optimize` + intégration Vercel Blob ou Cloudflare Images.

### 4. SSR i18n correct
- **État actuel** : `layout.tsx` hard-code `lang="fr"`. ThemeInjector override côté client uniquement. Les crawleurs voient toujours FR.
- **Reporté car** : Correction nécessite un refactor du layout racine + potentiellement next-intl.
- **Réouverture** : Refactor `layout.tsx` pour lire le locale depuis le store ou les cookies.

### 5. Statut automation (Nouveau → Courant)
- **État actuel** : Le statut est toujours initialisé à "Courant" à l'import. Aucune logique de basculement automatique basée sur le temps ou les ventes.
- **Reporté car** : Spécification business non fournie.
- **Réouverture** : Définir les règles métier puis implémenter un cron ou un hook de vérification.

### 6. Tri avancé (presets de tri catalogue)
- **État actuel** : Le catalogue public trie par ordre de section puis par ordre de ligne. Pas de presets (prix croissant, nouveautés, etc.).
- **Reporté car** : Nécessite une refonte du CatalogPreview pour supporter le tri dynamique côté client.
- **Réouverture** : Ajouter un composant SortPresetBar + logique de tri dans CatalogPreview.

---

*Dernière mise à jour : 20 juin 2026 — Clôture V1*
