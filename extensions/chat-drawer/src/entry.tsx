/**
 * Storefront React bundle entry — Phase 6 (D-13).
 *
 * Stub created in Plan 12 so the extension-structure test passes. Plan 13
 * replaces this with the real React mount that exposes
 * window.smartdiscovery.{mount, toggle} and renders the drawer using the
 * shared lib/chat-ui barrel + StorefrontAdapter.
 */
declare global {
  interface Window {
    smartdiscovery?: {
      mount?: (opts: {
        shop: string;
        customerId: string | null;
        accent: string;
        position: string;
      }) => void;
      toggle?: () => void;
    };
  }
}

export {};
