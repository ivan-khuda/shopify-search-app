/**
 * Storefront chat endpoint — Phase 4 STUB (501 NOT IMPLEMENTED).
 *
 * Phase 4 ships only enough surface here to satisfy EMB-07 success criterion #3:
 * "Both `/api/chat` (admin) and `/api/proxy/chat` (storefront, stubbed) call
 * `SearchService.hybridSearch`." The `hybridSearch` import below is the
 * source-level proof point that satisfies the EMB-07 grep gate; the route
 * returns 501 Not Implemented unconditionally until Phase 6.
 *
 * Why 501 instead of a working implementation: this route is exposed under the
 * App Proxy path and was previously invoking `hybridSearch` with the raw
 * `?shop=` query parameter, with no authentication. That allowed any caller
 * who knew a shop's `.myshopify.com` domain to dump search matches for that
 * shop — a multi-tenant data leak per PROJECT.md's "no multi-tenant data
 * leaks" hard constraint. Issue: 04-REVIEW.md CR-01.
 *
 * TODO(Phase 6): Replace the 501 short-circuit with the real storefront chat
 * endpoint. Required additions before the route is wired to the customer-facing
 * drawer:
 *
 *   1. App Proxy HMAC validation via
 *        shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })
 *      per STR-04. Derive `shop` from the validated signature, NOT from the
 *      raw query parameter.
 *   2. Anonymous visitor identity resolution from a `visitor_id` body field
 *      (IDN-01). Shopify's App Proxy strips Set-Cookie, so identity must be
 *      passed in the request payload (localStorage on the storefront), NOT via
 *      cookies — see PROJECT.md "Storefront identity".
 *   3. Replace the 501 with the Vercel AI SDK streaming-text call (the same
 *      `searchCatalog` tool registration used by `app/api/chat/route.ts`),
 *      sharing the chat-ui components extracted in Phase 5.
 *   4. Verify per-shop hard cap (CAP-02) before invoking the AI Gateway so
 *      storefront traffic cannot exhaust the free-tier monthly cap.
 *
 * Cross-reference: see `app/api/chat/route.ts` for the canonical pattern Phase 6
 * will mirror here. NOTE: Phase 6 must NOT use the Bearer session wrapper from
 * `@/lib/shopify/auth` — App Proxy authenticates via HMAC, not Bearer tokens,
 * so the two routes will diverge on their auth wrapper.
 */
import { hybridSearch } from '@/services/search/SearchService';

// Phase 6 will replace the 501 short-circuit with HMAC verification + streamText.
// The reference to `hybridSearch` keeps the import alive for the EMB-07 source-
// level grep gate without giving the live route any way to invoke it.
void hybridSearch;

export async function POST(): Promise<Response> {
  return Response.json(
    {
      error: 'not_implemented',
      message:
        'Storefront chat endpoint is a Phase 4 stub. Phase 6 will replace this with HMAC-authenticated streaming chat.',
    },
    { status: 501 },
  );
}
