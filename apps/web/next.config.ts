import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript/CSS source, not built output.
  transpilePackages: ["@svika/ui", "@svika/shared"],
};

export default nextConfig;
