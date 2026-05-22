# Codebase Structure

**Analysis Date:** 2026-05-22

## Directory Layout

```
shopify-search-app/
├── app/                          # Next.js App Router (root layout + routes)
│   ├── (embedded)/               # Shopify-embedded app pages
│   │   ├── __tests__/            # Tests for embedded layout
│   │   ├── layout.tsx            # Embedded layout (loads scripts, providers)
│   │   ├── EmbeddedProviders.tsx # Context providers + Shopify nav
│   │   ├── chat/
│   │   │   └── page.tsx          # Chat tabbed interface
│   │   └── onboarding/
│   │       └── page.tsx          # Onboarding page (sync trigger)
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   ├── __tests__/        # Auth tests
│   │   │   ├── route.ts          # OAuth begin
│   │   │   ├── callback/
│   │   │   │   └── route.ts      # OAuth callback
│   │   │   └── online/           # Online token endpoints (stubs)
│   │   ├── chat/
│   │   │   └── route.ts          # AI chat streaming endpoint
│   │   └── shopify/
│   │       ├── sync/
│   │       │   ├── __tests__/    # Sync tests
│   │       │   └── route.ts      # Product sync trigger
│   │       └── webhook/
│   │           └── route.ts      # Product change webhooks (stub)
│   ├── generated/                # Prisma-generated artifacts
│   │   └── prisma/               # Generated Prisma client
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Root page (template)
│   └── globals.css               # Global styles
├── components/                   # Reusable React components
│   ├── ai-elements/              # Custom AI input components
│   │   ├── prompt-input.tsx      # Multi-part input system
│   │   ├── attachments.tsx       # File attachment UI
│   │   ├── response.tsx          # Response display
│   │   └── reasoning.tsx         # Reasoning/thinking display
│   ├── chat/                     # Chat-specific components
│   │   ├── __tests__/            # Component tests
│   │   │   ├── product-card.test.tsx
│   │   │   ├── saved-products-panel.test.tsx
│   │   │   └── history-panel.test.tsx
│   │   ├── chat.tsx              # Main chat component
│   │   ├── chat.integration-test.tsx
│   │   ├── chat-message.tsx      # Message display
│   │   ├── message-parts.tsx     # Render message parts (text, etc)
│   │   ├── product-card.tsx      # Single product card
│   │   ├── history-panel.tsx     # Search history tab
│   │   ├── saved-products-panel.tsx # Saved products tab
│   │   ├── empty-state.tsx       # Empty state UI
│   │   └── mock-products.ts      # Mock product data (dev)
│   └── ui/                       # Shadcn-style primitives
│       ├── button.tsx
│       ├── tabs.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── hover-card.tsx
│       ├── tooltip.tsx
│       ├── input.tsx
│       ├── input-group.tsx
│       ├── textarea.tsx
│       ├── select.tsx
│       ├── command.tsx
│       ├── spinner.tsx
│       ├── motion-highlight.tsx
│       └── text-shimmer.tsx
├── lib/                          # Utility and business logic
│   ├── db/
│   │   ├── client.ts             # Prisma client singleton
│   │   └── repositories/
│   │       └── ProductRepository.ts # Product DB operations
│   ├── shopify/
│   │   ├── client.ts             # Shopify API client init
│   │   └── session-storage.ts    # Session persistence (Prisma)
│   ├── sync/
│   │   └── productSync.ts        # Product sync orchestrator (stub)
│   ├── utils.ts                  # Shared utilities (cn, etc)
│   └── prisma-npm-reexport.ts    # Prisma re-export
├── services/
│   └── shopify/
│       └── ShopifyProductService.ts # Shopify API service (stubs)
├── types/                        # TypeScript type definitions
│   ├── product.ts                # Chat/Product types
│   ├── shopify.ts                # Shopify domain types
│   └── shopify-global.d.ts       # Shopify window object types
├── prisma/
│   ├── schema.prisma             # Prisma schema (models, DB config)
│   ├── seed.ts                   # Database seeding
│   └── migrations/               # Prisma migrations
│       ├── 20260207111413_init/
│       ├── 20260216181046_add_shop_table/
│       └── 20260502011528_update_shopify_session_schema/
├── __tests__/                    # Top-level tests
│   └── middleware.test.ts        # Middleware tests
├── public/                       # Static assets
│   ├── next.svg
│   └── vercel.svg
├── docs/                         # Documentation
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── middleware.ts                 # Next.js middleware (auth validation)
├── next.config.ts                # Next.js configuration
├── vitest.config.ts              # Vitest test runner config
├── vitest.setup.ts               # Vitest setup
├── prisma.config.ts              # Prisma config (non-standard location)
├── CLAUDE.md                     # Developer guidance
├── package.json                  # Dependencies
├── bun.lock                       # Bun lockfile
├── tsconfig.json                 # TypeScript config
└── README.md
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router routes and pages
- Contains: Page components, API handlers, layouts, generated Prisma client
- Key files: `app/(embedded)/chat/page.tsx` (main UI), `app/api/chat/route.ts` (AI streaming), `app/api/auth/route.ts` (OAuth)

**`app/(embedded)/`:**
- Purpose: Shopify-embedded app pages (isolated layout, loads App Bridge)
- Contains: Chat and onboarding pages
- Key files: `layout.tsx` (script loading), `EmbeddedProviders.tsx` (navigation)

**`components/`:**
- Purpose: Reusable React components organized by domain
- Contains: Chat UI, AI input elements, shadcn primitives
- Key files: `chat/chat.tsx` (main chat logic), `ai-elements/prompt-input.tsx` (input system)

**`components/chat/`:**
- Purpose: Chat feature-specific components
- Contains: Chat container, messages, product cards, history/saved panels
- Key files: `chat.tsx` (useChat hook + product search), `chat-message.tsx` (message display), `product-card.tsx` (product UI)

**`components/ui/`:**
- Purpose: UI primitive components (button, tabs, dialog, etc)
- Contains: Styled shadcn-style components
- Note: Built from Radix UI + Tailwind, not from shadcn/ui package

**`lib/`:**
- Purpose: Shared utilities, services, and configuration
- Contains: Database client, Shopify client, sync orchestrator, shared functions
- Key files: `db/client.ts` (Prisma singleton), `shopify/client.ts` (Shopify API init)

**`lib/db/`:**
- Purpose: Data access layer
- Contains: Prisma client, repository classes
- Key files: `client.ts` (singleton), `repositories/ProductRepository.ts` (stub)

**`lib/shopify/`:**
- Purpose: Shopify integration
- Contains: Shopify API client, session storage adapter
- Key files: `client.ts` (initialized with scopes, session storage)

**`services/`:**
- Purpose: Business logic and external service calls
- Contains: Shopify product fetching service
- Key files: `ShopifyProductService.ts` (stub for paginated GraphQL fetching)

**`types/`:**
- Purpose: TypeScript type definitions
- Contains: Product types, Shopify types, global type augmentations
- Key files: `product.ts` (ChatProduct, ChatHistoryItem), `shopify.ts` (ProductCreateInput, etc), `shopify-global.d.ts` (window.shopify)

**`prisma/`:**
- Purpose: Database schema and migrations
- Contains: Schema definition, migrations, seed script
- Key files: `schema.prisma` (6 models: Product, ProductVariant, ProductImage, ProductOption, ProductEmbedding, ShopifySession)

**`__tests__/` and `__tests__/` subdirs:**
- Purpose: Unit and integration tests co-located with components
- Contains: Vitest test files, integration tests
- Key files: `components/chat/__tests__/product-card.test.tsx`, `components/chat/chat.integration-test.tsx`

**`docs/`:**
- Purpose: Design specs and planning docs
- Contains: Superpowers (features) plans and specifications
- Key files: Used for roadmap tracking (out of scope for this codebase mapping)

## Key File Locations

**Entry Points:**
- `app/layout.tsx` — Root HTML layout (fonts, styles)
- `app/(embedded)/layout.tsx` — Embedded app layout (Shopify scripts, providers)
- `app/(embedded)/chat/page.tsx` — Chat interface (primary user-facing page)
- `app/(embedded)/onboarding/page.tsx` — Onboarding page (product sync trigger)
- `middleware.ts` — Request middleware (session validation, commented out)

**API Routes:**
- `app/api/chat/route.ts` — POST endpoint for AI chat streaming
- `app/api/auth/route.ts` — GET endpoint for OAuth begin
- `app/api/auth/callback/route.ts` — GET endpoint for OAuth callback
- `app/api/shopify/sync/route.ts` — POST endpoint for product sync
- `app/api/shopify/webhook/route.ts` — POST endpoint for webhooks (stub)

**Core Components:**
- `components/chat/chat.tsx` — Chat UI with useChat hook, product search, message handling
- `components/chat/chat-message.tsx` — Message display with role-based styling
- `components/chat/product-card.tsx` — Product card with save button
- `components/ai-elements/prompt-input.tsx` — Multi-part input system with file attachments

**Configuration:**
- `prisma/schema.prisma` — Prisma ORM schema (models, DB config)
- `next.config.ts` — Next.js build config
- `vitest.config.ts` — Vitest test config
- `tsconfig.json` — TypeScript config (path aliases: `@/` → project root)

**Database & Services:**
- `lib/db/client.ts` — Prisma client singleton with Accelerate support
- `lib/shopify/client.ts` — Shopify API client with session storage
- `services/shopify/ShopifyProductService.ts` — Shopify product fetching (stubs)

## Naming Conventions

**Files:**
- Page components: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Layout components: `layout.tsx` (Next.js convention)
- Regular components: `kebab-case.tsx` (e.g., `chat-message.tsx`, `product-card.tsx`)
- Utilities: `kebab-case.ts` (e.g., `product-sync.ts`)
- Services: `PascalCase.ts` (e.g., `ProductRepository.ts`, `ShopifyProductService.ts`)
- Types: `kebab-case.ts` (e.g., `product.ts`, `shopify.ts`)
- Tests: `*.test.tsx`, `*.spec.ts`, or `*.integration-test.tsx`

**Directories:**
- Feature domains: lowercase, no suffix (e.g., `chat/`, `ui/`, `shopify/`)
- Test directories: `__tests__/` (co-located with feature)
- Generated/build: `generated/`, `.next/`, `node_modules/`

**Component Naming:**
- Exported functions: PascalCase (e.g., `export default function ChatMessage`)
- Hooks: camelCase, start with `use` (e.g., `useChat` from @ai-sdk/react, `usePromptInputAttachments` from custom context)
- Props interfaces: `ComponentNameProps` (e.g., `ChatMessageProps`)
- Variants: lowercase with hyphens (e.g., `variant="user"`, `variant="assistant"` in cva)

**Variables:**
- React state: camelCase (e.g., `selectedTab`, `savedProducts`, `syncing`)
- Constants: UPPER_SNAKE_CASE (e.g., `FALLBACK_RESPONSE`, `MOCK_PRODUCTS`)
- Temporary/derived: camelCase (e.g., `searchWords`, `matchingProducts`)

**Types:**
- Interfaces: PascalCase, `Interface` suffix optional (e.g., `ChatProduct`, `ChatHistoryItem`, `ProductAttachmentState`)
- Type unions: PascalCase (e.g., `ProductStatus`)
- Generics: Single uppercase letter or descriptive (e.g., `T`, `UIMessage<unknown, UIDataTypes, UITools>`)

## Where to Add New Code

**New Feature (e.g., search filters):**
- Primary code: `components/chat/` (new filter components)
- API integration: `app/api/chat/route.ts` (if adding filter parameters to prompt)
- Tests: `components/chat/__tests__/filter.test.tsx`
- Types: `types/product.ts` (if new filter type needed)

**New Component/Module:**
- Implementation: `components/` (if UI), `lib/` (if utility), `services/` (if business logic)
- Tests: Co-locate with feature in `__tests__/` subdirectory
- Exports: Use barrel files sparingly; prefer direct imports

**Utilities:**
- Shared helpers: `lib/utils.ts` (e.g., `cn()` for class merging)
- Domain-specific: `lib/{domain}/` (e.g., `lib/shopify/`, `lib/db/`)
- Service logic: `services/{domain}/` (e.g., `services/shopify/`)

**Styling:**
- Global styles: `app/globals.css`
- Component styles: Inline Tailwind classes (all components use @apply or inline className)
- Variants: Use CVA (class-variance-authority) for complex variations (see `components/chat/chat-message.tsx`)

**Tests:**
- Unit tests: Co-located in `__tests__/` next to component
- Integration tests: Same directory as component, suffix `.integration-test.tsx`
- API tests: `app/api/{route}/__tests__/`
- Middleware tests: `__tests__/middleware.test.ts`

**Environment/Config:**
- Environment variables: `.env` file (not committed; required: GOOGLE_GENERATIVE_AI_API_KEY, DATABASE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, HOST, NEXT_PUBLIC_SHOPIFY_API_KEY)
- Build config: `next.config.ts`, `tsconfig.json`
- Database config: `prisma/schema.prisma`, migrations in `prisma/migrations/`

## Special Directories

**`app/generated/`:**
- Purpose: Prisma-generated artifacts
- Generated: Yes (by `bunx prisma generate`)
- Committed: No (in .gitignore)
- Note: Do NOT edit; regenerate after schema changes

**`.next/`:**
- Purpose: Next.js build cache and server output
- Generated: Yes (by `bun build` or dev server)
- Committed: No (in .gitignore)
- Note: Development and production builds stored separately (`.next/dev/`, `.next/server/`)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by `bun install`)
- Committed: No (in .gitignore)
- Note: Use `bun` package manager exclusively (not npm)

**`prisma/migrations/`:**
- Purpose: Database schema change history
- Generated: Yes (by `bunx prisma migrate dev`)
- Committed: Yes (version control)
- Note: Each migration is a timestamped directory with `.sql` file

**`docs/superpowers/`:**
- Purpose: Feature planning and specifications
- Contents: Plans (YYYY-MM-DD format), specs
- Note: Not part of codebase execution; for roadmap tracking

**`.planning/`:**
- Purpose: GSD codebase analysis artifacts
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: Yes (enables `/gsd:plan-phase` to reference docs)
- Note: Contains ARCHITECTURE.md, STRUCTURE.md, TESTING.md, etc.

---

*Structure analysis: 2026-05-22*
