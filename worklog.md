---
Task ID: 1
Agent: Main Agent
Task: Implement reactive 3-dimensional stock state engine (Stock ↔️ Switch ↔️ Statut)

Work Log:
- Read DataTable.tsx, CatalogPreview.tsx, sync route.ts to understand current implementation
- Identified core bug: + button did NOT auto-set __disponibilite__='true' when stock increased from 0
- Identified badge issues: SOLD OUT had noir background (not red), no "Sur commande" state existed
- Fixed DataTable.tsx: + button now auto-sets __disponibilite__='true' when newStock > 0
- Fixed DataTable.tsx: Switch toggle shows "Sur commande" label when stock=0 + ON (Scenario C)
- Implemented computeStockState() in CatalogPreview.tsx with 3 states: en_stock, epuise, sur_commande
- Changed SOLD OUT badge from noir to bg-rose-600 (red) per user spec
- Added SUR COMMANDE badge with elegant dark gold (#8B7355) styling
- Nouveau badge now strictly HIDDEN when epuise OR sur_commande
- Detail view: proper badges per scenario + CTA changes (epuise→disabled, sur_commande→"Commander (Atelier)")
- Sorting: en_stock > sur_commande > epuise (epuise products sink to bottom)
- Pushed to GitHub and deployed to Vercel successfully

Stage Summary:
- Key fix: Reactive state engine now properly links Stock, Switch, and Display state
- 3 scenarios: A (en_stock), B (epuise/SOLD OUT), C (sur_commande/pre-order)
- SOLD OUT badge is now red (bg-rose-600), not green/noir
- Sur commande badge is elegant dark gold
- Deployed to: https://abaya-collection-catalogue-9dum.vercel.app
