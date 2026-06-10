/**
 * Storefront chat identity adapter (Phase 5, Phase 6 D-09, CR-03).
 *
 * CR-03 / IN-03: visitor identity is now fetched from the server-signed
 * bootstrap (resolveSignedVisitorId) rather than minted client-side with
 * crypto.randomUUID(). This module is the single consumer of visitor identity
 * on the client — it delegates entirely to the shared bootstrap module.
 * The duplicate identity logic that previously existed in entry.tsx and here
 * is now collapsed into lib/chat-ui/identity/visitor-bootstrap.ts (IN-03).
 *
 * IDN-02: customer_id injected from window.Shopify.customer when the shopper
 * is logged into the storefront (coerced to string for BigInt precision,
 * Pitfall 7). No console.* logging.
 */
import type { ChatIdentityAdapter } from './types';
import { resolveSignedVisitorId } from '@/lib/chat-ui/identity/visitor-bootstrap';

export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/apps/smartdiscovery/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') return {};

    // CR-03: server-minted, HMAC-signed visitor token. The bootstrap module
    // handles caching (in-memory + localStorage) and WR-10 blocked-storage
    // fallback. This adapter never calls crypto.randomUUID() for identity.
    const visitor_id = await resolveSignedVisitorId();
    const body: Record<string, unknown> = { visitor_id };

    // Phase 6 D-09 / IDN-02: include customer_id when shopper is logged in.
    // window.Shopify.customer is set by theme liquid; .id is a numeric BigInt
    // — coerce to string explicitly to preserve precision through JSON.parse
    // (Pitfall 7).
    const shopifyCustomer = (window as unknown as {
      Shopify?: { customer?: { id?: string | number | null } };
    }).Shopify?.customer;
    if (shopifyCustomer && shopifyCustomer.id != null) {
      body.customer_id = String(shopifyCustomer.id);
    }

    return body;
  }
}
