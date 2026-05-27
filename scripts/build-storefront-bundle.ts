// scripts/build-storefront-bundle.ts
//
// Storefront bundle build pipeline (D-13, D-14).
//
// Produces the lazy-loaded React bundle the App Embed loader fetches at
// first FAB click. Output:
//   - public/storefront-bundle.<sha256-8>.js — minified ESM, content-hashed
//   - public/storefront-manifest.json — { bundle, version } pointer the loader reads
//
// Entry: extensions/chat-drawer/src/entry.tsx (created by Plan 13). Running
// this script before Plan 13 ships will fail with esbuild's
// "Could not resolve" error — that is expected during Wave 1.
//
// Runs automatically via the `prebuild` npm/bun lifecycle hook before
// `bun build` / `vercel build`. Can also be invoked directly via
// `bun run build:storefront-bundle`.
//
// No secrets are baked via `define`. The storefront bundle reads runtime
// config from `dataset.*` attributes on the custom element (RESEARCH
// §Pattern 5).

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

async function main(): Promise<void> {
  mkdirSync('public', { recursive: true });

  // Cleanup previous bundles to prevent hash drift accumulation. Restricted
  // to the storefront-bundle.*.js prefix so we never touch other public assets.
  for (const entry of readdirSync('public')) {
    if (/^storefront-bundle[-.].*\.js$/.test(entry)) {
      unlinkSync(path.join('public', entry));
    }
  }

  const result = await build({
    entryPoints: ['extensions/chat-drawer/src/entry.tsx'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    metafile: true,
    write: false,
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
    define: { 'process.env.NODE_ENV': '"production"' },
    jsx: 'automatic',
  });

  const code = result.outputFiles[0].text;
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 8);
  const filename = `storefront-bundle-${hash}.js`;
  writeFileSync(path.join('public', filename), code);

  let version: string;
  try {
    version = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    version = String(Date.now());
  }

  writeFileSync(
    'public/storefront-manifest.json',
    JSON.stringify({ bundle: '/' + filename, version }, null, 2)
  );

  console.log(`Wrote public/${filename} (${code.length} bytes), manifest version=${version}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
