import path from "node:path";
import type { NextConfig } from "next";

const prismaNpmReexport = path.join(process.cwd(), "lib/prisma-npm-reexport.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client": prismaNpmReexport,
    };
    return config;
  },
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      // Turbopack needs a project-relative path (not absolute), see next.js "server relative imports"
      "@prisma/client": "./lib/prisma-npm-reexport.ts",
    },
  },
  async headers() {
    return [
      {
        // CR-02: the storefront drawer loads these public assets via a
        // cross-origin ES-module import() from the merchant's shop domain.
        // Module fetches are CORS-mode — without Access-Control-Allow-Origin
        // the browser rejects the entry bundle AND its esbuild split chunks
        // (DrawerBody-*, chunk-*, code-block-*, mermaid-*). These are public,
        // credential-free JS assets, so a wildcard origin is appropriate.
        source:
          "/:file((?:storefront-bundle|DrawerBody|chunk|code-block|mermaid)-.*\\.js)",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
