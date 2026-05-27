# Phase 04 — Deferred Items

## Pre-existing lint error in lib/shopify/auth.ts (logged during 04-04 execution)

- File: lib/shopify/auth.ts:14:27
- Rule: @typescript-eslint/prefer-as-const
- Message: Expected a `const` assertion instead of a literal type annotation
- Discovered while running `bun lint` for plan 04-04; this file was not modified by the plan and the error pre-dates the worktree base commit. Out-of-scope per executor Rule scope boundary.


## 04-05 — Out-of-scope items

- **components/chat/__tests__/message-parts.test.tsx:24** — `ReturnType<typeof vi.fn>` mock assignability error against `(product: ChatProduct) => void`. The 04-01 RED scaffold typed `renderParts(parts, onToggleSave: ReturnType<typeof vi.fn>)` and Vitest 4's `Mock<Procedure | Constructable>` is not structurally compatible with the typed callback. Runtime tests pass (10/10). Pre-existing in scaffold authored under plan 04-01; the plan instructs "Do NOT modify the 04-01 RED scaffold". Tracked here for a follow-up cleanup that re-types the helper as `(product: ChatProduct) => void`.
- **lib/shopify/auth.ts:14** — `@typescript-eslint/prefer-as-const` ESLint error. Pre-existing; not touched by plan 04-05.

## 04-06 — Out-of-scope items (pre-existing TSC errors observed during Plan 04-06 Task 1)

- **app/(embedded)/onboarding/page.tsx** (lines 36, 49, 51, 53, 56, 68) — `TS2304: Cannot find name 'shopify'`. The Polaris/App Bridge global from the script-injected runtime is not declared in the project's type roots. Pre-existing on HEAD before Plan 04-06; not touched by this plan. A future cleanup should add a `declare global { interface Window { shopify: ... } }` or a `globals.d.ts` ambient declaration.
- **app/prototype/prototype-data.ts** (lines 1, 57) — references the deleted `@/components/chat/mock-products` module + an implicit `any` parameter. The `app/prototype/` directory is untracked (see `git status`) and out-of-scope for Plan 04-06. The author of that prototype directory should remove the dead `mock-products` import or move it under a tsconfig `exclude`.
- **components/ai-elements/reasoning.tsx** (lines 10, 11, 16) — imports from `@jenius/ui/*` and `../text-shimmer` that do not resolve. Pre-existing on HEAD; tracked file but not touched by this plan.
