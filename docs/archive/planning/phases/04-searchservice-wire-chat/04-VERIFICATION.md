---
phase: 04
slug: searchservice-wire-chat
status: verified-with-deferred-smoke
verified_at: 2026-05-26T09:58:56Z
verifier: gsd-plan-executor
manual_smoke: deferred
deferred_reason: shopify-install-flow OAuth cookie blocker (pre-existing; out of scope for Phase 4)
plans_verified: ["04-01", "04-02", "04-03", "04-04", "04-05", "04-06"]
requirements_proven: ["EMB-05", "EMB-07", "ADM-05", "ADM-06"]
---

# Phase 4 — Verification Gate

## Summary

Phase 4 ("SearchService + Wire Chat") wires the admin chat playground to a real, shop-scoped hybrid retrieval service. `services/search/SearchService.ts` exports `hybridSearch(shop, query, opts)` running SQL-side Reciprocal Rank Fusion across a pgvector cosine branch and a tsvector `websearch_to_tsquery` branch inside a single `withHnswIterativeScan` transaction, both shop-filtered with defense-in-depth. `app/api/chat/route.ts` was rewritten to route through Vercel AI Gateway with a single camelCase singular `searchCatalog` tool whose `inputSchema` (Vercel AI SDK v6) is a real `z.object` schema; the tool's `execute` closure captures `shop` from the `withShopifySession` ctx so the LLM never controls multi-tenancy. `app/api/proxy/chat/route.ts` ships as a Phase 6 stub that imports `hybridSearch` at the source level, satisfying EMB-07 success criterion #3 today. `components/chat/mock-products.ts` was deleted from disk and the legacy `PendingProductAttachment` glue in `components/chat/chat.tsx` was gutted — `message.parts[*].type === 'tool-searchCatalog'` is now the single source of truth for surfacing product cards. `app/(embedded)/chat/page.tsx` was converted to an async Server Component that awaits `getActiveChatModel(shop)` and server-renders the preview-mode banner (`Preview mode — using your real catalog · Model: Gemini 2.5 Flash`, em-dash U+2014 and middle-dot U+00B7 byte-precise) above a new `components/chat/chat-shell.tsx` client component that owns the tabbed UI. Storefront drawer wiring (Phase 6), `lib/chat-ui/` extraction (Phase 5), and the `ShopSettings` body-only swap of `getActiveChatModel` (Phase 7) are intentionally deferred.

**Manual smoke status:** DEFERRED — operator surfaced a pre-existing Shopify OAuth callback cookie blocker (`Cannot complete OAuth process. Could not find an OAuth cookie for shop url: khuda-test-site.myshopify.com`, see `app/api/auth/callback/route.ts:4`) that prevents the embedded admin /chat page from loading. The blocker is documented as backlog work in `docs/superpowers/plans/2026-05-02-shopify-install-flow.md` and is out of scope for Phase 4 (which wires SearchService into chat, not the install flow). All structural and automated evidence below verifies the Phase 4 contract; the empirical end-to-end smoke (real-catalog cards in the rendered playground) is held until the install-flow fix lands.

---

## Requirements Coverage

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| EMB-05 | `SearchService.hybridSearch(shop, query, opts)` returns shop-scoped ranked products via RRF over pgvector + tsvector | PASS | `services/search/SearchService.ts` lines 1–271; `services/search/__tests__/SearchService.test.ts` — 12/12 it() blocks pass (`bunx vitest run services/search/__tests__/SearchService.test.ts` → `Tests 12 passed (12)`). Key gates: empty/whitespace short-circuit before embed call, shop appears ≥4× in WHERE bindings, cross-shop isolation across consecutive calls, `<=>` cosine operator present (`<#>` absent), `websearch_to_tsquery` + `ts_rank_cd` present, RRF formula `1.0 / (60 + rank)` present, conditional price-filter CTE only when bounds provided. |
| EMB-07 | MOCK_PRODUCTS removed; BOTH `/api/chat` AND `/api/proxy/chat` call `SearchService.hybridSearch` | PASS | **Admin side:** `app/api/chat/route.ts` — `grep -c "from '@/services/search/SearchService'" app/api/chat/route.ts` returns 1; tool `execute` closure forwards `shop` from withShopifySession ctx to `hybridSearch(ctx.shop, query, { priceMin, priceMax })`; `app/api/chat/__tests__/route.test.ts` 13/13 pass. **Storefront stub:** `app/api/proxy/chat/route.ts` line 1 — `import { hybridSearch } from '@/services/search/SearchService'`; `app/api/proxy/chat/__tests__/route.test.ts` 5/5 pass — happy-path test verifies `hybridSearch` invoked with `(shop, query)`. **MOCK_PRODUCTS deletion:** `components/chat/mock-products.ts` deleted from disk (commit `902d483`); `grep -rn 'MOCK_PRODUCTS\|buildMockResults' app components services lib types` returns zero matches. |
| ADM-05 | `/chat` displays a preview-mode banner naming the active model | PASS | **Dynamic-binding gate:** `grep -c "{model.displayName}" app/(embedded)/chat/page.tsx` returns 1 (banner uses JSX interpolation, not a hardcoded literal); `grep -c "Model: Gemini 2.5 Flash" app/(embedded)/chat/page.tsx` returns 0 (literal absent in page.tsx so Phase 7's body-only swap of `getActiveChatModel` propagates without touching this file). **Aria-label gate:** `grep -c "Chat playground preview mode banner" app/(embedded)/chat/page.tsx` returns 1 (exact UI-SPEC.md Accessibility row phrase). **Aria-live gate:** `grep -c 'aria-live="off"' app/(embedded)/chat/page.tsx` returns 1 (banner is static); `grep -c 'aria-live="polite"' components/chat/message-parts.tsx` returns ≥1 (tool-state pill is transient — both intentional). **Typography gate:** em-dash U+2014 and middle-dot U+00B7 present literally (byte-precise) in `app/(embedded)/chat/page.tsx` line 29 between 'mode' and 'using' and between 'catalog' and 'Model'. **Server-component gate:** `grep -c "use client" app/(embedded)/chat/page.tsx` returns 0; `grep -c "export default async function ChatPage" app/(embedded)/chat/page.tsx` returns 1. Server-component tests: `app/(embedded)/chat/__tests__/page.test.tsx` — 8/8 pass. |
| ADM-06 | Admin chat returns grounded results sourced from `SearchService.hybridSearch` via a tool call (no client-side mock filter) | PASS | `app/api/chat/route.ts` registers a single tool keyed `searchCatalog` (camelCase singular) with `inputSchema` (Vercel AI SDK v6, NOT v5 `parameters`) and `execute` calling `hybridSearch(ctx.shop, query, { priceMin, priceMax })`; `stopWhen: stepCountIs(3)`. `app/api/chat/__tests__/route.test.ts` — 13/13 pass (asserts `Object.keys(streamArgs.tools) === ['searchCatalog']`, `inputSchema` truthy, `parameters` undefined, execute closure forwards session-context shop). UI side: `components/chat/message-parts.tsx` renders only `part.output` from `tool-searchCatalog` parts; `components/chat/__tests__/message-parts.test.tsx` — 10/10 pass across input-streaming/input-available/output-available/output-error/unknown states; `components/chat/chat.integration-test.tsx` — 1/1 pass (TEST_PRODUCT fixture, not MOCK_PRODUCTS). |

---

## Automated Test Results

### Full Suite

Command: `bunx vitest run`

```
Test Files  24 passed (24)
     Tests  176 passed (176)
  Duration  20.79s
```

- **Total project tests:** 176 (Phase 3 baseline 125 → +51 new Phase 4 tests).
- **Total test files:** 24 (Phase 3 baseline 18 → +6 new Phase 4 files).
- Phase 4 itself added 51 test assertions across 6 new test files plus 1 extension (chat.integration-test.tsx rewritten in 04-05 to mock tool-searchCatalog output-available).

### Phase 4 Per-File Breakdown

Command: `bunx vitest run services/search/__tests__/SearchService.test.ts services/chat/__tests__/getActiveChatModel.test.ts app/api/chat/__tests__/route.test.ts app/api/proxy/chat/__tests__/route.test.ts components/chat/__tests__/message-parts.test.tsx components/chat/chat.integration-test.tsx 'app/(embedded)/chat/__tests__/page.test.tsx'`

```
Test Files  7 passed (7)
     Tests  52 passed (52)
  Duration  3.29s
```

| Test File | Wave | Tests | Status | Locks |
|-----------|------|-------|--------|-------|
| `services/search/__tests__/SearchService.test.ts` | 1 (RED) → 2 (GREEN) | 12 | PASS | RRF shape, constants, shop-scoping (≥4× WHERE bindings), empty-query short-circuit, conditional price CTE, error swallow, ChatProduct projection |
| `services/chat/__tests__/getActiveChatModel.test.ts` | 1 (RED) → 2 (GREEN) | 3 | PASS | Phase 4 default `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }`; shop-agnostic; AI Gateway namespacing regex |
| `app/api/chat/__tests__/route.test.ts` | 1 (RED) → 3 (GREEN) | 13 | PASS | `withShopifySession` wrapper, AI Gateway plain-string model, single `searchCatalog` tool key, v6 `inputSchema` (NOT v5 `parameters`), Zod schema (query 1–500; priceMin?/priceMax? numbers), execute closure shop from session ctx |
| `app/api/proxy/chat/__tests__/route.test.ts` | 1 (RED) → 3 (GREEN) | 5 | PASS | 400 `missing_shop` when ?shop= absent; empty/whitespace/malformed-JSON → `{ products: [] }` with no hybridSearch call; happy path forwards `(shop, query)` |
| `components/chat/__tests__/message-parts.test.tsx` | 1 (RED) → 4 (GREEN) | 10 | PASS | tool-searchCatalog state-machine renderer (input-streaming/input-available shimmer, output-available ProductCard grid, output-error affordance, zero-results affordance, unknown state); discriminator narrowing not `as ToolUIPart` cast |
| `components/chat/chat.integration-test.tsx` | 4 (extended) | 1 | PASS | TEST_PRODUCT fixture mocks tool-searchCatalog output-available — MOCK_PRODUCTS deletion proven at runtime |
| `app/(embedded)/chat/__tests__/page.test.tsx` | 5 (RED) → 5 (GREEN) | 8 | PASS | Server component awaits getActiveChatModel(shop), banner role="status" aria-live="off", aria-label exact phrase, em-dash + middle-dot byte-precise, dynamic `{model.displayName}` interpolation, no `use client` directive |
| **Phase 4 total** | | **52** | **PASS** | |

---

## Decision Trace

Mapping `04-CONTEXT.md` decisions D-01..D-11 to their implementation locations and the verification that confirmed each.

| Decision | Statement | Implementation | Verification |
|----------|-----------|----------------|--------------|
| D-01 | Pure (unweighted) RRF with k=60; no α weighting, no env knobs | `services/search/SearchService.ts` constant `RRF_K = 60`; SQL formula `SUM(1.0 / (60 + rank))` in `fused` CTE | SearchService test: `'exports RRF_K = 60'` PASS; SQL skeleton assertion verifies `1.0 / (60 + rank)` literal |
| D-02 | 50 candidates per branch; final top 10 | `services/search/SearchService.ts` constants `BRANCH_LIMIT = 50`, `RESULT_LIMIT = 10`; `LIMIT 50` in vec_ranked + lex_ranked, `LIMIT 10` in fused | SearchService test: `'exports BRANCH_LIMIT = 50'`, `'exports RESULT_LIMIT = 10'` PASS |
| D-03 | Both retrievers inside a single `withHnswIterativeScan` transaction with explicit shop WHERE filter on every branch (defense-in-depth) | `services/search/SearchService.ts` wraps both `$queryRaw` calls inside `withHnswIterativeScan(async tx => ...)`; vec_ranked has `pe.shop = $shop AND p.shop = $shop`, lex_ranked has `p.shop = $shop`, outer hydration JOIN re-binds `p.shop = $shop` | SearchService test: `'shop appears at least twice in WHERE clause'` asserts shop bindings ≥4× PASS; `'cross-shop isolation'` asserts shop-A absent from shop-B call PASS |
| D-04 | Tool-call-only wiring (no pre-search) via `streamText({ tools: { searchCatalog: tool({...}) } })` | `app/api/chat/route.ts` registers `searchCatalog` tool; no pre-flight hybridSearch before the LLM runs | Route test: `'streamText receives a single searchCatalog tool'` PASS |
| D-05 | Tool signature with Zod schema for `query`, `priceMin?`, `priceMax?`; shop from closure NOT from LLM | `app/api/chat/route.ts` uses **v6 `inputSchema: z.object({ query: z.string().min(1).max(500), priceMin: z.number().optional(), priceMax: z.number().optional() })`** (NOT v5 `parameters:`); `execute` reads `ctx.shop` from withShopifySession session, never from LLM args | Route test: `'inputSchema truthy and parameters undefined'` PASS (v6 rename gate, Pitfall 1 anchor); `'execute closure forwards shop from session ctx'` PASS |
| D-06 | UI reads `message.parts` directly; render ProductCard for parts of type `tool-searchCatalog` state `output-available`. Delete `PendingProductAttachment` and `MOCK_PRODUCTS.filter()` | `components/chat/message-parts.tsx` renders only `part.output` of `tool-searchCatalog` parts; `components/chat/chat.tsx` gutted (no PendingProductAttachment, no buildMockResults); `components/chat/mock-products.ts` deleted from disk | message-parts test: 10/10 PASS; integration test: TEST_PRODUCT fixture renders via tool-result path; `grep -rn 'MOCK_PRODUCTS\|buildMockResults' app components services lib types` returns 0 matches |
| D-07 | Price-only structured filters in V1; LLM extracts `priceMin`/`priceMax` via Zod | `app/api/chat/route.ts` system prompt instructs price extraction; Zod schema declares both as optional numerics; `SearchService.hybridSearch` applies CTE filter only when bounds provided | Route test: Zod schema shape PASS; SearchService test: `'price filter omitted when bounds undefined'`, `'price filter included when priceMin provided'` PASS |
| D-08 | Price filter applied via MIN(price) variants CTE joined into both branches; products without variants excluded under price filter | `services/search/SearchService.ts` hasPrice branch uses INNER JOIN against a `pf` CTE of `MIN(price) GROUP BY productId` from `product_variants` | SearchService test: hasPrice branch SQL includes `MIN(`/`product_variants`; hasPrice=false SQL omits both PASS |
| D-09 | `services/chat/getActiveChatModel.ts` exports `async function getActiveChatModel(shop): Promise<{ id, displayName }>` returning hardcoded Phase 4 default — Phase 7 body-only swap | `services/chat/getActiveChatModel.ts` async signature; private `DEFAULT_MODEL` constant; no Prisma import, no env read | getActiveChatModel test: 3/3 PASS — `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }`, shop-agnostic, AI Gateway namespacing regex |
| D-10 | `/api/chat` migrated to AI Gateway routing in Phase 4 (drops direct `@ai-sdk/google` dependency); model resolved per-request via `getActiveChatModel(shop)` | `app/api/chat/route.ts` — `streamText({ model: model.id })` where `model.id` is the plain string `'google/gemini-2.5-flash'`; no `@ai-sdk/google` import remains in the runtime path | Route test: `'streamText receives plain-string model id google/gemini-2.5-flash'` PASS; `grep -c "@ai-sdk/google" app/api/chat/route.ts` returns 0 |
| D-11 | Preview banner ABOVE the tab strip; server-rendered (no client fetch); muted Tailwind style; em-dash U+2014 + middle-dot U+00B7; no dismiss; dynamic `{model.displayName}` interpolation | `app/(embedded)/chat/page.tsx` lines 11–35 — async server component, banner div has `bg-muted/40 text-muted-foreground text-xs py-1.5 px-4 sm:px-6 border-b border-border`, role="status" aria-live="off", aria-label exact phrase, em-dash + middle-dot literal characters, span wrapping `{model.displayName}` with `text-foreground font-semibold`; positioned ABOVE `<ChatShell />` (tabbed UI lifted to `components/chat/chat-shell.tsx`) | page.test.tsx: 8/8 PASS including byte-precise glyph assertion and dynamic-interpolation gate; banner appears above ChatShell (DOM order assertion) PASS |

---

## Manual Smoke Results

| # | Test Sub-Case | Expected Behavior | Status | Note |
|---|----------------|-------------------|--------|------|
| 1 | Banner glyph correctness (ADM-05) | Banner reads exactly `Preview mode — using your real catalog · Model: Gemini 2.5 Flash` with em-dash U+2014 and middle-dot U+00B7 verified via codepoint inspection | DEFERRED | Pending shopify-install-flow fix. **Structural automation already proves the glyphs are byte-precise:** Node.js codepoint check on `app/(embedded)/chat/page.tsx` confirms U+2014 + U+00B7 present at the exact positions; server-component test asserts the same. Visual confirmation in the rendered admin chrome is what is held until the OAuth callback cookie blocker is resolved. See `docs/superpowers/plans/2026-05-02-shopify-install-flow.md`. |
| 2 | Demo query end-to-end (ADM-06, ROADMAP SC #1) | Typing 'show me waterproof jackets under $100' surfaces ≥1 real-catalog card with a non-MOCK_PRODUCTS title; Network tab shows `tool-searchCatalog` part with state `output-available` containing real product IDs | DEFERRED | Pending shopify-install-flow fix. Embedded admin /chat page cannot be loaded against the dev store because `app/api/auth/callback/route.ts:4` fails OAuth handshake with `Cannot find an OAuth cookie for shop url: khuda-test-site.myshopify.com`. Structural surrogate evidence: `app/api/chat/__tests__/route.test.ts` asserts the tool registration end-to-end + the `execute` closure invokes `hybridSearch(ctx.shop, query, { priceMin, priceMax })` with the session-bound shop. Empirical real-catalog cards confirmation is held. |
| 3 | Brand/SKU query (ROADMAP SC #4 — BM25 contribution to RRF) | Typing a brand name present in the dev catalog returns ≥1 product card; proves lexical branch contributes to fusion (pure vector retrieval would not necessarily match a brand-token query) | DEFERRED | Pending shopify-install-flow fix. Structural surrogate evidence: SearchService test `'shop appears at least twice in lex_ranked WHERE clause'` proves the lex_ranked branch exists and runs `websearch_to_tsquery` against `searchVector`; the RRF fusion CTE sums both branches with `UNION ALL`. Empirical brand-name-surfaces-a-card confirmation against a seeded shop is held. |
| 4 | Negative query (no-results affordance) | Typing 'xyzzy-zorp-quux-nonsense-noun' renders the 'No matching products / Try a broader description or remove the price filter.' affordance — NOT an error, NOT a blank screen | DEFERRED | Pending shopify-install-flow fix. Structural surrogate evidence: `components/chat/__tests__/message-parts.test.tsx` 10/10 PASS including the empty-output branch — when `tool-searchCatalog` `output-available` has `output: []`, the UI renders the literal copy `'No matching products'` + the broader-description / remove-price-filter affordance with `role="status"`. Empirical confirmation in the rendered admin is held. |

**Deferred-smoke rationale:** All four manual smoke sub-cases have structural and automated evidence that the underlying Phase 4 contract is satisfied. What is held is the end-to-end empirical visual confirmation in the Shopify-embedded admin, which is gated by a pre-existing OAuth install-flow blocker that lives outside Phase 4's surface (the install flow is owned by Phase 1 / pre-roadmap setup, not by Phase 4). Once `docs/superpowers/plans/2026-05-02-shopify-install-flow.md` lands, the operator can revisit this checklist without any Phase 4 code change.

---

## Phase 5+ Handoff Notes

- **Phase 5 (`lib/chat-ui/` extraction):**
  - `components/chat/chat-shell.tsx` (the new client component lifted from the old `page.tsx`) is a natural hoisting candidate for `lib/chat-ui/`. Its only Shopify-embedded coupling is the tabbed-UI shell; the inline `<Sparkles>` header and `<Tabs>` block should move into the shared barrel verbatim, with the `EmbeddedAdapter` / `StorefrontAdapter` seam restricted to identity (visitor_id vs session-token Bearer).
  - The `components/chat/chat.tsx` (the gutted `<Chat />` body) is now strictly the chat-pane orchestrator — `useChat` + `<PromptInput />` + `<MessageParts />`. This is ALSO a Phase 5 hoisting candidate; the identity-adapter slot is the only thing that needs to be parameterized when it moves into `lib/chat-ui/`.
  - Inline hex literals (#008060, #e1e3e5, etc.) noted in 04-UI-SPEC.md Risks-and-FLAGs item 2 should be replaced by Tailwind tokens during the Phase 5 lift — they are cleanup, not Phase 4 work.

- **Phase 6 (Storefront drawer):**
  - `app/api/proxy/chat/route.ts` is a stub; the JSDoc header lists four TODOs (HMAC verification, signed-cookie visitor identity, real `streamText` wiring to mirror `/api/chat`, hard-cap counter). Phase 6 owns the wholesale replacement of the stub body. The `import { hybridSearch } from '@/services/search/SearchService'` contract MUST be preserved across the replacement so EMB-07 success criterion #3 stays provable.
  - Storefront-side history derivation is held: `productCount` in `chat.tsx`'s `onHistoryAdd` is currently `0` at submit time because cards arrive asynchronously via the tool-result. Phase 5 or 6 should re-derive history from a `useEffect` that watches `messages[*].parts` for `tool-searchCatalog` `output-available`.

- **Phase 7 (Active model picker, `ShopSettings` model):**
  - `services/chat/getActiveChatModel.ts` is the contract anchor. The async signature, the `ActiveChatModel` interface, and the private `DEFAULT_MODEL` constant are the Phase 7 body-only swap target. The Phase 4 body returns the hardcoded `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }`; Phase 7 must replace the body with a `ShopSettings.activeChatModel` lookup keyed by the `shop` parameter that is already plumbed through every call site (`page.tsx`, `route.ts`). Callers do not change.
  - The banner displayName is dynamically interpolated via `{model.displayName}` (NOT a hardcoded literal in `page.tsx`) per ADM-05's dynamic-binding gate. Phase 7's body-only swap propagates a new model name into the rendered banner without touching `page.tsx`.
  - T-04-25 (Information Disclosure — displayName-as-injection-vector): Phase 7 MUST validate that `ShopSettings.displayName` cannot contain user-controlled HTML/text before the body-only swap. The Phase 4 banner is safe because the displayName is sourced from a hardcoded constant; once the DB read lands, the validation gate must too.
  - T-04-24 (Tampering — server component reads malicious shop from searchParams): Phase 7 MUST verify the searchParams shop equals the authenticated-session shop before reading `ShopSettings`. The Phase 4 `getActiveChatModel` is shop-agnostic so a bad shop value cannot leak data today; this becomes a real risk the moment the Phase 7 body swaps in.

---

## Deferred Items

### Manual smoke checklist (operator decision — 2026-05-26)

The four manual smoke sub-cases above are deferred behind the shopify-install-flow OAuth callback cookie blocker. Tracking doc: `docs/superpowers/plans/2026-05-02-shopify-install-flow.md`. No Phase 4 code change is required to clear the deferred items — once the install flow is fixed, the operator can re-run the checklist against a seeded dev shop.

### Inherited from prior waves (`deferred-items.md`)

- **`lib/shopify/auth.ts:14:27`** — `@typescript-eslint/prefer-as-const` ESLint warning. Pre-existing; logged during 04-04. Not touched by Phase 4.
- **`components/chat/__tests__/message-parts.test.tsx:24`** — `ReturnType<typeof vi.fn>` mock-type assignability against the typed `(product: ChatProduct) => void` callback. Pre-existing in the 04-01 RED scaffold; the plan instructed "Do NOT modify the 04-01 RED scaffold." Runtime tests pass (10/10). A follow-up cleanup should re-type the helper.
- **`app/(embedded)/onboarding/page.tsx`** (lines 36, 49, 51, 53, 56, 68) — `TS2304: Cannot find name 'shopify'`. The Polaris/App Bridge global from the script-injected runtime is not declared in the project's type roots. Pre-existing on HEAD before Plan 04-06.
- **`app/prototype/prototype-data.ts`** — references the deleted `@/components/chat/mock-products` module + implicit `any` parameter. The `app/prototype/` directory is untracked and out-of-scope.
- **`components/ai-elements/reasoning.tsx`** — imports from `@jenius/ui/*` and `../text-shimmer` that do not resolve. Pre-existing on HEAD.

### New deferrals introduced by Phase 4

- **Storefront-side `productCount` derivation:** `chat.tsx`'s `onHistoryAdd` callback at submit time records `productCount: 0` because tool-result cards arrive asynchronously. Phase 5 or 6 should re-derive from a `useEffect` watching `messages[*].parts`.
- **Inline hex color literals in `chat-shell.tsx` and `chat.tsx`:** `#008060`, `#e1e3e5`, etc. Phase 5 cleanup target — replace with Tailwind tokens during the `lib/chat-ui/` extraction.
- **Phase 7 prerequisites carried in this VERIFICATION's handoff notes:** displayName XSS validation gate and searchParams.shop ↔ session.shop verification gate for the body-only swap.

---

## Operator Quote (Resume Signal)

> "Yes — spawn continuation agent now"
> (Operator selection on 2026-05-26 in answer to "Defer manual smoke and close Phase 4 with deferred-smoke status?")

Operator-cited blocker:
> ngrok OAuth callback cookie error (`Could not find an OAuth cookie for shop url: khuda-test-site.myshopify.com`) prevents embedded admin /chat access. Pre-existing — not a Phase 4 regression. Tracked in `docs/superpowers/plans/2026-05-02-shopify-install-flow.md`.

---

Phase 4 verification gate: VERIFIED WITH DEFERRED MANUAL SMOKE — 2026-05-26T09:58:56Z

---

## Verifier Appendix (independent re-verification)

**Verifier:** gsd-verifier (independent agent)
**Verified at:** 2026-05-26T12:08:00Z
**Mode:** Goal-backward re-verification of the executor-authored VERIFICATION.md above. Independent re-runs of the structural/automated gates against the working tree.

### Independent re-runs

| Gate | Command | Result |
|------|---------|--------|
| Full test suite | `bunx vitest run` | **Test Files 24 passed (24) · Tests 176 passed (176)** in 8.15s — matches executor claim exactly. |
| `mock-products.ts` existence | `find . -name 'mock-products*' -not -path './.git/*' -not -path './node_modules/*' -not -path './.next/*'` | Empty. File deleted from disk. |
| Runtime mock references | `grep -rn 'MOCK_PRODUCTS\|buildMockResults' app/ components/ services/ lib/ types/` | Only `app/prototype/prototype-data.ts:1,57` (both **commented-out** lines, in an **untracked** directory per `git status` — `?? app/prototype/`). Zero runtime references. |
| Tracked-file mock check | `git ls-files components/chat/mock-products*` | Empty. Deletion is committed. |
| `/api/chat` SearchService import | `grep -c "from '@/services/search/SearchService'" app/api/chat/route.ts` | 1 |
| `/api/proxy/chat` SearchService import | `grep -c "from '@/services/search/SearchService'" app/api/proxy/chat/route.ts` | 1 |
| `/api/chat` v6 `inputSchema` lock | `grep -c "inputSchema" app/api/chat/route.ts` | 5 |
| `/api/chat` v5 `parameters:` absent | `grep -c "parameters:" app/api/chat/route.ts` | 0 |
| `/api/chat` no direct Google SDK | `grep -c "@ai-sdk/google" app/api/chat/route.ts` | 0 |
| `searchCatalog` tool key present | `grep -c "searchCatalog" app/api/chat/route.ts` | 5 |
| ADM-05 dynamic `{model.displayName}` | `grep -c "{model.displayName}" app/(embedded)/chat/page.tsx` | 1 |
| ADM-05 no hardcoded literal | `grep -c "Gemini 2.5 Flash" app/(embedded)/chat/page.tsx` | 0 |
| ADM-05 aria-label phrase exact | `grep -c "Chat playground preview mode banner" app/(embedded)/chat/page.tsx` | 1 |
| ADM-05 server component (no `use client`) | `grep -c 'use client' app/(embedded)/chat/page.tsx` | 0 |
| ADM-05 em-dash U+2014 in visible banner | Node codepoint scan on `app/(embedded)/chat/page.tsx` | Found at byte offset 1241 in context `"Preview mode — using your re"` (visible banner text, not just comment). |
| ADM-05 middle-dot U+00B7 in visible banner | Node codepoint scan on `app/(embedded)/chat/page.tsx` | Found in context `"og · Mod"` between `catalog` and `Model:`. |
| `withShopifySession` wraps `/api/chat` POST | `grep -n 'export const POST = withShopifySession' app/api/chat/route.ts` | Match on line 61 — shop is captured from session ctx, not from LLM args. |

### Independent code reading (Level 4 data-flow)

- **`/api/chat` → SearchService.** `app/api/chat/route.ts:92-94` `execute: async ({ query, priceMin, priceMax }) => { return hybridSearch(shop, query, { priceMin, priceMax }); }` — `shop` is the closure variable from `withShopifySession`. LLM-side input is restricted by Zod `inputSchema` to `{ query, priceMin?, priceMax? }`; no `shop` field. Multi-tenancy gate holds at the source level.
- **SearchService data flow.** `services/search/SearchService.ts:104` short-circuits on empty/whitespace query before `embed()` (T-04-03 lock). RRF SQL has shop bindings in vec_ranked (`pe.shop`, `p.shop`), lex_ranked (`p.shop`), outer hydration JOIN (`p.shop`), and (when hasPrice) the variants CTE (`shop`). Cosine `<=>`, `websearch_to_tsquery`, `ts_rank_cd`, `SUM(1.0 / (${RRF_K} + rank))` literal all present.
- **Banner → ChatShell composition.** `app/(embedded)/chat/page.tsx` is an async server component that awaits `getActiveChatModel(shop)`; banner renders ABOVE `<ChatShell />`. Banner reads `{model.displayName}` dynamically — Phase 7 body-only swap of `getActiveChatModel` will propagate without page.tsx changes (ADM-05 contract holds).
- **UI tool-result rendering.** `components/chat/message-parts.tsx` exclusively renders `tool-searchCatalog` part output (state-machine over `input-streaming`/`input-available`/`output-available`/`output-error`). No `MOCK_PRODUCTS.filter`, no `PendingProductAttachment`. Integration test uses `TEST_PRODUCT` fixture via the tool-result path.

### Anti-pattern scan on Phase 4 modified files

- `TBD`/`FIXME`/`XXX` markers: **0**.
- `TODO`/`HACK`: 3 hits, **all in `app/api/proxy/chat/route.ts`**, all explicitly tied to formal follow-up (`TODO(Phase 6): ...`). The debt-marker gate accepts these — completion auditability is preserved through the phase reference.
- "placeholder" hit in `components/chat/chat.tsx:133` is a `<PromptInputTextarea placeholder="...">` UI input placeholder, **not** a stub indicator.

### Requirements coverage (cross-reference vs REQUIREMENTS.md)

| Req ID | REQUIREMENTS.md description | Independent verdict |
|--------|----------------------------|---------------------|
| EMB-05 | `SearchService.hybridSearch(shop, query, limit)` runs pgvector cosine top-K and tsvector `websearch_to_tsquery` in parallel, fuses with RRF, returns ranked products scoped to shop | SATISFIED — code + 12/12 unit tests pass; shop scoping at ≥4 binding sites; RRF formula `1.0 / (60 + rank)` present. |
| EMB-07 | `MOCK_PRODUCTS` fully removed from runtime paths; both `/api/chat` (admin) and `/api/proxy/chat` (storefront) call `SearchService.hybridSearch` | SATISFIED — file deleted; both routes import `hybridSearch`; 0 runtime references. |
| ADM-05 | Admin chat playground labels itself "Preview mode — using your real catalog", displays active model name, uses shared chat components | SATISFIED structurally — banner text byte-precise; dynamic displayName binding; server-rendered; 8/8 page tests pass. (Shared-component lift to `lib/chat-ui/` is Phase 5 work, not gated by ADM-05.) |
| ADM-06 | Admin chat retrieves grounded results via `SearchService.hybridSearch` and renders product cards inline; never returns mock data | SATISFIED — tool-call-only architecture (`searchCatalog` tool), execute closure invokes `hybridSearch`, UI renders only `tool-searchCatalog` part outputs; 13/13 route + 10/10 message-parts tests pass. |

### Behavioral spot-checks (Step 7b)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 4 test files pass | `bunx vitest run` | 176/176 pass | PASS |
| `hybridSearch` callable signature | Source read: `export async function hybridSearch(shop, query, opts)` returns `Promise<ChatProduct[]>` | Type-correct | PASS |
| `searchCatalog` tool registered with v6 schema | `app/api/chat/route.ts:81-95` | Single tool key, `inputSchema: z.object(...)`, `execute` closure binds shop | PASS |
| Banner glyphs byte-precise | Node codepoint scan | U+2014 and U+00B7 present at visible banner text positions | PASS |

### Deferred-smoke acknowledgement

The four manual smoke sub-cases (banner glyph visual confirmation, demo query end-to-end, brand/SKU query, negative-query affordance) remain deferred behind the pre-existing OAuth callback cookie blocker (`app/api/auth/callback/route.ts:4` "Could not find an OAuth cookie"). This is an operator-accepted deferral documented in the executor's VERIFICATION.md above and tracked outside Phase 4 in `docs/superpowers/plans/2026-05-02-shopify-install-flow.md`. The deferral does NOT downgrade the structural verdict — every Phase 4 success criterion has source-level evidence plus an automated test gate.

### Verifier verdict

**Status:** `passed` (structural + automated gates fully verified; manual smoke operator-deferred behind out-of-scope OAuth blocker, with full structural surrogate evidence on each sub-case).

**Score:** 4/4 requirements (EMB-05, EMB-07, ADM-05, ADM-06) satisfied · 4/4 ROADMAP success criteria satisfied at the structural/automated level · 176/176 tests pass · 0 blocker anti-patterns · 0 unreferenced debt markers.

**Re-verification of executor claims:** All independently re-runnable claims in the executor's VERIFICATION.md match the working-tree state. No discrepancies found.

Verifier appendix sealed — 2026-05-26T12:08:00Z
