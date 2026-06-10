# Phase 4: SearchService + Wire Chat - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the admin chat playground to real, shop-scoped catalog data via a hybrid pgvector + tsvector retrieval service. Concretely:

1. New `services/search/SearchService.ts` exporting `hybridSearch(shop, query, opts)` — runs vector cosine top-K and tsvector `websearch_to_tsquery` in parallel inside a single `withHnswIterativeScan` transaction, fuses via Reciprocal Rank Fusion, returns ranked shop-scoped `Product[]` (with variants/images joined for card rendering).
2. Migrate `/api/chat/route.ts` from direct `@ai-sdk/google` to Vercel AI Gateway and add a `searchCatalog` tool exposed to the model via Vercel AI SDK `streamText({ tools })`. Tool args: `{ query: string, priceMin?: number, priceMax?: number }`. Tool result: `Product[]` from SearchService.
3. Refactor `components/chat/chat.tsx` to render product cards directly from `message.parts` tool-result entries. Delete `components/chat/mock-products.ts` (`MOCK_PRODUCTS` + `buildMockResults`) and the `PendingProductAttachment` glue code that anchored client-side keyword search to assistant messages.
4. Add `services/chat/getActiveChatModel.ts` — a thin stub returning the default chat model ID (`google/gemini-2.5-flash` routed through AI Gateway). Phase 7 will replace the body with a `ShopSettings` lookup.
5. Add "Preview mode — using your real catalog · Model: {modelId}" banner above the chat container on `/chat`, sourced from `getActiveChatModel(shop)`.
6. Stub `/api/proxy/chat/route.ts` that calls `SearchService.hybridSearch` and returns JSON. Phase 6 owns the real HMAC-verified storefront endpoint; Phase 4 ships the route file with a TODO marker so EMB-07's "both routes call SearchService" success criterion is provable today.

4 requirements: EMB-05, EMB-07, ADM-05, ADM-06. Phase 4 does NOT touch shared `lib/chat-ui/` extraction (Phase 5), storefront drawer (Phase 6), model picker UI (Phase 7), or email/cap (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### RRF Fusion Shape

- **D-01:** Pure (unweighted) Reciprocal Rank Fusion with `k = 60` (Cormack et al. default). Scoring formula: `score(doc) = 1 / (k + rank_vec) + 1 / (k + rank_lex)` where `rank_*` is the doc's 1-based rank within each retriever's result list (∞ when absent). No `α` weighting, no env-var knobs in V1 — revisit if quality is poor and we have telemetry to argue from.
- **D-02:** Each retriever returns its top **50** candidates before fusion; final result list returns top **10** products. Rationale: 50+50 → ~80–100 unique union members → comfortable headroom for the LLM to surface 3–5 cards while still letting it page within the tool result if it wants. Constants live as named exports at the top of `SearchService.ts` (`RRF_K`, `BRANCH_LIMIT`, `RESULT_LIMIT`).
- **D-03:** Both retrievers execute inside a single `withHnswIterativeScan(async (tx) => {...})` transaction. The vector branch runs `ORDER BY embedding <=> $queryVec LIMIT 50` against `product_embeddings` joined to `products` on `(shop, productShop, productId)`. The lexical branch runs `ORDER BY ts_rank_cd(searchVector, websearch_to_tsquery('english', $query)) DESC LIMIT 50` against `products`. Both `WHERE shop = $1` (the multi-tenancy guarantee from Phase 1 D-03/D-04 is enforced at the query layer here, not via Prisma extensions).

### Chat → Search Wiring

- **D-04:** Wiring is **tool-call only** via Vercel AI SDK `streamText({ tools: { searchCatalog: tool({...}) } })`. There is no pre-search before the LLM runs. The model decides when to call the tool, including multi-turn refinement and follow-up calls within one turn. Embedding the query happens inside the tool implementation, NOT in the route handler.
- **D-05:** Tool signature:
  ```ts
  searchCatalog: tool({
    description: 'Search the merchant\'s catalog by natural-language query plus optional price filters. Returns up to 10 matching products with title, description, price range, image, and tags. Always call this before recommending products.',
    parameters: z.object({
      query: z.string().min(1).max(500).describe('Natural-language search query'),
      priceMin: z.number().optional().describe('Minimum price filter (USD)'),
      priceMax: z.number().optional().describe('Maximum price filter (USD)'),
    }),
    execute: async ({ query, priceMin, priceMax }) =>
      SearchService.hybridSearch(ctx.shop, query, { priceMin, priceMax }),
  })
  ```
  The `shop` is captured from the request closure (set by `withShopifySession` per Phase 1 D-07); the LLM never sees or controls `shop`.
- **D-06:** Products surface in the UI by reading `message.parts` directly. `ChatMessage` iterates the parts array and renders `ProductCard` for any part of type `tool-searchCatalog` with `state === 'output-available'`. The legacy `PendingProductAttachment` state in `components/chat/chat.tsx` (lines 77–142) and the client-side `MOCK_PRODUCTS.filter()` block (lines 87–103) are deleted in the same plan. Saved-products toggle still lives in page-level state — the tool only sources what to *show*, not what's saved.

### Filter Parsing

- **D-07:** Phase 4 ships **price-only** structured filters. The LLM extracts `priceMin`/`priceMax` (USD numerics) from the user message into tool args via the Zod schema in D-05; no other structured filters (tags, vendor, inStock, in-budget categorical, size, color) are extracted in V1. The system prompt explicitly instructs the model to extract price phrases like "under $X", "between $A and $B", "around $X" (interpreted as ±20%, the model decides) into the optional params.
- **D-08:** SearchService applies the price filter at the SQL level by joining `product_variants` and filtering on `MIN(variants.price)::numeric` per product. Concretely: a CTE computes `minPrice` per product, both retriever branches `WHERE` against that CTE for `priceMin <= minPrice AND minPrice <= priceMax` when the filter is provided. Products with no variants are excluded when a price filter is set (no variant = no known price = no match). When no price filter is provided, the CTE is skipped and we don't pay the join cost.

### Active Model + Preview UX

- **D-09:** New `services/chat/getActiveChatModel.ts` exports `async function getActiveChatModel(shop: string): Promise<{ id: string; displayName: string }>`. Phase 4 body returns a hardcoded default — `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }`. Phase 7 will replace the body to read `ShopSettings.activeChatModel` from the database. The function signature is the contract; callers in Phase 4 already pass `shop` so Phase 7 is a body-only swap.
- **D-10:** `/api/chat/route.ts` is migrated **in Phase 4** from direct `@ai-sdk/google` import to AI Gateway routing. Rationale: PROJECT.md locks AI Gateway as the sole runtime entry for chat completions; current code violates this. The migration drops the `@ai-sdk/google` direct dependency from runtime paths (it may stay in devDependencies if tests need it). Model is resolved via `await getActiveChatModel(shop)` per request — no module-level constants.
- **D-11:** UI banner placement: slim banner spanning the chat container top, ABOVE the tab strip (Chat / History / Saved). Text: `Preview mode — using your real catalog · Model: {displayName}`. Server component fetches `getActiveChatModel(shop)` and passes `displayName` to the chat page; the banner is server-rendered (no client fetch). Style: muted Tailwind background (e.g., `bg-muted/40 text-muted-foreground text-xs`), one-line, no dismiss. The banner stays visible throughout `/chat` — it's a mode indicator, not a transient notification.

### Claude's Discretion

- Empty / no-results behavior (zero products from `hybridSearch`): the system prompt instructs the model how to phrase "I couldn't find anything matching that"; no UI placeholder card. Planner may add a minimal "no results" affordance if it falls out naturally during plan-phase.
- Latency strategy: `streamText` already streams tokens once the model starts generating; tool calls add a ~200–400ms hop (embed query + DB). No artificial buffering or "thinking" indicators in V1 — `useChat` natively renders streaming text and tool-status messages. Planner may add a tool-call status pill if the UX feels jarring.
- Error surfacing inside the tool (AI Gateway 5xx, DB connection error): tool returns an empty `Product[]` plus an error string in a non-LLM-visible side channel (server log). The LLM sees no products and answers accordingly. No retry inside the tool — Vercel AI SDK handles retries at the streamText layer.
- Test mocking for SearchService: planner chooses between (a) full integration tests against a seeded smoke shop (slow, real DB), (b) unit tests with `vi.mock('@/lib/db/client')` and synthetic vectors, (c) mixed. Phase 3 used pattern (c) successfully; planner may carry that forward.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + Roadmap
- `.planning/PROJECT.md` — Core value (storefront-visitor-to-real-products flow), V1 constraints (AI Gateway sole entry, no MOCK_PRODUCTS, shop-scoping everywhere)
- `.planning/REQUIREMENTS.md` — EMB-05 (SearchService hybridSearch contract), EMB-07 (MOCK_PRODUCTS removal), ADM-05 (Preview-mode label + active model), ADM-06 (grounded results only)
- `.planning/ROADMAP.md` §"Phase 4: SearchService + Wire Chat" — Goal + 4 success criteria + dependency on Phase 3

### Research
- `.planning/research/STACK.md` — pgvector HNSW + tsvector RRF pattern; `@ai-sdk/gateway` usage for chat completions and embeddings
- `.planning/research/ARCHITECTURE.md` §"Hybrid search service" — RRF fusion design, iterative_scan transaction wrapping
- `.planning/research/PITFALLS.md` §"pgvector pitfalls" — HNSW silent bypass on shop-filter, `hnsw.iterative_scan` per-session activation requirement

### Phase 1–3 Outputs (load-bearing handoffs)
- `.planning/phases/01-foundation/01-CONTEXT.md` §"D-03/D-04" — shop-first signature contract + composite (shop, id) FK pattern (SearchService obeys both)
- `.planning/phases/01-foundation/01-CONTEXT.md` §"D-07" — `withShopifySession` wrapper supplies `shop` to `/api/chat` route handler closure
- `.planning/phases/03-embeddings-search-indexes/03-CONTEXT.md` §"D-03" — `buildSearchableText` asymmetry (options in embedding, NOT in tsvector) — SearchService query must match this asymmetry
- `.planning/phases/03-embeddings-search-indexes/03-CONTEXT.md` §"D-04" — tsvector column composition with `setweight` weighting (A/B/C) — SearchService uses `ts_rank_cd` against this
- `.planning/phases/03-embeddings-search-indexes/03-CONTEXT.md` §"D-11" — `withHnswIterativeScan` helper signature + transaction semantics; primary consumer is SearchService
- `.planning/phases/03-embeddings-search-indexes/03-VERIFICATION.md` Smoke 4 — proven that HNSW Index Scan + shop filter coexist at ≥1500 rows

### Existing Code (source of truth, not docs)
- `services/embeddings/EmbeddingService.ts` — `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `embed(text)` function — SearchService calls `embed(query)` to get the query vector
- `lib/db/hnsw.ts` — `withHnswIterativeScan` helper; mandatory wrapper for any vector query
- `lib/db/repositories/ProductRepository.ts` — `listByShop`, `findByShopAndId` patterns; SearchService stays out of the repository (it does composite SELECTs that don't fit a CRUD repository)
- `app/api/chat/route.ts` — current Gemini-direct implementation to be replaced
- `components/chat/chat.tsx` — current MOCK_PRODUCTS wiring + `PendingProductAttachment` to be deleted
- `components/chat/mock-products.ts` — to be deleted in this phase
- `components/chat/chat-message.tsx` — extension point: read `message.parts` for tool results
- `components/chat/product-card.tsx` — render contract for cards (already shape-compatible with Product joins)
- `lib/shopify/auth.ts` (Phase 1) — `withShopifySession` wrapper that injects `shop` into `/api/chat`

### External Docs (verify via Context7 during plan-phase)
- Vercel AI SDK 6.x `streamText({ tools })` + `tool({...})` helper — exact parameter/result types, how tool calls and results appear in `message.parts`, how `useChat` surfaces tool state on the client
- Vercel AI Gateway provider configuration for chat completions — model ID format (`google/gemini-2.5-flash` vs other namespaces), env var (`AI_GATEWAY_API_KEY` already in use for embeddings)
- pgvector `<=>` cosine distance operator and parametrized vector literal syntax with Prisma `$queryRaw`
- PostgreSQL `websearch_to_tsquery('english', $query)` + `ts_rank_cd` reference; tie-breaking behavior
- Zod schema for tool parameters (`.describe()` semantics for LLM-visible descriptions)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/embeddings/EmbeddingService.ts:embed(text)` — single-input embed for the query vector. SearchService imports this directly; no new gateway glue.
- `lib/db/hnsw.ts:withHnswIterativeScan` — mandatory transaction wrapper. SearchService is the canonical caller.
- `components/chat/product-card.tsx` — accepts a `ChatProduct`-shaped object; the SearchService result type can be projected to this shape with minor field aliasing (`imageUrl` from `images[0].url`, `priceRange` from variants `MIN`/`MAX`).
- `components/chat/chat.tsx:ChatMessage` rendering loop — already iterates `message.parts` for text; tool-result parts slot into the same loop.
- `lib/db/repositories/ProductRepository.ts` — `findByShopAndId` confirms shop-scoping pattern; SearchService's SELECT joins follow the same `WHERE shop = $1` discipline.
- Phase 2's Vitest mock pattern (`vi.hoisted` + class-mock) — reusable for mocking `EmbeddingService.embed` and the Prisma `$queryRaw` shape in SearchService tests.

### Established Patterns
- `shop: string` first parameter on every service method (Phase 1 D-03). SearchService methods follow.
- `$queryRaw` is the SELECT escape hatch for vector + tsvector queries Prisma can't model. Phase 3 already uses it; Phase 4 extends.
- Streaming tool-result rendering via `useChat` `message.parts` is idiomatic Vercel AI SDK v6 — no custom data channels.
- AI Gateway is read by the `ai` package's bundled gateway provider via `process.env.AI_GATEWAY_API_KEY`; no SDK-level key handling in source code (matches Phase 3 D-09 pattern for embeddings).

### Integration Points
- `withShopifySession` (Phase 1) wraps `/api/chat/route.ts`; provides `{ shop, session }` to the handler closure. The `searchCatalog` tool's `execute` function reads `shop` from this closure.
- `EmbeddingService.embed` for the query vector lives inside SearchService — never duplicated in the route handler.
- `ProductRepository` provides post-search hydration if needed, but Phase 4's SQL already joins variants + images, so the repository is bypass-OK for hot path.

</code_context>

<specifics>
## Specific Ideas

- Tool name is exactly `searchCatalog` (camelCase, singular) — names appear in `message.parts[*].type` as `tool-searchCatalog` so consistency matters for the UI render switch.
- Tool description text is LLM-visible — invest in good prose. The "Always call this before recommending products" line is intentional steering against the model hallucinating products.
- The "Preview mode" banner is a *mode indicator*, not a notification — no dismiss button, no animation, no auto-hide.
- Banner phrasing is fixed: `Preview mode — using your real catalog · Model: {displayName}`. The em-dash and middle-dot are intentional typographic choices; do not normalize to hyphens.
- Empty input/whitespace queries should short-circuit `SearchService.hybridSearch` to return `[]` without calling AI Gateway (cost + correctness — embedding an empty string is undefined behavior).
- For the "waterproof jackets under $100" demo query: the model should produce a tool call `{ query: "waterproof jackets", priceMax: 100 }` — the price phrase is stripped from the natural-language query so the embedding/lexical signal doesn't waste tokens on "under $100".

</specifics>

<deferred>
## Deferred Ideas

- **Tag / vendor / inStock structured filters** — extend `searchCatalog` tool args. Out of Phase 4; revisit when telemetry shows missed queries.
- **Per-shop tunable RRF weighting** — `ShopSettings.searchWeights = { vector: 0.5, lexical: 0.5 }`. Phase 7 lands `ShopSettings`; weighting can ride along then.
- **Query-result caching** — short-TTL cache (e.g., 60s) for identical queries within a shop. V1 doesn't have it; revisit if catalog-side load profiles warrant.
- **Pagination / "show more"** — tool result is capped at 10 cards. Loading more would require either tool re-call with offset or a streaming append. Out of V1.
- **Result re-ranking by an LLM** — cross-encoder or LLM-judge pass over the top-10 candidates before showing. Out of V1; RRF is the only ranker.
- **Hybrid search analytics** — log query, tool args, top-K result IDs, click-through to a separate `SearchEvent` table for offline tuning. Out of V1; can land in Phase 8 alongside the request counter.
- **Configurable system prompt per shop** — `ShopSettings.systemPromptExtras`. Today the system prompt has a `[SHOP_SPECIFIC_INSTRUCTIONS]` placeholder; Phase 7's settings UI is the right place to populate it.
- **Storefront-side filter UI** — Phase 6 owns the storefront drawer; price + tag chip filters in the drawer would land there (and read from the same SearchService).
- **Embeddings re-rank model upgrade** — text-embedding-3-large or domain-tuned. Locked at -small for V1; upgrade is a separate phase with a backfill migration (per Phase 3 D-09 contract).

</deferred>
