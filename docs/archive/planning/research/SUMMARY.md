# Project Research Summary

**Project:** SmartDiscovery AI
**Domain:** Shopify-embedded AI product discovery app (admin + storefront surfaces)
**Researched:** 2026-05-22
**Confidence:** HIGH

## Executive Summary

SmartDiscovery AI is a brownfield Next.js 16 app that already has its embedded admin shell, OAuth flow, Prisma schema with pgvector slot, and a working chat UI — but every product-facing feature is stubbed or mocked. The V1 milestone is fundamentally one pipeline: make the sync → embedding → hybrid search loop real, then expose it through both the admin playground and a new storefront drawer. Research across all four files converges on the same build order: Foundation (security/schema fixes) → Sync Pipeline → Embeddings → Search → Shared UI extraction → Storefront Surface → Admin Settings → Hard cap + email. Nothing in Phase 5+ can start until real search results flow through the admin chat in Phase 4.

The recommended approach is to use Inngest for durable sync background jobs (survives Vercel's 60s timeout), `openai/text-embedding-3-small` via Vercel AI Gateway for embeddings, and a hybrid pgvector HNSW + PostgreSQL tsvector RRF query for search. The storefront drawer uses a Theme App Extension App Embed block injecting a FAB, routing all backend calls through Shopify App Proxy with HMAC verification. Visitor identity must use `localStorage` (not cookies — App Proxy strips `Set-Cookie`). The existing `components/chat/` tree is extracted into `lib/chat-ui/` with an adapter pattern so both surfaces share 100% of the component tree.

The two load-bearing risks are (1) the HNSW index silently bypassed by the Postgres query planner under per-shop filters — mitigated by enabling `hnsw.iterative_scan = 'relaxed_order'` and keeping `LIMIT <= 20` — and (2) Prisma dropping the HNSW index on the next migration run — mitigated by maintaining a separate `db/manual-indexes.sql` that the deployment pipeline re-applies after every migration. Both must be addressed in Phase 3 before any production load, not retroactively.

---

## Key Findings

### Load-Bearing Decisions (most critical)

| Decision | Rationale |
|----------|-----------|
| **Inngest for background sync** | `next/server after()` alone risks timeout at 5k products + embedding latency; Inngest step memoization resumes from last successful batch without external queue infrastructure |
| **`openai/text-embedding-3-small` pinned by ID** | 1,536 dims matches existing Prisma schema slot, $0.02/M tokens (10x cheaper than Gemini Embedding 2), must be pinned by full model ID — not an alias — to prevent silent embedding space drift |
| **Hybrid pgvector + tsvector RRF search** | Pure vector fails on brand names/SKUs; pure BM25 fails on intent queries; RRF fusion achieves ~91% recall@10 vs 65-78% for either alone — this is the core quality claim |
| **App Proxy + Theme App Extension (no custom CDN)** | Only pattern that gives signed same-origin requests and zero-touch theme install; merchant toggles App Embed block in theme editor, no Liquid edits required |
| **`localStorage` for visitor_id (not cookies)** | App Proxy strips both `Cookie` request header and `Set-Cookie` response header — using cookies means every page navigation creates a new anonymous user and destroys chat history |
| **`lib/chat-ui/` in-tree barrel (not monorepo)** | Admin and storefront share the same component tree via an adapter pattern; full monorepo adds 2-3 days of infra work for a single-app consumer |
| **Deterministic RAG (always retrieve before LLM)** | Tool-calling RAG lets the model skip retrieval; for a closed-domain product catalog the model should never answer without a search pass — eliminates the "forgot to search" failure mode |
| **Application-layer multi-tenancy (no Postgres RLS)** | RLS with Prisma Accelerate's connection pooling requires `SET LOCAL` in every transaction — error-prone; explicit `shop` column + `WHERE shop = $shop` in every query is safer and auditable |

### Recommended Stack (new dependencies only)

**Runtime additions:**
- `@ai-sdk/gateway` — explicit gateway provider for `getAvailableModels()` on the settings screen
- `inngest` — durable step-function sync jobs
- `resend` + `@react-email/components` — sync completion transactional email

**Remove from runtime:** `@ai-sdk/google` (Vercel AI Gateway is the sole provider per PROJECT.md)

**No new npm deps:** Theme App Extension (CLI scaffold + vanilla JS bundle), pgvector hybrid search (raw SQL via `prisma.$queryRaw`), App Proxy HMAC (existing `@shopify/shopify-api`), visitor identity (`node:crypto` + `nanoid` already in lockfile)

**New env vars:** `AI_GATEWAY_API_KEY`, `RESEND_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `COOKIE_SECRET`

**Version note:** `@shopify/shopify-api` is at 12.3.0 in lockfile; latest is 13.0.0 (major bump — do not upgrade without changelog review).

### Expected Features

**Must have (table stakes — P1):**
- Real product sync (GraphQL fetch + upsert + `products/create|update|delete` webhooks)
- Embedding generation + hybrid pgvector+tsvector search — core quality claim
- Storefront FAB + drawer (Theme App Extension + App Proxy)
- Anonymous visitor identity (no login wall — drops ~60% engagement otherwise)
- Product cards grounded in real catalog results
- Conversation persistence + History tab (no direct competitor exposes this in the drawer)
- Saved products bookmark tab
- Sync progress UI + completion email
- Model picker in admin settings (unique differentiator — no competitor exposes this)
- Hard per-shop request cap (unit-economics protection before billing ships)

**Should have (differentiators — P2):**
- Citation-grounded chat responses (3-10% engagement lift per arXiv 2503.04830)
- Customer-id upgrade when logged in (cross-device history without login wall)
- Zero-results fallback with nearest-neighbor suggestions
- Admin playground wired to real search

**Defer (V1.x / V2+):**
- Search analytics dashboard (log events now, expose UI in V1.x)
- Multi-language drawer, voice input, image-based visual search, exit-intent engagement, billing API

### Architecture Approach

Two independent auth surfaces (embedded admin via session-token Bearer, storefront via App Proxy HMAC) share one service layer. Route handlers are thin glue (auth + deserialize + one service call + serialize). Business logic lives in `services/` (SearchService, EmbeddingService, ConversationService, ShopifyProductService). Data access lives in `lib/db/repositories/` with `shop` as a structurally required parameter on every method. The `lib/chat-ui/` barrel exports a surface-agnostic `ChatPane` that receives a `ChatIdentityAdapter` — the only thing that differs between admin and storefront is the adapter wired at the page level.

**Major components:**
1. **`services/search/SearchService`** — hybrid SQL (pgvector cosine + tsvector RRF), always called before `streamText()`
2. **`services/embedding/EmbeddingService`** — batched `embedMany()` with `modelVersion` column; re-indexes only rows where model differs from `CURRENT_MODEL_VERSION`
3. **`lib/inngest/functions/sync-products`** — step-function sync: fetch page → upsert batch → update `SyncRun.processedCount` → repeat; sends email on completion
4. **`lib/chat-ui/` + adapters** — shared component tree; `EmbeddedAdapter` uses `window.shopify.idToken()`; `StorefrontAdapter` uses `localStorage` visitor_id
5. **`extensions/storefront-drawer/`** — Theme App Extension; App Embed block injects FAB + drawer mount into `<body>`; compiled JS bundle at deploy time
6. **`app/api/proxy/`** — App Proxy routes with shared `verifyProxyRequest()` HMAC guard

### Critical Pitfalls

1. **App Proxy strips Set-Cookie** — Generate `visitor_id` client-side via `crypto.randomUUID()`, store in `localStorage`, pass as request body field. Never use `Set-Cookie` on proxy routes. Must be solved before any visitor identity feature ships.

2. **HNSW index silently bypassed under shop-filtered queries** — Enable `SET hnsw.iterative_scan = 'relaxed_order'` before vector queries; keep `LIMIT <= 20`. Run `EXPLAIN ANALYZE` after Phase 3 to verify `Index Scan` not `Seq Scan`. Degrades from 2ms to 3-10s at ~20+ shops.

3. **Prisma drops HNSW index on next migration** — Append `CREATE INDEX CONCURRENTLY IF NOT EXISTS` SQL to every migration; maintain `db/manual-indexes.sql` re-applied by deployment pipeline after every `prisma migrate deploy`. Never use `prisma migrate reset` on production.

4. **Embedding model version mismatch silently corrupts search** — Add `modelName` + `modelVersion` columns to `ProductEmbedding` before the first embedding is written. Pin to full model ID string, not an alias. Queries filter `WHERE model_version = CURRENT_VERSION`.

5. **Vercel timeout kills sync mid-batch** — `SyncRun` must track `last_cursor` (Shopify GraphQL `pageInfo.endCursor`). Each Inngest step processes <=50 products; step memoization means a retry resumes from the failed batch, not from zero.

6. **Webhook + manual sync race condition** — Conditional upsert: `ON CONFLICT DO UPDATE SET ... WHERE product.updated_at_shopify < EXCLUDED.updated_at_shopify`. Must be in `ProductRepository.upsertBatch()` from day one.

7. **App Proxy HMAC fails on URL-encoded params** — Use `URL.searchParams.get()` (decoded), remove `signature` key, sort alphabetically, concatenate with NO separator between pairs, HMAC-SHA256, `timingSafeEqual`. Test with `path_prefix=%2Fapps%2F` URL-encoded value.

---

## Implications for Roadmap

### Phase 1: Foundation — Security + Schema + Real Data Access
**Rationale:** Every subsequent phase depends on multi-tenant scoping, secure auth, and functional repository layer. Skipping creates permanent security debt and blocks all DB writes.
**Delivers:** Middleware re-enabled with correct matcher; all `console.log(token)` removed; `Product.shop` column migration; `ProductRepository.upsertBatch()`; `ShopifyProductService` real GraphQL fetch.
**Addresses:** CONCERNS.md — commented-out middleware, console-logged tokens, stub repositories.
**Avoids:** Multi-tenant data leaks (missing `shop` column), credential exposure in logs.
**Research flag:** Standard patterns — no research phase needed.

### Phase 2: Sync Pipeline
**Rationale:** Real product data in DB is prerequisite for every other feature. Must include cursor-based resume and webhook HMAC or sync is not production-safe.
**Delivers:** Inngest sync function with step batching; `SyncRun` model + status polling endpoint; onboarding progress bar with real data; webhook handler with HMAC + conditional upsert; idempotency key on `SyncRun`.
**Addresses:** Real-time product sync (table stakes P1), onboarding progress indicator, completion state.
**Avoids:** Vercel timeout mid-batch (cursor resume), webhook/sync race condition (conditional upsert on `updated_at_shopify`).
**Research flag:** Standard patterns — Inngest Next.js quick start is well-documented.

### Phase 3: Embeddings + Search Indexes
**Rationale:** Embeddings must exist before SearchService can be built. Index strategy must be correct from day one — retroactive fixes are expensive.
**Delivers:** `EmbeddingService` with batched `embedMany()` + `modelVersion` columns; `db/manual-indexes.sql` with HNSW cosine + GIN tsvector indexes; hybrid RRF query verified with `EXPLAIN ANALYZE`.
**Addresses:** Semantic/NLP search (P1), typo tolerance, hybrid search differentiator.
**Avoids:** HNSW index bypass (iterative scan + LIMIT), Prisma drops index (idempotent SQL), embedding model drift (pinned model ID + `modelVersion`).
**Research flag:** Verify pgvector >= 0.8.0 on target Postgres before writing migration. Verify `SET hnsw.iterative_scan` works with Prisma Accelerate's connection pooler.

### Phase 4: SearchService + Wire Both Chat Endpoints
**Rationale:** Completing the search loop through the admin playground validates the core value prop before any storefront work begins. This is the "does it work?" checkpoint.
**Delivers:** `SearchService.search()` with hybrid SQL; `/api/chat` wired to SearchService (MOCK_PRODUCTS deleted); admin playground returns real results.
**Addresses:** Citation-grounded product answers, admin playground as real demo.
**Avoids:** Building storefront before search works.
**Research flag:** Standard patterns — no research phase needed.

### Phase 5: Shared Chat-UI Extraction
**Rationale:** Storefront drawer must be built on top of the shared package. If extraction happens after storefront is built, both surfaces diverge permanently.
**Delivers:** `lib/chat-ui/` barrel with `ChatPane`, adapters, hooks; `EmbeddedAdapter` + `StorefrontAdapter`; `Conversation`, `Visitor`, `SavedProduct`, `Message` Prisma models; history/saved tabs wired to DB.
**Addresses:** Shared UI (PROJECT.md), conversation persistence, saved bookmarks.
**Avoids:** Monorepo complexity (in-tree only), App Bridge leaking into shared components (adapter pattern).
**Research flag:** Standard patterns — no research phase needed.

### Phase 6: Storefront Surface (Theme App Extension + App Proxy)
**Rationale:** Requires Phase 4 (real search) + Phase 5 (shared UI) complete. First customer-facing end-to-end flow.
**Delivers:** `app/api/proxy/` routes with HMAC guard; `extensions/storefront-drawer/` App Embed block; FAB + drawer; `localStorage` visitor_id; customer_id linking; anonymous-to-customer merge on login.
**Addresses:** Storefront chat widget (P1), anonymous visitor identity, history tab, saved tab.
**Avoids:** Cookie-based visitor_id, URL-encoded HMAC params, theme editor preview breakage (`window.Shopify.designMode` check), prompt injection (shop-scoped search server-side).
**Research flag:** Research phase recommended — CSS z-index strategy across Dawn/Sense/Craft themes; `env(keyboard-inset-height)` / `dvh` mobile Safari support; add-to-cart scope requirements (PDP deep-link vs `cart/add.js`).

### Phase 7: Admin Settings (Model Picker)
**Rationale:** Can overlap with Phase 6. Independent feature; does not block storefront launch.
**Delivers:** `ShopSettings` Prisma model; `app/(embedded)/settings/page.tsx`; `getAvailableModels()` integration; active model persisted per shop; chat endpoints use `shopSettings.activeModel`.
**Addresses:** Model picker differentiator (unique in Shopify app space).
**Research flag:** Standard patterns — AI Gateway dynamic model discovery is well-documented.

### Phase 8: Hard Cap + Completion Email
**Rationale:** Unit-economics protection and merchant communication needed before any public install traffic. Hard cap must be atomic (race-condition safe).
**Delivers:** Per-shop `ChatRequest` counter with atomic `UPDATE ... RETURNING`; graceful "limit reached" response; Resend completion email using `shop.contactEmail` (not `shop.email`).
**Addresses:** Hard usage cap (P1), completion notification (table stakes).
**Avoids:** Non-atomic cap check, wrong email recipient.
**Research flag:** Standard patterns — no research phase needed.

### Phase Ordering Rationale

- Foundation must precede everything: missing `shop` column makes every multi-tenant write unsafe.
- Sync precedes embeddings: you cannot embed products that do not exist in the DB.
- Embeddings precede search: HNSW index must exist before SearchService can query it.
- Search precedes storefront: shipping a drawer that returns no products invalidates the first impression.
- Shared UI extraction precedes storefront build: building the drawer against `components/chat/` directly creates two diverging surfaces.
- Admin Settings (Phase 7) and Hard Cap (Phase 8) can run in parallel with Phase 6 — no blocking dependencies.

### Research Flags

Needs research phase during planning:
- **Phase 3:** pgvector version on target DB; `SET hnsw.iterative_scan` behavior with Prisma Accelerate pooler
- **Phase 6:** Theme CSS z-index across OS 2.0 themes; mobile keyboard/`dvh` Safari support; add-to-cart scope decision

Standard patterns (skip research phase):
- **Phase 1, 2, 4, 5, 7, 8:** Well-documented Shopify, Vercel, Inngest, Resend patterns with official documentation

---

## Existing Code: Keep / Replace / Extract

| Code | Action | Notes |
|------|--------|-------|
| `app/(embedded)/` shell + layouts | **KEEP** | Auth shell works; add `settings/page.tsx` |
| `app/api/auth/` OAuth routes | **KEEP + FIX** | Remove `console.log` statements only |
| `middleware.ts` | **KEEP + FIX** | Uncomment auth checks; fix `config.matcher` |
| `components/chat/` tree | **EXTRACT** to `lib/chat-ui/` | Move to shared barrel; leave thin surface wrappers |
| `components/chat/mock-products.ts` | **DELETE** | Replaced by server-side SearchService |
| `app/api/chat/route.ts` | **REPLACE** | Wire to SearchService; swap `@ai-sdk/google` for AI Gateway |
| `app/api/shopify/sync/route.ts` | **REPLACE** | Enqueue Inngest event; return `runId`; no synchronous work |
| `services/shopify/ShopifyProductService.ts` | **REPLACE** | Implement real GraphQL fetch with cursor pagination |
| `lib/sync/productSync.ts` | **REPLACE** | Move logic into Inngest function steps |
| `lib/db/repositories/ProductRepository.ts` | **REPLACE** | Implement `upsertBatch()` with conditional update on `updated_at_shopify` |
| `app/api/shopify/webhook/route.ts` | **REPLACE** | Add HMAC verification + `X-Shopify-Event-Id` deduplication |
| Prisma schema (`Product`, `ProductEmbedding`) | **EXTEND** | Add `shop`, `updatedAtShopify`, `modelName`, `modelVersion`; add new models |

---

## Open Questions (phase-gated)

| Question | Must resolve before | Notes |
|----------|---------------------|-------|
| Does Prisma Accelerate support `SET hnsw.iterative_scan` at session level? | Phase 3 | Accelerate uses a pooled connection; `SET` may not persist — may need `SET LOCAL` inside a transaction |
| pgvector extension version on target Postgres? | Phase 3 | `hnsw.iterative_scan` requires pgvector >= 0.8.0; confirm before writing the migration |
| Inngest vs `next/server after()` for V1? | Phase 2 | ARCHITECTURE.md recommends `after()` for simplicity; STACK.md recommends Inngest for durability. Recommendation: use Inngest from Phase 2 to avoid retrofitting at >50 shops |
| `@shopify/shopify-api` v13 changelog — breaking changes? | Phase 6 | Lockfile is at 12.3.0; latest is 13.0.0. Audit before upgrading. |
| Add-to-cart in drawer: deep-link to PDP vs Storefront Cart API? | Phase 6 | Cart API requires `unauthenticated_write_checkouts` scope; PDP deep-link is zero-scope-cost fallback for V1 |
| `read_users` scope for `accountOwner.email` on public apps? | Phase 8 | Shopify Community confirms this scope is unavailable on most public apps; use `shop.contactEmail` |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions npm-registry-verified; Inngest, Resend, AI Gateway patterns confirmed via official docs |
| Features | MEDIUM-HIGH | Table stakes from App Store analysis (indirect); UX patterns from official Shopify docs + practitioner sources |
| Architecture | HIGH | Verified against official Shopify, Vercel AI SDK, pgvector docs; patterns cross-referenced across multiple sources |
| Pitfalls | HIGH | Shopify-specific pitfalls from official docs + GitHub issues; pgvector pitfalls from confirmed GitHub issues (#721, #21850) |

**Overall confidence:** HIGH

### Gaps to Address

- **Prisma Accelerate + `SET` session semantics:** The hybrid search query sets `hnsw.ef_search` and `hnsw.iterative_scan` at session level; verify this works with Accelerate's connection pooler before Phase 3 migration.
- **Theme App Extension CSS isolation:** No authoritative source on z-index strategy across all OS 2.0 themes; test against Dawn, Sense, Craft in Phase 6.
- **Inngest free-tier limits:** Verify event/step limits are sufficient for 5k-product sync at V1 scale before committing to Inngest in Phase 2.

---

## Sources

### Primary (HIGH confidence)
- Shopify Dev Docs — App Proxy auth, cookie stripping, HMAC verification, Theme App Extensions
- pgvector GitHub issues #721, #21850 — HNSW index bypass, Prisma drift
- Vercel AI Gateway docs — model catalog, `embedMany`, `getAvailableModels`
- Official Inngest Next.js quick start — step function patterns, App Router setup
- `@shopify/shopify-app-js` Context7 — `validateHmac` with `signator: 'appProxy'`

### Secondary (MEDIUM confidence)
- Rep AI, Boost, Klevu App Store listings — feature table stakes, competitor analysis
- arXiv 2503.04830 — citation grounding A/B test data (3-10% engagement lift)
- Baymard 2025 — no-results UX benchmark (~50% of sites fail)
- TianPan.co embedding versioning guide — alias drift, shadow index migration strategy

---
*Research completed: 2026-05-22*
*Ready for roadmap: yes*
