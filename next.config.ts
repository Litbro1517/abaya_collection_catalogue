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
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // VG37.2 Axe 2: Re-enabled Next.js image optimization (was unoptimized: true).
    // The remotePatterns below are already configured for all image sources
    // (Google Drive, Googleusercontent, Supabase). The previous unoptimized:true
    // was a temporary workaround for unconfigured remote domains — no longer needed.
    unoptimized: false,
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

export default withBundleAnalyzer(nextConfig);
