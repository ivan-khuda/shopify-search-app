# Phase 4: SearchService + Wire Chat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 4-searchservice-wire-chat
**Areas discussed:** RRF fusion shape, Chat → search wiring, Filter parsing, Active model name + Preview UX

---

## RRF Fusion Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Pure RRF, k=60, 50+50→10 | Equal-weight RRF, standard k=60. Each branch returns top 50; fuse; return top 10. No tuning knobs in V1; revisit if quality is poor. Matches industry default. | ✓ |
| Weighted RRF (α tunable, default 0.5) | Add a weight α to bias vector vs lexical. Default 0.5 = equal. Adds tuning knob as an env var or constant. More complex; useful if one signal turns out stronger. | |
| Smaller candidate pools (20+20→10) | Less DB work per query. May hurt recall on long-tail queries but reduces latency. Reasonable for 5k-product catalogs. | |
| Larger pools (100+100→5) | Maximum recall, return only top 5 cards. More DB cost (~2-3ms extra). Useful if final chat UI shows few cards. | |

**User's choice:** Pure RRF, k=60, 50+50→10
**Notes:** Industry-default RRF parameters; revisit only with telemetry, not vibes. Constants exposed as named exports so future tuning is one diff.

---

## Chat → Search Wiring (Q1)

| Option | Description | Selected |
|--------|-------------|----------|
| Tool call only | LLM calls `searchCatalog({ query, limit })` via Vercel AI SDK tools. LLM rewrites awkward queries. Products attach to the message that triggered the tool. Natural multi-turn refinement. | ✓ |
| Pre-search only | Embed + search the raw last user message before calling streamText. Inject top-10 products into the system prompt as JSON. LLM just narrates. Simplest, lowest latency, no LLM agency over retrieval. | |
| Both (pre-search + tool) | Pre-search runs unconditionally; tool also exposed for LLM-driven follow-ups. More LLM calls, higher cost. Useful if you want guaranteed retrieval even when LLM doesn't call the tool. | |
| Pre-search with LLM query rewrite | LLM first generates a search query string from conversation history, then we embed+search that, then LLM composes the answer. Two LLM calls per turn. More controllable than tool-call but slower. | |

**User's choice:** Tool call only
**Notes:** Maximum LLM agency over retrieval, lowest token waste on guaranteed-but-unused pre-search results.

## Chat → Search Wiring (Q2 — Tool Result Render)

| Option | Description | Selected |
|--------|-------------|----------|
| Render from tool-result parts | useChat exposes message.parts including tool invocations + results. ChatMessage reads `tool-searchCatalog` results from message.parts and renders ProductCard inline. Pure server-driven; no client-side product state. The existing PendingProductAttachment glue code is deleted alongside MOCK_PRODUCTS. | ✓ |
| Server attaches to message metadata | Server writes products into custom message metadata via the streamText `data` channel. Client reads metadata. More plumbing but decouples cards from tool calls. | |
| Hybrid — keep PendingProductAttachment | Refactor PendingProductAttachment to consume server tool results instead of client search. Smaller diff but preserves an indirection that may not be needed. | |

**User's choice:** Render from tool-result parts
**Notes:** Eliminates client-side product state. PendingProductAttachment and MOCK_PRODUCTS deleted in this phase.

---

## Filter Parsing

| Option | Description | Selected |
|--------|-------------|----------|
| LLM extracts → tool args | Extend tool signature: `searchCatalog({ query, priceMin?, priceMax? })`. LLM extracts filters from the user query into tool params. SearchService applies WHERE on min(variant.price). Satisfies the literal success criterion. | ✓ |
| Defer filters to V2 | Phase 4 ships pure semantic+lexical retrieval. Revise success criterion #1 in ROADMAP. Risk: roadmap-success-criterion drift. | |
| Pass filters as text only | No structured extraction. Trust embedding/lexical signal to surface relevant cheap products. Probably won't satisfy criterion #1. | |
| Filter on price only, nothing else | Just price. No tags/vendor/inStock filters in V1. Smallest scope expansion that still satisfies criterion #1. | |

**User's choice:** LLM extracts → tool args (price only — tags/vendor/inStock deferred)
**Notes:** Price filter applied via CTE joining `product_variants` on `MIN(price)`. Other structured filters explicitly deferred.

---

## Active Model + Preview UX (Q1 — Model Source)

| Option | Description | Selected |
|--------|-------------|----------|
| Stub `getActiveChatModel(shop)` | New tiny service returning a constant default. Phase 7 replaces the body to read from ShopSettings. Stable API; no rewrite when picker lands. | ✓ |
| Env var CHAT_MODEL | Read process.env.CHAT_MODEL with hardcoded fallback. Operator can change per-deploy. Phase 7 still needs the service abstraction. | |
| Hardcoded constant | `const ACTIVE_CHAT_MODEL = 'google/gemini-2.5-flash'`. Smallest change. Phase 7 grep-and-replace. | |

**User's choice:** Stub `getActiveChatModel(shop)`
**Notes:** Stable shop-first signature; Phase 7 swaps body only.

## Active Model + Preview UX (Q2 — Gateway Migration)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — migrate now | PROJECT.md locks AI Gateway as sole runtime entry for chat. /api/chat currently violates this. Phase 4 wraps chat completion in AI Gateway alongside SearchService work. | ✓ |
| Defer to Phase 7 | Phase 7 needs multiple model support anyway, so it would do the Gateway swap as part of picker work. Risk: Phase 4 ships with a known PROJECT.md violation. | |
| Split into its own micro-phase | Add tiny phase between 4 and 5 for Gateway migration. Adds roadmap entry overhead. | |

**User's choice:** Yes — migrate now
**Notes:** Closes the PROJECT.md compliance gap as part of Phase 4 scope.

## Active Model + Preview UX (Q3 — Banner Placement)

| Option | Description | Selected |
|--------|-------------|----------|
| Banner above chat | Slim banner spanning the chat container top: "Preview mode — using your real catalog · Model: gemini-2.5-flash". Visible on every turn. Doesn't compete with header tabs. | ✓ |
| Chip in the chat header | Subtle pill next to or below the tab strip. Less prominent. Matches Polaris-style information density. | |
| Tooltip on a small "Preview" badge | Compact badge — hover for details. Cleanest visually but requires hover/click discovery, weak for ADM-05 "labels itself". | |

**User's choice:** Banner above chat
**Notes:** Server-rendered, sourced from `getActiveChatModel(shop)`. Fixed phrasing with em-dash + middle-dot.

---

## Claude's Discretion

- Empty / no-results behavior — system prompt handles phrasing; no UI placeholder card unless one falls out of planning.
- Latency strategy — rely on Vercel AI SDK streaming defaults; no artificial buffering or "thinking" indicators in V1.
- Tool error handling — return empty array + log on server; LLM sees no products.
- Test mocking choice for SearchService — planner picks unit vs integration mix (Phase 3's hybrid pattern is the precedent).

## Deferred Ideas

- Additional structured filters (tags, vendor, inStock) — extend `searchCatalog` tool args in a later phase.
- Per-shop tunable RRF weighting — rides with Phase 7's ShopSettings.
- Query-result caching (short TTL).
- Pagination / "show more" on tool results.
- LLM cross-encoder or judge re-ranking pass.
- SearchEvent analytics table.
- Configurable per-shop system-prompt extras.
- Storefront-side filter UI (Phase 6 owns the drawer).
- Embedding model upgrade to text-embedding-3-large (Phase 3 D-09 contract requires backfill migration).
