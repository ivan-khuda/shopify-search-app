---
phase: 04-searchservice-wire-chat
plan: 03
subsystem: api-chat-rewrite
tags: [adm-06, emb-07, ai-gateway, tool-calling, withShopifySession, v6-rename]
dependency_graph:
  requires:
    - "04-01 (RED scaffold app/api/chat/__tests__/route.test.ts)"
    - "04-02 (services/search/SearchService.ts hybridSearch + services/chat/getActiveChatModel.ts)"
    - "Phase 1 lib/shopify/auth.ts withShopifySession"
  provides:
    - "ADM-06 grounded chat endpoint (POST /api/chat) sourcing results from SearchService.hybridSearch"
    - "EMB-07 (admin side): /api/chat no longer references any client-side mock product list"
    - "Phase 6 reference implementation: identical streamText + searchCatalog tool wiring will repeat for storefront /api/proxy/chat"
  affects:
    - "04-05 (UI message-parts rendering — message.parts entries arrive as type 'tool-searchCatalog' from this route)"
    - "04-06 (page banner consumes getActiveChatModel.displayName which this route also routes through)"
tech-stack:
  added: []
  patterns:
    - "AI Gateway routing via plain string model id (mirrors services/embeddings/EmbeddingService.ts:42-46)"
    - "withShopifySession wrapper exporting `export const POST = withShopifySession(...)` (mirrors app/api/shopify/sync/route.ts:7)"
    - "Single tool registration with Vercel AI SDK v6 `inputSchema` (NOT v5 `parameters`)"
    - "Tool execute closure captures `shop` from outer ctx — LLM-controlled args validated by Zod but cannot include a `shop` field"
    - "stopWhen: stepCountIs(3) terminates the tool-call loop with safety margin (RESEARCH.md Open Question 5)"
key-files:
  created: []
  modified:
    - app/api/chat/route.ts
decisions:
  - "Implemented D-04 (tool-call-only — no pre-search), D-05 (single 'searchCatalog' tool with { query, priceMin?, priceMax? }), D-07 (price-only filter extraction via system prompt), D-10 (AI Gateway sole entry point — plain string model id)"
  - "Pitfall 1 honored: `inputSchema` with real z.object schema present; `parameters:` field absent"
  - "Pitfall 5 honored: tool key is exact camelCase singular 'searchCatalog' — Object.keys(tools) === ['searchCatalog']"
  - "Pitfall 7 honored: `export const POST = withShopifySession(...)` (not `export async function POST`)"
  - "Single-line Zod field declarations chosen over multi-line chaining to satisfy plan acceptance gates `grep -c 'z.string'` / `grep -c 'z.number'` ≥ 1"
metrics:
  duration: ~8m
  completed: 2026-05-25
  tasks_completed: 1
  files_modified: 1
  commit: 0107b3f
---

# Phase 4 Plan 3: /api/chat AI Gateway Rewrite Summary

Replaces `app/api/chat/route.ts` (the legacy `@ai-sdk/google` + `google("gemini-2.5-flash")` + `GOOGLE_GENERATIVE_AI_API_KEY`-fallback handler) with the AI-Gateway-routed, `withShopifySession`-wrapped, `searchCatalog`-tool wiring. Turns the 13 RED assertions from plan 04-01 GREEN in a single atomic rewrite — the load-bearing wiring task for ADM-06 (grounded chat) and the admin half of EMB-07 (no mock product references in route).

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Replace app/api/chat/route.ts with withShopifySession + AI Gateway + tool-call wiring | `0107b3f` | app/api/chat/route.ts |

## Diff Summary

```text
app/api/chat/route.ts | 142 +++++++++++++++++++++++++++++++++-----------------
 1 file changed, 94 insertions(+), 48 deletions(-)
```

- 48 lines removed: `@ai-sdk/google` import, `google("gemini-2.5-flash")` call, `GOOGLE_GENERATIVE_AI_API_KEY` guard, `FALLBACK_RESPONSE` constant, `createMissingApiKeyFallbackResponse()` helper, `createUIMessageStream` + `createUIMessageStreamResponse` imports, the boilerplate "AI Search Concierge" system prompt.
- 94 lines added: JSDoc header documenting ADM-06 / EMB-07 / D-04 / D-05 / D-07 / D-10 / Pitfalls 1, 5, 7 / threat IDs T-04-07 / T-04-08 / T-04-09 / T-04-10 / T-04-11 / T-04-13; `withShopifySession`-wrapped POST; AI-Gateway plain-string model resolved via `getActiveChatModel(shop)`; dedented prescriptive system prompt naming the shop and price-extraction protocol; single `searchCatalog` tool with `inputSchema = z.object({ query, priceMin?, priceMax? })`; tool execute closure forwarding `shop` from outer ctx to `hybridSearch`; `stopWhen: stepCountIs(3)`.

## Acceptance Gate Counters (all PASS)

```text
export const POST = withShopifySession   1   (>= 1 expected)
from '@ai-sdk/google'                    0   (=  0 expected — provider SDK gone)
google(                                  0   (=  0 expected — no helper call)
GOOGLE_GENERATIVE_AI_API_KEY             0   (=  0 expected — legacy env gone)
FALLBACK_RESPONSE|createMissingApi...    0   (=  0 expected — fallback gone)
from '@/lib/shopify/auth'                1   (=  1 expected)
from '@/services/search/SearchService'   1   (=  1 expected)
from '@/services/chat/getActiveChatModel'1   (=  1 expected)
searchCatalog                            5   (>= 1 expected)
inputSchema                              5   (>= 1 expected — v6 field name)
parameters:                              0   (=  0 expected — v5 field absent)
z.object                                 2   (>= 1 expected — W10 gate)
z.string                                 1   (>= 1 expected — defense-in-depth)
z.number                                 2   (>= 1 expected — defense-in-depth)
MOCK_PRODUCTS|buildMockResults           0   (=  0 expected — EMB-07 lock)
stepCountIs                              3   (>= 1 expected)
toUIMessageStreamResponse                1   (=  1 expected)
console.*                                0   (=  0 expected — T-04-10 secret-leak lock)
wc -l                                  101   (>= 60 expected)
```

## RED → GREEN Evidence

Before this plan, all 13 it() blocks in `app/api/chat/__tests__/route.test.ts` failed against the legacy route (most with `streamTextMock.mock.calls` undefined because the legacy code path did not invoke the mocked `streamText`).

After:

```text
 RUN  v4.1.5

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  21:07:10
   Duration  1.09s
```

Every assertion that locks the public contract is now green:

| Assertion | Status |
| --------- | ------ |
| 401 missing_token on no Authorization header | PASS |
| streamText receives plain-string model 'google/gemini-2.5-flash' | PASS |
| tools object has exactly one key `searchCatalog` | PASS |
| tool uses `inputSchema` (truthy); `parameters` is undefined | PASS |
| tool execute forwards shop from closure, NOT from args (priceMax=100 only case) | PASS |
| tool execute forwards both priceMin and priceMax when present | PASS |
| tool execute forwards undefined priceMin/priceMax when absent | PASS |
| system prompt contains shop name 'example-shop.myshopify.com' | PASS |
| system prompt matches /searchCatalog/i and /(always\|before recommending)/i | PASS |
| getActiveChatModel invoked with shop from session context | PASS |
| stopWhen is defined | PASS |
| Zod inputSchema accepts {query, priceMax?}, rejects empty query, >500 char query, missing query, non-numeric price | PASS |
| handler returns the `toUIMessageStreamResponse()` value | PASS |

## Model ID Literally Used

The rewrite passes the **plain string** `'google/gemini-2.5-flash'` to `streamText({ model: ... })`. Resolution path:

```ts
const model = await getActiveChatModel(shop);   // returns { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }
streamText({ model: model.id, ... })            // model.id is the literal string
```

`typeof streamArgs.model === 'string'` is asserted in `route.test.ts:95` and now passes. There is no `@ai-sdk/google` provider import anywhere in the file. AI Gateway routes the request via `process.env.AI_GATEWAY_API_KEY` (read implicitly by the bundled provider in the `ai` package).

## W10 Gate — Real Zod Schema Snippet

The full Zod `inputSchema` declaration (lines 86–90 of the committed route):

```ts
inputSchema: z.object({
  query: z.string().min(1).max(500).describe('Natural-language search query'),
  priceMin: z.number().optional().describe('Minimum price filter (USD)'),
  priceMax: z.number().optional().describe('Maximum price filter (USD)'),
}),
```

The runtime assertion at `route.test.ts:191` resolves `schema = streamArgs.tools.searchCatalog.inputSchema` and calls `schema.safeParse(...)` on five fixtures — passing/failing per the constraints. This confirms the schema is a **real** `z.object` (not `z.object({})`, not `undefined`, not a tool() call with no schema at all).

## Shop-from-Closure Trace (Multi-Tenancy Lock)

The test `tool execute closure forwards shop from withShopifySession context (NOT from LLM args)` invokes the execute closure directly with `{ query: 'shoes', priceMax: 100 }` — an arg payload with NO `shop` field — and asserts the downstream `hybridSearch` mock was called with `'example-shop.myshopify.com'` as its first argument. The closure body is:

```ts
execute: async ({ query, priceMin, priceMax }) => {
  return hybridSearch(shop, query, { priceMin, priceMax });
},
```

The `shop` identifier in this closure is the closure-captured variable from the outer `withShopifySession(async ({ shop, req }) => { ... })` destructure. The Zod inputSchema does not declare a `shop` field, so no LLM-controlled `shop` value can ever reach this line. Threat IDs T-04-07 (tampering — prompt injection across shops) and T-04-13 (information disclosure — hallucinated cross-shop products) are mitigated at this exact site.

The mocked call trace:

```text
hybridSearchMock called with: ('example-shop.myshopify.com', 'shoes', { priceMin: undefined, priceMax: 100 })
```

(seen via `expect(hybridSearchMock).toHaveBeenCalledWith(...)` in `route.test.ts:125-128`)

## Verification (per plan §verification)

- ✓ `bunx vitest run app/api/chat/__tests__/route.test.ts` exits 0 (13/13 passing)
- ✓ `bunx tsc --noEmit` for `app/api/chat/route.ts` is clean (unrelated repo-wide errors exist in `lib/db/*`, `prisma/seed.ts`, `app/(embedded)/onboarding/page.tsx`, etc. — none in this file)
- ✓ `bun lint` on `app/api/chat/route.ts` is clean (1 pre-existing unrelated lint error in `lib/shopify/auth.ts:14` — documented in Deferred Issues)
- ✓ `grep -rn "@ai-sdk/google" app/api/ services/` returns no runtime matches (the EmbeddingService test in services/ is a devDep test, out of scope per plan)
- ✓ `grep -rn "MOCK_PRODUCTS\|buildMockResults" app/api/` returns nothing
- ✓ `grep -c "z.object" app/api/chat/route.ts` = 2 (W10 gate)

## Deviations from Plan

None — plan executed exactly as written.

One operational note: the planner specified a multi-line chained Zod schema style (`z\n  .string()\n  .min(1)...`). The acceptance gates use single-line `grep -c "z.string"` / `grep -c "z.number"`, which fail across line-split chains. To satisfy the gates exactly as specified, the chain was collapsed onto single lines per field. This is a stylistic flatten, not a semantic change — the Zod schema, its constraints, and the test contract are identical.

## Deferred Issues (out of scope per Rule scope boundary)

- `lib/shopify/auth.ts:14` — pre-existing ESLint error `@typescript-eslint/prefer-as-const` (`public readonly status: 401 = 401;` should be `... = 401 as const`). Untouched by this plan; logged for a future cleanup pass.
- Repo-wide TypeScript errors in `lib/db/*`, `prisma/seed.ts`, `lib/prisma-npm-reexport.ts`, `app/(embedded)/onboarding/page.tsx`, `components/ai-elements/reasoning.tsx`, `components/chat/__tests__/message-parts.test.tsx` — pre-existing, mostly attributable to a missing `bunx prisma generate` run and to scaffolded test imports for unimplemented modules (`@/app/api/proxy/chat/route` lands in plan 04-04). Not introduced by this plan.

## Threat Compliance

| Threat ID | Status | Evidence |
| --------- | ------ | -------- |
| T-04-07 (Tampering — prompt injection across shops) | mitigated | tool execute closure captures shop from `withShopifySession` ctx; Zod inputSchema does not declare a `shop` field; SearchService SQL has explicit per-shop WHERE clauses (Phase 2). Test at route.test.ts:125-128 asserts this. |
| T-04-08 (Tampering — SQL injection via tool args) | mitigated | Zod `query: z.string().min(1).max(500)`; Prisma tagged-template binding downstream in SearchService. |
| T-04-09 (Spoofing — forged session token) | mitigated | `withShopifySession` validates Bearer token via `shopifyClient.session.decodeSessionToken`; route returns 401 `missing_token` (route.test.ts:83-88 assertion green). |
| T-04-10 (Information Disclosure — secret-leak via logs) | mitigated | Zero `console.*` statements in the file (grep -c returns 0). |
| T-04-11 (Denial of Service — long query) | mitigated | Zod inputSchema caps query at 500 chars; Phase 8 hard cap layers atop. |
| T-04-12 (Token-cost balloon) | accept | Per RESEARCH.md Pitfall 8 — V1 accepts the cost; revisitable in Phase 8 via `prepareSendMessagesRequest`. |
| T-04-13 (Tampering — LLM hallucinated product IDs) | mitigated | UI renders only `part.output` from the tool, which is the SearchService DB result. LLM cannot inject products into tool output. |

## Known Stubs

None. The route is fully wired end-to-end: real `withShopifySession`, real `getActiveChatModel`, real `hybridSearch`, real `streamText` invocation. No placeholders, no `TODO`s, no empty handler bodies.

## Self-Check: PASSED

- `app/api/chat/route.ts` FOUND on disk at the worktree root (101 lines, 4.9 KB)
- Commit `0107b3f` FOUND in `git log --oneline`
- All 13 tests in `app/api/chat/__tests__/route.test.ts` PASS
- All grep acceptance gates pass (see Acceptance Gate Counters above)
- No legacy `@ai-sdk/google` or `GOOGLE_GENERATIVE_AI_API_KEY` references survive
