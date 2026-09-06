import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// ━━ MANDAT 4P (Bundle Optimization Step 1) ━━
// Conditionally activate @next/bundle-analyzer when ANALYZE=true is set.
// This keeps production builds (Vercel) unaffected — the analyzer only runs
// on-demand for local investigation (ANALYZE=true bun run build).
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
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
};

// ━━ MANDAT 4P — Security Headers (Fix 4) ━━
// 3 en-têtes de sécurité critiques absents sur main : HSTS, nosniff,
// Referrer-Policy. Injectés via headers() pour toutes les routes.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfigWithHeaders: NextConfig = {
  ...nextConfig,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfigWithHeaders);
