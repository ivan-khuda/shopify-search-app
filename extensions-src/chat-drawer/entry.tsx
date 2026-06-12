/**
 * Storefront bundle entry — Phase 6 (D-13), updated CR-03.
 *
 * Runs INSIDE the dynamically-imported main bundle. loader.js (the
 * vanilla IIFE in extensions/chat-drawer/assets/loader.js) calls
 * `window.smartdiscovery.mount(opts)` after `await import(bundleUrl)`.
 * From that point on this module owns the drawer's React lifecycle.
 *
 * CR-03 / IN-03: visitor identity now comes from resolveSignedVisitorId
 * (server-minted, HMAC-signed). The previous local resolveVisitorId /
 * STORAGE_KEY / safeStorage* helpers are removed — that logic lives in
 * lib/chat-ui/identity/visitor-bootstrap.ts (single source, IN-03).
 *
 * WR-10 preserved: if resolveSignedVisitorId rejects (network down, HMAC
 * config error), mount() catches and falls back to an empty-string token so
 * the drawer still renders. The server will return 401 on the first request,
 * the client re-mints, and subsequent requests succeed.
 *
 * No console.* logging.
 */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StorefrontDrawer } from './components/StorefrontDrawer';
import { resolveSignedVisitorId } from '@/lib/chat-ui/identity/visitor-bootstrap';

// Baked in by scripts/build-storefront-bundle.ts via esbuild `define` — the
// content-hashed filename of the compiled drawer stylesheet that the build
// emits next to this bundle under /public. Non-secret. Declared (not
// assigned) so dev/test loads without the define stay safe behind the
// `typeof` guard in injectStyles().
declare const __SD_STYLES_FILE__: string;

const STYLES_LINK_ID = 'smartdiscovery-styles';

/**
 * Inject the drawer's compiled Tailwind stylesheet once per page. The drawer
 * components style exclusively with Tailwind utility classes; without this
 * link the storefront renders unstyled. The href is resolved against this
 * module's own URL — the entry is an ESM module served from the app host's
 * /public, and the CSS sits in the same directory.
 */
function injectStyles(): void {
  if (typeof __SD_STYLES_FILE__ !== 'string' || !__SD_STYLES_FILE__) return;
  if (document.getElementById(STYLES_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = STYLES_LINK_ID;
  link.rel = 'stylesheet';
  link.href = new URL('./' + __SD_STYLES_FILE__, import.meta.url).href;
  document.head.appendChild(link);
}

interface MountOpts {
  shop: string;
  customerId: string | null;
  // Legacy loader paint settings — the React drawer reads its accent /
  // position from the fetched settings bundle now (drawer-redesign Task 8);
  // these fields stay so older cached loaders keep calling mount() safely.
  accent: string;
  position: 'bottom_right' | 'bottom_left';
  /**
   * Loader-fetched /_meta/appearance JSON, handed through so the drawer can
   * seed its settings state without a second fetch (no DEFAULT_SHOP_SETTINGS
   * flash on first open). Optional — older cached loaders don't send it and
   * StorefrontDrawer falls back to fetching itself.
   */
  settings?: unknown;
}

let reactRoot: Root | null = null;
let lastOpts: MountOpts | null = null;
// data-shop-name (Task 9 adds it to app_embed.liquid) — read defensively so
// the bundle works against themes still serving the older liquid.
let lastShopName: string | null = null;
// WR-03: imperative toggle registered by the mounted StorefrontDrawer so
// `toggle()` can flip the drawer's real open state (re-rendering with a
// different `initialOpen` is a no-op once mounted).
let drawerToggle: (() => void) | null = null;

function renderDrawer(opts: MountOpts, visitorId: string, initialOpen: boolean): void {
  if (!reactRoot) return;
  reactRoot.render(
    <StorefrontDrawer
      shop={opts.shop}
      visitorId={visitorId}
      customerId={opts.customerId}
      shopName={lastShopName}
      fabPosition={opts.position}
      initialSettings={opts.settings}
      initialOpen={initialOpen}
      registerToggle={(fn) => {
        drawerToggle = fn;
      }}
    />
  );
}

async function mount(opts: MountOpts): Promise<void> {
  const rootEl = document.querySelector<HTMLElement>('smartdiscovery-app');
  if (!rootEl) return;

  injectStyles();

  lastShopName = rootEl.dataset?.shopName || null;

  document.body.classList.remove('sd-skeleton-open');

  // WR-04: the loader.js IIFE painted its own FAB directly under
  // <smartdiscovery-app>. StorefrontDrawer renders a React-owned FAB with the
  // same class/position/z-index — remove the loader's so the page never has
  // two stacked buttons with duplicate accessible names and stale
  // aria-expanded. (`:scope >` excludes React's FAB, which lives inside
  // .sd-drawer-mount.)
  rootEl.querySelector(':scope > button.sd-fab')?.remove();

  let container = rootEl.querySelector<HTMLDivElement>('.sd-drawer-mount');
  if (!container) {
    container = document.createElement('div');
    container.className = 'sd-drawer-mount';
    rootEl.appendChild(container);
  }
  if (!reactRoot) {
    reactRoot = createRoot(container);
  }
  lastOpts = opts;

  // CR-03: resolve signed visitor token before first render so DrawerBody
  // has it immediately. On failure degrade to empty string — server returns
  // 401 on first use, client re-mints via /_meta/visitor, subsequent
  // requests succeed. Drawer always mounts (WR-10 mount-survival guarantee).
  let visitorId = '';
  try {
    visitorId = await resolveSignedVisitorId();
  } catch {
    // Fallback: empty token — drawer mounts, first request triggers re-mint.
  }

  renderDrawer(opts, visitorId, true);
}

function toggle(): void {
  // Preferred path: flip the mounted drawer's real open state.
  if (drawerToggle) {
    drawerToggle();
    return;
  }
  // Fallback (drawer never registered, e.g. first render still in flight):
  // re-render requesting an open drawer.
  if (!lastOpts) return;
  // Use the cached token from the bootstrap module (already resolved).
  void resolveSignedVisitorId().then((visitorId) => {
    if (lastOpts) renderDrawer(lastOpts, visitorId, true);
  });
}

declare global {
  interface Window {
    smartdiscovery?: { mount: typeof mount; toggle: typeof toggle };
  }
}

window.smartdiscovery = { mount, toggle };

export {};
