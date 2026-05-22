# Coding Conventions

**Analysis Date:** 2026-05-22

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `ProductCard.tsx`, `ChatMessage.tsx`) in `components/` directory
- Services/classes: PascalCase (e.g., `ShopifyProductService.ts`) in `services/` directory
- Utilities: camelCase (e.g., `productSync.ts`, `utils.ts`) in `lib/` directory
- API routes: lowercase with hyphens (e.g., `/api/auth/route.ts`, `/api/shopify/sync/route.ts`)
- Test files: same name as source with `.test.tsx` or `.spec.ts` suffix (co-located or in `__tests__/` subdirectory)

**Functions:**
- Event handlers: `handle` prefix (e.g., `handleStartSync`, `handleToggleSave`, `handleRemove`)
- Custom hooks: `use` prefix (e.g., `usePromptInputAttachments`)
- Utility functions: camelCase (e.g., `cn()` for className merging)
- API route handlers: Named exports as HTTP method (e.g., `export async function GET()`, `export async function POST()`)

**Variables:**
- State variables: camelCase (e.g., `selectedTab`, `savedProducts`, `syncing`)
- React component props: camelCase (e.g., `onSave`, `isSaved`, `product`)
- Mock/test data: camelCase (e.g., `mockSession`, `mockProduct`, `mockRedirect`)
- HTML data attributes: kebab-case (e.g., `data-slot`, `data-testid`, `data-state`)

**Types:**
- Interfaces: PascalCase, usually exported (e.g., `interface ProductCardProps`, `interface ChatProduct`)
- Types: PascalCase (e.g., `type PromptInputMessage`)
- Enums: Not observed in codebase
- TypeScript utility types: Uppercase (e.g., `Record<string, string>`, `ReturnType<typeof vi.fn>`)

## Code Style

**Formatting:**
- No Prettier config file detected; ESLint handles formatting via `eslint-config-next`
- Run `bun lint` to check ESLint compliance
- Default Next.js style: 2-space indentation (observed in practice)

**Linting:**
- Tool: ESLint v9 with flat config (`eslint.config.mjs`)
- Config extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/`, `.worktrees/`, `out/`, `build/`, `next-env.d.ts`
- Run: `bun lint`

## Import Organization

**Order:**
1. External dependencies (e.g., `import React from 'react'`, `import { shopifyApi } from '@shopify/shopify-api'`)
2. Type imports (e.g., `import type { ChatProduct } from '@/types/product'`)
3. Internal imports from `@/` alias (e.g., `import { cn } from '@/lib/utils'`)
4. Relative imports (rare; mostly avoided in favor of `@/` alias)

**Path Aliases:**
- `@/` resolves to project root. Used consistently throughout for:
  - `@/components/...`
  - `@/lib/...`
  - `@/services/...`
  - `@/types/...`
  - `@/app/...` (rare)

**Type Imports:**
- Use `import type { ... }` for interfaces/types to enable tree-shaking (observed in `components/chat/chat.tsx`, `types/product.ts`)

## Error Handling

**Pattern: Response Objects (API Routes)**
- Return Response with status code and JSON body for errors
- Example from `app/api/shopify/sync/route.ts`:
  ```typescript
  return Response.json({ error: 'missing_token' }, { status: 401 });
  ```
- Status codes: 400 (invalid input), 401 (auth failure), 500 (server error)

**Pattern: Try/Catch in Client Components**
- Wrap async operations in try/catch blocks
- Example from `app/(embedded)/onboarding/page.tsx`:
  ```typescript
  try {
    const token = await shopify.idToken();
    const res = await fetch('/api/shopify/sync', { ... });
    // Handle response
  } catch {
    shopify.toast.show('Sync failed. Try again.', { isError: true });
  } finally {
    setSyncing(false);
  }
  ```

**Pattern: Graceful Fallbacks**
- Example from `app/api/chat/route.ts`: If `GOOGLE_GENERATIVE_AI_API_KEY` is missing, return a static fallback response instead of erroring
- No error throwing; service degrades gracefully

## Logging

**Framework:** `console` (no dedicated logging library observed)

**Patterns:**
- Development debugging: `console.log()` used throughout (e.g., `middleware.ts`, `onboarding/page.tsx`, `api/auth/route.ts`)
- Seed script uses `console.error()` for error logging in `prisma/seed.ts`
- Debug logs not removed; appear to remain in code for development observation

**Note:** Console logs should be reviewed and removed before production deployment. They appear to be left-over debugging aids.

## Comments

**When to Comment:**
- Minimal use of comments observed
- Comments used for: placeholder instructions (e.g., "// upsert product", "// paginate through Shopify GraphQL API")
- Inline TODO comments when implementation is deferred
  - Example: `app/api/shopify/sync/route.ts` contains: `// TODO: wire real syncProducts(session). Tracked in docs/superpowers/specs/...`

**JSDoc/TSDoc:**
- Not used in this codebase; instead, TypeScript types and interfaces document expected shapes
- Example: `ProductCardProps` interface documents all props for `ProductCard` component

## Function Design

**Size:**
- Small functions preferred; most functions 10-30 lines
- Callbacks and event handlers typically 1-5 lines

**Parameters:**
- Use destructuring for component props: `function ProductCard({ product, isSaved, onSave }: ProductCardProps)`
- Use object parameters for functions with multiple args (e.g., API route handlers receive `request: Request`)
- Event handlers receive typed events: `onClick={(e) => handleClick()}`

**Return Values:**
- React components: JSX.Element
- API route handlers: `Promise<Response>`
- Event handlers: `void`
- Utility functions: Explicit return types preferred (e.g., `cn()` returns `string`)

## Module Design

**Exports:**
- Named exports for components, classes, and utilities
- `export const` for singletons (e.g., `shopifyClient`, `prisma`, `productRepository`, `sessionStorage`)
- `export function` for utilities and handlers
- `export class` for service classes
- `export { ... }` for re-exporting UI component subcomponents (e.g., `export { Button, buttonVariants }` in `components/ui/button.tsx`)

**Barrel Files:**
- Minimal use; mostly direct imports from specific files
- UI component files use re-export pattern but not traditional barrel files

**Singleton Pattern:**
- Database client: `export const prisma = new PrismaClient()` in `lib/db/client.ts`
- Repository instance: `export const productRepository = new ProductRepository()` in `lib/db/repositories/ProductRepository.ts`
- Shopify client: `export const shopifyClient = shopifyApi({...})` in `lib/shopify/client.ts`
- Session storage: `export const sessionStorage = new PrismaSessionStorage(...)` in `lib/shopify/session-storage.ts`

## React Patterns

**Hooks:**
- `useState` for local state (e.g., `selectedTab`, `syncing`, `savedProducts`)
- `useCallback` for memoizing event handlers (e.g., `AttachmentItem` in `components/chat/chat.tsx`)
- `useMemo` for derived state (e.g., `PromptInputAttachmentsDisplay` in `chat.tsx`)
- Custom hooks: `usePromptInputAttachments()` for context-based state access

**Memoization:**
- `memo()` used for components to prevent unnecessary re-renders (e.g., `AttachmentItem` in `chat.tsx`)
- Display names set for memoized components: `AttachmentItem.displayName = "AttachmentItem"`

**Client Components:**
- `'use client'` directive at top of files that use hooks or event listeners (e.g., `app/(embedded)/chat/page.tsx`, `components/chat/chat.tsx`)

## TypeScript

**Type Safety:**
- Strict TypeScript enabled (observed from tsconfig defaults)
- Interfaces preferred for component props and data shapes
- Type imports for tree-shaking optimization

**Assertion Library:**
- Tests use `expect()` from Vitest (no jest imports)

---

*Convention analysis: 2026-05-22*
