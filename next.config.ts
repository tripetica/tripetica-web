import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["pdfkit", "web-push"],
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
    proxyClientMaxBodySize: "30mb",
  },
  images: {
    qualities: [75, 90],
  },
  // Dev-only: allow LAN and Hetzner test hosts to fetch HMR/webpack
  // internals. Next.js ignores this option in production.
  allowedDevOrigins: [
    "192.168.1.222",
    "192.168.1.107",
    "62.238.123.40",
    "dev.tripetica.com",
  ],
  // Locale slash/case normalization lives in proxy.ts. Root ?lang= is 410.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
