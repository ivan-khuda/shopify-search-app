import { shopifyClient } from '@/lib/shopify/client';
import type { Session } from '@shopify/shopify-api';

/**
 * GraphQL query for the shop's contact email (Phase 8, D-05).
 *
 * The Admin GraphQL schema types `Shop.contactEmail` as `String!`, but in
 * practice dev stores and freshly-provisioned shops may return null or an
 * empty string. The caller (fetchShopContactEmail) coalesces those cases
 * to `null` so the Inngest function can skip the failure-email send
 * without failing the sync.
 *
 * Scope note (Plan 08-06 Open Question 2 resolution): the offline session
 * scopes configured in `lib/shopify/client.ts` (`read_products`) are
 * sufficient — Shopify Admin GraphQL allows `Shop.contactEmail` to be read
 * with any granted scope. Phase 2's working sync corroborates this; if
 * verification (Plan 08-15) surfaces a scope error at runtime, add
 * `read_shop_data` to the scopes config.
 */
export const SHOP_CONTACT_EMAIL_QUERY = /* GraphQL */ `
  query ShopContactEmail {
    shop {
      contactEmail
    }
  }
`;

/**
 * Fetch the shop's contact email for failure notifications (D-05).
 *
 * Returns `null` on every failure mode — missing field, null value,
 * empty string, malformed response, or any thrown GraphQL error.
 * This is intentional per D-05 + Assumption A5: notifications are
 * auxiliary; a notification-path failure must NOT bubble out of the
 * Inngest sync function. The sync result is the contract.
 *
 * Pitfall 6: contactEmail is PII. The catch block is intentionally
 * bare (no error binding) to prevent accidental logging. There must
 * be zero `console.*` calls in this file.
 */
export async function fetchShopContactEmail(
  session: Session
): Promise<string | null> {
  try {
    const client = new shopifyClient.clients.Graphql({ session });
    const response = await client.request<{
      shop?: { contactEmail?: string | null };
    }>(SHOP_CONTACT_EMAIL_QUERY);

    const email = response.data?.shop?.contactEmail;
    return email && email.length > 0 ? email : null;
  } catch {
    // D-05: swallow all errors — failure-email send is auxiliary; the
    // sync result is the contract. Pitfall 6: do NOT bind the error
    // (contactEmail / session token must never reach logs).
    return null;
  }
}
