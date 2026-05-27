# External Integrations

**Analysis Date:** 2026-05-22

## APIs & External Services

**Google Generative AI (Gemini):**
- Service: Google Cloud Generative AI API (gemini-2.5-flash model)
- What it's used for: Streaming AI responses for product search queries in chat interface
- SDK/Client: @ai-sdk/google 3.0.21
- Auth: Environment variable `GOOGLE_GENERATIVE_AI_API_KEY`
- Endpoint: `app/api/chat/route.ts`
- Fallback: Chat endpoint returns static response when API key is missing

**Shopify Admin API:**
- Service: Shopify REST + GraphQL APIs
- What it's used for: OAuth authentication, session management, product syncing, webhook events
- SDK/Client: @shopify/shopify-api 12.3.0
- Auth: Environment variables `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`
- Configuration: `lib/shopify/client.ts` initializes Shopify client with API version January26 (2026-01)
- Scopes: `read_products, write_products` (OAuth scopes defined in `shopify.app.toml`)
- Embedded: App configured as embedded (isEmbeddedApp: true)

## Data Storage

**Databases:**
- PostgreSQL (via provider: "postgresql" in Prisma schema)
  - Connection: Environment variable `DATABASE_URL` (supports Prisma Accelerate)
  - Client: @prisma/client 7.3.0 + @prisma/adapter-pg 7.3.0 (Postgres adapter)
  - Schema location: `prisma/schema.prisma`
  - Migrations location: `prisma/migrations/`
  - Models: Product, ProductVariant, ProductImage, ProductOption, ProductEmbedding, ShopifySession

**Vector/Embeddings:**
- pgvector PostgreSQL extension (used in `ProductEmbedding` model)
- Schema field: `ProductEmbedding.embedding` of type `Unsupported("vector")`
- Implementation: Raw SQL migration required (Prisma doesn't natively support vector type)
- Purpose: Semantic search for product discovery (not yet integrated into chat flow)

**File Storage:**
- Local filesystem only - Product images stored as URLs from Shopify, no local file storage

**Caching:**
- None detected - No Redis, Memcached, or other caching layer

## Authentication & Identity

**Auth Provider:**
- Shopify OAuth 2.0
  - Implementation: Two-tier authentication (offline + online sessions)
    - Offline sessions: App-to-shop authorization (`isOnline: false`, used for product sync)
    - Online sessions: Shop admin user authorization (`isOnline: true`, used for UI interactions)
  - Auth routes:
    - `app/api/auth/route.ts` - Initiates OAuth flow (GET endpoint)
    - `app/api/auth/callback/route.ts` - Handles OAuth callback
    - `app/api/auth/online/route.ts` - Initiates online session flow
  - Session storage: Prisma-backed via @shopify/shopify-app-session-storage-prisma 8.0.1
  - Session model: `ShopifySession` in PostgreSQL (table: `shopify_sessions`)
  - Token validation: Session token decoding in `middleware.ts` and `app/api/shopify/sync/route.ts`

**Session Management:**
- Storage implementation: `lib/shopify/session-storage.ts` - PrismaSessionStorage with table name "shopifySession"
- Client-side token: `Authorization: Bearer <session-token>` header (verified on protected routes)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or similar error tracking configured

**Logs:**
- console logging only - console.log statements in auth flow, middleware, chat route
- No structured logging framework (Winston, Pino, etc.)

## CI/CD & Deployment

**Hosting:**
- Platform: Not explicitly configured, but inferred as Vercel (via Vercel AI SDK usage)
- Alternative: Can deploy to any Node.js host

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI pipeline configuration

**Package Lock:**
- bun.lock present (248KB) - Ensures reproducible dependency versions

## Environment Configuration

**Required env vars:**

| Variable | Purpose | Location Used |
|----------|---------|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key for chat | `app/api/chat/route.ts` |
| `DATABASE_URL` | PostgreSQL connection (Prisma Accelerate URL supported) | `lib/db/client.ts`, `prisma.config.ts`, `prisma/seed.ts` |
| `SHOPIFY_API_KEY` | Shopify Admin API key | `lib/shopify/client.ts` |
| `SHOPIFY_API_SECRET` | Shopify Admin API secret | `lib/shopify/client.ts` |
| `HOST` | App host for Shopify OAuth redirect | `lib/shopify/client.ts` |
| `NEXT_PUBLIC_SHOPIFY_API_KEY` | Public Shopify API key for client-side App Bridge | `app/(embedded)/layout.tsx` |
| `SHOPIFY_APP_HANDLE` | App handle slug (used for post-install redirect) | Inferred from documentation, not yet in code |

**Secrets location:**
- `.env` file (local development)
- Environment variables (production deployment)
- Credentials NOT committed to git (secrets in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- `app/api/shopify/webhook/route.ts` - POST endpoint for Shopify product event webhooks
  - Expected events: products/create, products/update, products/delete (per CLAUDE.md)
  - HMAC verification: Not yet implemented (stub)
  - API version: 2026-04 (from `shopify.app.toml`)

**Outgoing:**
- None detected - App does not make outgoing webhook calls to external services

**OAuth Callbacks:**
- `app/api/auth/callback/route.ts` - Handles Shopify OAuth callback (GET endpoint)
- `app/api/auth/online/callback/route.ts` - Handles online session OAuth callback (inferred location)

## Data Sync

**Product Sync:**
- Endpoint: `app/api/shopify/sync/route.ts` - POST endpoint to manually trigger product sync
- Auth: Bearer token validation (session token)
- Service: `services/shopify/ShopifyProductService.ts` (stub implementation)
- Flow: Shopify REST API → ShopifyProductService → ProductRepository → PostgreSQL
- Status: Not yet wired to chat flow (documented as "TODO" in sync route)

**Mock Data:**
- MOCK_PRODUCTS used for keyword search (in-memory, not persisted)
- Location: Inferred from `components/chat/chat.tsx` per CLAUDE.md

## API Versions

**Shopify:**
- Admin API version: January26 (2026-01) per `lib/shopify/client.ts`
- Webhook API version: 2026-04 per `shopify.app.toml`

**Google Generative AI:**
- Model: gemini-2.5-flash (specified in `app/api/chat/route.ts`)

**Vercel AI SDK:**
- Version: 6.0.77 (ai package) with compatible @ai-sdk packages

---

*Integration audit: 2026-05-22*
