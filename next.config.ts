import type { NextConfig } from "next";

// Use ESM (browser) build only — avoid Node build that requires @tensorflow/tfjs-node
const humanEsm = "@vladmandic/human/dist/human.esm.js";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
    ],
  },
  turbopack: {
    resolveAlias: {
      "@vladmandic/human": humanEsm,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@vladmandic/human": require("path").join(process.cwd(), "node_modules", "@vladmandic", "human", "dist", "human.esm.js"),
    };
    return config;
  },
};

export default nextConfig;
