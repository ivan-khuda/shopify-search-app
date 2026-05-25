/**
 * Phase 4 contract anchor (D-09) — active chat model resolver.
 *
 * Phase 4 returns a hardcoded default for every shop: Gemini 2.5 Flash routed
 * via the Vercel AI Gateway provider/model namespace. The
 * shop-first signature is the contract today — callers in /api/chat and
 * /api/proxy/chat already pass `shop`, so Phase 7 is a BODY-ONLY swap to read
 * `ShopSettings.activeChatModel` from the database. No signature change, no
 * call-site changes, no test rewrites at Phase 7.
 *
 * ASYMMETRY (mirroring services/search/searchableText.ts):
 *   - Phase 4: ignores the shop arg, returns DEFAULT_MODEL.
 *   - Phase 7: will SELECT activeChatModelId FROM shop_settings WHERE shop = $1
 *     and resolve to the matching ActiveChatModel; the default remains the
 *     fallback when the row is absent.
 *
 * Rule: DO NOT inline the model id at call sites. Always route through this
 * helper. The /api/chat and /api/proxy/chat routes both import
 * `getActiveChatModel` and pass its `.id` to `streamText({ model: ... })` so
 * the Phase 7 swap reaches every consumer at once.
 *
 * Why ASCII "Gemini 2.5 Flash":
 *   The banner template that consumes `displayName` (plan 04-06) adds the
 *   em-dash / middle-dot decoration. Keep this string as plain ASCII so the
 *   banner formatting is the single source of typographic truth.
 */

export interface ActiveChatModel {
  id: string;
  displayName: string;
}

// Private — call through `getActiveChatModel` only. NOT exported so callers
// cannot bypass the resolver. Frozen-shape constant via the type annotation
// + module-level immutability convention (mirrors EMBEDDING_MODEL pattern).
const DEFAULT_MODEL: ActiveChatModel = {
  id: 'google/gemini-2.5-flash',
  displayName: 'Gemini 2.5 Flash',
};

/**
 * Resolve the active chat model for a given shop.
 *
 * Phase 4: returns DEFAULT_MODEL for any shop (shop-agnostic by design).
 * Phase 7: will read ShopSettings.activeChatModel from the database.
 *
 * The `async` modifier is intentional so the Phase 7 swap can do a Prisma
 * read without changing the signature. The `void shop;` line signals to
 * TypeScript and any reader that Phase 4 ignores the param.
 */
export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> {
  void shop;
  return DEFAULT_MODEL;
}
