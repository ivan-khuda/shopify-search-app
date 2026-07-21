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
//   - public/storefront-styles-<hash>.css — compiled Tailwind utilities for
//     the drawer (entry.tsx injects a <link> for it at mount time)
//   - public/storefront-manifest.json — { bundle, styles, version } pointer
//     the loader reads
//
// Entry: extensions-src/chat-drawer/entry.tsx.
// Styles: extensions-src/chat-drawer/storefront.css (Tailwind 4 CSS-first,
// preflight deliberately excluded so no reset leaks into merchant themes).
//
// Runs automatically via the `prebuild` bun lifecycle hook before
// `bun build` / `vercel build`. Can also be invoked directly via
// `bun run build:storefront-bundle`.
//
// No secrets are baked via `define`. The storefront bundle reads runtime
// config from `dataset.*` attributes on the custom element (RESEARCH
// §Pattern 5). The only define besides NODE_ENV is __SD_STYLES_FILE__ — the
// non-secret content-hashed CSS filename, baked in so entry.tsx can resolve
// the stylesheet next to its own module URL.

import { build } from 'esbuild';
import {
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
} from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

async function main(): Promise<void> {
  mkdirSync('public', { recursive: true });

  // Cleanup previous bundles + split chunks. We delete anything tracked by
  // the previous manifest (entry + chunks). On first run, falls back to the
  // legacy prefix-based sweep.
  const manifestPath = path.join('public', 'storefront-manifest.json');
  const previousFiles = new Set<string>();
  try {
    const prev = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (typeof prev.bundle === 'string') previousFiles.add(prev.bundle.replace(/^\//, ''));
    if (typeof prev.styles === 'string') previousFiles.add(prev.styles.replace(/^\//, ''));
    if (Array.isArray(prev.chunks)) {
      for (const c of prev.chunks) if (typeof c === 'string') previousFiles.add(c.replace(/^\//, ''));
    }
  } catch {
    // no prior manifest
  }
  for (const entry of readdirSync('public')) {
    if (
      previousFiles.has(entry) ||
      /^(storefront-bundle|DrawerBody|chunk|code-block|mermaid)-.*\.js$/.test(entry) ||
      /^storefront-styles-.*\.css$/.test(entry)
    ) {
      unlinkSync(path.join('public', entry));
    }
  }

  // Compile the drawer's Tailwind stylesheet BEFORE the JS build: the
  // content-hashed CSS filename is baked into the bundle via `define` so
  // entry.tsx can inject a <link> resolved against its own module URL.
  // @tailwindcss/cli scans only the @source globs declared in storefront.css
  // (drawer components + lib/chat-ui); preflight is excluded there so the
  // emitted file is purely class-based — nothing leaks into merchant themes.
  const cssTmp = path.join(tmpdir(), `sd-storefront-styles-${process.pid}.css`);
  execSync(
    `bunx @tailwindcss/cli -i extensions-src/chat-drawer/storefront.css -o ${JSON.stringify(cssTmp)} --minify`,
    { stdio: 'pipe' }
  );
  const cssContent = readFileSync(cssTmp);
  unlinkSync(cssTmp);
  if (cssContent.includes('box-sizing:border-box')) {
    // Guard against a future storefront.css edit re-introducing Preflight —
    // a global reset shipped into a merchant's theme is a sev-1.
    throw new Error(
      'storefront styles contain a global reset (preflight?) — refusing to ship'
    );
  }
  const cssHash = createHash('sha256').update(cssContent).digest('hex').slice(0, 8).toUpperCase();
  const stylesFileName = `storefront-styles-${cssHash}.css`;
  writeFileSync(path.join('public', stylesFileName), cssContent);

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
    define: {
      'process.env.NODE_ENV': '"production"',
      // Non-secret: content-hashed stylesheet filename emitted above.
      __SD_STYLES_FILE__: JSON.stringify(stylesFileName),
    },
    jsx: 'automatic',
  });

  // Guard: the bundle runs in merchant storefronts where `process` does not
  // exist. Any surviving `process.env` reference (e.g. next/image pulled in
  // via the lib/chat-ui barrel) throws "process is not defined" at module
  // scope and kills the drawer. `define` only rewrites the keys listed above,
  // so anything else must be caught here.
  for (const outPath of Object.keys(result.metafile.outputs)) {
    if (!outPath.endsWith('.js')) continue;
    const code = readFileSync(outPath, 'utf8');
    if (/\bprocess\.env\b/.test(code)) {
      throw new Error(
        `${path.basename(outPath)} references process.env — a Node-only module ` +
          'leaked into the storefront bundle (import via sub-paths, not the ' +
          'lib/chat-ui barrel). Refusing to ship.'
      );
    }
  }

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

  const stylesPath = '/' + stylesFileName;

  writeFileSync(
    'public/storefront-manifest.json',
    JSON.stringify(
      { bundle: entryPath, chunks: chunkPaths, styles: stylesPath, version },
      null,
      2
    )
  );

  const entryBytes = entryOutput[1].bytes;
  console.log(`Wrote public${entryPath} (${entryBytes} bytes entry), manifest version=${version}`);
  console.log(`  styles: ${stylesFileName} (${cssContent.length} bytes)`);
  for (const [outPath, info] of Object.entries(result.metafile.outputs)) {
    if (outPath === entryOutput[0]) continue;
    console.log(`  chunk: ${path.basename(outPath)} (${info.bytes} bytes)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
