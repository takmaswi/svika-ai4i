import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript/CSS source, not built output.
  transpilePackages: ["@svika/ui", "@svika/shared"],
  webpack: (config) => {
    // The corridor geometry is imported straight from packages/db/seed/geo so
    // the map and the seed can never drift apart.
    config.module.rules.push({ test: /\.geojson$/, type: "json" });
    return config;
  },
};

export default nextConfig;
