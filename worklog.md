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

---
Task ID: 2
Agent: Main Agent
Task: Implement minimalist stock counter UI + optimistic update + debounce

Work Log:
- Analyzed both screenshots with VLM: initial design (clean number + ⚡) vs current (ugly circular +/- buttons)
- Replaced ugly circular -/+ Button components with minimalist design:
  - Stock number displayed as clean bold colored text (emerald/red)
  - Small up/down chevron arrows appear ONLY on click (hidden by default)
  - No browser number input arrows visible
  - ⚡ Quick sell stays as discrete icon
- Implemented optimistic update system:
  - Local optimisticStock state maps rowId → value (instant 0ms UI update)
  - Debounced API save: 1.5s after last click
  - Pending changes shown with amber ring indicator
  - Debounce timers cleaned up on unmount, pending flushed
- Reactive engine preserved with debounce integration:
  - Scenario A: Stock > 0 → auto ON
  - Scenario B: Stock == 0 → auto OFF
  - Scenario C: Manual ON at stock 0 → Sur commande
  - Switch component reads optimistic stock for instant feedback

Stage Summary:
- Stock counter is now minimalist (no more ugly circular buttons)
- Performance: no more per-click API calls + full refresh
- Optimistic update: UI changes instantly, saves debounced at 1.5s
- Deployed to: https://abaya-collection-catalogue-9dum.vercel.app
