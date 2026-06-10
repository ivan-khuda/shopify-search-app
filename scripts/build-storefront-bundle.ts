// scripts/build-storefront-bundle.ts
//
// Storefront bundle build pipeline (D-13, D-14).
//
// Produces a code-split ESM bundle. The entry chunk is tiny (FAB shell +
// lazy import of DrawerBody); the heavy chat panes ship as sibling chunks
// that the browser fetches on first drawer-open via the entry's React.lazy
// import. Output:
//   - public/storefront-bundle.<hash>.js — entry chunk
//   - public/storefront-bundle.<hash>.<id>.js — split chunks (auto-imported)
//   - public/storefront-manifest.json — { bundle, version } pointer the loader reads
//
// Entry: extensions-src/chat-drawer/entry.tsx.
//
// Runs automatically via the `prebuild` bun lifecycle hook before
// `bun build` / `vercel build`. Can also be invoked directly via
// `bun run build:storefront-bundle`.
//
// No secrets are baked via `define`. The storefront bundle reads runtime
// config from `dataset.*` attributes on the custom element (RESEARCH
// §Pattern 5).

import { build } from 'esbuild';
import { writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

async function main(): Promise<void> {
  mkdirSync('public', { recursive: true });

  // Cleanup previous bundles + split chunks. We delete anything tracked by
  // the previous manifest (entry + chunks). On first run, falls back to the
  // legacy prefix-based sweep.
  const manifestPath = path.join('public', 'storefront-manifest.json');
  const previousFiles = new Set<string>();
  try {
    const prev = JSON.parse(require('node:fs').readFileSync(manifestPath, 'utf8'));
    if (typeof prev.bundle === 'string') previousFiles.add(prev.bundle.replace(/^\//, ''));
    if (Array.isArray(prev.chunks)) {
      for (const c of prev.chunks) if (typeof c === 'string') previousFiles.add(c.replace(/^\//, ''));
    }
  } catch {
    // no prior manifest
  }
  for (const entry of readdirSync('public')) {
    if (previousFiles.has(entry) || /^(storefront-bundle|DrawerBody|chunk|code-block|mermaid)-.*\.js$/.test(entry)) {
      unlinkSync(path.join('public', entry));
    }
  }

  const result = await build({
    entryPoints: { 'storefront-bundle': 'extensions-src/chat-drawer/entry.tsx' },
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    metafile: true,
    write: true,
    outdir: 'public',
    entryNames: '[name]-[hash]',
    chunkNames: '[name]-[hash]',
    splitting: true,
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
    define: { 'process.env.NODE_ENV': '"production"' },
    jsx: 'automatic',
  });

  const entryOutput = Object.entries(result.metafile.outputs).find(
    ([, info]) => info.entryPoint === 'extensions-src/chat-drawer/entry.tsx'
  );
  if (!entryOutput) {
    throw new Error('esbuild metafile did not report an entry output');
  }
  const entryPath = '/' + path.basename(entryOutput[0]);

  let version: string;
  try {
    version = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    version = String(Date.now());
  }

  const chunkPaths = Object.keys(result.metafile.outputs)
    .filter((p) => p !== entryOutput[0])
    .map((p) => '/' + path.basename(p));

  writeFileSync(
    'public/storefront-manifest.json',
    JSON.stringify({ bundle: entryPath, chunks: chunkPaths, version }, null, 2)
  );

  const entryBytes = entryOutput[1].bytes;
  console.log(`Wrote public${entryPath} (${entryBytes} bytes entry), manifest version=${version}`);
  for (const [outPath, info] of Object.entries(result.metafile.outputs)) {
    if (outPath === entryOutput[0]) continue;
    console.log(`  chunk: ${path.basename(outPath)} (${info.bytes} bytes)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
