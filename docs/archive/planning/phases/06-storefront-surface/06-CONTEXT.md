# Phase 6: Storefront Surface - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire a FAB-triggered side drawer into merchant storefronts via a Shopify Theme App Extension + App Proxy, with DB-backed conversation and saved-products history scoped to anonymous visitors (UUID in localStorage) and merged into customer-keyed records when `window.Shopify.customer` is present. The drawer mounts the `lib/chat-ui/` components shipped in Phase 5 through `StorefrontAdapter`. All visual decisions are pre-locked by `06-UI-SPEC.md`.

Phase 6 ships the storefront read/write path end-to-end:
- `extensions/chat-drawer/` Theme App Extension package with App Embed block (STR-01, STR-02)
- `[app_proxy]` block in `shopify.app.toml` routing `/apps/smartdiscovery/*` (STR-03)
- HMAC-verified REST endpoints under `app/api/proxy/` (STR-04, STR-08)
- New Prisma models: `Conversation`, `SavedProduct`, `VisitorCustomerLink` (IDN-03, IDN-05, IDN-06)
- Replacing the 501 stub at `app/api/proxy/chat/route.ts` with the real streaming endpoint
- Weekly Inngest retention cron for 180-day conversation sweep
- A storefront chat bundle (lazy-loaded from this Next.js app's own domain) wired by the App Embed loader script

Phase 6 does NOT touch: admin model picker / `ShopSettings` (Phase 7), Resend email on sync completion (Phase 8), per-shop monthly hard cap with DB-backed `RequestCounter` (Phase 8), or any new chat capabilities beyond what already exists in `lib/chat-ui/*`.

</domain>

<decisions>
## Implementation Decisions

### A. Persistence layer scope (storefront)

- **D-01:** Pure DB on storefront — the Postgres `Conversation` + `SavedProduct` tables are the sole source of truth. No LocalStorage cache on storefront for history/saved. The only thing that lives in `localStorage` on the storefront is the `visitor_id` UUID (already shipped in Phase 5 D-05). Drawer mount fetches via App Proxy; all writes go through App Proxy. Cross-device IDN-06 merge becomes a simple DB rewrite — no LocalStorage reconciliation step.
- **D-02:** `DbBackedHistoryStore` and `DbBackedSavedProductsStore` implement the Phase 5 D-06 store interfaces (`HistoryStore`, `SavedProductsStore`). They live alongside the existing `LocalStorage*Store` in `lib/chat-ui/stores/` and are wired by the storefront shell only — admin continues to use `LocalStorage*Store` per Phase 5 D-07. `ChatPane` stays prop-driven and unchanged. The `useHistoryStore(scope)` / `useSavedProductsStore(scope)` convenience hooks (Phase 5 D-08) get a parallel variant — e.g., `useDbBackedHistoryStore(visitorId)` — or a discriminator the surface shell selects on. Planner picks the exact ergonomic, but the interface contract from D-06 stays byte-identical.
- **D-03:** REST per-resource App Proxy endpoints under `app/api/proxy/`. Each route HMAC-verifies independently via `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` before any logic:
  - `GET  /api/proxy/conversations?visitor_id=...&cursor=...` — list, cursor pagination 20 per page (D-05)
  - `POST /api/proxy/conversations` — create a new Conversation row (called on first user message after drawer-open)
  - `GET  /api/proxy/conversations/:id` — fetch full messages JSONB for resume
  - `PATCH /api/proxy/conversations/:id` — append turn (called on assistant stream complete per D-15)
  - `DELETE /api/proxy/conversations?visitor_id=...` — bulk hard-delete (Clear All per D-06)
  - `GET  /api/proxy/saved-products?visitor_id=...` — list (no pagination needed; usually small)
  - `POST /api/proxy/saved-products` — toggle save with `INSERT … ON CONFLICT DO NOTHING`
  - `DELETE /api/proxy/saved-products/:productId?visitor_id=...` — remove single
  - `POST /api/proxy/chat` — the existing endpoint (currently 501 stub), implements HMAC + visitor_id + Vercel AI SDK `streamText` with the same `searchCatalog` tool used by `app/api/chat/route.ts`
- **D-04:** New `Conversation` row per drawer-open session. The first user message of a session calls `POST /api/proxy/conversations` (which creates the row with the message's text stored as the `title` per D-14) and returns the new `conversation_id`. Subsequent messages in the same session `PATCH /api/proxy/conversations/:id` to append. Closing the drawer ends the session; reopening fresh = new Conversation row. The History tab "open to resume" affordance (IDN-04) loads the row's messages JSONB into the active drawer session, making subsequent messages append to that row.
- **D-05:** No per-visitor conversation cap. `GET /api/proxy/conversations` returns 20 conversations per page, ordered by `lastMessageAt DESC`, with cursor pagination (`?cursor=<conversation_id>` returns the next 20 older). History tab in the drawer uses an infinite-scroll pattern with the cursor.
- **D-06:** "Clear All" on History tab issues `DELETE /api/proxy/conversations?visitor_id=...`. Backend hard-deletes all matching Conversation rows for the visitor_id AND (if customer-linked) all rows for the customer_id. No soft-delete column, no undo banner. Irreversible by design.
- **D-07:** Weekly Inngest cron sweeps Conversations where `lastMessageAt < now() - INTERVAL '180 days'` and hard-deletes them. Implementation lives in `lib/inngest/` (existing setup). If Inngest cron scheduling isn't ready this phase, fall back to a manual `bun script:cleanup-conversations` script and capture a backlog item.
- **D-08:** Per-visitor in-memory rate limit on storefront endpoints. Module exports a `rateLimit(visitorId, bucket)` helper using a Map<visitorId, timestamps[]> with TTL eviction. Limits this phase:
  - `/api/proxy/chat`: 30 messages / 5 minutes per visitor → 429 with `Retry-After: 60`
  - `/api/proxy/conversations` and `/api/proxy/saved-products` reads + writes: 60 requests / minute per visitor → 429 with `Retry-After: 30`
  Acknowledged imperfect across Vercel instances; Phase 8's DB-backed `RequestCounter` supersedes once shipped.

### B. Visitor → customer identity merge (IDN-02, IDN-06)

- **D-09:** Merge fires **once per `(visitor_id, customer_id)` pair**. A new Prisma model `VisitorCustomerLink { shop, visitorId, customerId, mergedAt }` (composite unique on `(shop, visitorId, customerId)`) records the merge marker. On every drawer-mount where `window.Shopify.customer.id` is present, `StorefrontAdapter.getRequestBody()` includes `customer_id` alongside `visitor_id`. The backend checks `VisitorCustomerLink` existence — if missing, runs the merge transactionally and INSERTs the link row; if present, no-op. Subsequent drawer-opens for that same pair are O(1) idempotent lookups.
- **D-10:** Conflict resolution at merge time: **union with dedupe by `product_id`** for SavedProduct; **union by row id** for Conversation (Conversation rows have unique primary keys, so dedup is implicit). No data loss per IDN-06.
- **D-11:** Merge mechanics:
  ```sql
  BEGIN;
  -- Re-key anon Conversation rows for this visitor in place:
  UPDATE Conversation SET customerId = $newCustomerId
    WHERE shop = $shop AND visitorId = $visitorId AND customerId IS NULL;
  -- Re-key anon SavedProduct rows; partial unique index (D-19) handles dedupe via ON CONFLICT:
  INSERT INTO SavedProduct (shop, visitorId, customerId, productId, savedAt)
    SELECT shop, visitorId, $newCustomerId, productId, savedAt
      FROM SavedProduct
     WHERE shop = $shop AND visitorId = $visitorId AND customerId IS NULL
    ON CONFLICT (shop, customerId, productId) WHERE customerId IS NOT NULL DO NOTHING;
  DELETE FROM SavedProduct
    WHERE shop = $shop AND visitorId = $visitorId AND customerId IS NULL;
  INSERT INTO VisitorCustomerLink (shop, visitorId, customerId, mergedAt) VALUES (...);
  COMMIT;
  ```
  Both `visitorId` and `customerId` remain on Conversation rows after merge (for audit trail and same-device resume). SavedProduct gets re-INSERTed with `customerId` set and the visitor-only rows are removed (cleaner than retaining duplicates). Planner refines exact SQL during implementation — semantic intent is what's locked.
- **D-12:** Customer transition handling:
  - **Logout** (`Shopify.customer.id` disappears between drawer-opens): drawer reverts to anon. New chat messages get `visitor_id` only with `customer_id = NULL` — a fresh thread. Past customer-scoped data isn't visible to anon reads. The visitor's local `visitor_id` UUID stays in localStorage.
  - **Different customer** (`Shopify.customer.id` changes to a new value): treat as a new merge pair. `(visitor_id, new_customer_id)` triggers its own merge per D-09. A single `visitor_id` can end up linked to multiple `customer_id`s over time (different household members on shared device). Each merge brings forward only the anon data accrued since the last merge (i.e., post-D-11 the anon rows have `customer_id` set, so the next merge sees no anon rows to re-key).

### C. Extension bundle strategy

- **D-13:** **Lazy-load model.** `extensions/chat-drawer/` contains a small App Embed liquid block + a tiny loader script (~5–15KB) that paints the FAB and registers a click handler. On first FAB click, the loader dynamically `import()`s the main chat bundle from `https://<vercel-host>/storefront-bundle.<contentHash>.js`. The chat bundle is built and hosted from this Next.js app, NOT bundled into the extension. Tradeoff acknowledged: ~100–300ms cold-load latency on first FAB click; storefront pages stay light. Iteration on the chat surface no longer requires `shopify app deploy`.
- **D-14:** **Bundle build pipeline — Claude's discretion (planner picks).** Constraint: produce a single `.js` file with a content-hashed filename in `public/storefront-bundle.<hash>.js`, plus a `public/storefront-manifest.json` containing `{ bundle: '/storefront-bundle.<hash>.js', version: '<git-sha>' }`. Loader fetches the manifest first, then the bundle. Choices the planner can make:
  - esbuild prebuild script run before `bun build` (lightweight, scriptable, fast)
  - Vite as a separate build (familiar tooling but adds a dep)
  - A custom Next.js webpack/turbopack entry (likely fights the framework)
  Researcher should verify what Vercel ships with cleanest deployment ergonomics. Treat the JSON manifest as the contract.
- **D-15:** **Loader UX during cold load.** On first FAB click, the drawer slides in immediately with a skeleton state (placeholder chat messages, greyed prompt input, empty History/Saved tabs). Once the main bundle finishes loading, React hydrates inside the existing drawer container — no second animation, no "surprise" pop-open. Skeleton CSS lives in the loader inline (~1–2KB). This requires UI-SPEC.md to grow a brief "Skeleton state" addendum at implementation time; planner flags this as a UI-SPEC supplement.
- **D-16:** **App Embed block schema — STR-02 minimum only:**
  - `enabled` (checkbox, default true) — when false, loader script never paints FAB
  - `accent_color` (Shopify `color` input, default `#008060`) — writes to CSS custom property `--sd-accent` per UI-SPEC `:root` scoping
  - `fab_position` (Shopify `select`, options: `bottom-right` (default), `bottom-left`) — flips a CSS class on the FAB container
  No greeting/CTA copy override (UI-SPEC locks copy). No language toggle (no i18n infrastructure this phase). No drawer-side override (UI-SPEC locks slide-from-right). Schema lives in `extensions/chat-drawer/blocks/chat-drawer.liquid` `{% schema %}` block.

### D. Conversation row granularity

- **D-17:** Messages stored as **JSONB blob on the Conversation row** — column `messages JSONB NOT NULL DEFAULT '[]'::jsonb` containing the Vercel AI SDK `UIMessage[]` array verbatim (with `parts`, `role`, `id`, `createdAt`, tool calls, product attachments). Single SELECT returns full conversation for resume. Append = UPDATE that rewrites the messages column. Write-amplification is acceptable: storefront conversations are typically short (5–20 messages) and AI Gateway latency dominates anyway. No SQL-level cross-message search (deferred — see Deferred Ideas).
- **D-18:** Conversation title = **first user message, truncated to 60 chars**, stored as `title VARCHAR(60)` column on Conversation. Computed and INSERTed when the first user message arrives (i.e., on `POST /api/proxy/conversations`). Never updated after. Empty/whitespace-only first messages fall back to `'(no title)'`. Matches ChatGPT / Claude.ai pattern; zero extra AI Gateway cost.
- **D-19:** **DB write timing**: Vercel AI SDK `onFinish` callback (in `/api/proxy/chat` handler) is the single write point per chat turn. On stream complete:
  ```ts
  // /api/proxy/chat onFinish:
  UPDATE Conversation
     SET messages    = messages || $newUserMsgJson || $newAssistantMsgJson,
         lastMessageAt = NOW()
   WHERE id = $conversationId AND shop = $shop;
  ```
  User message + assistant response written atomically as a single row update. Mid-stream failures (AI Gateway 500, network drop) discard the user's message — accepted tradeoff for write simplicity. The client never sees its message "saved" until the stream completes successfully; on failure, the prompt input remains populated for retry.
- **D-20:** **SavedProduct uniqueness via two partial unique indexes:**
  - `(shop, visitorId, productId) WHERE customerId IS NULL` — anonymous-only rows
  - `(shop, customerId, productId) WHERE customerId IS NOT NULL` — customer-linked rows

  Prisma's `@@unique` does not model partial indexes, so these ship as a raw SQL migration (existing pattern from pgvector / GIN indexes — see `scripts/apply-manual-indexes.ts` + `bun db:indexes`). The Phase 6 migration script grows the new partial-index applications. D-11's `ON CONFLICT (shop, customerId, productId) WHERE customerId IS NOT NULL DO NOTHING` clause depends on this index existing.

### E. Storefront chat endpoint completion (replaces `/api/proxy/chat` 501 stub)

- **D-21:** Implement `/api/proxy/chat` per the TODO checklist already documented in `app/api/proxy/chat/route.ts`:
  1. HMAC validation via `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` — derive `shop` from the validated signature, NOT from raw `?shop=` query param (the existing stub's own justification — CR-01 from Phase 4 review)
  2. Extract `visitor_id` from request body (POST JSON), reject if missing
  3. Apply rate limit (D-08) — return 429 with retry-after on exceed
  4. Apply hard cap check: this phase ships a no-op stub of the cap check that always passes — Phase 8 fills in the DB-backed `RequestCounter` lookup
  5. Resolve `customer_id` from request body if present (sent by StorefrontAdapter when `window.Shopify.customer.id` is set)
  6. If this is the first message of a session, INSERT the Conversation row first; otherwise locate by `conversation_id` in the body
  7. Run merge check (D-09) — if `customer_id` present and no `VisitorCustomerLink` row exists, run D-11 merge in same transaction as the new Conversation create
  8. Call `streamText` with the same `searchCatalog` tool registration used by `app/api/chat/route.ts`, model resolved via `getActiveChatModel(shop)` (Phase 4 D-09)
  9. `onFinish` callback runs D-19 write
  10. Return `streamText.toAIStreamResponse()` (or v6 equivalent) — same response shape `/api/chat` returns

### Claude's Discretion

- **Exact bundle build tooling (D-14)** — esbuild vs Vite vs custom webpack entry. Researcher checks Vercel deployment best-practice; constraint is the file-output + manifest contract.
- **Exact `useDbBackedHistoryStore` / `useDbBackedSavedProductsStore` hook ergonomics (D-02)** — whether to dispatch on a discriminator or ship parallel hooks. Constraint: signature compatible with how `ChatPane`/surface shell consume them today via Phase 5 D-08.
- **Exact rate-limit Map eviction strategy (D-08)** — sliding window vs fixed bucket vs token bucket. Researcher checks Vercel's `unstable_cache` / `revalidate` semantics for cross-instance behavior; constraint is the 30/5min and 60/min limits.
- **Inngest function shape for D-07 retention sweep** — single-shot `every('1w')` vs scheduled `cron('0 3 * * 0')` vs batched. Constraint: must be idempotent and must page through deletions if a sweep finds >10k matches.
- **App Proxy HMAC handler factory** — researcher decides whether to extract a `withAppProxyHmac` wrapper (parallel to existing `withShopifySession` for admin routes) or inline the check per route. Recommendation: extract.
- **Skeleton state CSS layout** — must look reasonable on first paint per D-15. Planner sketches a skeleton, then files a tiny UI-SPEC supplement covering it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Core value (storefront chat that "just works"), storefront identity via localStorage `visitor_id` (NOT cookies — App Proxy strips Set-Cookie), Theme App Extension + App Proxy as the locked integration pattern, ~5k product scale, "no multi-tenant data leaks" hard constraint
- `.planning/REQUIREMENTS.md` — STR-01..STR-08 + IDN-01..IDN-06 are this phase's contract; NOT-* and CAP-* are explicitly Phase 8
- `.planning/ROADMAP.md` Phase 6 section — locked success criteria (FAB + drawer via App Embed, visitor_id UUID persisting through reload, customer-id merge across devices, App Proxy same-origin only, Theme Editor non-collision)
- `CLAUDE.md` — bun only; Vercel AI Gateway only; Tailwind 4 + shadcn primitives; no secrets in logs; Prisma + pgvector + raw-SQL migrations for indexes
- `.planning/phases/06-storefront-surface/06-UI-SPEC.md` — Approved 6/6 dimensions. All FAB / drawer / typography / color / spacing / copywriting / z-index / Theme Editor guard decisions are LOCKED. Planner must NOT re-decide any of these. Skeleton-state addendum (D-15) is the only known follow-up.

### Prior-phase decisions (still load-bearing)
- `.planning/phases/05-shared-chat-ui-extraction/05-CONTEXT.md` §D-03 — `ChatIdentityAdapter` shape (endpoint, getAuthHeaders, getRequestBody)
- `.planning/phases/05-shared-chat-ui-extraction/05-CONTEXT.md` §D-05 — `StorefrontAdapter` already shipped: visitor_id from localStorage; THIS PHASE adds `customer_id` to its `getRequestBody()` output
- `.planning/phases/05-shared-chat-ui-extraction/05-CONTEXT.md` §D-06 — `HistoryStore` / `SavedProductsStore` interfaces; D-02 of this phase implements `DbBacked*` variants against them
- `.planning/phases/05-shared-chat-ui-extraction/05-CONTEXT.md` §D-07 — `LocalStorageHistoryStore` / `LocalStorageSavedProductsStore` keep being used by admin; Phase 6 leaves them untouched
- `.planning/phases/05-shared-chat-ui-extraction/05-CONTEXT.md` §D-09 — DB-backed store swap was originally scheduled for Phase 8; Phase 6 pulls it forward for storefront (admin still on LocalStorage per Phase 5 D-07)
- `.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md` §D-09 — `getActiveChatModel(shop)` signature is locked; `/api/proxy/chat` uses this same function
- `.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md` §D-11 — `/chat` admin page is a server component, banner above tabs (unaffected by Phase 6 but stays canonical)
- `.planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md` Phase 5+ Handoff Notes — explicitly flagged `/api/proxy/chat` as a 501 stub until Phase 6 lands HMAC
- `.planning/phases/04-searchservice-wire-chat/04-REVIEW.md` CR-01 — original security violation: `/api/proxy/chat` reading shop from raw query without HMAC; D-21 implements the fix

### Existing code (source of truth)
- `app/api/proxy/chat/route.ts` — current 501 stub with explicit `TODO(Phase 6)` checklist inside; D-21 implements that checklist verbatim
- `app/api/chat/route.ts` — admin chat endpoint; reference implementation for `streamText` + `searchCatalog` tool registration that `/api/proxy/chat` mirrors
- `lib/shopify/client.ts` — `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` is the locked HMAC call per STR-04
- `lib/chat-ui/index.ts` — barrel exports (ChatPane, ChatMessage, ProductCard, HistoryPanel, SavedProductsPanel, EmptyState, message-parts)
- `lib/chat-ui/adapters/storefront.ts` — `StorefrontAdapter` already generates visitor_id; D-12 says this file gets a single edit to also read `window.Shopify?.customer?.id` and include it in `getRequestBody()`
- `lib/chat-ui/adapters/types.ts` — `ChatIdentityAdapter` interface (do not change shape)
- `lib/chat-ui/stores/types.ts` — `HistoryStore` / `SavedProductsStore` interfaces that DbBacked* variants implement
- `lib/chat-ui/stores/local-storage.ts` — reference implementation pattern for the store interface; DbBacked* variants follow the same `subscribe(listener)`-as-useSyncExternalStore-driver pattern
- `lib/chat-ui/stores/hooks.ts` — `useHistoryStore` / `useSavedProductsStore` convenience hooks; surface shell consumes via these
- `lib/inngest/` — existing Inngest setup; D-07 retention cron lives here
- `prisma/schema.prisma` — existing models: `Product`, `ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding`, `ShopifySession`. Phase 6 adds: `Conversation`, `SavedProduct`, `VisitorCustomerLink`
- `prisma/migrations/` — existing pgvector / GIN raw-SQL migration pattern is what D-20 partial unique indexes follow
- `scripts/apply-manual-indexes.ts` + `bun db:indexes` — manual index application pipeline; D-20 grows this
- `shopify.app.toml` — currently has NO `[app_proxy]` block; STR-03 requires adding it. Currently has NO extension reference; STR-01 requires `extensions/chat-drawer/`
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md` — existing codebase maps (use during planning, not duplicated here)

### Shopify platform documentation (researcher confirms with context7)
- Theme App Extension docs (App Embed blocks, `target: body`, asset bundling via Shopify CLI, settings schema reference)
- Shopify App Proxy docs (path routing, HMAC signature spec, Set-Cookie stripping behavior that justifies localStorage identity)
- `Shopify.designMode` global behavior in the Theme Editor (UI-SPEC's "FAB visible but drawer must not auto-open" guard depends on this)
- `window.Shopify.customer` shape and lifecycle on customer login/logout
- Vercel AI SDK v6 `streamText` + `onFinish` callback contract (the locked write timing per D-19)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/chat-ui/*`** — Phase 5 already exported all chat components runtime-neutral. The storefront drawer composes `ChatPane`, `HistoryPanel`, `SavedProductsPanel`, `EmptyState` directly. Zero re-design.
- **`lib/chat-ui/adapters/storefront.ts`** — `StorefrontAdapter` already implements visitor_id-via-localStorage. Phase 6 edit is additive: read `window.Shopify?.customer?.id` and include in `getRequestBody()` output when present.
- **`app/api/chat/route.ts`** — admin chat endpoint is the structural reference for `/api/proxy/chat`. Same `streamText` shape, same `searchCatalog` tool, same `getActiveChatModel(shop)` call. Only the auth boundary differs (HMAC instead of session-token Bearer).
- **`lib/shopify/client.ts`** — `shopifyClient.utils.validateHmac(..., { signator: 'appProxy' })` is the locked call site for STR-04.
- **`lib/inngest/`** — Inngest is already set up. D-07 retention cron is a new function in this dir.
- **`scripts/apply-manual-indexes.ts`** — pattern for raw-SQL index migrations is already established; D-20 partial unique indexes extend it.
- **`prisma/schema.prisma` shop-scoping pattern** — every existing model carries a `shop` column. The new `Conversation`, `SavedProduct`, `VisitorCustomerLink` models follow this pattern (PROJECT.md "no multi-tenant data leaks").

### Established Patterns
- **HMAC handler boundary**: admin routes use a `withShopifySession`-style wrapper (see `app/api/shopify/sync/route.ts`). Storefront routes should follow a parallel `withAppProxyHmac` wrapper (Claude's discretion — researcher confirms). This minimizes the surface where HMAC could be forgotten.
- **shop-scoped queries**: every Prisma query in `lib/db/` filters by `shop`. Phase 6 queries follow this.
- **Streaming chat response shape**: `streamText` + `toAIStreamResponse` (v6 name TBD per researcher) is the locked response contract. Storefront drawer's `useChat` consumes the same shape.
- **Raw SQL migration for indexes**: pgvector + GIN indexes already use this pattern (`bun db:indexes`). Phase 6 partial unique indexes follow.

### Integration Points
- **`shopify.app.toml`** must grow an `[app_proxy]` block (STR-03). Format per Shopify docs:
  ```toml
  [app_proxy]
  url = "https://<app-host>/api/proxy"
  subpath = "smartdiscovery"
  prefix = "apps"
  ```
  Storefront fetches go to `/apps/smartdiscovery/*` from the merchant's domain; Shopify proxies to `/api/proxy/*` on our app.
- **`extensions/chat-drawer/`** is a new Theme App Extension package created via Shopify CLI (`shopify app generate extension --type theme_app_extension`). It contains:
  - `blocks/chat-drawer.liquid` — App Embed block with `target: body` + `{% schema %}` containing D-16's settings
  - `assets/loader.js` — the tiny lazy-load script
  - `assets/loader.css` — FAB + skeleton drawer styles (~1–2KB)
- **`public/` route on the Next.js app** — D-13/D-14 bundle output lands here so it's served via Vercel's static asset CDN with aggressive cache headers.
- **`prisma/schema.prisma`** — three new models join the existing schema. Migration runs `prisma migrate dev` for Conversation / SavedProduct base schema, then `bun db:indexes` for the partial unique indexes.
- **`/api/proxy/chat` replacement** — the 501 stub disappears in this phase. The existing file path + EMB-07 grep gate ("source-level proof that hybridSearch is called") must continue to satisfy that gate.
- **Phase 8 forward-compat**: D-08 in-memory rate limit is a place-holder for Phase 8's DB-backed `RequestCounter`. D-21 step 4 (cap check) ships as a no-op stub that Phase 8 fills in. Don't refactor — Phase 8 expects to find these seams.

</code_context>

<specifics>
## Specific Ideas

- **Cross-device merge UX has zero visible drawer affordance** — when the merge fires on drawer-mount, the visitor sees their already-existing customer-keyed conversations appear in History silently. No "Merging your sessions…" UI. Matches the "transparent identity" line from `06-UI-SPEC.md` Identity contract.
- **Skeleton state on first FAB click** is a UI-SPEC supplement that Phase 6 plan should generate as a small UI-SPEC.md patch (D-15). Don't ship without it — first FAB click is the visitor's first impression.
- **`Shopify.designMode` guard already locked in UI-SPEC** — first FAB click in Theme Editor must NOT load the bundle (designMode = `true` should short-circuit the loader). Lazy-load actually makes this cleaner — the bundle never has to render in designMode at all.

</specifics>

<deferred>
## Deferred Ideas

- **AI-generated conversation summaries for History tab titles** — use a cheap AI Gateway model to summarize each Conversation into ~5 words. Considered for D-18 but rejected for V1 (extra cost, fuzzy "idle" detection). Future phase if title quality becomes a complaint.
- **DB-backed History/Saved for the admin chat surface** — Phase 5 D-09 originally scheduled this for Phase 8. Still applicable: admin LocalStorage works fine for per-shop local history; cross-device admin would need user-account identity (out of V1 entirely).
- **Locale override / multilingual storefront support** — App Embed schema could expose a `locale` setting; chat-ui copy strings would need translation. Out of Phase 6 scope. Future phase tied to Shopify Markets multi-language storefronts.
- **Greeting / CTA text overrides for App Embed** — merchant-customizable greeting copy. Considered for D-16; rejected because UI-SPEC.md locks copywriting (changing copy mid-stream invalidates the design contract). Future phase if merchants ask.
- **Drawer position left/right slide** — UI-SPEC locks right-slide; left-slide would need mirrored animations + skeleton + scrim semantics. Future phase if requested.
- **Cross-message SQL search** — D-17 chose JSONB blob which precludes individual-message indexing. Future phase could add a denormalized `ChatMessage` shadow table or full-text search over the JSONB column.
- **Soft-delete on Clear All with 5-second undo banner** — UI-SPEC doesn't currently spec a toast surface and the simpler hard-delete (D-06) shipped. Future phase if "I cleared by accident" complaints emerge.
- **DB-backed cross-instance rate limit** — D-08's in-memory limiter is a Phase 8 forward-compat seam; Phase 8's DB-backed `RequestCounter` (CAP-01) supersedes.
- **Multi-tab same-visitor concurrent drawer behavior** — not explicitly decided. Falls out naturally from D-04 (per drawer-open session = per-tab session). If two tabs in the same browser open the drawer, each maintains its own active Conversation row. History tab in either tab sees both. No explicit BroadcastChannel coordination this phase.
- **Inngest cron scheduling fallback** — D-07 assumes Inngest cron is ready. If not, ship a manual `bun script:cleanup-conversations` and capture a backlog item to wire Inngest.
- **Per-merchant audit log of merges** — `VisitorCustomerLink` is the closest we get; richer audit (timestamps, row counts merged, etc.) is future work.

</deferred>

---

*Phase: 06-Storefront Surface*
*Context gathered: 2026-05-26*
