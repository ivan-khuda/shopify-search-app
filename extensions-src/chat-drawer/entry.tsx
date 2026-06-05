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
  if (!lastOpts) return;
  // Re-render with initialOpen toggled — the drawer's internal state
  // re-seeds from initialOpen on remount. For V1 this is acceptable; a
  // controlled-props variant can ship later if needed.
  renderDrawer(lastOpts, true);
}

declare global {
  interface Window {
    smartdiscovery?: { mount: typeof mount; toggle: typeof toggle };
  }
}

window.smartdiscovery = { mount, toggle };

export {};
