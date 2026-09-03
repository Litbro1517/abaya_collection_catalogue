import type { Metadata } from "next";
import { Zain } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeInjector } from "@/components/ThemeInjector";
import { GlobalCart } from "@/components/GlobalCart";
import { db } from '@/lib/db';
import { headers } from 'next/headers';

// ── Audit remediation: GTM container ID via env var (no more placeholder) ──
const GTM_CONTAINER_ID = process.env.NEXT_PUBLIC_GTM_ID || '';

// MANDAT 4P — Optimisation LCP : police unique Zain
// Avant : 4 familles chargées simultanément (Playfair Display + Inter +
// Zain + Tajawal) → 590ms de blocage du rendu sur mobile (render-blocking).
// Maintenant : Zain uniquement (supporte arabic + latin, weights 300/400/700).
// Réduit de 4 à 1 le nombre de familles de police téléchargées avant le
// premier paint → impact direct sur LCP et render-blocking.
// La variable CSS --font-zain est mappée sur les anciennes variables
// (--font-playfair, --font-geist-sans, --font-tajawal) pour éviter de
// modifier le CSS existant et garantir zéro régression visuelle.
const zain = Zain({
  variable: "--font-zain",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["300", "400", "700"],
});

// ━━ SEO Fix V2: shared function to read brand metadata from DB ━━
// Used by both generateMetadata and RootLayout to avoid duplicate DB queries.
async function getBrandMetadata() {
  let catalogName = "Abaya Collection Chic";
  let whatsappNumber = "";
  let metadataBaseUrl = 'https://abaya-collection-catalogue-9dum.vercel.app';
  let dbFavicon: string | null = null;

  try {
    const settings = await db.catalogSettings.findFirst();
    if (settings?.favicon) dbFavicon = settings.favicon;
    if (settings?.whatsappNumber) whatsappNumber = settings.whatsappNumber;
    if (settings) {
      const catalog = await db.catalog.findFirst({
        where: { id: settings.catalogId },
        select: { name: true },
      });
      if (catalog?.name) catalogName = catalog.name;
    }
  } catch { /* DB unavailable — use defaults */ }

  try {
    const seoRow = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (seoRow?.value) {
      const parsed = JSON.parse(seoRow.value);
      if (parsed.canonicalUrl) metadataBaseUrl = parsed.canonicalUrl;
    }
  } catch { /* DB unavailable — use default */ }

  return { catalogName, whatsappNumber, metadataBaseUrl, dbFavicon };
}

export async function generateMetadata(): Promise<Metadata> {
  const { catalogName, dbFavicon, metadataBaseUrl } = await getBrandMetadata();

  // ── VG45: Favicon priority — DB favicon takes ABSOLUTE precedence ──
  // Prior behavior (VG44) declared an array with BOTH the DB favicon AND
  // static fallbacks (/favicon.ico, /logo.svg, /logo.png). Chrome's favicon
  // selection algorithm picks the LAST <link rel="icon"> tag that
  // successfully loads, and prefers entries with explicit sizes. The 256x256
  // /logo.png (a horizontal text logo) was being selected OVER the DB
  // golden "A" badge favicon, showing a truncated text logo in the tab.
  //
  // Fix: EXCLUSIVE mode — when dbFavicon is set, emit ONLY that URL (no
  // competing static entries). When dbFavicon is absent/null, emit the
  // static fallback chain (favicon.ico + logo.svg, but NOT logo.png which
  // is a rectangular text logo unsuitable as a tab icon).
  const icons = dbFavicon
    ? {
        // Custom favicon configured in admin (Settings → Identité visuelle)
        // — exposed exclusively so no static asset can override it.
        icon: [{ url: dbFavicon }],
        shortcut: dbFavicon,
        apple: dbFavicon,
      }
    : {
        // No DB favicon — use static fallbacks only.
        // /favicon.ico (multi-res 16/32/48px) is the primary tab icon.
        // /logo.svg is the vector fallback (crisp on retina).
        // /logo.png (256x256 text logo) is intentionally EXCLUDED from the
        // icon array — it's a rectangular text logo, unsuitable as a tab
        // icon. It remains available as apple-touch-icon only.
        icon: [
          { url: '/favicon.ico', sizes: 'any' },
          { url: '/logo.svg', type: 'image/svg+xml' },
        ],
        shortcut: '/favicon.ico',
        apple: '/logo.png',
      };

  return {
    metadataBase: new URL(metadataBaseUrl),
    title: `${catalogName} — Catalogue`,
    description: "Découvrez notre collection exclusive d'abayas, robes et ensembles. Commandez via WhatsApp, Messenger et plus.",
    icons,
    // ━━ MANDAT 4P — SEO noindex, nofollow (préalable prioritaire) ━━
    // Empêche le référencement et le crawling par les moteurs de recherche.
    // Next.js émet <meta name="robots" content="noindex, nofollow" /> dans le <head>.
    // Complété par une balise meta directe dans le <head> manuel du RootLayout
    // (ci-dessous) pour garantir qu'aucune page fille ne puisse override cette directive.
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    // ━━ OG cover image for social sharing (WhatsApp, Facebook, Twitter) ━━
    // Uses /og-cover.jpg (1200×630 JPEG, brand colors) as the default cover.
    // Page-specific openGraph (page.tsx) overrides this for product pages.
    openGraph: {
      title: `${catalogName} — Catalogue`,
      description: "Découvrez notre collection exclusive d'abayas, robes et ensembles. Commandez via WhatsApp, Messenger et plus.",
      siteName: catalogName,
      images: [
        {
          url: '/og-cover.jpg',
          width: 1200,
          height: 630,
          alt: `${catalogName} — Catalogue`,
        },
      ],
      type: 'website',
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${catalogName} — Catalogue`,
      description: "Découvrez notre collection exclusive d'abayas, robes et ensembles. Commandez via WhatsApp, Messenger et plus.",
      images: ['/og-cover.jpg'],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ━━ SEO Fix V2: read brand metadata once (shared with generateMetadata) ━━
  const { catalogName, whatsappNumber, metadataBaseUrl } = await getBrandMetadata();

  // ── MANDAT 4P — Fix TTFB : lire la locale depuis le header middleware ──
  // Avant : `await cookies()` forçait Next.js en rendu 100% dynamique,
  // neutralisant l'ISR (revalidate=300 dans page.tsx) → TTFB 2.2s.
  // Maintenant : le middleware injecte `x-locale` dans le header →
  // `headers()` est une fonction synchrone (pas de Dynamic API) →
  // Next.js peut pré-rendre la page (ISR actif) → TTFB < 0.5s.
  let ssrLocale = 'fr';
  try {
    const headerList = await headers();
    const xLocale = headerList.get('x-locale');
    if (xLocale && ['fr', 'en', 'ar'].includes(xLocale)) {
      ssrLocale = xLocale;
    } else {
      // No header (first visit or build) — check DB default
      const settings = await db.catalogSettings.findFirst();
      const dbDefault = settings?.defaultCatalogLanguage;
      if (dbDefault && ['fr', 'en', 'ar'].includes(dbDefault)) {
        ssrLocale = dbDefault;
      }
    }
  } catch {
    // DB or headers unavailable — use 'fr'
  }
  const ssrDir = ssrLocale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={ssrLocale} dir={ssrDir} suppressHydrationWarning>
      <head>
        {/* ━━ MANDAT 4P — SEO noindex, nofollow (balise meta directe, garantie absolue) ━━
            Cette balise est ajoutée DIRECTEMENT dans le <head> manuel du RootLayout
            pour garantir qu'elle soit présente sur TOUTES les pages, même si une
            page fille override generateMetadata() avec robots: { index: true }.
            Google utilise la directive la plus restrictive quand plusieurs balises
            meta robots coexistent — donc cette balise garantit noindex partout.
            Complète la directive robots dans generateMetadata() ci-dessus. */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        {/* Audit remediation: Google Tag Manager — container script.
            Only rendered when NEXT_PUBLIC_GTM_ID env var is set to a real ID.
            When unset (empty string), GTM script is skipped entirely — no 404
            request to googletagmanager.com, no fake container injection. The
            window.dataLayer array is still initialized by analytics.ts so events
            queue up and will flush once a real GTM ID is configured.
            ━━ Correctif M2 (head hydration fix) ━━
            Uses ternary `GTM_CONTAINER_ID ? <Script/> : null` instead of
            `GTM_CONTAINER_ID && (<Script/>)`. When the env var is empty, the
            `&&` expression evaluates to `''` (the falsy value itself), which
            React renders as a text node in <head> — this triggers a hydration
            mismatch in React 19 / Next 16 that detaches all <link> stylesheet
            tags from the DOM, causing the layout to collapse. `null` is
            ignored by the React renderer and produces no DOM node at all. */}
        {GTM_CONTAINER_ID ? (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`,
            }}
          />
        ) : null}
        {/* ━━ SEO V2: JSON-LD Organization — variabilisé depuis DB ━━ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: catalogName,
              url: metadataBaseUrl,
              logo: `${metadataBaseUrl}/logo.png`,
              description: "Boutique en ligne d'abayas, robes et ensembles. Commandez via WhatsApp avec paiement à la livraison (COD) au Maroc.",
              address: {
                "@type": "PostalAddress",
                addressCountry: "MA",
                addressRegion: "Marrakech",
              },
              ...(whatsappNumber ? {
                sameAs: [`https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}`],
              } : {}),
            }),
          }}
        />
      </head>
      <body
        // MANDAT 4P — Police unique Zain
        // Les anciennes variables CSS (--font-playfair, --font-geist-sans,
        // --font-tajawal) sont aliasées vers --font-zain pour garantir
        // la compatibilité avec le CSS existant sans le modifier.
        className={`${zain.variable} antialiased bg-background text-foreground`}
        style={{
          // Alias: toutes les anciennes variables pointent vers Zain
          ['--font-playfair' as string]: 'var(--font-zain)',
          ['--font-geist-sans' as string]: 'var(--font-zain)',
          ['--font-tajawal' as string]: 'var(--font-zain)',
        }}
      >
        {/* Audit remediation: GTM noscript fallback — only when GTM ID is set.
            Uses ternary `: null` (same M2 fix as the head <Script>) to avoid
            injecting a whitespace text node that would trigger a hydration
            mismatch. */}
        {GTM_CONTAINER_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        <ThemeInjector />
        <TooltipProvider>
          {children}
          <GlobalCart />
        </TooltipProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
