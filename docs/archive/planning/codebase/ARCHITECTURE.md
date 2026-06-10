<!-- refreshed: 2026-05-22 -->
# Architecture

**Analysis Date:** 2026-05-22

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Embedded Frontend Layer                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Chat Page / Onboarding Page      `app/(embedded)/chat/`      │  │
│  │ `app/(embedded)/onboarding/`                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Chat Component, UI Components    `components/chat/`          │  │
│  │ AI Elements, Prompt Input        `components/ai-elements/`   │  │
│  │                                  `components/ui/`             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API & Service Layer                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Chat Endpoint          `app/api/chat/route.ts`               │  │
│  │ Auth Endpoints         `app/api/auth/route.ts`               │  │
│  │ Shopify Sync/Webhook   `app/api/shopify/`                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Shopify Client         `lib/shopify/client.ts`               │  │
│  │ Shopify Service        `services/shopify/ShopifyProductService` │
│  │ Sync Orchestrator      `lib/sync/productSync.ts`             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Data Access Layer                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Prisma Client          `lib/db/client.ts`                    │  │
│  │ Product Repository     `lib/db/repositories/ProductRepository` │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                               │
│  Products, Variants, Images, Options, Embeddings, Sessions          │
└─────────────────────────────────────────────────────────────────────┘

External Integrations:
┌─────────────────────────────────────────────────────────────────────┐
│ Shopify API (@shopify/shopify-api)                                  │
│ Google Gemini (AI SDK + @ai-sdk/google)                             │
│ Vercel AI SDK (ai package - UI message streaming)                   │
│ Shopify App Bridge (s-* web components)                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Chat Page | Tabbed layout (Chat/History/Saved), state management for products and history | `app/(embedded)/chat/page.tsx` |
| Chat Component | User input, keyword search against mock products, message rendering | `components/chat/chat.tsx` |
| ChatMessage | Display assistant/user messages with streamed text | `components/chat/chat-message.tsx` |
| ProductCard | Display individual product with save button | `components/chat/product-card.tsx` |
| PromptInput | Custom multi-part input system with file attachment support | `components/ai-elements/prompt-input.tsx` |
| Auth Routes | Shopify OAuth begin/callback flow | `app/api/auth/route.ts`, `app/api/auth/callback/route.ts` |
| Chat API | Stream AI responses using Google Gemini via Vercel AI SDK | `app/api/chat/route.ts` |
| Sync Route | Validate session token and trigger product sync | `app/api/shopify/sync/route.ts` |
| Shopify Client | Initialize @shopify/shopify-api with session storage | `lib/shopify/client.ts` |
| Prisma Client | Database connection with Accelerate support | `lib/db/client.ts` |
| Product Repository | Database operations for products (stub implementation) | `lib/db/repositories/ProductRepository.ts` |

## Pattern Overview

**Overall:** Next.js 16 App Router with **embedded Shopify frontend** communicating via **API routes** to a **PostgreSQL backend** with **optional AI search layer**.

**Key Characteristics:**
- **Next.js App Router**: File-based routing, Server/Client Components (marked with 'use client')
- **Shopify Embedded**: Loads Shopify App Bridge and Polaris JS; uses s-* web components for navigation
- **Streaming Chat**: Vercel AI SDK (`useChat` hook) with `streamText` for real-time AI responses
- **Mock Products**: Chat uses `MOCK_PRODUCTS` (client-side keyword search); Shopify sync and DB-backed search are stubs
- **Database-First Design**: Prisma ORM with PostgreSQL, supports pgvector for semantic search
- **Session Management**: Shopify session tokens validated via Bearer auth on protected routes

## Layers

**Frontend / UI Layer:**
- Purpose: Render embedded Shopify app interface with chat UI, product cards, history/saved tabs
- Location: `app/(embedded)/`, `components/`
- Contains: React components, hooks (useChat), UI primitives, Shopify web components
- Depends on: Vercel AI SDK, @shopify/app-bridge-react (legacy), lucide icons, tailwind/shadcn primitives
- Used by: Web browsers running in Shopify Admin

**API / Route Handler Layer:**
- Purpose: Handle HTTP requests (auth, chat streaming, product sync), validate sessions
- Location: `app/api/`
- Contains: Route handlers using Next.js Request/Response, middleware
- Depends on: Shopify client, Prisma, Google Gemini API, Session storage
- Used by: Frontend via fetch, external webhooks (future)

**Service Layer:**
- Purpose: Orchestrate business logic (product syncing, Shopify API calls)
- Location: `services/shopify/`, `lib/sync/`
- Contains: Service classes (ShopifyProductService), sync functions
- Depends on: Shopify API, Prisma
- Used by: API routes, background jobs (future)

**Data Access Layer:**
- Purpose: Encapsulate database queries and mutations
- Location: `lib/db/`, `lib/db/repositories/`
- Contains: Prisma client, repository classes
- Depends on: PostgreSQL, Prisma schema
- Used by: Service layer, API routes

**Configuration/Infrastructure:**
- Purpose: Environment setup, Shopify auth, database connection
- Location: `lib/shopify/`, `middleware.ts`, `prisma.config.ts`
- Contains: Shopify client init, session storage, auth middleware
- Depends on: Environment variables, Shopify Admin API
- Used by: All layers

## Data Flow

### Primary Request Path: Chat Query

1. **User Input** (`components/chat/chat.tsx:144-169`)
   - User submits message via PromptInput
   - `handleSubmit` extracts query text, runs `buildMockResults()` against `MOCK_PRODUCTS` (client-side)
   - Sets pending product attachment state with matched products

2. **Chat Submission** (`components/chat/chat.tsx:168`)
   - `sendMessage({ text: query })` from `useChat` hook
   - Hooks sends POST to `/api/chat` with `UIMessage[]`

3. **Stream Processing** (`app/api/chat/route.ts:31-55`)
   - Receives message array, converts to model messages
   - Calls `streamText()` with Google Gemini model
   - Returns streaming response via `createUIMessageStreamResponse()`
   - Falls back to static response if `GOOGLE_GENERATIVE_AI_API_KEY` missing

4. **Message Rendering** (`components/chat/chat.tsx:183-205`)
   - `useChat` updates messages state as stream arrives
   - `ChatMessage` component renders each message with role-based styling
   - `ProductCard` components render below assistant message if attached

5. **Product Attachment** (`components/chat/chat.tsx:112-142`)
   - `attachedProducts` state binds products to corresponding assistant message ID
   - On re-render, products display in grid below their anchor message

### Product Sync Flow

1. **Onboarding Trigger** (`app/(embedded)/onboarding/page.tsx:8-31`)
   - User clicks "Start sync" button
   - Calls `shopify.idToken()` to get session token (Shopify App Bridge)
   - POSTs to `/api/shopify/sync` with `Authorization: Bearer <token>`

2. **Token Validation** (`app/api/shopify/sync/route.ts:5-41`)
   - Validates Bearer token via `shopifyClient.session.decodeSessionToken(token)`
   - Extracts shop hostname from token payload
   - Loads offline session from storage
   - Returns 401 if any validation fails

3. **Product Sync** (`app/api/shopify/sync/route.ts:42-44`)
   - TODO: Currently returns success without syncing
   - Future: calls `ShopifyProductService.fetchAllProducts()` → maps → stores in DB

### Authentication Flow

1. **Begin Auth** (`app/api/auth/route.ts:14-19`)
   - GET request with `?shop=<hostname>`
   - Calls `shopifyClient.auth.begin()` with `/api/auth/callback` as callback URL
   - Redirects to Shopify consent screen

2. **Callback** (`app/api/auth/callback/route.ts`)
   - Handles OAuth callback from Shopify
   - Stores session in PostgreSQL via Prisma + session storage adapter

3. **Session Storage** (`lib/shopify/session-storage.ts`)
   - Uses Prisma to persist/load `ShopifySession` model
   - Adapter passed to `shopifyApi()` config

**State Management:**
- **UI State**: React useState in page components (Chat page holds history, saved products)
- **Server State**: Prisma-managed PostgreSQL (products, sessions, embeddings)
- **Session State**: ShopifySession table + Shopify API access token in session

## Key Abstractions

**UIMessage Stream:**
- Purpose: Represent multi-part AI responses (text, tools, reasoning) streamed to client
- Examples: `app/api/chat/route.ts` uses Vercel AI SDK `streamText()`, returns `UIMessageStreamResponse`
- Pattern: Server-side streaming via ReadableStream, client-side hydration via `useChat` hook

**Shopify Session:**
- Purpose: Encapsulate OAuth session data (access token, shop, user info)
- Examples: `types/shopify.ts`, `prisma/schema.prisma` (ShopifySession model)
- Pattern: Persisted in PostgreSQL, loaded via `@shopify/shopify-api` session storage adapter

**Product Attachment State:**
- Purpose: Bind product cards to their corresponding assistant message for rendering
- Examples: `components/chat/chat.tsx:77-142` (PendingProductAttachment, attachedProducts)
- Pattern: Track pending products during message send, anchor to first assistant message after send completes

**Mock Product Search:**
- Purpose: Client-side keyword search until real Shopify sync is wired
- Examples: `components/chat/mock-products.ts`, `components/chat/chat.tsx:87-103`
- Pattern: Split query into words, filter MOCK_PRODUCTS by title/description/tags/category

## Entry Points

**Web Entry:**
- Location: `app/(embedded)/chat/page.tsx` (primary), `app/(embedded)/onboarding/page.tsx`
- Triggers: User navigates to `/chat` or `/onboarding` in embedded app
- Responsibilities: Render tabbed layout, manage product/history state, pass callbacks to Chat component

**API Entry (Chat):**
- Location: `app/api/chat/route.ts`
- Triggers: POST from `useChat` hook in frontend
- Responsibilities: Convert UI messages to model format, stream Gemini response

**API Entry (Sync):**
- Location: `app/api/shopify/sync/route.ts`
- Triggers: POST from onboarding page with Bearer token
- Responsibilities: Validate session, trigger product sync (stub)

**Auth Entry:**
- Location: `app/api/auth/route.ts`, `app/api/auth/callback/route.ts`
- Triggers: Shopify OAuth flow
- Responsibilities: Begin OAuth flow, store session on callback

**Middleware:**
- Location: `middleware.ts`
- Triggers: On every request
- Responsibilities: Decode session token from Bearer header or shop query param, set shop context (currently commented out)

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop (async/await). Vercel AI SDK uses server-side streaming without explicit worker threads.
- **Global state:** `prisma` singleton in `lib/db/client.ts` (PrismaClient), `shopifyClient` singleton in `lib/shopify/client.ts`. Shopify session storage uses Prisma queries.
- **Circular imports:** None detected. Layers strictly separate (UI → API → Service → Data).
- **Session Management:** Shopify session tokens must match shop hostname; offline sessions required for sync endpoint. Bearer auth validated on each protected route.
- **AI Fallback:** Chat endpoint gracefully falls back to static response if `GOOGLE_GENERATIVE_AI_API_KEY` missing.
- **Mock Data Dependency:** Chat UI depends on `MOCK_PRODUCTS` until Shopify sync wired; real product DB queries not yet integrated.

## Anti-Patterns

### Incomplete Service Implementation

**What happens:** `ShopifyProductService.fetchAllProducts()` and `ShopifyProductService.mapToLocalProduct()` in `services/shopify/ShopifyProductService.ts` are stubs that return empty arrays / void.

**Why it's wrong:** Product sync endpoint (`app/api/shopify/sync/route.ts`) has a TODO comment and doesn't actually fetch or store products. Chat UI uses `MOCK_PRODUCTS` instead of DB-backed search.

**Do this instead:** Complete the implementation in `services/shopify/ShopifyProductService.ts` by calling Shopify GraphQL API, then wire `lib/sync/productSync.ts` to call `ShopifyProductService` and persist via `ProductRepository`. Update `components/chat/chat.tsx` to query products from `/api/chat` (attach to AI response) instead of client-side mock search.

### Commented-Out Middleware Logic

**What happens:** `middleware.ts` has entire auth checks commented out (lines 22-32). Session validation is bypassed for all routes.

**Why it's wrong:** Currently no protection on `/chat` or `/onboarding` routes. Any request can proceed. Sync endpoint validates token but middleware doesn't.

**Do this instead:** Uncomment middleware logic once sessions are guaranteed to exist on install. Add matcher config to protect only embedded routes (`/chat`, `/onboarding`). Ensure offline session is loaded before allowing request to proceed.

### Mock Products in UI Logic

**What happens:** `buildMockResults()` in `components/chat/chat.tsx:87-103` filters `MOCK_PRODUCTS` client-side on every chat message. No real product search.

**Why it's wrong:** Search doesn't scale with real catalog. Product database is unused. No semantic/vector search even though schema supports pgvector.

**Do this instead:** Move product search to API endpoint (`POST /api/search` or attach to `/api/chat`). Accept query text, return matching products from DB via semantic embedding query. Update chat component to use API results instead of mock filter.

## Error Handling

**Strategy:** Route handlers return `NextResponse.json({ error: ... }, { status: ... })` for API errors. Frontend shows toast messages via `shopify.toast.show()`. Client-side errors logged to console.

**Patterns:**
- **Auth errors:** 401 Unauthorized on missing/invalid Bearer token (sync route)
- **Validation errors:** 400 Bad Request if required params missing (auth route)
- **Graceful degradation:** Chat endpoint returns fallback static response if API key missing instead of 500
- **No explicit error boundary:** React error boundaries not defined; errors bubble to Next.js error handling

## Cross-Cutting Concerns

**Logging:** Console.log used throughout (auth routes, middleware, sync). No structured logger.

**Validation:** Manual validation in route handlers (Bearer token format, shop hostname format). No schema validation library (zod, joi).

**Authentication:** Session token Bearer auth on `/api/shopify/sync`. OAuth session storage via Prisma adapter. Middleware partially validates (commented out).

---

*Architecture analysis: 2026-05-22*
