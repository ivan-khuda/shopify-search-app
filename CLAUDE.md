# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Start Next.js dev server
bun build        # Production build
bun lint         # ESLint
bun test         # Run all tests (vitest)
```

Run a single test file:
```bash
bunx vitest run components/chat/__tests__/product-card.test.tsx
```

Prisma:
```bash
bunx prisma migrate dev      # Apply migrations
bunx prisma generate         # Regenerate client after schema changes
bunx prisma db seed          # Seed database (runs prisma/seed.ts via tsx)
```

## Architecture

This is a **Next.js 16 App Router** project — a Shopify-embedded AI product search assistant ("SmartDiscovery AI"). The package manager is **bun**.

### AI Chat Layer

- **`app/api/chat/route.ts`** — streaming chat endpoint using Vercel AI SDK (`ai` package) + Google Gemini (`gemini-2.5-flash`). Falls back to a static response when `GOOGLE_GENERATIVE_AI_API_KEY` is missing.
- **`components/chat/chat.tsx`** — main chat component using `useChat` from `@ai-sdk/react`. On each submit it runs a local keyword search against `MOCK_PRODUCTS` and attaches matching products to the next assistant message.
- **`app/chat/page.tsx`** — wraps `Chat` in a tabbed layout (Chat / History / Saved Products), managing state for history and saved products.

### Shopify Integration

- **`lib/shopify/client.ts`** — initializes `@shopify/shopify-api` using env vars; exports `shopifyClient` and `getSessionFromStorage` (reads sessions from Postgres via Prisma).
- **`app/api/shopify/sync/route.ts`** — POST endpoint to manually trigger product sync via Shopify REST client.
- **`app/api/shopify/webhook/route.ts`** — POST endpoint stub for real-time product change webhooks (HMAC verification not yet implemented).
- **`services/shopify/ShopifyProductService.ts`** — service class stub for paginated GraphQL product fetching and mapping.
- **`lib/sync/productSync.ts`** — orchestrates syncing all products by calling `ShopifyProductService`.

### Database

- **Prisma** with PostgreSQL (via `@prisma/adapter-pg`). Client generated to `app/generated/prisma/`.
- **`lib/db/client.ts`** — singleton `PrismaClient`, connects via `DATABASE_URL` (supports Prisma Accelerate).
- **`lib/db/repositories/ProductRepository.ts`** — repository pattern for product DB operations.
- Schema models: `Product`, `ProductVariant`, `ProductImage`, `ProductOption`, `ProductEmbedding` (pgvector for semantic search — migration uses raw SQL), `ShopifySession`.

### Components

- **`components/ai-elements/`** — custom compound prompt input system (`PromptInputProvider`, `PromptInput`, etc.) with attachment support.
- **`components/chat/`** — chat-specific components: `ChatMessage`, `ProductCard`, `HistoryPanel`, `SavedProductsPanel`, `EmptyState`.
- **`components/ui/`** — shadcn/ui-style primitives (Button, Tabs, Dialog, etc.) + motion components.

### Testing

- **Vitest** with jsdom environment and `@testing-library/react`.
- Unit tests in `components/chat/__tests__/`.
- Integration tests in `*.integration-test.tsx` files alongside pages/components.
- Path alias `@/` resolves to the project root.

## Environment Variables

Required in `.env`:
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API key (chat falls back gracefully if absent)
- `DATABASE_URL` — Postgres connection string (Prisma Accelerate URL)
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `HOST` — Shopify app credentials
- `SHOPIFY_APP_HANDLE` — App handle slug from Shopify Partner Dashboard (used to construct the post-install redirect URL)
- `NEXT_PUBLIC_SHOPIFY_API_KEY` — Same value as `SHOPIFY_API_KEY`; exposed to client components for App Bridge initialization

## Key Design Decisions

- Product results are currently driven by `MOCK_PRODUCTS` (keyword search in client); the Shopify sync and DB-backed search are stubs not yet wired into the chat flow.
- `ProductEmbedding.embedding` uses Postgres `pgvector` (`Unsupported("vector")` in Prisma schema), requiring raw SQL for the migration.
- The `prisma.config.ts` file at root (not `prisma/`) is the Prisma config entry point.
