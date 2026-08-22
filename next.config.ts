import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: phones on the LAN load http://192.168.1.222:3000 while
  // `next dev` binds to localhost. Allow that origin to fetch HMR/webpack
  // internals. Next.js ignores this option in production.
  allowedDevOrigins: ["192.168.1.222", "192.168.1.107"],
  redirects: async () => [
    {
      source: "/",
      destination: "/ru",
      permanent: true,
    },
  ],
};

export default nextConfig;
