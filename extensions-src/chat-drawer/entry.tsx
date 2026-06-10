/**
 * Storefront bundle entry — Phase 6 (D-13).
 *
 * Runs INSIDE the dynamically-imported main bundle. loader.js (the
 * vanilla IIFE in extensions/chat-drawer/assets/loader.js) calls
 * `window.smartdiscovery.mount(opts)` after `await import(bundleUrl)`.
 * From that point on this module owns the drawer's React lifecycle.
 *
 * No console.* logging.
 */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StorefrontDrawer } from './components/StorefrontDrawer';

const STORAGE_KEY = 'smartdiscovery.visitor_id';

interface MountOpts {
  shop: string;
  customerId: string | null;
  accent: string;
  position: 'bottom_right' | 'bottom_left';
}

let reactRoot: Root | null = null;
let lastOpts: MountOpts | null = null;
let visitorId: string | null = null;
// WR-03: imperative toggle registered by the mounted StorefrontDrawer so
// `toggle()` can flip the drawer's real open state (re-rendering with a
// different `initialOpen` is a no-op once mounted).
let drawerToggle: (() => void) | null = null;

function resolveVisitorId(): string {
  if (visitorId) return visitorId;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    visitorId = stored;
    return stored;
  }
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, fresh);
  visitorId = fresh;
  return fresh;
}

function renderDrawer(opts: MountOpts, initialOpen: boolean): void {
  if (!reactRoot) return;
  reactRoot.render(
    <StorefrontDrawer
      shop={opts.shop}
      visitorId={resolveVisitorId()}
      customerId={opts.customerId}
      accent={opts.accent}
      position={opts.position}
      initialOpen={initialOpen}
      registerToggle={(fn) => {
        drawerToggle = fn;
      }}
    />
  );
}

function mount(opts: MountOpts): void {
  const rootEl = document.querySelector('smartdiscovery-app');
  if (!rootEl) return;

  document.body.classList.remove('sd-skeleton-open');

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
  renderDrawer(opts, true);
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
  renderDrawer(lastOpts, true);
}

declare global {
  interface Window {
    smartdiscovery?: { mount: typeof mount; toggle: typeof toggle };
  }
}

window.smartdiscovery = { mount, toggle };

export {};
