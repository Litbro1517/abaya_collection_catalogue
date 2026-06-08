import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
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
    ],
  },
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: [
    ".space-z.ai",
    "localhost",
    "21.0.8.64",
    "21.0.8.205",
  ],
};

export default nextConfig;
