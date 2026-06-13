---
Task ID: 1
Agent: Main Agent
Task: Mandat Global de Déploiement V1 — GTM, Tracking & SEO Meta

Work Log:
- Reviewed existing codebase: GTM integration, WhatsApp tracking, SEO metadata were ALREADY implemented
- Fixed WhatsApp tracking: dataLayer.push now initializes window.dataLayer if not present (was conditionally checking existence)
- Fixed hydration error: Moved GTM <Script> from <head> to <body> in layout.tsx (removed whitespace text nodes causing React hydration mismatch)
- Disabled RELATION type in ColumnEditorDialog: Added `frozen: true` flag, type selector shows "Bientôt disponible (V2)" with V2 badge, selection blocked
- Added V1 FREEZE notice in ColumnEditorDialog when RELATION type is selected (shows lock icon + message)
- Added API guards: POST /api/datasources/[id]/columns rejects RELATION type (403)
- Added API guards: PUT /api/datasources/[id]/columns/[columnId] rejects RELATION type (403)
- Added API guards: PUT /api/datasources/[id]/columns/bulk-update rejects RELATION type
- Added API guards: POST /api/datasources/[id]/relations returns 403 (V1 freeze)
- Verified with Agent Browser: page loads cleanly, zero hydration errors
- Committed and pushed to GitHub (triggers Vercel auto-deploy)

Stage Summary:
- All 4 mandate tasks implemented and verified
- GTM: NEXT_PUBLIC_GTM_ID env var, container script in layout.tsx
- WhatsApp Tracking: dataLayer.push({event:'whatsapp_contact', product_title}) on CTA — NO monetary values
- SEO: generateMetadata with hybrid logic (custom seo_description/seo_keywords OR auto-gen from nomproduitdocx + price), OpenGraph+Twitter tags
- RELATION Freeze: Frontend (disabled type selector, frozen badge, V1 notice) + Backend (API 403 guards on column/relation creation)
- Hydration fix: GTM script moved from <head> to <body>
- Deployed to Vercel via GitHub push
