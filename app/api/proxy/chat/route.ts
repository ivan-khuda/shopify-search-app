/**
 * Storefront chat endpoint — Phase 4 STUB.
 *
 * Phase 4 ships only enough surface here to satisfy EMB-07 success criterion #3:
 * "Both `/api/chat` (admin) and `/api/proxy/chat` (storefront, stubbed) call
 * `SearchService.hybridSearch`." The runtime storefront drawer does NOT invoke
 * this route in Phase 4 — it exists today as a source-level proof point so the
 * EMB-07 verification gate passes via two grep commands targeting `hybridSearch`
 * imports across both routes.
 *
 * TODO(Phase 6): Replace this stub with the real storefront chat endpoint. The
 * Phase 6 executor must add ALL of the following before this route is wired to
 * the customer-facing drawer:
 *
 *   1. App Proxy HMAC validation via
 *        shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })
 *      per STR-04. The `?shop=` query parameter is UNTRUSTED in Phase 4 — Phase 6
 *      must derive shop from the validated signature, NOT from the raw param.
 *   2. Anonymous visitor identity resolution from a `visitor_id` body field
 *      (IDN-01). Shopify's App Proxy strips Set-Cookie, so identity must be
 *      passed in the request payload (localStorage on the storefront), NOT via
 *      cookies — see PROJECT.md "Storefront identity".
 *   3. Replace this JSON response with the Vercel AI SDK streaming-text call
 *      (the same `searchCatalog` tool registration used by `app/api/chat/route.ts`),
 *      sharing the chat-ui components extracted in Phase 5. See that route for
 *      the canonical wiring shape Phase 6 must mirror here.
 *   4. Verify per-shop hard cap (CAP-02) before invoking the AI Gateway so
 *      storefront traffic cannot exhaust the free-tier monthly cap.
 *
 * WARNING: DO NOT use this endpoint from production storefront drawer code
 * until Phase 6. The current implementation trusts the `?shop=` query parameter
 * as-supplied and performs zero authentication — it is a source-level
 * placeholder, not a callable storefront API.
 *
 * Cross-reference: see `app/api/chat/route.ts` for the canonical pattern Phase 6
 * will mirror here. NOTE: this stub intentionally does NOT use the Bearer
 * session wrapper from `@/lib/shopify/auth` — App Proxy authenticates via HMAC,
 * not Bearer tokens, so the two routes will diverge on their auth wrapper even
 * after Phase 6 lands.
 */
import { hybridSearch } from '@/services/search/SearchService';

export async function POST(req: Request): Promise<Response> {
  // TODO(Phase 6): Replace this stub with HMAC verification + streaming-text wiring (see header).
  const url = new URL(req.url);
  // Phase 4: ?shop= is UNTRUSTED here. Phase 6 will verify HMAC signature.
  const shop = url.searchParams.get('shop');
  if (!shop) {
    return Response.json({ error: 'missing_shop' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? '').trim();
  if (!query) {
    return Response.json({ products: [] });
  }

  const products = await hybridSearch(shop, query);
  return Response.json({ products });
}
