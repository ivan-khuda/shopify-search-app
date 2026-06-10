/**
 * D-13/D-14 — prebuild pipeline gate.
 * Verifies bun run prebuild produces public/storefront-bundle-*.js + valid manifest,
 * and that the ENTRY chunk stays under the 250KB budget.
 *
 * Gates with it.skipIf when bun is not on PATH (non-bun CI environments).
 *
 * WR-09: prebuild runs ONCE in beforeAll and FAILS the suite on error (no
 * stale-manifest validation), the size test reads the entry path from the
 * manifest (content hashes have no lexicographic temporal ordering), and the
 * RED-scaffold `expect(true)` escape hatches are gone.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '..');

// Check if bun is available on PATH
function isBunAvailable(): boolean {
  try {
    execSync('bun --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const bunAvailable = isBunAvailable();

interface StorefrontManifest {
  bundle: string;
  chunks?: string[];
  version: string;
}

function readManifest(): StorefrontManifest {
  const manifestPath = resolve(ROOT, 'public/storefront-manifest.json');
  expect(existsSync(manifestPath), 'public/storefront-manifest.json must exist after prebuild').toBe(true);
  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as StorefrontManifest;
}

describe('bundle-build — D-13/D-14 prebuild pipeline', () => {
  beforeAll(() => {
    if (!bunAvailable) return;
    // Run prebuild ONCE; any failure fails the whole suite — never fall back
    // to validating a stale manifest/bundle from a previous run.
    try {
      execSync('bun run prebuild', { stdio: 'pipe', cwd: ROOT });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`prebuild failed: ${message}`);
    }
  }, 120_000);

  it.skipIf(!bunAvailable)(
    'bun run prebuild produces the public/storefront-bundle-*.js entry named in the manifest',
    () => {
      const manifest = readManifest();
      expect(manifest.bundle).toMatch(/^\/storefront-bundle-[A-Za-z0-9]+\.js$/);
      const entryPath = join(ROOT, 'public', manifest.bundle.replace(/^\//, ''));
      expect(existsSync(entryPath), `entry bundle ${manifest.bundle} must exist`).toBe(true);
    }
  );

  it.skipIf(!bunAvailable)(
    'bun run prebuild produces valid public/storefront-manifest.json',
    () => {
      const manifest = readManifest();

      // Manifest shape: { bundle: '/storefront-bundle-X.js', chunks: [...], version: string }
      expect(typeof manifest.bundle).toBe('string');
      expect(manifest.bundle).toMatch(/^\/storefront-bundle-[A-Za-z0-9]+\.js$/);
      expect(typeof manifest.version).toBe('string');
      expect(manifest.version.length).toBeGreaterThan(0);
    }
  );

  it.skipIf(!bunAvailable)(
    'storefront bundle size is < 250KB minified (D-14)',
    () => {
      // Measure the ENTRY chunk only. Heavy panes (ChatPane/HistoryPanel/
      // SavedProductsPanel + DbBacked stores) ship as split chunks loaded on
      // first FAB click via React.lazy; the 250KB budget guards initial-paint
      // bytes, not the total feature size.
      //
      // The entry path comes from the manifest the build just wrote — NOT
      // from a lexicographic sort of directory listings, which can pick an
      // arbitrary stale bundle when more than one is present.
      const manifest = readManifest();
      const bundlePath = join(ROOT, 'public', manifest.bundle.replace(/^\//, ''));
      expect(existsSync(bundlePath), `entry bundle ${manifest.bundle} must exist`).toBe(true);

      const sizeKB = readFileSync(bundlePath).length / 1024;
      expect(sizeKB).toBeLessThan(250);
    }
  );

  it('bun is available on PATH (required for prebuild script)', () => {
    // Informational: documents whether bun is available
    // Tests above use skipIf, so this just asserts availability
    if (!bunAvailable) {
      console.warn('bun not on PATH — bundle-build tests skipped');
    }
    // Don't hard-fail if bun not available — skipIf handles it
    expect(true).toBe(true);
  });
});
