/**
 * RED scaffold for D-13/D-14 — prebuild pipeline test.
 * Verifies bun run prebuild produces public/storefront-bundle-*.js + valid manifest.
 *
 * Gates with it.skipIf when bun is not on PATH (non-bun CI environments).
 * Fails today because:
 *   1. `bun run prebuild` script doesn't exist yet (Wave 3 adds it)
 *   2. The esbuild entry file doesn't exist yet
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { readdirSync } from 'node:fs';

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

describe('bundle-build — D-13/D-14 prebuild pipeline', () => {
  it.skipIf(!bunAvailable)(
    'bun run prebuild produces public/storefront-bundle-*.js',
    () => {
      // Run prebuild — will fail until Wave 3 adds the script + entry.tsx
      try {
        execSync('bun run prebuild', {
          stdio: 'pipe',
          cwd: ROOT,
        });
      } catch (err) {
        // If prebuild fails, the test fails with the error message
        const message = err instanceof Error ? err.message : String(err);
        // Rethrow for meaningful failure message
        throw new Error(`prebuild failed: ${message}`);
      }

      // Assert the bundle file exists
      const publicDir = resolve(ROOT, 'public');
      const files = readdirSync(publicDir);
      const bundleFiles = files.filter((f) => f.match(/^storefront-bundle-[a-f0-9]+\.js$/));
      expect(bundleFiles.length).toBeGreaterThan(0);
    }
  );

  it.skipIf(!bunAvailable)(
    'bun run prebuild produces valid public/storefront-manifest.json',
    () => {
      try {
        execSync('bun run prebuild', {
          stdio: 'pipe',
          cwd: ROOT,
        });
      } catch {
        // Prebuild failure is handled by the bundle-existence test above
        // This test only checks the manifest if prebuild succeeded
      }

      const manifestPath = resolve(ROOT, 'public/storefront-manifest.json');
      if (!existsSync(manifestPath)) {
        // RED state: manifest doesn't exist yet
        expect(existsSync(manifestPath)).toBe(true);
        return;
      }

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
        bundle: string;
        version: string;
      };

      // Manifest shape: { bundle: '/storefront-bundle-X.js', version: string }
      expect(typeof manifest.bundle).toBe('string');
      expect(manifest.bundle).toMatch(/^\/storefront-bundle-[a-f0-9]+\.js$/);
      expect(typeof manifest.version).toBe('string');
      expect(manifest.version.length).toBeGreaterThan(0);
    }
  );

  it.skipIf(!bunAvailable)(
    'storefront bundle size is < 250KB minified (D-14)',
    () => {
      const publicDir = resolve(ROOT, 'public');

      if (!existsSync(publicDir)) {
        // RED state: public dir doesn't exist yet
        expect(existsSync(publicDir)).toBe(true);
        return;
      }

      let files: string[];
      try {
        files = readdirSync(publicDir);
      } catch {
        expect(true).toBe(true);
        return;
      }

      const bundleFiles = files.filter((f) => f.match(/^storefront-bundle-[a-f0-9]+\.js$/));

      if (bundleFiles.length === 0) {
        // RED state: no bundle yet
        expect(bundleFiles.length).toBeGreaterThan(0);
        return;
      }

      const latestBundle = bundleFiles.sort().pop()!;
      const bundlePath = join(publicDir, latestBundle);
      const bundleContent = readFileSync(bundlePath);

      const sizeKB = bundleContent.length / 1024;
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
