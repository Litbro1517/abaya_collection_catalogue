/**
 * VG40.3: Landing Page Funnel Layout
 *
 * This layout isolates the /lp/* routes from the root layout's GlobalCart
 * (floating cart button + drawer). Landing pages are closed funnels —
 * the user should NOT see the catalog's cart icon or be able to navigate
 * to the catalog during the conversion flow.
 *
 * The root layout (src/app/layout.tsx) still provides fonts, ThemeInjector,
 * TooltipProvider, and Toaster — those are harmless and needed. Only the
 * GlobalCart is suppressed by this layout NOT rendering it.
 *
 * Next.js App Router merges layouts: root layout → lp layout → page.
 * Since GlobalCart is rendered INSIDE the root layout's body (not as a
 * slot), we can't remove it via a child layout. Instead, we use a
 * different approach: the GlobalCart component checks the pathname and
 * hides itself on /lp/* routes (already done for /admin). We extend
 * that check here.
 *
 * This layout is intentionally minimal — it just passes children through.
 * Its existence allows future isolation (custom fonts, no-theme, etc.)
 * without touching the root layout.
 */

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
