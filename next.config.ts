import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "web-push"],
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
  // Locale, Bubble ?lang=, and slash/case normalization live in proxy.ts
  // so destinations can be 301s that drop the lang query in one hop.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
