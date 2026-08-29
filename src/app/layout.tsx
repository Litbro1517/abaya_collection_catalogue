import type { Metadata } from "next";
import { Playfair_Display, Inter, Zain, Tajawal } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeInjector } from "@/components/ThemeInjector";
import { GlobalCart } from "@/components/GlobalCart";
import { db } from '@/lib/db';

// ── Audit remediation: GTM container ID via env var (no more placeholder) ──
// Previously: hard-coded 'GTM-XXXXXXX' placeholder → GTM container never loaded,
// no GA4/Meta tracking fired even with dataLayer events in place.
// Now: reads NEXT_PUBLIC_GTM_ID env var. If unset, GTM script is skipped entirely
// (the dataLayer array still receives events — they'll be flushed once a real ID
// is configured, or picked up by Zaraz which listens on window.dataLayer).
// Empty string = "no GTM" (graceful no-op), distinct from the fake 'GTM-XXXXXXX'
// which previously fired a 404 request to googletagmanager.com on every page load.
const GTM_CONTAINER_ID = process.env.NEXT_PUBLIC_GTM_ID || '';

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

// VG37 Axe 2: Zain replaces Beiruti — unified Arabic typography ecosystem
// Zain (display/headings) + Tajawal (body text) + Roboto (already in admin)
// VG37 Fix: Zain on Google Fonts only supports weights 300, 400, 700 — NOT 500/600.
// Using unsupported weights causes critical build failure (Unknown weight 500).
const zain = Zain({
  variable: "--font-zain",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["300", "400", "700"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  // Try to read favicon and catalog name from DB for SSR metadata
  let dbFavicon: string | null = null;
  let catalogName = "Abaya Collection Chic";

  try {
    const settings = await db.catalogSettings.findFirst();
    if (settings?.favicon) {
      dbFavicon = settings.favicon;
    }
    if (settings) {
      // Get catalog name from the related catalog
      const catalog = await db.catalog.findFirst({
        where: { id: settings.catalogId },
        select: { name: true },
      });
      if (catalog?.name) catalogName = catalog.name;
    }
  } catch {
    // DB not available (first deploy, etc.) — use defaults
  }

  // Resolve metadataBase from DB or fallback to production URL
  let metadataBaseUrl = 'https://abaya-collection-catalogue-9dum.vercel.app';
  try {
    const seoRow = await db.settings.findUnique({ where: { key: '__seo_metadata__' } });
    if (seoRow?.value) {
      const parsed = JSON.parse(seoRow.value);
      if (parsed.canonicalUrl) metadataBaseUrl = parsed.canonicalUrl;
    }
  } catch {
    // DB not available — use default
  }

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
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ── SSR: resolve visitor locale from cookie, fallback to DB default, then 'fr' ──
  let ssrLocale = 'fr';
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get('abaya_locale')?.value;
    if (cookieLocale && ['fr', 'en', 'ar'].includes(cookieLocale)) {
      ssrLocale = cookieLocale;
    } else {
      // No cookie yet (first visit) — check DB default
      const settings = await db.catalogSettings.findFirst();
      const dbDefault = settings?.defaultCatalogLanguage;
      if (dbDefault && ['fr', 'en', 'ar'].includes(dbDefault)) {
        ssrLocale = dbDefault;
      }
    }
  } catch {
    // DB or cookies unavailable — use 'fr'
  }
  const ssrDir = ssrLocale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={ssrLocale} dir={ssrDir} suppressHydrationWarning>
      <head>
        {/* Audit remediation: Google Tag Manager — container script.
            Only rendered when NEXT_PUBLIC_GTM_ID env var is set to a real ID.
            When unset (empty string), the <Script> is skipped entirely — no 404
            request to googletagmanager.com, no fake container injection. The
            window.dataLayer array is still initialized by analytics.ts so events
            queue up and will flush once a real GTM ID is configured. */}
        {GTM_CONTAINER_ID && (
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
        )}
      </head>
      <body
        className={`${playfair.variable} ${inter.variable} ${zain.variable} ${tajawal.variable} antialiased bg-background text-foreground`}
      >
        {/* Audit remediation: GTM noscript fallback — only when GTM ID is set */}
        {GTM_CONTAINER_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
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
