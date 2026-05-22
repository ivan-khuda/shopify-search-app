# SmartDiscovery AI

## What This Is

SmartDiscovery AI is a Shopify-embedded app that adds AI-powered product discovery to any storefront. The app syncs a merchant's catalog into a vector database (pgvector), runs hybrid semantic + full-text search, and surfaces results inside a customer-facing chat drawer injected into the storefront via a Theme App Extension. It's for Shopify merchants who want a "Looking for something specific?" assistant in their store without paying enterprise search vendors.

## Core Value

**A storefront visitor can describe what they want in natural language and immediately see relevant products from the merchant's catalog — synced reliably, embedded into their theme, with no dev work from the merchant.**

If everything else fails, this end-to-end flow (install → sync → ask in drawer → see real products) must work.

## Requirements

### Validated

<!-- Inferred from current codebase (mapped 2026-05-22). These capabilities exist; they may need hardening but the bones are in place. -->

- ✓ Next.js 16 App Router project scaffolded with bun, Tailwind 4, TypeScript strict, Vitest setup — existing
- ✓ Shopify OAuth (begin + callback) via `@shopify/shopify-api` with Prisma-backed session storage — existing (`app/api/auth/`)
- ✓ Embedded admin shell with `s-app-nav` web component, App Bridge bootstrapped via `NEXT_PUBLIC_SHOPIFY_API_KEY` — existing (`app/(embedded)/`)
- ✓ Onboarding page UI with "Start sync" trigger and session-token Bearer auth to `/api/shopify/sync` — existing
- ✓ Embedded admin chat playground UI with tabs (Chat / History / Saved), product cards, prompt input, Vercel AI SDK `useChat`, Gemini fallback — existing (`components/chat/`, `app/api/chat/route.ts`)
- ✓ Prisma schema with `Product`, `ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding` (pgvector), `ShopifySession` — existing (`prisma/schema.prisma`)

### Active

<!-- V1 scope. All hypotheses until shipped. -->

**Sync pipeline**
- [ ] Implement `ShopifyProductService` real GraphQL fetch with pagination (title, description, tags, vendor, product_type, images, variants/price, status)
- [ ] Implement `ProductRepository.upsert` end-to-end (Product + variants + images + options in one transaction)
- [ ] Wire `lib/sync/productSync.ts` as an idempotent batched orchestrator
- [ ] Replace synchronous sync route with background job: POST `/api/shopify/sync` creates `SyncRun` row → worker processes in batches → progress reported via polling/SSE
- [ ] Polling/SSE endpoint `/api/shopify/sync/status` returns `{ state, processedCount, totalCount, errors[] }`
- [ ] Onboarding UI shows real-time progress bar driven by status endpoint
- [ ] Send completion email via Resend (success/failure summary, product counts) to shop owner email pulled from Shopify Shop GraphQL
- [ ] Webhook handler `/api/shopify/webhook` with HMAC verification for `products/create|update|delete` triggering incremental upsert/delete

**Embeddings + Search**
- [ ] Generate text embeddings (title + description + tags + product_type + vendor) via Vercel AI Gateway embedding endpoint, batched
- [ ] Store embeddings in `ProductEmbedding` (pgvector) with cosine index migration
- [ ] Hybrid search query: pgvector cosine top-K ∪ PostgreSQL `tsvector`/`websearch_to_tsquery` BM25-style, then re-rank by weighted score
- [ ] Search service exposed via `/api/storefront/chat` (App Proxy route) and `/api/chat` (embedded admin)
- [ ] Chat answers ground product cards in real DB results — `MOCK_PRODUCTS` removed from runtime path

**Admin: model picker + playground**
- [ ] Settings screen lists available Vercel AI Gateway chat models with description, context window, per-token pricing
- [ ] Merchant selects active model; choice persisted per shop in DB
- [ ] Admin chat playground uses selected model end-to-end
- [ ] Sensible default model pre-selected on first install

**Storefront integration**
- [ ] Theme App Extension package with App Embed block that injects FAB + drawer mount on storefront
- [ ] FAB renders a chat drawer matching design references (Image #1 narrow/mobile, Image #2 side-drawer desktop)
- [ ] Drawer has tabs: Chat (live AI chat), History (past conversations), Saved (bookmarked products)
- [ ] Drawer talks to backend exclusively through Shopify App Proxy (signed HMAC requests)
- [ ] Anonymous visitor identity via signed cookie (visitor_id) with customer-id linking when `window.Shopify.customer` is present (cross-device persistence)
- [ ] Conversation persistence keyed by visitor_id (+ customer_id if linked), pagination in History
- [ ] Saved products: bookmark list per visitor/customer (NOT Shopify wishlist), surfaced in Saved tab

**Shared UI**
- [ ] Extract `components/chat/` into a runtime-neutral package (`lib/chat-ui/` or `packages/chat-ui/`) with no App Bridge / no embedded-only dependencies
- [ ] Both embedded admin and storefront drawer consume the shared package

**Hard cap (pre-billing safety net)**
- [ ] Per-shop request counter with hard monthly cap on chat requests (configurable env), no UI surfacing required in V1 beyond a graceful "limit reached" response

### Out of Scope

- **Billing / monetization (Shopify Billing API, plans, credit ledger)** — deferred to a dedicated later milestone after the discovery + drawer loop is proven. V1 ships free with a hard request cap.
- **Multimodal embeddings (text + image / CLIP)** — text-only embedding is enough for V1 across general verticals; multimodal adds cost and complexity without proven lift for our launch use case.
- **Voice / audio input in chat** — keep input text-only.
- **Bulk operations API for initial sync** — overkill for the 5k SKU target; revisit when we target 50k+ catalogs.
- **Personalization based on purchase history / recommendations engine** — distinct product from "search the catalog by intent."
- **Shopify Plus exclusive features (checkout extensibility, B2B flows)** — V1 is broad-market.
- **Customer wishlist integration / metafield sync for Saved** — Saved is our own bookmark list; we don't compete with installed wishlist apps.
- **Self-hosted / BYO-LLM-key option** — V1 routes everything through Vercel AI Gateway; merchant doesn't bring keys.
- **Multi-language UI / translated drawer** — single English locale for V1.
- **Public app listing optimization / App Store submission** — engineering milestone, not a marketing/listing one.

## Context

**Codebase baseline (mapped 2026-05-22 — see `.planning/codebase/`):**

The repo already contains a working Next.js 16 embedded app shell, OAuth flow, embedded admin chat playground UI (with tabs/history/saved), Prisma schema with pgvector slot, and stubbed Shopify sync + webhook routes. Significant scaffolding to leverage:

- Embedded admin chat UI nearly matches the storefront design references — extracting it as a shared package is realistic, not aspirational
- Prisma schema already declares `ProductEmbedding.embedding Unsupported("vector")` — pgvector migration just needs raw SQL applied
- Onboarding page already pins session-token Bearer auth pattern — the sync route handler does the same; we extend rather than redesign
- `MOCK_PRODUCTS` is the only product source today — the V1 milestone is essentially "make the sync + embedding + search pipeline real and wire it through both surfaces"

**Known concerns to address during V1 (from `CONCERNS.md`):**
- Middleware auth check is currently commented out → must be re-enabled before storefront drawer ships
- `console.log` of session tokens in middleware and auth routes → strip before any public launch
- No HMAC verification on webhook route → blocks webhook-driven incremental sync
- Chat state lives only in React state on page reload → fixed naturally when conversations persist to DB per visitor

**User-facing references:**
- Image #1 (mobile/narrow chat) and Image #2 (storefront side-drawer over collection page) are the two target form factors for the storefront drawer
- The existing admin chat (`components/chat/chat.tsx`) is the visual baseline; the storefront drawer is a re-skin of the same component tree with merchant-themable surface

## Constraints

- **Tech stack**: Locked to Next.js 16 App Router + bun + TypeScript strict + Prisma + PostgreSQL + pgvector + Tailwind 4 + shadcn-style primitives. No framework migrations in V1.
- **Package manager**: bun only — never npm/pnpm/yarn commands.
- **AI provider**: Vercel AI Gateway is the sole runtime entry point for chat completions and embeddings in V1. No direct OpenAI/Anthropic/Google SDKs in shipped code paths.
- **Email provider**: Resend with React Email templates.
- **Catalog scale**: Designed for up to ~5k products per shop. Bulk Operations API and queue infrastructure are explicitly out of scope.
- **Storefront integration**: Theme App Extension (App Embed block) + Shopify App Proxy — no theme-file edits required from merchant, no third-party CDN scripts.
- **Storefront identity**: Anonymous visitor (signed cookie) with optional customer-id upgrade — do not require login.
- **Sync architecture**: Background job + status polling/SSE — never run >60s synchronously in a single Vercel function invocation.
- **Auth**: Shopify session-token Bearer auth on embedded API routes; App Proxy HMAC verification on storefront routes. Re-enable middleware before drawer launch.
- **Hard cap**: Per-shop monthly cap on chat requests enforced server-side until billing ships — protects unit economics during free V1.
- **Security**: No secrets, no session tokens, no auth headers in logs anywhere in the codebase (existing `console.log`s must go).
- **Hosting**: Vercel-first (inferred from AI SDK + AI Gateway choice). Code must remain deployable to standard Node, but optimize for Vercel runtime characteristics.
- **No multi-tenant data leaks**: Every product/embedding/conversation row carries shop scoping; queries always filter by shop.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Theme App Extension + App Proxy for storefront drawer | Standard 2026 Shopify pattern; gives signed same-origin endpoint and zero-touch theme integration | — Pending |
| Vercel AI Gateway as sole AI provider | Hosted on Vercel; unified billing/observability/fallback; AI SDK first-class support | — Pending |
| Defer billing to later milestone | V1 free + hard cap lets us validate the discovery loop before introducing payment friction | — Pending |
| Target ~5k products in V1 | Covers majority of SMB Shopify shops; lets us skip bulk-ops + distributed queue work | — Pending |
| Text-only embeddings + hybrid (vector + tsvector) | Cheaper, simpler, covers brand/SKU edge cases that pure vector misses | — Pending |
| Resend for transactional email | Best DX for Next.js, React Email templates, generous free tier | — Pending |
| FAB trigger for storefront drawer | Works on any OS 2.0 theme without merchant editing Liquid; merchant just toggles the embed block | — Pending |
| Hybrid anonymous + customer-linked identity | Maximum reach (no login wall) with cross-device history when customer is logged in | — Pending |
| Dynamic Vercel AI Gateway model catalog in admin | Lets merchants pick price/quality tradeoff without us re-deploying when models change | — Pending |
| Background job + status polling for sync | Survives Vercel timeouts, tab close, and cold starts | — Pending |
| Shared chat-UI package between admin and storefront | Existing admin chat already mirrors storefront design — duplication would diverge fast | — Pending |
| History = conversations, Saved = our own bookmark list | Avoids collision with installed Shopify wishlist apps; keeps storefront state model simple | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-22 after initialization*
