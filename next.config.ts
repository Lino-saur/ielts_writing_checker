import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 82],
    minimumCacheTTL: 2_592_000
  },
  experimental: {
    optimizePackageImports: ["recharts"]
  }
};

export default nextConfig;
