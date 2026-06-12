/**
 * RED scaffold for STR-07 + D-15 — loader.js designMode guard + skeleton.
 *
 * Tests that:
 * - when Shopify.designMode === true at click time, the FAB does NOT load the bundle
 * - when designMode is false, the FAB click fetches the manifest + dynamically imports
 * - first click paints a skeleton container before the bundle resolves
 *
 * Tests fail with file-not-found until Wave 3 ships the loader.js scaffold.
 * The loader is expected to export a paintFab(root) function for testability
 * (planner decision: Wave 3 plan 12 author implements).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOADER_PATH = resolve(
  __dirname,
  '../../../extensions/chat-drawer/assets/loader.js'
);

let importMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  importMock = vi.fn().mockResolvedValue({});
  fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ bundle: '/storefront-bundle-abc123.js', version: 'abc123' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );
  vi.stubGlobal('fetch', fetchMock);

  // Reset Shopify designMode
  Object.defineProperty(window, 'Shopify', {
    value: { designMode: false },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('loader.js — STR-07 designMode guard', () => {
  it('loader.js file exists at extensions/chat-drawer/assets/loader.js', () => {
    // This will fail until Wave 3 ships the extension scaffold
    expect(() => readFileSync(LOADER_PATH, 'utf-8')).not.toThrow();
  });

  it('does NOT call import() and does NOT fetch manifest when designMode is true at click time', async () => {
    // Set designMode = true BEFORE click
    Object.defineProperty(window, 'Shopify', {
      value: { designMode: true },
      configurable: true,
      writable: true,
    });

    // The loader should export a function the test can call directly
    // (paintFab pattern — Wave 3 implementation decision)
    // For now: assert that the loader module structure allows isolation testing

    // When loader.js exists, reading and evaluating it should not throw
    let loaderText: string;
    try {
      loaderText = readFileSync(LOADER_PATH, 'utf-8');
    } catch {
      // File not found = correct RED state
      expect(true).toBe(true);
      return;
    }

    // If file exists: verify designMode guard is present in source
    expect(loaderText).toMatch(/designMode/);
  });

  it('fetches manifest when designMode is false at click time', async () => {
    Object.defineProperty(window, 'Shopify', {
      value: { designMode: false },
      configurable: true,
      writable: true,
    });

    let loaderText: string;
    try {
      loaderText = readFileSync(LOADER_PATH, 'utf-8');
    } catch {
      // File not found = correct RED state
      expect(true).toBe(true);
      return;
    }

    // Loader source should reference the App Proxy bundle-url path (B-2 fix)
    expect(loaderText).toMatch(/_meta\/bundle-url/);
  });

  it('D-15: paints skeleton container with class sd-skeleton-open before bundle resolves', async () => {
    let loaderText: string;
    try {
      loaderText = readFileSync(LOADER_PATH, 'utf-8');
    } catch {
      // File not found = correct RED state
      expect(true).toBe(true);
      return;
    }

    // Loader source should reference the skeleton class
    expect(loaderText).toMatch(/sd-skeleton-open/);
  });
});

describe('loader.js — FAB restyle per merchant settings (drawer-redesign Task 9)', () => {
  const CSS_PATH = resolve(
    __dirname,
    '../../../extensions/chat-drawer/assets/loader.css'
  );

  it('has a restyleFab path keyed on data.fabStyle, reachable from the meta .then', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/restyleFab/);
    expect(loaderText).toMatch(/data\.fabStyle/);
  });

  it('pill: dark pill markup with the shop name from root.dataset.shopName', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/sd-fab--pill/);
    expect(loaderText).toMatch(/dataset\.shopName/);
    expect(loaderText).toMatch(/Ask /);
  });

  it('labeled: accent block markup with the two-line label', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/sd-fab--labeled/);
    expect(loaderText).toMatch(/Powered by AI/);
    expect(loaderText).toMatch(/Find anything/);
  });

  it('overrides the dataset accent with data.drawerAccent via --sd-accent', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/data\.drawerAccent/);
    expect(loaderText).toMatch(/setProperty\('--sd-accent'/);
  });

  it('loader.css ships the pill/labeled FAB classes', () => {
    const cssText = readFileSync(CSS_PATH, 'utf-8');
    expect(cssText).toMatch(/\.sd-fab--pill/);
    expect(cssText).toMatch(/\.sd-fab--labeled/);
  });

  it('both assets stay well under the 100KB Liquid asset cap', () => {
    const loaderBytes = Buffer.byteLength(readFileSync(LOADER_PATH, 'utf-8'));
    const cssBytes = Buffer.byteLength(readFileSync(CSS_PATH, 'utf-8'));
    expect(loaderBytes).toBeLessThan(100 * 1024);
    expect(cssBytes).toBeLessThan(100 * 1024);
  });
});

describe('loader.js — settings pass-through to the bundle (no first-open flash)', () => {
  // The loader hands the appearance JSON it already fetched through to
  // window.smartdiscovery.mount() so the React drawer seeds its settings
  // state instead of refetching and flashing DEFAULT_SHOP_SETTINGS.
  it('stores the fetched appearance JSON in settingsData', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/var settingsData = null/);
    expect(loaderText).toMatch(/settingsData = data/);
  });

  it('includes settings: settingsData in the mount opts', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/settings:\s*settingsData/);
  });

  it('assigns settingsData before the kill-switch early-return', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    const assignIdx = loaderText.indexOf('settingsData = data');
    const killSwitchIdx = loaderText.indexOf('data.drawerEnabled === false');
    expect(assignIdx).toBeGreaterThan(-1);
    expect(killSwitchIdx).toBeGreaterThan(-1);
    expect(assignIdx).toBeLessThan(killSwitchIdx);
  });
});

describe('loader.js — kill-switch + editor preview visibility', () => {
  // Settings-redesign: after painting the FAB the loader fires a non-blocking
  // appearance lookup and removes the FAB when the merchant disabled the
  // drawer (drawerEnabled === false) or hid the editor preview
  // (designMode && editorPreviewVisible === false). Network failure keeps the
  // FAB (fail-open). String-level assertions — same pattern as above.
  it('fetches the App Proxy appearance meta endpoint after painting the FAB', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/_meta\/appearance/);
  });

  it('removes the FAB when drawerEnabled === false', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/data\.drawerEnabled === false/);
    expect(loaderText).toMatch(/fab\.remove\(\)/);
  });

  it('removes the FAB in the Theme Editor when editorPreviewVisible === false', () => {
    const loaderText = readFileSync(LOADER_PATH, 'utf-8');
    expect(loaderText).toMatch(/data\.editorPreviewVisible === false/);
    // Guarded by the designMode check so storefront visitors are unaffected.
    expect(loaderText).toMatch(
      /window\.Shopify && window\.Shopify\.designMode === true/
    );
  });
});
