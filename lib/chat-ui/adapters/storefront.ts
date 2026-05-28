import type { ChatIdentityAdapter } from './types';

const STORAGE_KEY = 'smartdiscovery.visitor_id';

export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/apps/smartdiscovery/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') return {};
    let visitorId = window.localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, visitorId);
    }
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
