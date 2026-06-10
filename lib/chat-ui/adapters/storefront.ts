import type { ChatIdentityAdapter } from './types';

const STORAGE_KEY = 'smartdiscovery.visitor_id';

// WR-10: localStorage access throws SecurityError when site data is blocked
// (Safari "Block all cookies", some embedded webviews, certain private modes).
// Storefront code runs on uncontrolled browser configurations — degrade to a
// per-page-load in-memory visitor id instead of breaking every chat send.
// The in-memory id is consulted ONLY when storage is blocked; when storage
// works, localStorage stays the single source of truth.
let inMemoryVisitorId: string | null = null;

function readStoredVisitorId(key: string): { blocked: boolean; value: string | null } {
  try {
    return { blocked: false, value: window.localStorage.getItem(key) };
  } catch {
    return { blocked: true, value: null };
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked — the in-memory fallback keeps the id stable for this page load.
  }
}

export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/apps/smartdiscovery/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') return {};
    const stored = readStoredVisitorId(STORAGE_KEY);
    let visitorId: string;
    if (stored.value) {
      visitorId = stored.value;
    } else if (stored.blocked && inMemoryVisitorId) {
      visitorId = inMemoryVisitorId;
    } else {
      visitorId = crypto.randomUUID();
      safeStorageSet(STORAGE_KEY, visitorId);
    }
    inMemoryVisitorId = visitorId;
    const body: Record<string, unknown> = { visitor_id: visitorId };
    // Phase 6 D-09 / IDN-02: include customer_id when shopper is logged into the
    // storefront. window.Shopify.customer is set by theme liquid; .id is a
    // numeric BigInt — coerce to string explicitly to preserve precision
    // through JSON.parse (Pitfall 7).
    const shopifyCustomer = (window as unknown as {
      Shopify?: { customer?: { id?: string | number | null } };
    }).Shopify?.customer;
    if (shopifyCustomer && shopifyCustomer.id != null) {
      body.customer_id = String(shopifyCustomer.id);
    }
    return body;
  }
}
