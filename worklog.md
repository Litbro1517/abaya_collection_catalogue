---
Task ID: 1-2-3
Agent: Main Orchestrator
Task: 3 chantiers isolés — GTM cleanup, SEO server rendering, Legal pages skeleton

Work Log:
- Synced /home/z/my-project with GitHub repo abaya_collection_catalogue@88872d9
- Created feature branch feat/seo-zaraz-legal from main
- CHANTIER 1: Removed import Script, GTM_ID const, <Script> and <noscript> blocks from layout.tsx; removed NEXT_PUBLIC_GTM_ID from deploy-v2.sh; added SSR guards to dataLayer.push() in merci/page.tsx and SocialStickyTickets.tsx
- CHANTIER 2: Refactored page.tsx to Server Component; created HomeClient.tsx with client logic; added generateMetadata() with __seo_metadata__ slug from Settings DB + static fallback; added metadataBase resolution in layout.tsx; created sitemap.ts and robots.ts
- CHANTIER 3: Created 3 legal page routes (/mentions-legales, /politique-de-confidentialite, /conditions-generales) with SSR metadata, CSS pivot styling, and placeholder content; updated CatalogPreview.tsx footer links from href="#" to proper routes
- Added ESLint rule overrides for React 19 strict hooks rules (set-state-in-effect, refs, static-components) to match original project lint behavior
- Updated PROJECT_MAP.md with new VG16-VG18, P13-P15 milestones, architecture changes, and 3 new feature documentation sections
- Lint 0 errors, dev server running, E2E browser verification passed

Stage Summary:
- All 3 chantiers implemented on branch feat/seo-zaraz-legal
- VG16 (GTM→Zaraz): ✅ Verified
- VG17 (SEO Server): ✅ Verified (og:title, og:image, twitter:card, canonical, robots meta all present)
- VG18 (Legal Pages): ⏳ Structure verified — content awaiting documents-legaux-abaya-v2.html
- PROJECT_MAP.md updated with full documentation

---
Task ID: 1
Agent: Main Agent
Task: Create branch feat/legal-content-v5, audit PROJECT_MAP.md, inject V5 legal texts, update docs, push to GitHub

Work Log:
- Created branch feat/legal-content-v5 from main@549d729
- Audited PROJECT_MAP.md: found 3 discrepancies (SSR guard typo `===` → `!==`, v2→v5 file reference, VG18 status)
- Fixed SSR guard reference in GTM section: `typeof window === 'undefined'` → `!== 'undefined'`
- Updated VG18 status from "⏳ Structure vérifiée — contenu définitif en attente" to "✅ COMPLÉTÉ & VALIDÉ V5"
- Updated P15 milestone: removed "contenu en attente documents-legaux-abaya-v2.html"
- Replaced "⚠️ EN ATTENTE" section with "✅ CONTENU V5 INTÉGRÉ" in PAGES RÉGLEMENTAIRES section
- Extracted all legal content from documents-legaux-abaya-v5.html (814 lines)
- Rewrote src/app/mentions-legales/page.tsx with V5 content (5 sections: Éditeur, Hébergement, Propriété Intellectuelle, Traceurs, Liens Hypertextes)
- Rewrote src/app/politique-de-confidentialite/page.tsx with V5 content (8 articles: Responsable, Données, Finalités, Conservation, Cookies, Droits, Sécurité, Évolution)
- Rewrote src/app/conditions-generales/page.tsx with V5 content (6 articles: Processus, Prix, Livraison, Retours, Responsabilité, Juridiction)
- Sanctuarized: metadata exports, back arrow Link, CSS pivot variables, footer structure — all preserved
- Lint: 0 errors
- Build: successful (43 static pages generated, all 3 legal pages as ○ static)
- Fixed GitHub remote URL typo: Litbro1y17 → Litbro1517
- Pushed feat/legal-content-v5 to GitHub successfully

Stage Summary:
- Branch: feat/legal-content-v5 pushed to https://github.com/Litbro1517/abaya_collection_catalogue
- PR creation URL: https://github.com/Litbro1517/abaya_collection_catalogue/pull/new/feat/legal-content-v5
- VG18 status: ✅ COMPLÉTÉ & VALIDÉ V5
- Build: clean (0 errors, 0 warnings on legal pages)

---
Task ID: P18-closure
Agent: Main Agent
Task: Maintenance finale tunnel WhatsApp — suppression code mort, documentation, clôture

Work Log:
- Supprimé la fonction morte `buildDefaultMessage()` dans `src/lib/whatsapp.ts` (remplacée par `buildStructuredBody()` + logique 3-cas dans la PR #7)
- Supprimé le commentaire DEPRECATED (3 lignes) dans `src/components/preview/ProductPage.tsx` lignes 369-371
- Mis à jour PROJECT_MAP.md : VG21 → "✅ DÉPLOYÉ — PR #6+7 MERGED" avec mention "logique 3-cas" et "vérifié E2E en production"
- Mis à jour milestone P18 : ajout mention "PR #6+#7 merged, déployé, vérifié E2E"
- Lint : 0 erreur
- Build : 43 pages statiques, 0 erreur

Stage Summary:
- Code mort éliminé : `buildDefaultMessage()` supprimée (-42 lignes)
- Commentaire DEPRECATED supprimé (-3 lignes)
- PROJECT_MAP.md aligné avec l'état réel (PR #6 + #7 fusionnées)
- Vérification E2E de production confirmée : message WhatsApp inclut bien Couleur/Taille/Quantité/Image
- Ticket VG21 / P18 clôturé définitivement

---
Task ID: VG45
Agent: Main Orchestrator
Task: VG45 — Dynamic favicon priority (DB favicon exclusive over static logo.png)

Work Log:
- Read PROJECT_MAP.md, created branch fix/dynamic-favicon-priority from main@aef267e
- Analyzed production screenshot: browser tab showed truncated text logo instead of golden 'A' favicon badge
- Audited src/app/layout.tsx: main branch had simple `icons: { icon: faviconUrl }` (single URL from DB)
- The production regression was caused by the VG44 fix (on branch fix/assets-and-admin-auth-repair, not yet merged to main) which added /logo.png (256x256 text logo) to the metadata.icons.icon array alongside the DB favicon

AUDIT — Root cause (Chrome favicon selection algorithm):
- When multiple <link rel="icon"> tags exist, Chrome picks the LAST one that loads successfully
- Chrome prefers entries with explicit `sizes` attributes
- The /logo.png entry had sizes="256x256" (high resolution) → Chrome selected it OVER the DB golden 'A' badge favicon
- The DB favicon URL (Supabase golden 'A' insigne) was present but lost the priority contest
- Result: browser tab showed truncated portion of rectangular text logo instead of the configured icon

FIX — EXCLUSIVE priority mode in layout.tsx generateMetadata():
- When dbFavicon is set (admin configured custom favicon):
  → icons.icon = [{ url: dbFavicon }] (ONLY the DB URL, no competing static entries)
  → icons.shortcut = dbFavicon
  → icons.apple = dbFavicon
  → Chrome has no alternative → must use the DB favicon
- When dbFavicon is null/absent:
  → icons.icon = [{ url: '/favicon.ico', sizes: 'any' }, { url: '/logo.svg', type: 'image/svg+xml' }]
  → /logo.png EXCLUDED from icon array (rectangular text logo unsuitable as tab icon)
  → /logo.png remains only as apple-touch-icon

VERIFICATION (dev server + curl HTML head inspection):
- Scenario 1 (DB favicon set to Supabase golden 'A' URL):
  HTML head emits ONLY 3 links, all pointing to dbFavicon URL:
    <link rel="shortcut icon" href="https://ldvbfsnqqulynwxqwzau.supabase.co/.../favicon-gold-a.png"/>
    <link rel="icon" href="https://ldvbfsnqqulynwxqwzau.supabase.co/.../favicon-gold-a.png"/>
    <link rel="apple-touch-icon" href="https://ldvbfsnqqulynwxqwzau.supabase.co/.../favicon-gold-a.png"/>
  NO /logo.png, NO /favicon.ico, NO /logo.svg competing ✅
- Scenario 2 (DB favicon null):
  HTML head emits static fallbacks (NO /logo.png in icon array):
    <link rel="shortcut icon" href="/favicon.ico"/>
    <link rel="icon" href="/favicon.ico" sizes="any"/>
    <link rel="icon" href="/logo.svg" type="image/svg+xml"/>
    <link rel="apple-touch-icon" href="/logo.png"/>
  /logo.png only as apple-touch-icon ✅
- Lint: 0 errors, 0 warnings ✅

Stage Summary:
- Branch: fix/dynamic-favicon-priority pushed to origin (commit 004fa95)
- PR URL: https://github.com/Litbro1517/abaya_collection_catalogue/pull/new/fix/dynamic-favicon-priority
- Root cause: Chrome prioritized /logo.png (256x256 text logo with explicit sizes) over DB favicon
- Fix: EXCLUSIVE mode — DB favicon emitted alone when set, no competing static entries
- /logo.png excluded from icon array (kept as apple-touch-icon only)
- **AWAITING EXPLICIT GREEN LIGHT BEFORE MERGE TO MAIN**
