/**
 * Phase 7 — Active chat model resolver (D-06, D-08, D-09).
 *
 * Phase 4 defined the contract: `(shop: string) => Promise<ActiveChatModel>`,
 * routed through this single helper so callers in `/api/chat` and
 * `/api/proxy/chat` never inline the model id. Phase 7 honors that contract
 * verbatim and swaps ONLY the body — every consumer picks up merchant model
 * selections on the very next request without any caller code change (D-08).
 *
 * Behavior (per Phase 7 D-06, D-09 + Open Question 3 + 4 resolutions):
 *   1. Empty `shop` (installing / never-saved state) → `DEFAULT_MODEL`,
 *      no DB call.
 *   2. `prisma.shopSettings.findUnique({ where: { shop } })` returns `null`
 *      → `DEFAULT_MODEL`. The DB is never explicitly seeded (D-09); the
 *      absence of a row IS the fallback signal.
 *   3. Row exists + catalog lookup hits → `{ id, displayName }` hydrated
 *      from `fetchModelCatalog()`.
 *   4. Row exists + catalog miss (saved id no longer offered, or catalog
 *      cold-start fallback) → synthesize `displayName` from the id segment
 *      after `'/'` (Open Q3). Chat never breaks.
 *   5. Row exists + catalog throws → same synthesis fallback (catalog
 *      outage; silent — D-06's user-facing warning lives at the settings
 *      page, NOT in the chat hot path). Open Q4: never mutate the DB on
 *      this branch.
 *
 * Implementation note: the resolver calls `prisma.shopSettings.findUnique`
 * directly rather than going through `shopSettingsRepository.get`. Rationale
 * (CONTEXT.md "Resolved Claude's-Discretion items"): the resolver is the
 * single read-path, benefits from inline typed access, and the test file
 * mocks `@/lib/db/client` directly. The repository is the write-path tool
 * (used by Plan 07's PATCH route).
 *
 * Phase 4 deferred-item closure:
 *
 *   T-04-24 (XSS gate on displayName): RESOLVED safe by code-path inspection.
 *   `displayName` flows ONLY into text contexts in V1:
 *     (a) admin chat banner — React JSX text node (auto-escaped),
 *     (b) settings table cell — Polaris `<s-text>` web component (auto-
 *         escaped),
 *     (c) "Model updated to ${displayName}" toast — App Bridge toast API,
 *         text-only render.
 *   No `dangerouslySetInnerHTML` exists anywhere downstream. The source of
 *   displayName is either the AI Gateway catalog response (trusted) or the
 *   id-segment synthesis path — and AI Gateway model ids match the pattern
 *   `^[a-z-]+/[a-z0-9.-]+$` (RESEARCH §State of the Art), so the segment is
 *   always alphanumeric + dashes + dots. No additional sanitization needed.
 *
 *   T-04-25 (`searchParams.shop` ↔ `session.shop`): OUT OF SCOPE for the
 *   resolver. This function takes `shop: string` on trust from the caller.
 *   The trust boundary is enforced at:
 *     - `/api/chat` and `/api/proxy/chat` — shop derived from session token
 *       / App Proxy HMAC (Plan 07 will not alter these).
 *     - `/api/settings/model` PATCH — shop derived strictly from
 *       `withShopifySession`, never from body/query (enforced in Plan 07).
 *     - `/settings` SSR page — shop from searchParams for read-only display
 *       only; documented asymmetry (Plan 08).
 *
 * Constraints:
 *   - Zero `console.*` calls (CLAUDE.md hard rule).
 *   - The id literal `'google/gemini-2.5-flash'` appears EXACTLY ONCE here
 *     in DEFAULT_MODEL. The catalog client's cold-start row duplicates it
 *     by design (circular-import avoidance — see model-catalog.ts).
 *   - No `any` types; let TypeScript infer the Prisma return.
 */
import { prisma } from '@/lib/db/client';
import { fetchModelCatalog } from './model-catalog';

export interface ActiveChatModel {
  id: string;
  displayName: string;
}

// Private — not exported so callers cannot bypass the resolver. Module-level
// immutability convention (mirrors EMBEDDING_MODEL pattern).
const DEFAULT_MODEL: ActiveChatModel = {
  id: 'google/gemini-2.5-flash',
  displayName: 'Gemini 2.5 Flash',
};

export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> {
  // Empty-shop guard: installing / never-saved state. Skip the DB call.
  if (!shop) return DEFAULT_MODEL;

  const row = await prisma.shopSettings.findUnique({ where: { shop } });

  // D-09: never explicitly seed — absence of a row IS the fallback signal.
  if (!row) return DEFAULT_MODEL;

  // Best-effort catalog hydration. Catalog failures (network, gateway down,
  // unknown id) fall through to id-segment synthesis. Silent by design —
  // the warning banner per D-06 lives on the settings page.
  try {
    const { models } = await fetchModelCatalog();
    const match = models.find((m) => m.id === row.activeChatModelId);
    if (match) return { id: match.id, displayName: match.displayName };
  } catch {
    // fall through to synthesized displayName below
  }

  const segment = row.activeChatModelId.split('/')[1] ?? row.activeChatModelId;
  return { id: row.activeChatModelId, displayName: segment };
}
