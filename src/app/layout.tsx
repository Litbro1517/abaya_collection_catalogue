import type { Metadata } from "next";
import { Zain } from "next/font/google";
import Script from "next/script";
import ReactDOM from "react-dom";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeInjector } from "@/components/ThemeInjector";
import { GlobalCart } from "@/components/GlobalCart";
import { LocaleDirectionSync } from "@/components/LocaleDirectionSync";
import { db } from '@/lib/db';

// ── Audit remediation: GTM container ID via env var (no more placeholder) ──
const GTM_CONTAINER_ID = process.env.NEXT_PUBLIC_GTM_ID || '';

// MANDAT 4P — Optimisation LCP : police unique Zain
// Avant : 4 familles chargées simultanément (Playfair Display + Inter +
// Zain + Tajawal) → 590ms de blocage du rendu sur mobile (render-blocking).
// Maintenant : Zain uniquement (supporte arabic + latin, weights 400/700).
// Réduit de 4 à 1 le nombre de familles de police téléchargées avant le
// premier paint → impact direct sur LCP et render-blocking.
// La variable CSS --font-zain est mappée sur les anciennes variables
// (--font-playfair, --font-geist-sans, --font-tajawal) pour éviter de
// modifier le CSS existant et garantir zéro régression visuelle.
//
// ━━ MANDAT ADF — OPTIMISATION LCP FONT BUDGET (audit lcp-infra) ━━
// Audit ADF (A/B Lighthouse 4G/CPU 4×, rig byte-identique à la prod) :
//   - 87,5 KiB préchargés (6 woff2 Zain : 2 subsets × 3 weights) dont
//     28,5 KiB de weight 300 JAMAIS utilisé (0 occurrence font-light/300)
//   - Les polices occupent le pipe critique 607→2361ms, en concurrence
//     directe avec le CSS (qui finit à 2140ms) → FCP/LCP gated par le
//     budget pré-paint, pas par la découverte image.
//   - EXP-4 mesurée : LCP 1,9s (−500ms vs baseline 2,4s), FCP −400ms,
//     CLS inchangé (0,003), texte arabe peint en Zain dès le 1er paint.
// Correctif EXP-4 (meilleur ratio gain/risque) :
//   1. Retrait du weight "300" (jamais utilisé → −28,5 KiB de preloads morts)
//   2. Split en 2 instances Zain :
//      - zainArabic : subsets:["arabic"], preload:true → texte arabe peint
//        immédiatement en Zain (lang=ar dir=rtl par défaut, SSR depuis DB)
//      - zainLatin : subsets:["latin"], preload:false → ne concourt pas sur
//        le chemin pré-paint (FOUT mineur : seuls les chiffres swappent)
//   3. Les deux instances partagent la variable --font-zain (aliasing CSS)
//      → zéro changement CSS requis, zéro régression visuelle RTL.
const zainArabic = Zain({
  variable: "--font-zain",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "700"],
  preload: true,
});

const zainLatin = Zain({
  variable: "--font-zain",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
  preload: false,
});

// ━━ MANDAT 4P ÉTAPE 14 — Preconnect CDN Supabase (parité LCP mobile/desktop) ━━
// Audit ADF mobile (Lighthouse 12.4 Lantern, Moto G Power 412×823 DPR 1.75,
// RTT 150ms / 1,638 Mbps / CPU 4× — profil identique à PageSpeed Insights) :
//   - LCP desktop 0,9s (vert) vs LCP mobile 2,9s (orange) — différentiel
//     reproduit et mesuré sur la prod (abaya-collection-catalogue-9dum).
//   - L'élément LCP (1ère image produit) est servi depuis Supabase
//     (ldvbfsnqgulynwxqwzau.supabase.co) — une origine CROSS-DOMAIN distincte
//     du document HTML (vercel.app).
//   - AUCUN <link rel="preconnect"> vers cette origine n'existe dans le <head>
//     mesuré : le navigateur découvre le preload de l'image LCP en parsant le
//     <head>, puis DOIT ouvrir une connexion (DNS + TCP + TLS) SÉRIALISÉE
//     après cette découverte. À 150ms de RTT mobile, c'est ~450ms perdus sur
//     le chemin critique ; à 40ms de RTT desktop (~120ms), l'impact est
//     négligeable — c'est l'asymétrie exacte Bureau/Mobile constatée sur PSI.
// Fix chirurgical : émettre preconnect + dns-prefetch en tête de <head>
// (découverts dans les premiers octets du HTML streaming par le preloader
// scanner) → DNS+TCP+TLS vers Supabase s'ouvrent EN PARALLÈLE du téléchargement
// HTML/CSS → l'image LCP part sur une connexion déjà chaude. Standard web.dev
// « Preconnect to required origins » (optimize-lcp, éliminer le resource load
// delay cross-origin).
// Garde-fous :
//   - Origine dérivée de SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / favicon DB
//   - Un lien n'est émis QUE si l'hôte est un hôte Supabase vérifié (.supabase.co)
//   - Zéro effet de mise en page (aucun rendu visuel) — CLS inchangé par
//     construction ; les preloads/preload LCP existants (É13) sont inchangés.
function resolveSupabaseCdnOrigin(dbFaviconUrl: string | null): string {
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    dbFaviconUrl,
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c);
      if (u.protocol === 'https:' && u.hostname.endsWith('.supabase.co')) {
        return u.origin;
      }
    } catch { /* pas une URL absolue — candidat ignoré */ }
  }
  return '';
}

// ━━ SEO Fix V2: shared function to read brand metadata from DB ━━
// Used by both generateMetadata and RootLayout to avoid duplicate DB queries.
async function getBrandMetadata() {
  let catalogName = "Abaya Collection Chic";
  let whatsappNumber = "";
  let metadataBaseUrl = 'https://abaya-collection-catalogue-9dum.vercel.app';
  let dbFavicon: string | null = null;
  let defaultCatalogLanguage = 'fr';

  try {
    const settings = await db.catalogSettings.findFirst();
    if (settings?.favicon) dbFavicon = settings.favicon;
    if (settings?.whatsappNumber) whatsappNumber = settings.whatsappNumber;
    if (settings?.defaultCatalogLanguage && ['fr', 'en', 'ar'].includes(settings.defaultCatalogLanguage)) {
      defaultCatalogLanguage = settings.defaultCatalogLanguage;
    }
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

  return { catalogName, whatsappNumber, metadataBaseUrl, dbFavicon, defaultCatalogLanguage };
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
    // ━━ MANDAT 4P — Suppression du verrou noindex (fix/remove-noindex-lock) ━━
    // La maintenance est terminée — le verrou noindex/nofollow global (inséré
    // temporairement) est supprimé pour autoriser l'indexation par les robots
    // d'exploration. Score SEO PageSpeed attendu : 100/100 (était 69/100).
    // Les routes d'erreur (lp/[slug] 404, product-meta/[slug] 404) conservent
    // leur propre noindex légitime (pages inexistantes).
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
  const { catalogName, whatsappNumber, metadataBaseUrl, dbFavicon, defaultCatalogLanguage } = await getBrandMetadata();

  // ━━ MANDAT 4P ÉTAPE 14 — Preconnect CDN Supabase (parité LCP mobile/desktop) ━━
  // Voir commentaire resolveSupabaseCdnOrigin ci-dessus. Résolu au rendu (build
  // pour les routes statiques/ISR) à partir de l'env + favicon DB — zéro requête
  // supplémentaire (getBrandMetadata est déjà appelé pour les métadonnées).
  const supabaseCdnOrigin = resolveSupabaseCdnOrigin(dbFavicon);

  // Émission via l'API React Float ReactDOM.preconnect() : React insère le
  // <link rel="preconnect"> dans le PREAMBULE du <head> (avant les preload
  // de polices next/font et tout autre enfant du head) — position la plus
  // précoce possible pour le preloader scanner → DNS+TCP+TLS vers l'origine
  // des images démarrent dès les premiers octets du HTML streaming.
  // (Un <link> manuel dans le JSX <head> serait rendu APRÈS les preload de
  // polices — mesuré : position ~5,6 KB dans le head au lieu du préambule.)
  if (supabaseCdnOrigin) {
    ReactDOM.preconnect(supabaseCdnOrigin);
  }

  // MANDAT 4P v2 — Fix TTFB : supprimer await headers() du layout racine.
  // `await headers()` est une Dynamic API sous Next 16 → force TOUTES les
  // routes en rendu dynamique (ƒ) → ISR inopérant → TTFB 2.2-5.7s.
  // Le layout racine reste statique → ISR actif → x-vercel-cache: HIT.
  //
  // ━━ MANDAT 4P — FIX CLS (post-É12) : locale SSR depuis le défaut BDD ━━
  // Problème mesuré (audit CLS, prod + local) : le HTML statique était TOUJOURS
  // `lang="fr" dir="ltr"` alors que le défaut BDD est `ar` (defaultCatalogLanguage).
  // Pour tout visiteur SANS préférence (PSI/first-visit), HomeClient seedait
  // clientLocale='ar' après hydratation → ThemeInjector basculait dir=rtl →
  // la grille produit swapait ses colonnes → CLS 0,61 local / 0,31 mobile +
  // 0,68 desktop (PSI). Régression apparue avec É12 (suppression du fallback
  // BDD server-side qui pré-existait via `await headers()`).
  // Correctif chirurgical (parité avec le comportement PRE-É12, ISR préservé) :
  //   1. Le layout lit le défaut BDD via getBrandMetadata (MÊME requête Prisma
  //      que favicon/name — zéro requête supplémentaire) → SSR `lang`/`dir`
  //      corrects dès le HTML initial. Valeur figée au build (ISR 300s) — même
  //      contrat de fraîcheur que les données catalogue.
  //   2. Script inline no-flash dans <head> (pattern next-themes) : applique la
  //      PRÉFÉRENCE visiteur (localStorage abaya_clientLocale > cookie abaya_locale)
  //      AVANT le premier paint → retour visiteur = zéro flip visible.
  //   3. LocaleDirectionSync (post-hydration) reste le filet de sécurité — ses
  //      valeurs sont alignées (même priorité) → idempotent, zéro re-flip.
  // LCP/ISR intacts : aucun headers()/cookies() server-side, script ~450B
  // non bloquant, prerender inchangé.
  const ssrLocale = defaultCatalogLanguage;
  const ssrDir = ssrLocale === 'ar' ? 'rtl' : 'ltr';
  // Script no-flash : priorité identique au store client (localStorage > cookie),
  // n'agit QUE si la préférence diffère du défaut SSR (déjà correct sinon).
  const localeNoFlashScript = `(function(){try{var V=['fr','en','ar'];var l=null;try{var ls=localStorage.getItem('abaya_clientLocale');if(ls&&V.indexOf(ls)>=0)l=ls}catch(e){}if(!l){var m=document.cookie.match(/(?:^|;\\s*)abaya_locale=([^;]+)/);if(m&&V.indexOf(m[1])>=0)l=m[1]}var D=${JSON.stringify(ssrLocale)};if(!l||l===D)return;var r=l==='ar';var h=document.documentElement;h.setAttribute('lang',l);h.setAttribute('dir',r?'rtl':'ltr');if(r)h.classList.add('rtl');else h.classList.remove('rtl');}catch(e){}})();`;

  return (
    <html lang={ssrLocale} dir={ssrDir} className={ssrDir === 'rtl' ? 'rtl' : undefined} suppressHydrationWarning>
      <head>
        {/* ━━ MANDAT 4P — FIX CLS : script no-flash locale (pre-paint) ━━
            Doit être le PREMIER enfant du <head> : applique la préférence
            visiteur (localStorage/cookie) avant tout paint → élimine le flip
            RTL post-hydration (CLS 0,31/0,68 mesuré en prod PSI). ~450B,
            synchrone, non bloquant (aucun fetch). */}
        <script dangerouslySetInnerHTML={{ __html: localeNoFlashScript }} />
        {/* ━━ MANDAT 4P ÉTAPE 14 — fallback dns-prefetch (anciens navigateurs).
            Le <link rel="preconnect"> principal est émis via
            ReactDOM.preconnect() dans le préambule du head (voir ci-dessus) —
            React le rend AVANT les preload de polices. dns-prefetch reste ici
            en filet de sécurité, sans crossorigin : les <img> sont des fetches
            no-cors (contrairement aux polices). */}
        {supabaseCdnOrigin ? (
          <link rel="dns-prefetch" href={supabaseCdnOrigin} />
        ) : null}
        {/* ━━ MANDAT 4P — Suppression du verrou noindex (fix/remove-noindex-lock) ━━
            Les deux balises meta <meta name="robots" content="noindex, nofollow" />
            et <meta name="googlebot" content="noindex, nofollow" /> ont été retirées
            (insérées temporairement pendant la maintenance, désormais terminée).
            Le site est à nouveau indexable par les moteurs de recherche. */}
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
        // ━━ MANDAT ADF — OPTIMISATION LCP FONT BUDGET ━━
        // zainArabic (preload:true) + zainLatin (preload:false) : les deux
        // variables --font-zain sont appliquées → les deux subsets sont chargés,
        // mais seul l'Arabic est préchargé (le Latin est chargé post-paint).
        className={`${zainArabic.variable} ${zainLatin.variable} antialiased bg-background text-foreground`}
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
        <LocaleDirectionSync />
        <TooltipProvider>
          {children}
          <GlobalCart />
        </TooltipProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
