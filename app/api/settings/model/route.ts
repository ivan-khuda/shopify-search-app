/**
 * PATCH /api/settings/model — the single write path for `ShopSettings.activeChatModelId`.
 *
 * Surface (Phase 7 contract):
 *   - HTTP method: PATCH only. No GET/POST/DELETE in V1.
 *   - Auth: Bearer session-token via `withShopifySession` (Plan 07-03). Auth failures
 *     are translated to 401 `{ error: <code> }` by the wrapper before reaching this
 *     handler.
 *   - Request body: `{ activeChatModelId: string }` (1..200 chars). Any other shape →
 *     400 `{ error: 'invalid_body' }`.
 *   - Defense-in-depth (RESEARCH §Pattern 4): the submitted id is re-validated against
 *     a live `fetchModelCatalog()` lookup BEFORE upsert. An id outside the catalog →
 *     400 `{ error: 'unknown_model_id' }` and NO write happens.
 *   - Multi-tenancy lock: `shop` is sourced from the verified session context only.
 *     Any `shop` field present in the request body is ignored by the Zod schema and
 *     never reaches the repository.
 *
 * Response shape:
 *   - 200 → `{ ok: true, displayName: string }` (catalog-hydrated human name)
 *   - 400 → `{ error: 'invalid_body' | 'unknown_model_id' }`
 *   - 401 → `{ error: 'missing_token' | 'invalid_token' | 'invalid_dest'
 *             | 'invalid_shop_domain' | 'no_offline_session' }` (from withShopifySession)
 *
 * CLAUDE.md constraints:
 *   - Zero log calls in this file (CLAUDE.md). Errors return structured codes only.
 *   - No PII, no auth tokens, no stack traces in any response body.
 */
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import { shopSettingsRepository } from '@/lib/db/repositories/ShopSettingsRepository';

const Body = z.object({
  activeChatModelId: z.string().min(1).max(200),
});

export const PATCH = withShopifySession(async ({ shop, req }) => {
  // 1. Parse JSON body — malformed JSON is invalid_body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  // 2. Zod-validate body shape. Note: `shop` in body is NOT in the schema, so any
  // tampered `shop: 'evil-shop'` is silently dropped — multi-tenancy lock.
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { activeChatModelId } = parsed.data;

  // 3. Defense-in-depth: validate id against the live catalog. The 15-min cache
  // means this is effectively a no-cost lookup on the hot path.
  const catalog = await fetchModelCatalog();
  const match = catalog.models.find((m) => m.id === activeChatModelId);
  if (!match) {
    return Response.json({ error: 'unknown_model_id' }, { status: 400 });
  }

  // 4. Upsert keyed by ctx.shop (NEVER body.shop).
  await shopSettingsRepository.upsert(shop, activeChatModelId);

  // 5. Echo the catalog-hydrated displayName so the client can update its
  // optimistic state without a second fetch.
  return Response.json({ ok: true, displayName: match.displayName }, { status: 200 });
});
