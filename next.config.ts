import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// ━━ MANDAT 4P (Bundle Optimization Step 1) ━━
// Conditionally activate @next/bundle-analyzer when ANALYZE=true is set.
// This keeps production builds (Vercel) unaffected — the analyzer only runs
// on-demand for local investigation (ANALYZE=true bun run build).
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// ━━ MANDAT 4P — RECTIFICATIONS AUDIT 360° (P1 Sécurité) ━━
// En-têtes HTTP de sécurité — audit DUEL 360° VOLET 1 : 6/7 en-têtes
// critiques manquants sur la prod (clickjacking, MIME sniffing, XSS sans
// CSP). Injectés via headers() pour TOUTES les routes (statiques, ISR,
// API). Adaptés à la stack réelle :
//   - GTM (googletagmanager.com) + GA (google-analytics.com, analytics.google.com)
//   - Tags gérés PAR le conteneur GTM (GA4, éventuel Pixel via GTM :
//     connect.facebook.net, facebook.com/tr, graph.facebook.com — le
//     tracking passe par GTM, jamais par du code applicatif direct)
//   - Images produit : Supabase CDN (*.supabase.co) + Google (lh3/googleusercontent)
//   - next/font : polices self-hostées (pas de fonts.googleapis.com)
//   - Scripts d'hydratation Next.js : inline → 'unsafe-inline' requis
//     (baseline obligatoire tant que les nonces par requête ne sont pas
//     mis en place — Next 16 require nonce via middleware pour durcir)
//   - 'unsafe-eval' : requis par GTM preview + le runtime dev de Next.js
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js bootstrap/hydration inline + GTM container + Meta Pixel snippet
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      // Images produit Supabase/Google + trackers (img pixel) + data URLs
      "img-src 'self' data: blob: https: http:",
      // GA4/Meta téléchargés/consommés par les tags GÉRÉS PAR LE CONTENEUR
      // GTM (googletagmanager) — zéro code de tracking direct dans l'app
      "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://*.supabase.co https://connect.facebook.net https://graph.facebook.com",
      "font-src 'self' data:",
      // GTM preview (mode debug) — sinon aucun frame nécessaire
      "frame-src 'self' https://www.googletagmanager.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // ━━ MANDAT 4P — RECTIFICATIONS AUDIT 360° (P0 Build TypeScript) ━━
  // `typescript.ignoreBuildErrors: true` RETIRÉ (audit DUEL 360° VOLET 4 :
  // violation critique — le build Vercel passait silencieusement malgré 134
  // erreurs TypeScript, dont des routes cassées au runtime, masquées).
  // La baseline a été assainie sur la branche : correction des erreurs src/
  // + exclusion des scripts ops/démos hors application du tsconfig.
  // Next.js typechecke désormais à CHAQUE build — zéro régression de typage
  // ne peut plus passer inaperçue.
  reactStrictMode: false,
  // Audit DUEL 360° VOLET 1 : X-Powered-By: Next.js leaké la stack → retiré.
  poweredByHeader: false,
  images: {
    // VG37.2 Axe 2: Re-enabled Next.js image optimization (was unoptimized: true).
    // The remotePatterns below are already configured for all image sources
    // (Google Drive, Googleusercontent, Supabase). The previous unoptimized:true
    // was a temporary workaround for unconfigured remote domains — no longer needed.
    unoptimized: false,
    // MANDAT 4P PageSpeed fix — modern image formats:
    // Next.js image optimizer will serve AVIF (best compression) then WebP fallback
    // for any image routed through next/image. Reduces payload ~30-50% vs JPEG/PNG.
    // Note: product card images currently use raw <img> (Google lh3 already serves
    // optimized sizes via =w800), so this benefits future next/image migrations.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days — immutable CDN assets
    remotePatterns: [
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: [
    ".space-z.ai",
    "localhost",
    "127.0.0.1",
    "21.0.8.64",
    "21.0.8.205",
  ],
  async headers() {
    return [
      {
        // En-têtes de sécurité sur toutes les routes de l'application
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
