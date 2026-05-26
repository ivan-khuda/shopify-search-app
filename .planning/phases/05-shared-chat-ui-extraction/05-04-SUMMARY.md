---
phase: 05-shared-chat-ui-extraction
plan: 04
subsystem: embedded-chat-surface
tags: [refactor, embedded-surface, chat-ui, hard-cut, d-11]
requires:
  - "@/lib/chat-ui (barrel — ChatPane, HistoryPanel, SavedProductsPanel)"
  - "@/lib/chat-ui/adapters/embedded (EmbeddedAdapter)"
  - "@/lib/chat-ui/stores/hooks (useHistoryStore, useSavedProductsStore)"
provides:
  - "app/(embedded)/chat/chat-shell.tsx — embedded surface shell wiring lib/chat-ui"
  - "app/(embedded)/chat/__tests__/chat-shell.test.tsx — relocated unit test (mocks @/lib/chat-ui)"
affects:
  - "app/(embedded)/chat/page.tsx (RSC import + shop prop)"
  - "app/(embedded)/chat/__tests__/page.test.tsx (vi.mock target)"
  - "app/prototype/prototype-data.ts (dead-comment + orphan-helper cleanup)"
  - "components/chat/ (entire directory DELETED — 14 files)"
tech-stack:
  added: []
  patterns:
    - "Surface shell owns surface-specific heights (h-[calc(100vh-100px)] outer, h-[calc(100%-180px)] chat tab) — lifted out of shared ChatPane per UI-SPEC parity rule #4"
    - "EmbeddedAdapter instantiated via useMemo([]) — stable identity for ChatPane's transport memo"
    - "Per-shop scoping: useHistoryStore(shop) + useSavedProductsStore(shop) wire stores keyed on the searchParams.shop value"
    - "Set<string> derivation via useMemo([saved.items]) for ChatPane.savedProductIds"
key-files:
  created:
    - "app/(embedded)/chat/chat-shell.tsx"
    - "app/(embedded)/chat/__tests__/chat-shell.test.tsx"
  modified:
    - "app/(embedded)/chat/page.tsx"
    - "app/(embedded)/chat/__tests__/page.test.tsx"
    - "app/prototype/prototype-data.ts"
  deleted:
    - "components/chat/chat.tsx"
    - "components/chat/chat-shell.tsx"
    - "components/chat/chat-message.tsx"
    - "components/chat/product-card.tsx"
    - "components/chat/history-panel.tsx"
    - "components/chat/saved-products-panel.tsx"
    - "components/chat/empty-state.tsx"
    - "components/chat/message-parts.tsx"
    - "components/chat/chat.integration-test.tsx"
    - "components/chat/__tests__/chat-shell.test.tsx"
    - "components/chat/__tests__/history-panel.test.tsx"
    - "components/chat/__tests__/message-parts.test.tsx"
    - "components/chat/__tests__/product-card.test.tsx"
    - "components/chat/__tests__/saved-products-panel.test.tsx"
decisions:
  - "Set-derivation for savedProductIds lives in chat-shell.tsx (not inside the store hook) so the Set identity changes with saved.items, letting ChatPane's downstream memoization invalidate correctly."
  - "page.test.tsx vi.mock target chose the relative '../chat-shell' form to match the page.tsx relative import — keeps the mock-target string and the source-import string identical for grep-ability."
  - "Deleted now-orphan VENDOR_BY_CATEGORY + parsePrice helpers in prototype-data.ts (their only consumer was the commented-out CATALOG mapping block that referenced the removed MOCK_PRODUCTS). Documented as a Rule 2 cleanup tied to the dead-comment removal scope."
metrics:
  duration: "~6 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
  files_deleted: 14
  tests_passing: "45/45 (lib/chat-ui + app/(embedded)/chat suites)"
---

# Phase 5 Plan 4: Embedded Surface Hard-Cut to lib/chat-ui Summary

Embedded admin `/chat` surface is now fully wired through `@/lib/chat-ui` — the legacy `components/chat/` tree is gone, `app/(embedded)/chat/chat-shell.tsx` instantiates `EmbeddedAdapter` and consumes the per-shop store hooks, and the grep gate (`@/components/chat`) returns zero matches across `app/`, `lib/`, and `components/`. This is the SHR-03 + SHR-04 delivery defined by CONTEXT D-11 (single-commit hard cut, no shims).

## What Changed

### `app/(embedded)/chat/chat-shell.tsx` (rebuilt)

Net-new file at the new path (the legacy `components/chat/chat-shell.tsx` was deleted in Task 2). The rebuild:

- `'use client'` directive.
- Accepts `{ shop }: { shop: string }` — required prop replaces the old no-args signature.
- `const adapter = useMemo(() => new EmbeddedAdapter(), []);` — stable identity for `ChatPane`'s downstream `DefaultChatTransport` memo.
- `const history = useHistoryStore(shop);` + `const saved = useSavedProductsStore(shop);` — per-shop localStorage-backed stores from Plan 03.
- `const savedProductIds = useMemo(() => new Set(saved.items.map((p) => p.id)), [saved.items]);` — Set derivation co-located with the shell so the Set identity flips on item mutation.
- Outer wrapper carries `h-[calc(100vh-100px)]` and the chat `<TabsContent>` carries `h-[calc(100%-180px)]` — surface-specific heights lifted out of `ChatPane` per UI-SPEC parity rule #4.
- Header/Tabs/TabsTrigger/Button JSX is byte-identical to the legacy file. The D-12 hex map (`bg-[#008060]`, `text-[#008060]`, `border-[#e1e3e5]`, `text-[#6d7175]`, `text-[#202223]`) was already in arbitrary-value Tailwind form in the legacy file — verified via grep that no bare `style={{ color: "#…" }}` literals remain. D-12 cleanup is a no-op verify step, confirmed.
- Imports: `ChatPane, HistoryPanel, SavedProductsPanel` from the `@/lib/chat-ui` barrel; `EmbeddedAdapter` from the `@/lib/chat-ui/adapters/embedded` sub-path (D-04 barrel-isolation contract — the barrel re-exports types only for adapters); `useHistoryStore, useSavedProductsStore` from `@/lib/chat-ui/stores/hooks`.
- Props passed: `<ChatPane adapter={adapter} savedProductIds={savedProductIds} onToggleSave={saved.toggle} onHistoryAdd={history.add} />`; `<HistoryPanel items={history.items} onClear={history.clear} />`; `<SavedProductsPanel products={saved.items} onToggleSave={saved.toggle} />`. Prop names verified against the lifted component signatures in `lib/chat-ui/components/`.

### `app/(embedded)/chat/page.tsx` (RSC)

Two-line edit, banner block untouched:
- L2: `import { ChatShell } from '@/components/chat/chat-shell';` → `import { ChatShell } from './chat-shell';`
- `<ChatShell />` → `<ChatShell shop={shop ?? ''} />` (`shop` already derived from `searchParams` in the existing RSC body per Phase 4 D-11).

### `app/(embedded)/chat/__tests__/chat-shell.test.tsx` (relocated)

Net-new at the new path (the legacy version was deleted in Task 2). Key changes from the legacy form:

- `vi.mock` target changed from `'@/components/chat/chat'` (default export) to `'@/lib/chat-ui'` (named exports). All three barrel exports (`ChatPane`, `HistoryPanel`, `SavedProductsPanel`) are stubbed because the new shell imports all three from the same barrel; mocking only `ChatPane` would render the real `HistoryPanel`/`SavedProductsPanel` and break the assertions.
- Import path changed to relative: `import { ChatShell } from '../chat-shell';` (matches neighboring `page.test.tsx` style).
- `render(<ChatShell />)` → `render(<ChatShell shop="example.myshopify.com" />)` — the shop prop is now required.

### `app/(embedded)/chat/__tests__/page.test.tsx` (single-line edit)

- `vi.mock('@/components/chat/chat-shell', …)` → `vi.mock('../chat-shell', …)`. Test body and assertions untouched.

### `app/prototype/prototype-data.ts` (dead-code cleanup)

- Removed the dead line-1 comment: `// import { MOCK_PRODUCTS } from '@/components/chat/mock-products';`.
- Removed the commented-out `CATALOG` mapping block that referenced the deleted import.
- Removed the now-orphan `VENDOR_BY_CATEGORY` constant and the `parsePrice` helper (their only consumer was the deleted commented block). The hardcoded `CATALOG` array is the only consumer of these helpers' file, and it doesn't use either.

### `components/chat/` (DELETED — 14 files + directory)

All 14 files removed via `git rm` (D-11 hard cut, no shims):

```
components/chat/chat.tsx
components/chat/chat-shell.tsx
components/chat/chat-message.tsx
components/chat/product-card.tsx
components/chat/history-panel.tsx
components/chat/saved-products-panel.tsx
components/chat/empty-state.tsx
components/chat/message-parts.tsx
components/chat/chat.integration-test.tsx
components/chat/__tests__/chat-shell.test.tsx
components/chat/__tests__/history-panel.test.tsx
components/chat/__tests__/message-parts.test.tsx
components/chat/__tests__/product-card.test.tsx
components/chat/__tests__/saved-products-panel.test.tsx
```

The `components/chat/` directory and its `__tests__/` subdirectory are gone (git tracks file removals; empty parent directories are implicitly removed).

## Verification

| Gate                                                                | Result                                |
| ------------------------------------------------------------------- | ------------------------------------- |
| `grep -rn '@/components/chat' app/ lib/ components/`                | **0 matches** (D-11 hard cut)         |
| `test ! -d components/chat`                                         | **PASS** — directory removed          |
| `bunx vitest run app/(embedded)/chat/__tests__/`                    | **9/9 PASS** (chat-shell + page)      |
| `bunx vitest run lib/chat-ui/__tests__/`                            | **36/36 PASS** (Plan 03 suites stay green) |
| Combined embedded + shared chat-ui tests                            | **45/45 PASS**                        |
| D-12 hex map verify (no bare `style={{ color: "#…" }}` in chat-shell.tsx) | **PASS** — only arbitrary-value Tailwind classes  |

## Deviations from Plan

### Rule 2 (auto-add critical hygiene) — orphan-helper cleanup in `app/prototype/prototype-data.ts`

- **Found during:** Task 2 (prototype-data.ts cleanup).
- **Issue:** Removing the line-1 comment `// import { MOCK_PRODUCTS } …` per the plan exposed the acceptance criterion `grep -c "MOCK_PRODUCTS" app/prototype/prototype-data.ts` returns `0`. The remaining occurrence was the multi-line commented-out `CATALOG = MOCK_PRODUCTS.map(…)` block (lines 55–65). Deleting that block in turn orphaned the `VENDOR_BY_CATEGORY` constant and `parsePrice` helper, which had no other consumer.
- **Fix:** Removed the commented-out CATALOG block and the two orphan helpers. The hardcoded `CATALOG: PrototypeProduct[] = [ … 15 entries … ]` array (the actual export) is untouched.
- **Files modified:** `app/prototype/prototype-data.ts`.
- **Commit:** `84c1bd0`.

### Environmental: `bun run build` cannot be verified inside the claude-code worktree

- **Found during:** Final verification pass after Task 2.
- **Issue:** The plan's success criterion includes `bun build` clean. Running `bun run build` (the Next.js production build) fails with `Next.js inferred your workspace root, but it may not be correct. We couldn't find the Next.js package (next/package.json) from the project directory`. The worktree's `node_modules/` contains only a `.cache` directory — dependencies are installed at the parent repo (`/Users/ikhuda/sites/personal/shopify-search-app/node_modules/`) and Turbopack's workspace-root inference cannot resolve them from inside the worktree path.
- **Root cause:** This is the standard claude-code parallel-worktree environment. Vitest succeeds because vitest's resolver walks parent directories; Turbopack does not. Installing dependencies (`bun install`) is excluded from auto-fix (Rule 3 package-install carve-out).
- **Outcome:** Verified via `bunx tsc --noEmit` that the failures are all pre-existing environmental (`Cannot find module '@/app/generated/prisma/client'`, `Cannot find module 'next'`, etc.) — none reference any of the files this plan modified (`chat-shell.tsx`, `page.tsx`, `prototype-data.ts`, the two test files). The Turbopack root-inference failure is a worktree-environment artifact, not a defect introduced by this plan.
- **Recommendation:** When the merge into the primary checkout completes, run `bun run build` there to satisfy the success criterion. Manual visual verification of the embedded `/chat` page is deferred to Plan 05 per the plan's verification block.

## Known Stubs

None. All wiring is real:
- `EmbeddedAdapter` uses `shopify.idToken()` from the App Bridge global (production-ready since Plan 02).
- `useHistoryStore`/`useSavedProductsStore` use localStorage-backed implementations (Plan 03).
- `ChatPane` consumes the real Vercel AI SDK `useChat` transport with `DefaultChatTransport`.

## Commits

| Commit    | Type    | Subject                                                |
| --------- | ------- | ------------------------------------------------------ |
| `e5a8c8a` | feat    | rebuild embedded chat-shell on lib/chat-ui             |
| `84c1bd0` | chore   | hard-cut legacy components/chat tree (D-11)            |

## Self-Check: PASSED

- `app/(embedded)/chat/chat-shell.tsx` — FOUND
- `app/(embedded)/chat/__tests__/chat-shell.test.tsx` — FOUND
- `app/(embedded)/chat/page.tsx` modified — FOUND (`./chat-shell` import + `shop={shop ?? ''}` prop)
- `app/(embedded)/chat/__tests__/page.test.tsx` modified — FOUND (`'../chat-shell'` mock target)
- `app/prototype/prototype-data.ts` — FOUND (no `MOCK_PRODUCTS` references)
- Commit `e5a8c8a` — FOUND on branch
- Commit `84c1bd0` — FOUND on branch
- `components/chat/` directory — REMOVED
- Grep gate `@/components/chat` across `app/ lib/ components/` — 0 matches
- Test suite (lib/chat-ui + app/(embedded)/chat) — 45/45 GREEN
