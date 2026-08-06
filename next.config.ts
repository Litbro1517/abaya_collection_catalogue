import type { NextConfig } from "next";

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

export default nextConfig;
