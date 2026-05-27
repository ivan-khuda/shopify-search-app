# Phase 2: Sync Pipeline - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `/api/shopify/sync` actually sync products. The POST endpoint creates a `SyncRun` row, fires an Inngest event, and returns `{ syncRunId }` in under 2s. An Inngest step-function processes the catalog in batches of 100 via Shopify GraphQL cursor pagination, calling `productRepository.upsertProduct(shop, input)` for each product. Progress (`processedCount`, `totalCount`, `state`) lives in the `SyncRun` row; the onboarding UI polls `/api/shopify/sync/status?syncRunId=…` every 2s and renders a progress bar + state label. A new `/api/shopify/webhook` route verifies Shopify HMAC, deduplicates by `X-Shopify-Event-Id` against a new `WebhookEvent` table, and writes inline via the repository for `products/create|update|delete`. Idempotency on manual syncs uses `sha256(shop + 5-min-bucket)`.

13 requirements: SYN-01..11 + ADM-01, ADM-02. Phase ships nothing beyond what those requirements specify — no embeddings (Phase 3), no admin model picker (Phase 7), no storefront drawer (Phase 6), no Resend completion email (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Inngest Workflow Shape

- **D-01:** The sync function is a single Inngest function (`shopify/product.sync` event) that loops over Shopify GraphQL cursor pagination. Each batch is wrapped in three `step.run` calls with **deterministic step IDs** keyed by cursor: `fetch-batch-${cursor || 'start'}`, `upsert-batch-${cursor || 'start'}`, `persist-cursor-${cursor || 'start'}`. Inngest memoizes each step's return value; on Vercel timeout the function resumes from the last unfinished step without re-running completed ones. The cursor of the last persisted batch is the resume anchor. (Per RESEARCH.md and the user's choice of "One step.run per batch with cursor persist".)
- **D-02:** Batch size = **100 products per fetch/upsert**. Shopify GraphQL `products(first:)` supports up to 250; 100 strikes a balance — query cost stays low for shops with many variants/images, ~50 step cycles for a 5k catalog gives meaningful progress granularity, and the cursor-persist step rate stays manageable. (Locked across all Phase 2 sync code.)

### SyncRun Lifecycle

- **D-03:** `SyncRun` Prisma model carries `id String @id`, `shop String`, `state SyncState` (enum: `queued | running | succeeded | failed | partial`), `processedCount Int @default(0)`, `totalCount Int?`, `errors String[] @default([])`, `cursor String?`, `idempotencyKey String`, `startedAt DateTime`, `finishedAt DateTime?`. State transitions:
  - `queued` → `running` when the Inngest function begins
  - `running` → `succeeded` if all batches complete with zero `errors[]`
  - `running` → `partial` if at least one product upsert failed but the run finished
  - `running` → `failed` if the Inngest function exhausts retries or hits an unrecoverable error
- **D-04:** `totalCount` is populated by a single `products.totalCount` GraphQL call at function start (before the first batch). It's nullable because the count may be unavailable on small shops or under throttle; the UI handles `totalCount: null` by hiding the percent and showing "X products synced so far" until the count arrives.

### Idempotency Key

- **D-05:** Idempotency key = `sha256("${shop}|${Math.floor(Date.now() / 300_000)}")` (5-minute bucket per the formula in PROJECT.md). POST `/api/shopify/sync` first does `prisma.syncRun.findFirst({ where: { shop, idempotencyKey } })`. If a row exists and `state in ('queued', 'running')`, return the existing `{ syncRunId }` without enqueuing a second Inngest job. If the row exists but is in a terminal state (`succeeded | failed | partial`), still return the existing id — the merchant sees the latest result; they'd start a fresh sync by waiting past the 5-min boundary.

### Webhook Handler

- **D-06:** `/api/shopify/webhook` is **inline**: HMAC verify → dedup check → direct `productRepository.upsertProduct` (create/update) or `productRepository.deleteProduct` (delete). No Inngest event indirection for V1. Shopify retries on 4xx/5xx, so transient failures still re-deliver. The route returns 200 only after the DB write completes.
- **D-07:** Dedup via a new Prisma model `WebhookEvent { eventId String @id, shop String, topic String, receivedAt DateTime @default(now()) }`. The handler does `await prisma.webhookEvent.create({ data: { eventId, shop, topic } })` first and catches the unique-violation (`P2002`) — a violation means duplicate delivery, route returns 200 immediately. Per RESEARCH.md Pitfall: cleanup of old `WebhookEvent` rows is **out of scope V1** (the table grows monotonically; add a 30-day Inngest cron in a later phase).
- **D-08:** Conflict resolution between manual sync and webhook (per SYN-11): every product upsert compares the Shopify-provided `product.updatedAt` against the existing DB row's last-known `updatedAt`. If incoming is older, skip the write (log to `SyncRun.errors[]` if during a manual run). This implements the "trust newer Shopify timestamp" pattern called out in PITFALLS.md.

### Auth Helper Reuse

- **D-09:** Both `POST /api/shopify/sync` and `GET /api/shopify/sync/status` use the **full `withShopifySession` wrapper** from Phase 1 — every status poll reloads the offline session from DB. Consistency over micro-optimization for V1; if profiling shows the polling QPS dominates, the deferred fast-path `verifyToken` (carried over from Phase 1 deferred ideas) lands then. No adaptive client-side throttling in V1.
- **D-10:** `/api/shopify/webhook` does NOT use `withShopifySession` — Shopify webhooks send no session token. The route verifies HMAC via **`shopifyClient.webhooks.validate({ rawBody, rawRequest: req })`** (NOT `utils.validateHmac` — that's for OAuth/App Proxy per RESEARCH.md correction). The validator returns a `WebhookValidation` object with `valid`, `domain` (the shop hostname), `topic`, and `webhookId` (the X-Shopify-Webhook-Id) — derive `shop`, `topic`, and `eventId` from the validator's return value rather than parsing headers manually. The validator internally reads `X-Shopify-Hmac-Sha256` from the request and validates against `SHOPIFY_API_SECRET`. Read the raw body via `await req.text()` BEFORE `JSON.parse` — `validate` needs the unparsed bytes.

### Inngest Configuration

- **D-11:** Inngest client lives at `lib/inngest/client.ts` exporting `inngest = new Inngest({ id: 'smartdiscovery-ai' })`. The sync function lives at `inngest/functions/sync-products.ts`. The Inngest API endpoint is `app/api/inngest/route.ts` using `serve({ client: inngest, functions: [syncProductsFunction] })` from `inngest/next`. For local dev, run `bunx inngest-cli@latest dev` against `http://localhost:3000/api/inngest`.
- **D-12:** In dev, Inngest runs against `INNGEST_DEV=1` (no signing key needed). In Vercel prod, set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` via the Vercel ↔ Inngest marketplace integration. Document both flows in `01-09-SUMMARY.md` for handoff.

### Onboarding Progress UI

- **D-13:** The progress bar uses `<s-progress-bar value={percent}>` (Shopify Polaris web component, already loaded by `EmbeddedProviders`). Below it: `<s-text>` showing `{processedCount} / {totalCount} products` (or `{processedCount} products synced so far` when `totalCount` is null) and a state badge (Queued / Running / Failed). The "Start sync" button is replaced by the progress view as soon as the POST response returns the syncRunId. Polling runs every **2 seconds** (constant; no exponential backoff in V1).
- **D-14:** Completion state: when `state === 'succeeded'` show `<s-banner tone="success">Your store is ready — {processedCount} products synced</s-banner>` + primary CTA `<s-button variant="primary">Open admin chat</s-button>` linking to `/chat`. For `state === 'partial'` show a tone="warning" banner with `{processedCount} products synced, {errors.length} failed` and a "Retry sync" secondary CTA (re-POSTs `/api/shopify/sync`; the 5-min idempotency window means it only fires if enough time has passed). For `state === 'failed'` show tone="critical" + Retry CTA only. No history view in V1.

### Error Policy in Batches

- **D-15:** Per SYN-03, one failed product upsert does not abort the run. The Inngest `upsert-batch` step wraps each `productRepository.upsertProduct(shop, mapped)` in a try/catch. On error: push `{ shopifyProductId, message }` to a local `batchErrors[]` array, continue. After the batch completes, the step persists the errors back to `SyncRun.errors[]` (concat). If `batchErrors.length === batch.length` (entire batch failed), throw — Inngest retries the step. Partial-batch failure (some succeeded) is recorded but does not throw. Final state is `partial` when `SyncRun.errors.length > 0`, `succeeded` when zero.

### Webhook Registration

- **D-16:** Webhook subscription registration is **out of scope for Phase 2 implementation work** — Shopify CLI's `shopify.app.toml` already declares the topics in `[webhooks.subscriptions]`. The CLI registers them on `bunx shopify app deploy`. Phase 2 code (the `/api/shopify/webhook` route) only needs to handle inbound deliveries. Add a `**Manual step (Phase 2):**` section to `02-09-SUMMARY.md` listing the topics to add to `shopify.app.toml` and the `bunx shopify app deploy` invocation.

### Shopify `updatedAt` Conflict Column (added post-research)

- **D-17:** SYN-11 (webhook upserts use Shopify-provided `product.updatedAt` for conflict resolution) requires a database column to compare against — Phase 1's `Product` model has no Shopify-timestamp field. Phase 2's additive Prisma migration must add `updatedAtShopify DateTime?` to the `Product` model (nullable to absorb existing rows from any pre-Phase-2 dev data; new rows always populated by sync/webhook). `ProductUpsertInput` grows a corresponding `updatedAtShopify` field. The conditional guard in webhook handler:
  ```ts
  const existing = await productRepository.findByShopAndHandle(shop, payload.handle);
  if (existing?.updatedAtShopify && payload.updated_at && new Date(payload.updated_at) < existing.updatedAtShopify) {
    return 200; // stale event, skip
  }
  await productRepository.upsertProduct(shop, mapped);
  ```
  Note: `findByShopAndHandle` is a small repository addition Phase 2 makes (Phase 1 only shipped `findByShopAndId`). Alternatively, since `(shop, handle)` is `@@unique` in the schema, use `prisma.product.findFirst({ where: { shop, handle }})` from the route — either works. Implementer's call.

### Claude's Discretion

- Inngest function name (`shopify/product.sync` is the recommended convention; final id is implementer's call).
- Whether to add a `RetryConfig` to the Inngest function (default Inngest exponential backoff is fine for V1; tune later if needed).
- Test mocking strategy for Inngest: prefer `@inngest/test` if available; otherwise stub `step.run` to invoke its callback inline.
- Whether the `SyncRun.errors[]` is `String[]` or `Json[]` — `Json[]` is richer but Postgres `text[]` is simpler; implementer chooses. The interface (one error per failed product) is locked.
- Whether the webhook handler should also write a `SyncRun` entry for webhook-triggered changes — V1 says no; webhooks update product rows directly, not as part of a sync run. Reconsider in a later phase if audit trail is needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Scope
- `.planning/PROJECT.md` — Core Value, V1 scope, Out of Scope, locked decisions including the 5k catalog target and "sync architecture: background job + status polling/SSE — never run >60s synchronously"
- `.planning/REQUIREMENTS.md` — SYN-01..11 + ADM-01, ADM-02 are the formal requirements covered by this phase
- `.planning/ROADMAP.md` §"Phase 2: Sync Pipeline" — phase goal, 5 success criteria, depends_on: Phase 1

### Research (Phase 1 era — still authoritative)
- `.planning/research/STACK.md` — Inngest 4.4.0 install + usage, `@shopify/shopify-api` 12.3 HMAC validation API, Shopify GraphQL `products(first: $first, after: $cursor)` shape
- `.planning/research/ARCHITECTURE.md` §"Sync pipeline" — `SyncRun` model shape, polling endpoint pattern, "use `next/server after()`" alternative considered and rejected for V1 (Inngest preferred for resumability)
- `.planning/research/PITFALLS.md` §"Background sync pitfalls" — cursor-based resumption, conditional upsert on `product.updatedAt`, webhook deduplication on `X-Shopify-Event-Id`, lost work between batches; §"Shopify-specific" — HMAC verification gotchas (URL encoding, parameter ordering)
- `.planning/research/FEATURES.md` §"Onboarding patterns" — "5-minute setup", progress bar UX expectations

### Phase 1 Outputs (canonical handoffs)
- `.planning/phases/01-foundation/01-CONTEXT.md` §"D-03" — repository methods take shop as first arg (this phase consumes that contract via `productRepository.upsertProduct`)
- `.planning/phases/01-foundation/01-09-SUMMARY.md` §"Handoff to Phase 2" — sync route already wrapped in `withShopifySession`; Inngest worker imports the same Prisma singleton
- `lib/shopify/auth.ts` (Phase 1 Plan 02) — `withShopifySession` wrapper is the auth pattern for sync POST and status GET
- `lib/db/repositories/ProductRepository.ts` (Phase 1 Plan 06) — `upsertProduct(shop, ProductUpsertInput)` is the data-access surface; `ProductUpsertInput` shape is the GraphQL → DB mapping contract
- `prisma/schema.prisma` (Phase 1 Plan 03) — Phase 2 adds `SyncRun`, `WebhookEvent`, and `SyncState` enum; all new tables follow the same `shop String NOT NULL` + composite-index pattern
- `app/api/shopify/sync/route.ts` (Phase 1 Plan 08) — the file Phase 2 rewrites; current placeholder returns `{ success: true }`

### Codebase Snapshot
- `.planning/codebase/STACK.md` — bun, Vitest 4, Next.js 16 confirmed pinned
- `.planning/codebase/INTEGRATIONS.md` — Shopify API key/secret env var names; Resend not yet relevant
- `.planning/codebase/CONCERNS.md` §"Webhook Handler Not Implemented" — the stub being replaced; HMAC not yet wired

### External Docs (research-time, version-pinned)
- Inngest Next.js quick start (verified 2026-05 via STACK.md research)
- Shopify Admin GraphQL `products` query reference (use `query=updated_at_max` for incremental; not needed in V1 since the cursor-based full sync is enough)
- Shopify webhooks reference: `products/create`, `products/update`, `products/delete` event payload shapes; `X-Shopify-Event-Id` header guarantees per Shopify docs
- `shopify.app.toml` `[webhooks.subscriptions]` reference (Shopify CLI 3.x docs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/shopify/auth.ts` `withShopifySession` — wraps both `POST /api/shopify/sync` and `GET /api/shopify/sync/status`. Phase 2 routes are one-line wrapper invocations.
- `lib/shopify/client.ts` `shopifyClient` — Phase 2's webhook HMAC verification uses `shopifyClient.webhooks.validate({ rawBody, rawRequest: req })` — NOT `utils.validateHmac` (see D-10). `SHOPIFY_API_SECRET` is already wired into `shopifyClient`; the validator reads it internally.
- `lib/db/client.ts` `prisma` singleton — Phase 2 Inngest worker imports the same singleton; `@prisma/adapter-pg` handles the local Docker Postgres connection.
- `lib/db/repositories/ProductRepository.ts` `productRepository.upsertProduct(shop, input)` — the single integration point for both sync and webhook code paths. The `ProductUpsertInput` shape mirrors Shopify GraphQL `Product` fields (title, handle, description, vendor, productType, status, tags, variants[], images[], options[]).
- `app/(embedded)/onboarding/page.tsx` — already has the "Start sync" button calling `POST /api/shopify/sync` with Bearer token (Phase 1 Plan 04 cleaned its console.logs). Phase 2 adds the progress view + state machine.
- `proxy.ts` matcher — `/onboarding/:path*` is already covered, so Phase 2's progress polling page-side calls don't need any matcher change.

### Established Patterns
- Singleton client exports (`prisma`, `shopifyClient`, `sessionStorage`) — Phase 2 follows: `inngest` (new) is exported as singleton from `lib/inngest/client.ts`.
- Error response shape `Response.json({ error: <code> }, { status })` — Phase 2 status endpoint uses the same shape for `404 sync_run_not_found`, `403 wrong_shop`, etc.
- Co-located Vitest tests (`__tests__/`) with the `vi.mock()` block before imports — Phase 2 tests for Inngest functions follow the same pattern, mocking `step.run` inline.
- Composite-key relations on merchant data (`(shop, id)` per D-04 in Phase 1) — new `SyncRun` and `WebhookEvent` carry `shop NOT NULL` + `@@index([shop])`; no parent-child FK needed since they're standalone.

### Integration Points
- `app/api/shopify/sync/route.ts` — Phase 2 replaces the placeholder body with: derive shop, compute idempotency key, find-or-create SyncRun, enqueue Inngest event, return `{ syncRunId }`.
- `app/api/shopify/sync/status/route.ts` (NEW) — `GET` handler wrapped in `withShopifySession`, reads `syncRunId` from query, returns the matching `SyncRun` row (only if it belongs to `shop`).
- `app/api/shopify/webhook/route.ts` — Phase 2 replaces the existing stub with the full HMAC + dedup + repository call.
- `app/api/inngest/route.ts` (NEW) — Inngest serve handler exposing the sync function to the Inngest runtime.
- `inngest/functions/sync-products.ts` (NEW) — the step-function workflow.
- `lib/inngest/client.ts` (NEW) — the Inngest client singleton.
- `app/(embedded)/onboarding/page.tsx` — add `useEffect` polling `/api/shopify/sync/status?syncRunId=…` every 2s when `syncing && syncRunId`; render progress bar and completion banner.
- `services/shopify/ShopifyProductService.ts` — Phase 2 implements `fetchAllProducts(shop, session, { cursor, batchSize })` returning `{ items, nextCursor, totalCount? }` instead of the empty-array stub.

</code_context>

<specifics>
## Specific Ideas

- Use Shopify Polaris web components (`<s-progress-bar>`, `<s-banner>`, `<s-button>`, `<s-text>`) for the progress UI — they're already loaded by `EmbeddedProviders` and match the rest of the embedded admin.
- Webhook topics for V1: `products/create`, `products/update`, `products/delete`. No `products/list` (doesn't exist), no inventory/order webhooks (out of scope).
- Test the Inngest `step.run` flow by mocking the `step` parameter as `{ run: (id, fn) => fn() }` — invokes the callback inline so unit tests don't need a running Inngest dev server.
- For local dev, document the two-process workflow: `bun dev` (Next.js + your API routes) + `bunx inngest-cli@latest dev` (Inngest runtime). Both can run from the same shell with `concurrently` (but don't add that dependency yet — `tmux`/two terminals is fine for V1).
- HMAC verification gotcha (from PITFALLS.md): `webhooks.validate` expects the raw request body, not the parsed JSON. Read `const rawBody = await req.text()` first, call `shopifyClient.webhooks.validate({ rawBody, rawRequest: req })`, then `JSON.parse(rawBody)`. Document in the route file.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk Operations API for initial sync** — research suggested this for 50k+ catalogs; the 5k V1 target stays on paginated GraphQL per D-01/D-02. Revisit when targeting enterprise stores.
- **Resend completion email** — Phase 8 owns email notifications. Phase 2's `succeeded` state only updates the UI; no email yet.
- **Sync history view in admin** — "view past runs" tab is V1.x at earliest. The `SyncRun` table accumulates rows, so the data is there; UI is deferred.
- **WebhookEvent table cleanup cron** — table grows monotonically. Add a 30-day Inngest cron to delete old events in a later phase.
- **Adaptive client-side polling** — 2s constant for V1; if QPS becomes a problem, switch to exponential backoff (5s after 30s queued, 10s after 2min, etc.).
- **Fast-path `verifyToken` without DB hit** — carried over from Phase 1 deferred ideas. Same trigger: only if polling profiling shows the session-load is dominant.
- **Real-time progress via SSE** — research considered, V1 sticks with polling. SSE adds Vercel function instance pinning, which complicates scaling.
- **Per-product retry control via `step.run` per product** — overkill for 5k SKU; the batch-level try/catch in D-15 is sufficient.
- **Webhook → Inngest event indirection** — deliberately rejected for V1 (D-06). Reconsider if webhook DB write latency becomes a problem.
- **Webhook-triggered SyncRun row for audit** — Claude's Discretion item; revisit if a customer asks "when was this product updated by us?".
- **Inngest dead-letter queue / failure dashboard** — Inngest provides this out of the box at higher tiers; no custom UI in V1.
- **GraphQL query cost monitoring** — surface costs in `SyncRun.errors[]` if a batch hits throttle; not a UI concern V1.

</deferred>

---

*Phase: 2-Sync Pipeline*
*Context gathered: 2026-05-23*
