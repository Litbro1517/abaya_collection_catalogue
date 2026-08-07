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

// VG37.3 D1: Google Tag Manager container ID
// ⚠️ PLACEHOLDER — Replace GTM-XXXXXXX with the real GTM container ID before production.
// Location: src/app/layout.tsx, this line + the <Script> and <noscript> tags below.
const GTM_CONTAINER_ID = 'GTM-XXXXXXX';

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
  let faviconUrl = "/logo.svg"; // default fallback
  let catalogName = "Abaya Collection Chic";

  try {
    const settings = await db.catalogSettings.findFirst();
    if (settings?.favicon) {
      faviconUrl = settings.favicon;
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

  return {
    metadataBase: new URL(metadataBaseUrl),
    title: `${catalogName} — Catalogue`,
    description: "Découvrez notre collection exclusive d'abayas, robes et ensembles. Commandez via WhatsApp, Messenger et plus.",
    icons: {
      icon: faviconUrl,
    },
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
        {/* VG37.3 D1: Google Tag Manager — container script (head, afterInteractive).
            ⚠️ PLACEHOLDER GTM-XXXXXXX at layout.tsx L.15 — replace with real GTM ID. */}
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
      </head>
      <body
        className={`${playfair.variable} ${inter.variable} ${zain.variable} ${tajawal.variable} antialiased bg-background text-foreground`}
      >
        {/* VG37.3 D1: Google Tag Manager — noscript fallback (immediately after <body>) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
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
