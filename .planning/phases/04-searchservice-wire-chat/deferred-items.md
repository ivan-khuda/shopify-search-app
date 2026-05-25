# Phase 04 — Deferred Items

## Pre-existing lint error in lib/shopify/auth.ts (logged during 04-04 execution)

- File: lib/shopify/auth.ts:14:27
- Rule: @typescript-eslint/prefer-as-const
- Message: Expected a `const` assertion instead of a literal type annotation
- Discovered while running `bun lint` for plan 04-04; this file was not modified by the plan and the error pre-dates the worktree base commit. Out-of-scope per executor Rule scope boundary.


## 04-05 — Out-of-scope items

- **components/chat/__tests__/message-parts.test.tsx:24** — `ReturnType<typeof vi.fn>` mock assignability error against `(product: ChatProduct) => void`. The 04-01 RED scaffold typed `renderParts(parts, onToggleSave: ReturnType<typeof vi.fn>)` and Vitest 4's `Mock<Procedure | Constructable>` is not structurally compatible with the typed callback. Runtime tests pass (10/10). Pre-existing in scaffold authored under plan 04-01; the plan instructs "Do NOT modify the 04-01 RED scaffold". Tracked here for a follow-up cleanup that re-types the helper as `(product: ChatProduct) => void`.
- **lib/shopify/auth.ts:14** — `@typescript-eslint/prefer-as-const` ESLint error. Pre-existing; not touched by plan 04-05.
