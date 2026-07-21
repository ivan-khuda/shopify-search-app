# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Start Next.js dev server
bun run build    # Production build (prebuild compiles the storefront bundle first; bare `bun build` invokes bun's native bundler, not Next)
bun lint         # ESLint
bun run test     # Run all tests (vitest) — bare `bun test` runs bun's native test runner and fails
```

Run a single test file:

```bash
bunx vitest run extensions-src/chat-drawer/__tests__/fab.test.tsx
```

Prisma:

```bash
bunx prisma migrate dev      # Apply migrations
bunx prisma generate         # Regenerate client after schema changes
bunx prisma db seed          # Seed database (runs prisma/seed.ts via tsx)
bun db:indexes               # Apply manual pgvector HNSW + GIN indexes (REQUIRED after every `prisma migrate reset` — these live in db/manual-indexes.sql, outside Prisma's migration history)
bun db:studio                # Prisma Studio
```

Other:

```bash
bun run build:storefront-bundle    # Compile extensions-src/chat-drawer → public/storefront-bundle-*.js (also runs automatically as prebuild)
bun script:cleanup-conversations   # Manual conversation retention sweep
INNGEST_DEV=1 bunx inngest-cli@latest dev   # Local Inngest dev server (required for sync jobs locally)
```

## Architecture

**Next.js 16 App Router** project — "SmartDiscovery AI", a Shopify-embedded AI product search assistant. Package manager is **bun**. Two user-facing surfaces share one chat engine:

1. **Embedded admin app** (Shopify admin iframe): onboarding, settings, chat playground.
2. **Storefront chat drawer** (Theme App Extension + App Proxy): customer-facing search assistant.

### Surfaces & routing

- `app/page.tsx` — public marketing landing (`components/landing/`, pixel-faithful to `docs/design/landing/`, tokens in `components/landing/landing.css`).
- `app/install/` — shop-domain form that starts OAuth.
- `app/(embedded)/` — admin pages: `chat/`, `onboarding/`, `settings/`; `EmbeddedProviders.tsx` initializes App Bridge (`NEXT_PUBLIC_SHOPIFY_API_KEY`).
- `proxy.ts` (repo root) — Next.js 16's rename of `middleware.ts`. Session gate on `/onboarding`, `/chat`, `/settings`: loads the offline session for `?shop=`, redirects to `/api/auth` if missing.
- `app/prototype/` — static design-reference screens, not production.

### AI chat layer

- `app/api/chat/route.ts` — admin chat. Tool-call-only wiring (D-04): the LLM decides when to invoke the single `searchCatalog` tool (`{ query, priceMin?, priceMax? }`, Zod-validated). Model is the plain string `google/gemini-2.5-flash` routed through **Vercel AI Gateway** via `AI_GATEWAY_API_KEY` (D-10) — no direct provider SDK imports in shipped code paths. The authenticated `shop` is captured in the tool's execute closure; the LLM cannot override it.
- `app/api/proxy/chat/route.ts` — storefront chat. Per-request chain: App Proxy HMAC → visitor signature → in-memory rate limit (`lib/rate-limit/memory.ts`) → monthly cap (`services/chat/CapService.ts`, `HARD_CAP_REQUESTS_PER_MONTH`) → streaming chat → conversation persisted.
- `services/search/SearchService.ts` — `hybridSearch(shop, query, opts)`: pgvector cosine (`<=>`) + `websearch_to_tsquery`, fused by Reciprocal Rank Fusion (RRF_K=60, BRANCH_LIMIT=50, RESULT_LIMIT=10). Query text only ever passes through Prisma tagged-template binding.
- `services/embeddings/EmbeddingService.ts` — embeddings via AI Gateway; model pinned to `openai/text-embedding-3-small`.
- `lib/chat-ui/` — shared headless chat engine: `use-chat-controller.ts`; adapters `embedded.ts` (Bearer → /api/chat) and `storefront.ts` (App Proxy → /api/proxy/chat); stores `local-storage.ts` (admin) and `db-backed.ts` (storefront); presentation components.

### Shopify integration

- `lib/shopify/client.ts` — `@shopify/shopify-api` init; `lib/shopify/session-storage.ts` — Prisma session storage.
- OAuth: `app/api/auth/` + `callback/` (offline), `app/api/auth/online/` + `callback/` (per-user). Post-install redirect uses `SHOPIFY_APP_HANDLE`.
- `lib/shopify/auth.ts` — `withShopifySession` Bearer session-token validation for embedded API routes; `lib/shopify/app-proxy-auth.ts` — App Proxy HMAC + visitor-token verification for `/api/proxy/*`.
- Sync: `app/api/shopify/sync/route.ts` creates a `SyncRun` and fires Inngest event `shopify/product.sync`; `sync/status/` is polled by the UI. `inngest/functions/sync-products.ts` runs the durable job (fetch via `services/shopify/ShopifyProductService.ts` cursor-paginated GraphQL → embed → upsert), sends Resend result emails (`services/email/EmailService.ts`, templates in `lib/email/templates/`). Never runs >60s synchronously in one Vercel invocation.
- Webhooks: `app/api/shopify/webhook/route.ts` — HMAC-verified (`SHOPIFY_WEBHOOK_SECRET`) product create/update/delete; `services/shopify/ShopifyWebhookService.ts` re-embeds changed products; `WebhookEvent` model dedupes.
- Retention: `inngest/functions/retention-sweep.ts` — cron `0 3 * * 0`, bounded at 100 batches.

### Storefront drawer (Theme App Extension)

- `extensions/chat-drawer/blocks/app_embed.liquid` — App Embed loader: fetches `/api/proxy/meta/bundle-url` + `/meta/appearance`, honors the settings kill-switch and theme-editor visibility, restyles the FAB per merchant settings, then mounts the drawer.
- `extensions-src/chat-drawer/` — drawer React source (shell, FAB variants, chat/history/saved panes), compiled by `scripts/build-storefront-bundle.ts` into `public/storefront-bundle-*.js` + manifest. The bundle is self-contained: compiled Tailwind inside, no `next/image`, no third-party CDN scripts.
- Visitor identity: signed visitor token (`lib/identity/visitor-signature.ts`), bootstrap via `/api/proxy/meta/visitor`, anonymous-to-customer merge in `lib/identity/merge.ts` (`VisitorCustomerLink`).

### Database

- Prisma 7 + PostgreSQL via `@prisma/adapter-pg`; client generated to `app/generated/prisma/`; singleton in `lib/db/client.ts` (supports Accelerate URLs).
- Models: `Product`, `ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding` (pgvector `Unsupported("vector")`, raw-SQL migration), `ShopifySession`, `SyncRun`, `WebhookEvent`, `Conversation`, `SavedProduct`, `VisitorCustomerLink`, `ShopSettings`, `RequestCounter`.
- Repositories in `lib/db/repositories/`: `ProductRepository`, `RequestCounterRepository`, `ShopSettingsRepository`. Every tenant-scoped row carries `shop`; queries always filter by shop.
- `prisma.config.ts` at repo root (not `prisma/`) is the Prisma config entry point.

### Settings

- `/api/settings/{appearance,model,shop,usage}` (Bearer-authed) ↔ `ShopSettings` via `ShopSettingsRepository`; contract in `lib/settings/contract.ts`.
- Appearance flows: Settings UI → ShopSettings → `/api/proxy/meta/appearance` → `lib/chat-ui/appearance.ts` CSS mapping → drawer theming (FAB style, drawer position, colors, greeting).
- Model selection: `services/chat/model-catalog.ts` + `getActiveChatModel.ts`; import defaults from `services/chat/default-model-id.ts` in client components (client-safe module).

### Testing

- Vitest 4 + jsdom + Testing Library. Path alias `@/` → project root.
- Component tests: `extensions-src/chat-drawer/__tests__/` (one file per drawer component), `lib/chat-ui` tests.
- Structural guards in `__tests__/`: app-embed schema, bundle build, extension structure, shopify.toml, proxy, merge-integration (needs `INTEGRATION_DB_URL`).

## Environment Variables

Required in `.env` (all verified in code):

- `DATABASE_URL` — Postgres connection string (direct or Prisma Accelerate)
- `DIRECT_URL` — direct Postgres URL; required in production when `DATABASE_URL` is an Accelerate URL (used by `scripts/apply-manual-indexes.ts`; falls back to `DATABASE_URL` locally)
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `HOST` — Shopify app credentials
- `SHOPIFY_APP_HANDLE` — app handle slug for the post-install redirect
- `NEXT_PUBLIC_SHOPIFY_API_KEY` — same as `SHOPIFY_API_KEY`, exposed for App Bridge
- `SHOPIFY_WEBHOOK_SECRET` — webhook HMAC verification
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key; chat completions AND embeddings both fail without it
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` — sync notification emails
- `HARD_CAP_REQUESTS_PER_MONTH` — per-shop monthly chat cap
- `INNGEST_DEV` — set to `1` locally so the SDK targets `bunx inngest-cli@latest dev`; leave unset in production
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — production-only, auto-set by the Vercel ↔ Inngest integration
- `INTEGRATION_DB_URL` — test-only, for the merge integration test

There is no `GOOGLE_GENERATIVE_AI_API_KEY` — all model traffic goes through AI Gateway.

## Key Design Decisions & Gotchas

- **AI Gateway only** (D-10): no direct OpenAI/Anthropic/Google SDK calls in shipped code paths; models addressed as plain strings.
- **`ProductEmbedding.modelVersion` is frozen** (`openai/text-embedding-3-small`). Upgrading requires a code-constant bump AND a backfill migration — never silently change the model.
- **Manual indexes live outside Prisma**: rerun `bun db:indexes` after every `prisma migrate reset`.
- **`proxy.ts` is the middleware** — Next.js 16 renamed `middleware.ts`; don't create a `middleware.ts`.
- **Underscore route folders never route** in Next.js (`_meta` had to become `meta`).
- **bun traps**: `bun build` ≠ `bun run build`; `bun test` ≠ `bun run test`.
- **No secrets in logs**: never log session tokens, HMAC signatures, API keys, raw queries, or recipient addresses.
- **Multi-tenancy**: `shop` always comes from verified auth (session token or HMAC), never from client input; every query filters by shop.
- Density setting on the admin chat is playground-only; it does not affect the storefront drawer.

## Conventions

- Components/services/classes PascalCase; utilities camelCase; event handlers `handle*`; hooks `use*`.
- Named exports; `export const` singletons (`prisma`, `shopifyClient`, `productRepository`, `sessionStorage`).
- `import type { ... }` for type-only imports. Strict TypeScript.
- Errors: routes return `Response` with 400/401/500 + JSON body; services degrade gracefully rather than throw where a fallback exists.

<!-- GSD:project-start source:PROJECT.md -->

## Project

**SmartDiscovery AI**

SmartDiscovery AI is a Shopify-embedded app that adds AI-powered product discovery to any storefront. The app syncs a merchant's catalog into a vector database (pgvector), runs hybrid semantic + full-text search, and surfaces results inside a customer-facing chat drawer injected into the storefront via a Theme App Extension. It's for Shopify merchants who want a "Looking for something specific?" assistant in their store without paying enterprise search vendors.

**Core Value:** **A storefront visitor can describe what they want in natural language and immediately see relevant products from the merchant's catalog — synced reliably, embedded into their theme, with no dev work from the merchant.**

If everything else fails, this end-to-end flow (install → sync → ask in drawer → see real products) must work.

### Constraints

- **Tech stack**: Locked to Next.js 16 App Router + bun + TypeScript strict + Prisma + PostgreSQL + pgvector + Tailwind 4 + shadcn-style primitives. No framework migrations in V1.
- **Package manager**: bun only — never npm/pnpm/yarn commands.
- **AI provider**: Vercel AI Gateway is the sole runtime entry point for chat completions and embeddings in V1. No direct OpenAI/Anthropic/Google SDKs in shipped code paths.
- **Email provider**: Resend with React Email templates.
- **Catalog scale**: Designed for up to ~5k products per shop. Bulk Operations API and queue infrastructure are explicitly out of scope.
- **Storefront integration**: Theme App Extension (App Embed block) + Shopify App Proxy — no theme-file edits required from merchant, no third-party CDN scripts.
- **Storefront identity**: Anonymous visitor (signed cookie) with optional customer-id upgrade — do not require login.
- **Sync architecture**: Background job + status polling — never run >60s synchronously in a single Vercel function invocation.
- **Auth**: Shopify session-token Bearer auth on embedded API routes; App Proxy HMAC verification on storefront routes; `proxy.ts` session gate live on embedded pages.
- **Hard cap**: Per-shop monthly cap on chat requests enforced server-side until billing ships — protects unit economics during free V1.
- **Security**: No secrets, no session tokens, no auth headers in logs anywhere in the codebase.
- **Hosting**: Vercel-first. Code must remain deployable to standard Node, but optimize for Vercel runtime characteristics.
- **No multi-tenant data leaks**: Every product/embedding/conversation row carries shop scoping; queries always filter by shop.

<!-- GSD:project-end -->

## Workflow: Superpowers

This project uses the superpowers plugin workflow (GSD was retired 2026-06-10; its planning history is archived at `docs/archive/planning/`).

- Creative/feature work starts with `superpowers:brainstorming`, then `superpowers:writing-plans`.
- Implementation plans live in `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`.
- Execute plans with `superpowers:subagent-driven-development` (preferred) or `superpowers:executing-plans`.
- Bugs go through `superpowers:systematic-debugging`; features/bugfixes follow `superpowers:test-driven-development`.
- Verify before claiming done (`superpowers:verification-before-completion`); request review before merging (`superpowers:requesting-code-review`).

## Project Management

Tasks tracked on Trello board **"Shopify search App"** (`6982273d4679a5a7fced0442`), lists: Backlog → Todo → In Progress → Blocked → Done → Archived.
