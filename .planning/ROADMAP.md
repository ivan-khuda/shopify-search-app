# Roadmap: SmartDiscovery AI

## Overview

SmartDiscovery AI goes from a scaffolded-but-stubbed Shopify embedded app to a fully functional AI product discovery system. The build order is strictly sequenced through the critical path (Foundation → Sync → Embeddings → Search) before branching into parallel tracks (Storefront, Admin Settings, Email + Hard Cap). Every phase delivers something independently verifiable: the admin chat playground serves as the integration checkpoint before any storefront work begins.

## Phases

**Phase Numbering:**

- Integer phases (1–8): Planned V1 milestone work
- Decimal phases (e.g., 2.1): Urgent insertions via `/gsd:phase insert`

- [x] **Phase 1: Foundation** - Security hardening, multi-tenancy schema, repository layer
- [x] **Phase 2: Sync Pipeline** - Inngest background sync, SyncRun model, webhooks, onboarding progress UI
- [x] **Phase 3: Embeddings + Search Indexes** - EmbeddingService, HNSW + GIN indexes, modelVersion column
- [ ] **Phase 4: SearchService + Wire Chat** - RRF hybrid search, MOCK_PRODUCTS removed, admin playground on real data
- [ ] **Phase 5: Shared Chat-UI Extraction** - lib/chat-ui barrel, adapter pattern, persistence models
- [ ] **Phase 6: Storefront Surface** - Theme App Extension, App Proxy, FAB + drawer, visitor identity + persistence
- [ ] **Phase 7: Admin Settings + Model Picker** - ShopSettings model, model picker UI, per-shop active model
- [ ] **Phase 8: Email + Hard Cap** - Resend completion emails, per-shop request counter, graceful cap response

## Phase Details

### Phase 1: Foundation

**Goal**: The codebase is secure, multi-tenant safe, and has a real data-access layer that every subsequent phase can build on
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05
**Success Criteria** (what must be TRUE):

  1. Every Prisma model storing merchant data has a `shop` column with an index, and no query can return data without filtering by shop
  2. No session token, auth header, or Bearer token appears in any server log (console.log statements removed from middleware, auth routes, and onboarding)
  3. Middleware auth check is active with the correct matcher; unauthenticated requests to `/onboarding` and `/chat` are redirected to auth
  4. `ProductRepository` exposes type-safe `upsertProduct`, `deleteProduct`, `listByShop`, and `findByShopAndId` backed by Prisma transactions
  5. `verifyShopSessionToken(request)` is a shared helper used by all embedded admin API routes (not duplicated inline)

**Plans**: 9 plans

- [ ] 01-01-PLAN.md — Wave 0 RED test scaffolds (auth.test.ts, ProductRepository.test.ts, middleware.test.ts cleanup)
- [ ] 01-02-PLAN.md — lib/shopify/auth.ts (verifyShopSessionToken + withShopifySession + ShopifyAuthError)
- [ ] 01-03-PLAN.md — prisma/schema.prisma rewrite + destructive migration SQL (shop column + composite FK)
- [ ] 01-04-PLAN.md — Delete console.log statements from middleware/auth routes/onboarding (FND-02)
- [ ] 01-05-PLAN.md — [BLOCKING] Apply Prisma migration; regenerate client; verify pgvector + ShopifySession survive
- [ ] 01-06-PLAN.md — ProductRepository real CRUD (upsertProduct/findByShopAndId/listByShop/deleteProduct)
- [ ] 01-07-PLAN.md — proxy.ts (Next.js 16) replacing middleware.ts; re-enabled session check; matcher set
- [ ] 01-08-PLAN.md — Sync route rewrite via withShopifySession; update tests for D-06 code split
- [ ] 01-09-PLAN.md — Phase 1 verification gate (automated + manual smoke + ROADMAP/STATE update)

**UI hint**: no

### Phase 2: Sync Pipeline

**Goal**: Merchants can trigger a real product sync from their Shopify catalog; sync runs as a durable background job with progress visible in the onboarding UI and real-time webhook updates keep the catalog current
**Depends on**: Phase 1
**Requirements**: SYN-01, SYN-02, SYN-03, SYN-04, SYN-05, SYN-06, SYN-07, SYN-08, SYN-09, SYN-10, SYN-11, ADM-01, ADM-02
**Success Criteria** (what must be TRUE):

  1. Clicking "Start sync" in the onboarding UI creates a SyncRun row, enqueues an Inngest job, and immediately returns a syncRunId — the request completes in under 2 seconds regardless of catalog size
  2. The onboarding page polls `/api/shopify/sync/status` every 2 seconds and displays a live progress bar showing processedCount / totalCount with state labels (queued, running, succeeded, failed)
  3. A second "Start sync" click while a run is active is silently de-duplicated (same idempotency key returns the existing run, no second Inngest job fired)
  4. After a product is created, updated, or deleted in Shopify Admin, the webhook handler verifies the HMAC signature, deduplicates by X-Shopify-Event-Id, and upserts/deletes the product using updated_at_shopify for conflict resolution
  5. If the Inngest function is interrupted mid-run (e.g., Vercel cold restart), resuming the job processes from the last persisted cursor, not from product 1

**Plans**: 11 plans

- [ ] 02-01-PLAN.md — Wave 0 RED test scaffolds + install inngest + @inngest/test
- [ ] 02-02-PLAN.md — Additive Prisma schema rewrite (SyncState/SyncRun/WebhookEvent/updatedAtShopify) + migration SQL author
- [ ] 02-03-PLAN.md — Inngest client singleton + serve handler skeleton
- [ ] 02-04-PLAN.md — [BLOCKING] Apply Prisma migration + regenerate client
- [ ] 02-05-PLAN.md — ShopifyProductService rewrite + ProductUpsertInput.updatedAtShopify
- [ ] 02-06-PLAN.md — syncProductsFunction (Inngest step-function) + serve handler wired
- [ ] 02-07-PLAN.md — POST /api/shopify/sync rewrite (idempotency + inngest.send)
- [ ] 02-08-PLAN.md — GET /api/shopify/sync/status (shop-scoped polling endpoint)
- [ ] 02-09-PLAN.md — /api/shopify/webhook rewrite (HMAC + dedup + topic dispatch + stale-event skip) + ProductRepository.findByShopAndHandle
- [ ] 02-10-PLAN.md — Onboarding state machine + polling + progress UI + completion banners
- [ ] 02-11-PLAN.md — Phase 2 verification gate

**UI hint**: yes

### Phase 3: Embeddings + Search Indexes

**Goal**: Every synced product has a stored embedding with a pinned model version, and the database has HNSW + GIN indexes that are safe from Prisma migration drift
**Depends on**: Phase 2
**Requirements**: EMB-01, EMB-02, EMB-03, EMB-04, EMB-06
**Success Criteria** (what must be TRUE):

  1. After a sync completes, every product in the DB has a corresponding row in `ProductEmbedding` with a non-null `modelVersion` column containing the full model ID (not an alias)
  2. A single failed embedding during batch processing does not abort the run; the sync continues and logs the failure
  3. Running `EXPLAIN ANALYZE` on a shop-scoped vector query confirms an HNSW index scan (not a sequential scan) with `hnsw.iterative_scan = 'relaxed_order'` enabled
  4. Re-running `db/manual-indexes.sql` after a `prisma migrate dev` cycle is idempotent — indexes are not dropped and recreated, no errors thrown

**Plans**: 8 plans
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Wave 0 RED test scaffolds + AI_GATEWAY_API_KEY checkpoint

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — buildSearchableText helper (D-03 single source of truth)
- [x] 03-03-PLAN.md — withHnswIterativeScan helper for EMB-06 GUC enforcement
- [x] 03-04-PLAN.md — EmbeddingService (embed/embedBatch/embedAndStore) + EMBEDDING_MODEL pinning

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — Schema additions + raw-SQL migration + manual-indexes.sql + db:indexes + [BLOCKING] apply

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-06-PLAN.md — Inject embed-batch step into sync-products.ts (4-step batch loop)
- [x] 03-07-PLAN.md — Webhook re-embedding inline + CLAUDE.md workflow docs

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-08-PLAN.md — Phase 3 verification gate (full suite + EXPLAIN ANALYZE + idempotency + roll-forward)

**UI hint**: no

### Phase 4: SearchService + Wire Chat

**Goal**: The admin chat playground returns real, shop-scoped product results from hybrid search — MOCK_PRODUCTS is gone from all runtime paths
**Depends on**: Phase 3
**Requirements**: EMB-05, EMB-07, ADM-05, ADM-06
**Success Criteria** (what must be TRUE):

  1. Typing a natural-language query into the admin chat playground (e.g., "show me waterproof jackets under $100") returns product cards sourced from the merchant's actual synced catalog, not mock data
  2. The admin playground labels itself "Preview mode — using your real catalog" and displays the name of the active model
  3. Both `/api/chat` (admin) and `/api/proxy/chat` (storefront, stubbed) call `SearchService.hybridSearch`; the `MOCK_PRODUCTS` file and `buildMockResults()` function are deleted
  4. A query containing a brand name or SKU-style term returns relevant results (verifying that BM25 full-text contributes to RRF fusion alongside vector results)

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 04-01-wave0-test-scaffolds-PLAN.md — Wave 0 RED test scaffolds (5 test files, ~43 it() blocks)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-02-searchservice-active-model-PLAN.md — SearchService.ts + getActiveChatModel.ts (parallel-safe foundational services)

**Wave 3** *(blocked on Wave 2 completion — runs 04-03 and 04-04 in parallel)*

- [ ] 04-03-api-chat-rewrite-PLAN.md — /api/chat rewrite (withShopifySession + AI Gateway + searchCatalog tool)
- [ ] 04-04-proxy-chat-stub-PLAN.md — /api/proxy/chat stub (EMB-07 success criterion #3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04-05-ui-refactor-PLAN.md — UI refactor (message-parts.tsx tool-state renderer, chat.tsx gutting, MOCK_PRODUCTS deletion)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 04-06-page-banner-verify-PLAN.md — page.tsx server-component + banner + Phase 4 verification gate

**UI hint**: yes

### Phase 5: Shared Chat-UI Extraction

**Goal**: Chat components live in a runtime-neutral `lib/chat-ui/` barrel consumed identically by the embedded admin and the storefront drawer, with an adapter pattern handling the only surface-specific difference (auth/identity)
**Depends on**: Phase 4
**Requirements**: SHR-01, SHR-02, SHR-03, SHR-04
**Success Criteria** (what must be TRUE):

  1. `lib/chat-ui/` exports `ChatPane`, `ChatMessage`, `ProductCard`, `HistoryPanel`, and `SavedProductsPanel` with zero imports from `window.shopify`, App Bridge, or any Shopify-embedded SDK
  2. The `ChatIdentityAdapter` interface is the sole surface-specific seam; `EmbeddedAdapter` provides session-token Bearer auth, `StorefrontAdapter` provides visitor_id from localStorage
  3. The embedded admin chat page imports exclusively from `lib/chat-ui/` — no direct imports from `components/chat/` remain in the embedded surface
  4. A TypeScript strict-mode build passes with no `any` casts in the shared barrel or either adapter

**Plans**: TBD
**UI hint**: yes

### Phase 6: Storefront Surface

**Goal**: A storefront visitor can open a FAB-triggered chat drawer, ask about products in natural language, see results from the merchant's real catalog, and have their conversation history and saved products persist across sessions — all without logging in and without any merchant theme edits
**Depends on**: Phase 5
**Requirements**: STR-01, STR-02, STR-03, STR-04, STR-05, STR-06, STR-07, STR-08, IDN-01, IDN-02, IDN-03, IDN-04, IDN-05, IDN-06
**Success Criteria** (what must be TRUE):

  1. A merchant toggles the App Embed block in their theme editor (no Liquid edits); a FAB appears bottom-right on all storefront pages, and clicking it opens a side drawer with Chat / History / Saved tabs
  2. A first-time anonymous visitor gets a UUID visitor_id stored in localStorage; their conversation persists after closing and reopening the drawer, and after a full page reload
  3. When a logged-in customer opens the drawer, their anonymous history and saved products merge into their customer-keyed record; the same history is visible when they log in on a different device
  4. All storefront-to-backend requests travel through the Shopify App Proxy path (`/apps/smartdiscovery/*`); no cross-origin requests are made
  5. The drawer does not collide with any theme element's z-index on the Dawn, Sense, or Craft themes; in the Theme Editor (`Shopify.designMode`), the FAB is visible but the drawer does not open automatically

**Plans**: TBD
**UI hint**: yes

### Phase 7: Admin Settings + Model Picker

**Goal**: Merchants can choose the AI chat model their storefront uses, with a sensible default pre-selected on install, and the admin playground immediately reflects the active model choice
**Depends on**: Phase 4
**Requirements**: ADM-03, ADM-04
**Success Criteria** (what must be TRUE):

  1. Navigating to `/settings` shows a list of available Vercel AI Gateway chat models with name, provider, context window, per-token pricing, and a "best for" descriptor
  2. Selecting a model and saving persists the choice per-shop in the `ShopSettings` table; a page refresh on `/settings` shows the previously selected model still active
  3. On first install, a sensible default model (Gemini 2.5 Flash or equivalent) is pre-selected without any merchant action
  4. The admin playground's active-model label updates immediately after the merchant changes the model setting

**Plans**: TBD
**UI hint**: yes

### Phase 8: Email + Hard Cap

**Goal**: Every sync completion triggers a Resend email to the shop owner, and per-shop chat request counts are enforced so the app can operate safely at scale before billing ships
**Depends on**: Phase 2
**Requirements**: NOT-01, NOT-02, NOT-03, NOT-04, CAP-01, CAP-02, CAP-03
**Success Criteria** (what must be TRUE):

  1. When a sync run completes successfully, the shop's `contactEmail` (from Shopify GraphQL `shop { contactEmail }`) receives a Resend email showing the product count synced and a link to the admin
  2. When a sync run fails, the shop owner receives a Resend email with the failure reason and a retry link
  3. When a shop exceeds its monthly chat request cap (configurable via `HARD_CAP_REQUESTS_PER_MONTH`), both `/api/chat` and `/api/proxy/chat` return HTTP 200 with a "monthly limit reached" message that the chat UI renders as a friendly inline response
  4. The request counter increment is atomic — concurrent requests from the same shop cannot both succeed when the counter is at cap − 1 (race-condition safe)

**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases 1 → 2 → 3 → 4 → 5 → 6 are strictly sequential.
Phases 7 and 8 are parallel-eligible with Phase 6 (no blocking dependencies — both depend only on Phase 4 and Phase 2 respectively).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Sync Pipeline | 0/TBD | Not started | - |
| 3. Embeddings + Search Indexes | 8/8 | Complete | 2026-05-25 |
| 4. SearchService + Wire Chat | 1/6 | In Progress|  |
| 5. Shared Chat-UI Extraction | 0/TBD | Not started | - |
| 6. Storefront Surface | 0/TBD | Not started | - |
| 7. Admin Settings + Model Picker | 0/TBD | Not started | - |
| 8. Email + Hard Cap | 0/TBD | Not started | - |
