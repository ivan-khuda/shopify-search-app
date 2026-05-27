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
bun db:indexes               # Apply manual pgvector + GIN indexes (REQUIRED after every `prisma migrate reset` — these indexes live outside Prisma's migration history)
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
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key for embedding calls (required for EmbeddingService.embed and embedMany; sync + webhook re-embedding both fail without it)
- `DIRECT_URL` — Direct Postgres URL (postgresql://...). Required in production when DATABASE_URL is a Prisma Accelerate URL. Used by scripts/apply-manual-indexes.ts. In local dev where DATABASE_URL is already a direct postgres URL, DIRECT_URL is optional (the script falls back to DATABASE_URL).

## Key Design Decisions

- Product results are currently driven by `MOCK_PRODUCTS` (keyword search in client); the Shopify sync and DB-backed search are stubs not yet wired into the chat flow.
- `ProductEmbedding.embedding` uses Postgres `pgvector` (`Unsupported("vector")` in Prisma schema), requiring raw SQL for the migration.
- The `prisma.config.ts` file at root (not `prisma/`) is the Prisma config entry point.
- `ProductEmbedding.modelVersion` is a frozen pinned ID (`openai/text-embedding-3-small`). Future model upgrades require a code-level constant bump AND a backfill migration; never silently change the model.

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
- **Sync architecture**: Background job + status polling/SSE — never run >60s synchronously in a single Vercel function invocation.
- **Auth**: Shopify session-token Bearer auth on embedded API routes; App Proxy HMAC verification on storefront routes. Re-enable middleware before drawer launch.
- **Hard cap**: Per-shop monthly cap on chat requests enforced server-side until billing ships — protects unit economics during free V1.
- **Security**: No secrets, no session tokens, no auth headers in logs anywhere in the codebase (existing `console.log`s must go).
- **Hosting**: Vercel-first (inferred from AI SDK + AI Gateway choice). Code must remain deployable to standard Node, but optimize for Vercel runtime characteristics.
- **No multi-tenant data leaks**: Every product/embedding/conversation row carries shop scoping; queries always filter by shop.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5 - All application code, API routes, components, services
- JavaScript (with JSX/TSX) - React component definitions
- SQL - Prisma migrations and raw SQL for pgvector operations (e.g., `prisma/migrations/`)

## Runtime

- Node.js (runtime inferred from Next.js 16 App Router; specific version not pinned in `.nvmrc`)
- bun - Primary package manager
- Lockfile: `bun.lock` (present; 248KB)

## Frameworks

- Next.js 16.1.6 - Full-stack framework with App Router for routing, SSR, API routes
- React 19.2.3 - UI component library
- React DOM 19.2.3 - DOM rendering
- Vitest 4.1.5 - Test runner (config: `vitest.config.ts`, environment: jsdom)
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- @vitejs/plugin-react 6.0.1 - Vite React plugin for Vitest
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind
- PostCSS - CSS processing (config: `postcss.config.mjs`)
- TypeScript compiler - Type checking and transpilation
- ESLint 9 - Linting with Next.js config

## Key Dependencies

- @prisma/client 7.3.0 - Prisma ORM client for database queries
- @prisma/adapter-pg 7.3.0 - PostgreSQL adapter for Prisma
- prisma 7.3.0 - Prisma CLI for migrations and schema management
- ai 6.0.77 - Vercel AI SDK for streaming AI responses
- @ai-sdk/google 3.0.21 - Google Gemini model integration via AI SDK
- @ai-sdk/react 3.0.75 - React hooks for AI (useChat, useCompletion)
- @shopify/shopify-api 12.3.0 - Shopify Admin API client library
- @shopify/shopify-app-session-storage-prisma 8.0.1 - Prisma session storage for Shopify sessions
- @shopify/app-bridge-types 0.7.0 - TypeScript types for Shopify App Bridge
- @shopify/polaris-types 1.0.7 - TypeScript types for Shopify Polaris design system
- radix-ui 1.4.3 - Headless UI component primitives
- class-variance-authority 0.7.1 - Type-safe CSS class composition
- tailwind-merge 3.4.0 - Merge Tailwind CSS classes without conflicts
- lucide-react 0.563.0 - Icon library (React components)
- motion 12.38.0 - Animation library
- cmdk 1.1.1 - Command palette / menu component
- clsx 2.1.1 - Utility for constructing className strings
- zod 4.3.6 - TypeScript-first schema validation
- dotenv 17.2.4 - Environment variable loader
- streamdown 2.1.0 - Streaming utilities
- nanoid 5.1.6 - URL-friendly unique ID generator
- dedent 1.7.1 - Remove leading whitespace from strings
- tsx 4.21.0 - TypeScript execution (used for Prisma seed script)
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions
- @types/pg 8.16.0 - PostgreSQL client type definitions
- jsdom 29.0.2 - DOM implementation for testing
- typescript 5 - TypeScript compiler

## Configuration

- Variables configured via `.env` file (see INTEGRATIONS.md for required variables)
- dotenv package loads environment on startup
- Prisma Accelerate supported via `DATABASE_URL` containing accelerate connection string
- `next.config.ts` - Next.js configuration with Webpack/Turbopack aliases for Prisma
- `tsconfig.json` - TypeScript configuration (target: ES2017, strict mode enabled, path alias: @/*)
- `vitest.config.ts` - Vitest configuration with jsdom environment
- `eslint.config.mjs` - ESLint configuration extending Next.js core-web-vitals and TypeScript rules
- `postcss.config.mjs` - PostCSS configuration with Tailwind CSS plugin
- `prisma.config.ts` - Prisma configuration pointing to `prisma/schema.prisma` and `prisma/migrations`

## Platform Requirements

- bun (package manager)
- Node.js runtime
- PostgreSQL database (via Prisma Accelerate or direct connection)
- Shopify Partner account with app credentials
- Google Cloud project with Generative AI API enabled (optional - chat endpoint falls back gracefully)
- Deployment target: Vercel (inferred from Next.js + Vercel AI SDK), but deployable to any Node.js host
- PostgreSQL database (managed or self-hosted)
- Environment variables for Shopify API keys, Google API key, database connection

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase (e.g., `ProductCard.tsx`, `ChatMessage.tsx`) in `components/` directory
- Services/classes: PascalCase (e.g., `ShopifyProductService.ts`) in `services/` directory
- Utilities: camelCase (e.g., `productSync.ts`, `utils.ts`) in `lib/` directory
- API routes: lowercase with hyphens (e.g., `/api/auth/route.ts`, `/api/shopify/sync/route.ts`)
- Test files: same name as source with `.test.tsx` or `.spec.ts` suffix (co-located or in `__tests__/` subdirectory)
- Event handlers: `handle` prefix (e.g., `handleStartSync`, `handleToggleSave`, `handleRemove`)
- Custom hooks: `use` prefix (e.g., `usePromptInputAttachments`)
- Utility functions: camelCase (e.g., `cn()` for className merging)
- API route handlers: Named exports as HTTP method (e.g., `export async function GET()`, `export async function POST()`)
- State variables: camelCase (e.g., `selectedTab`, `savedProducts`, `syncing`)
- React component props: camelCase (e.g., `onSave`, `isSaved`, `product`)
- Mock/test data: camelCase (e.g., `mockSession`, `mockProduct`, `mockRedirect`)
- HTML data attributes: kebab-case (e.g., `data-slot`, `data-testid`, `data-state`)
- Interfaces: PascalCase, usually exported (e.g., `interface ProductCardProps`, `interface ChatProduct`)
- Types: PascalCase (e.g., `type PromptInputMessage`)
- Enums: Not observed in codebase
- TypeScript utility types: Uppercase (e.g., `Record<string, string>`, `ReturnType<typeof vi.fn>`)

## Code Style

- No Prettier config file detected; ESLint handles formatting via `eslint-config-next`
- Run `bun lint` to check ESLint compliance
- Default Next.js style: 2-space indentation (observed in practice)
- Tool: ESLint v9 with flat config (`eslint.config.mjs`)
- Config extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/`, `.worktrees/`, `out/`, `build/`, `next-env.d.ts`
- Run: `bun lint`

## Import Organization

- `@/` resolves to project root. Used consistently throughout for:
- Use `import type { ... }` for interfaces/types to enable tree-shaking (observed in `components/chat/chat.tsx`, `types/product.ts`)

## Error Handling

- Return Response with status code and JSON body for errors
- Example from `app/api/shopify/sync/route.ts`:
- Status codes: 400 (invalid input), 401 (auth failure), 500 (server error)
- Wrap async operations in try/catch blocks
- Example from `app/(embedded)/onboarding/page.tsx`:
- Example from `app/api/chat/route.ts`: If `GOOGLE_GENERATIVE_AI_API_KEY` is missing, return a static fallback response instead of erroring
- No error throwing; service degrades gracefully

## Logging

- Development debugging: `console.log()` used throughout (e.g., `middleware.ts`, `onboarding/page.tsx`, `api/auth/route.ts`)
- Seed script uses `console.error()` for error logging in `prisma/seed.ts`
- Debug logs not removed; appear to remain in code for development observation

## Comments

- Minimal use of comments observed
- Comments used for: placeholder instructions (e.g., "// upsert product", "// paginate through Shopify GraphQL API")
- Inline TODO comments when implementation is deferred
- Not used in this codebase; instead, TypeScript types and interfaces document expected shapes
- Example: `ProductCardProps` interface documents all props for `ProductCard` component

## Function Design

- Small functions preferred; most functions 10-30 lines
- Callbacks and event handlers typically 1-5 lines
- Use destructuring for component props: `function ProductCard({ product, isSaved, onSave }: ProductCardProps)`
- Use object parameters for functions with multiple args (e.g., API route handlers receive `request: Request`)
- Event handlers receive typed events: `onClick={(e) => handleClick()}`
- React components: JSX.Element
- API route handlers: `Promise<Response>`
- Event handlers: `void`
- Utility functions: Explicit return types preferred (e.g., `cn()` returns `string`)

## Module Design

- Named exports for components, classes, and utilities
- `export const` for singletons (e.g., `shopifyClient`, `prisma`, `productRepository`, `sessionStorage`)
- `export function` for utilities and handlers
- `export class` for service classes
- `export { ... }` for re-exporting UI component subcomponents (e.g., `export { Button, buttonVariants }` in `components/ui/button.tsx`)
- Minimal use; mostly direct imports from specific files
- UI component files use re-export pattern but not traditional barrel files
- Database client: `export const prisma = new PrismaClient()` in `lib/db/client.ts`
- Repository instance: `export const productRepository = new ProductRepository()` in `lib/db/repositories/ProductRepository.ts`
- Shopify client: `export const shopifyClient = shopifyApi({...})` in `lib/shopify/client.ts`
- Session storage: `export const sessionStorage = new PrismaSessionStorage(...)` in `lib/shopify/session-storage.ts`

## React Patterns

- `useState` for local state (e.g., `selectedTab`, `syncing`, `savedProducts`)
- `useCallback` for memoizing event handlers (e.g., `AttachmentItem` in `components/chat/chat.tsx`)
- `useMemo` for derived state (e.g., `PromptInputAttachmentsDisplay` in `chat.tsx`)
- Custom hooks: `usePromptInputAttachments()` for context-based state access
- `memo()` used for components to prevent unnecessary re-renders (e.g., `AttachmentItem` in `chat.tsx`)
- Display names set for memoized components: `AttachmentItem.displayName = "AttachmentItem"`
- `'use client'` directive at top of files that use hooks or event listeners (e.g., `app/(embedded)/chat/page.tsx`, `components/chat/chat.tsx`)

## TypeScript

- Strict TypeScript enabled (observed from tsconfig defaults)
- Interfaces preferred for component props and data shapes
- Type imports for tree-shaking optimization
- Tests use `expect()` from Vitest (no jest imports)

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **Next.js App Router**: File-based routing, Server/Client Components (marked with 'use client')
- **Shopify Embedded**: Loads Shopify App Bridge and Polaris JS; uses s-* web components for navigation
- **Streaming Chat**: Vercel AI SDK (`useChat` hook) with `streamText` for real-time AI responses
- **Mock Products**: Chat uses `MOCK_PRODUCTS` (client-side keyword search); Shopify sync and DB-backed search are stubs
- **Database-First Design**: Prisma ORM with PostgreSQL, supports pgvector for semantic search
- **Session Management**: Shopify session tokens validated via Bearer auth on protected routes

## Layers

- Purpose: Render embedded Shopify app interface with chat UI, product cards, history/saved tabs
- Location: `app/(embedded)/`, `components/`
- Contains: React components, hooks (useChat), UI primitives, Shopify web components
- Depends on: Vercel AI SDK, @shopify/app-bridge-react (legacy), lucide icons, tailwind/shadcn primitives
- Used by: Web browsers running in Shopify Admin
- Purpose: Handle HTTP requests (auth, chat streaming, product sync), validate sessions
- Location: `app/api/`
- Contains: Route handlers using Next.js Request/Response, middleware
- Depends on: Shopify client, Prisma, Google Gemini API, Session storage
- Used by: Frontend via fetch, external webhooks (future)
- Purpose: Orchestrate business logic (product syncing, Shopify API calls)
- Location: `services/shopify/`, `lib/sync/`
- Contains: Service classes (ShopifyProductService), sync functions
- Depends on: Shopify API, Prisma
- Used by: API routes, background jobs (future)
- Purpose: Encapsulate database queries and mutations
- Location: `lib/db/`, `lib/db/repositories/`
- Contains: Prisma client, repository classes
- Depends on: PostgreSQL, Prisma schema
- Used by: Service layer, API routes
- Purpose: Environment setup, Shopify auth, database connection
- Location: `lib/shopify/`, `middleware.ts`, `prisma.config.ts`
- Contains: Shopify client init, session storage, auth middleware
- Depends on: Environment variables, Shopify Admin API
- Used by: All layers

## Data Flow

### Primary Request Path: Chat Query

### Product Sync Flow

### Authentication Flow

- **UI State**: React useState in page components (Chat page holds history, saved products)
- **Server State**: Prisma-managed PostgreSQL (products, sessions, embeddings)
- **Session State**: ShopifySession table + Shopify API access token in session

## Key Abstractions

- Purpose: Represent multi-part AI responses (text, tools, reasoning) streamed to client
- Examples: `app/api/chat/route.ts` uses Vercel AI SDK `streamText()`, returns `UIMessageStreamResponse`
- Pattern: Server-side streaming via ReadableStream, client-side hydration via `useChat` hook
- Purpose: Encapsulate OAuth session data (access token, shop, user info)
- Examples: `types/shopify.ts`, `prisma/schema.prisma` (ShopifySession model)
- Pattern: Persisted in PostgreSQL, loaded via `@shopify/shopify-api` session storage adapter
- Purpose: Bind product cards to their corresponding assistant message for rendering
- Examples: `components/chat/chat.tsx:77-142` (PendingProductAttachment, attachedProducts)
- Pattern: Track pending products during message send, anchor to first assistant message after send completes
- Purpose: Client-side keyword search until real Shopify sync is wired
- Examples: `components/chat/mock-products.ts`, `components/chat/chat.tsx:87-103`
- Pattern: Split query into words, filter MOCK_PRODUCTS by title/description/tags/category

## Entry Points

- Location: `app/(embedded)/chat/page.tsx` (primary), `app/(embedded)/onboarding/page.tsx`
- Triggers: User navigates to `/chat` or `/onboarding` in embedded app
- Responsibilities: Render tabbed layout, manage product/history state, pass callbacks to Chat component
- Location: `app/api/chat/route.ts`
- Triggers: POST from `useChat` hook in frontend
- Responsibilities: Convert UI messages to model format, stream Gemini response
- Location: `app/api/shopify/sync/route.ts`
- Triggers: POST from onboarding page with Bearer token
- Responsibilities: Validate session, trigger product sync (stub)
- Location: `app/api/auth/route.ts`, `app/api/auth/callback/route.ts`
- Triggers: Shopify OAuth flow
- Responsibilities: Begin OAuth flow, store session on callback
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

### Commented-Out Middleware Logic

### Mock Products in UI Logic

## Error Handling

- **Auth errors:** 401 Unauthorized on missing/invalid Bearer token (sync route)
- **Validation errors:** 400 Bad Request if required params missing (auth route)
- **Graceful degradation:** Chat endpoint returns fallback static response if API key missing instead of 500
- **No explicit error boundary:** React error boundaries not defined; errors bubble to Next.js error handling

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
