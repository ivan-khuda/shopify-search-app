import path from "node:path";
import type { NextConfig } from "next";

const prismaNpmReexport = path.join(process.cwd(), "lib/prisma-npm-reexport.ts");

const nextConfig: NextConfig = {
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
};

export default nextConfig;
