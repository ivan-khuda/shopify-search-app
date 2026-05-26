---
phase: 05-shared-chat-ui-extraction
plan: 03
subsystem: chat-ui
tags: [refactor, components, chat-ui, ui, extraction, barrel]
requires:
  - 05-02 (adapters + stores delivered)
provides:
  - lib/chat-ui/components/* (7 lifted components)
  - lib/chat-ui/index.ts (barrel re-exports)
  - lib/chat-ui/__tests__/* (relocated unit + integration tests)
affects:
  - lib/chat-ui/components/chat-pane.tsx
  - lib/chat-ui/components/chat-message.tsx
  - lib/chat-ui/components/product-card.tsx
  - lib/chat-ui/components/history-panel.tsx
  - lib/chat-ui/components/saved-products-panel.tsx
  - lib/chat-ui/components/empty-state.tsx
  - lib/chat-ui/components/message-parts.tsx
  - lib/chat-ui/index.ts
  - lib/chat-ui/__tests__/product-card.test.tsx
  - lib/chat-ui/__tests__/history-panel.test.tsx
  - lib/chat-ui/__tests__/saved-products-panel.test.tsx
  - lib/chat-ui/__tests__/message-parts.test.tsx
  - lib/chat-ui/__tests__/chat-pane.integration-test.tsx
tech-stack:
  added: []
  patterns:
    - DefaultChatTransport with Resolvable<T> functions (uncalled arrow funcs) for adapter.getAuthHeaders / adapter.getRequestBody
    - Named-export barrel (lib/chat-ui/index.ts) with type-only re-export from ./adapters/types
    - Surface-neutral ChatPane component (no surface-specific height classes)
key-files:
  created:
    - lib/chat-ui/components/chat-pane.tsx
    - lib/chat-ui/components/chat-message.tsx
    - lib/chat-ui/components/product-card.tsx
    - lib/chat-ui/components/history-panel.tsx
    - lib/chat-ui/components/saved-products-panel.tsx
    - lib/chat-ui/components/empty-state.tsx
    - lib/chat-ui/components/message-parts.tsx
    - lib/chat-ui/index.ts
    - lib/chat-ui/__tests__/product-card.test.tsx
    - lib/chat-ui/__tests__/history-panel.test.tsx
    - lib/chat-ui/__tests__/saved-products-panel.test.tsx
    - lib/chat-ui/__tests__/message-parts.test.tsx
    - lib/chat-ui/__tests__/chat-pane.integration-test.tsx
  modified: []
decisions:
  - "Resolvable functions in DefaultChatTransport are passed UNCALLED (() => adapter.getAuthHeaders()) so the AI SDK invokes them fresh on every sendMessage — avoids stale-closure bug per AI SDK issues #7819 / #7463."
  - "Barrel exports type-only ChatIdentityAdapter via `export type { ... } from './adapters/types'` — permitted by Plan 01's barrel-isolation regex (negative-lookahead exemption); concrete adapters remain forbidden from the barrel."
  - "Surface-specific heights (h-[calc(100vh-100px)] and h-[calc(100%-180px)]) are removed from ChatPane. Plan 04 will re-add them to the surface shell."
  - "MessageParts is intentionally NOT in the barrel — it's an internal implementation detail of ChatMessage. Tests that need it use the deep-path import @/lib/chat-ui/components/message-parts."
metrics:
  completed: 2026-05-26
  duration_minutes: ~15
  task_count: 2
  file_count: 13
---

# Phase 05 Plan 03: Shared Chat-UI Components Lift Summary

**One-liner:** Lifted seven chat components into `lib/chat-ui/components/`, applied the two locked UI-SPEC deltas (user-bubble width clamp + chat-pane surface-height removal), renamed the legacy `Chat` default export to a named `ChatPane` wired via `DefaultChatTransport`, relocated 4 unit + 1 integration test, and created the public barrel at `lib/chat-ui/index.ts` honoring D-04 isolation.

## Component File Move Summary

All copies are byte-identical to the legacy `components/chat/*.tsx` source except where annotated:

| Source                                            | Target                                                     | Deltas |
|---------------------------------------------------|------------------------------------------------------------|--------|
| `components/chat/empty-state.tsx`                 | `lib/chat-ui/components/empty-state.tsx`                   | None (byte-identical) |
| `components/chat/product-card.tsx`                | `lib/chat-ui/components/product-card.tsx`                  | None (byte-identical) |
| `components/chat/chat-message.tsx`                | `lib/chat-ui/components/chat-message.tsx`                  | Line 81 width-clamp delta (see UI-SPEC section) |
| `components/chat/history-panel.tsx`               | `lib/chat-ui/components/history-panel.tsx`                 | Line 5: `@/components/chat/empty-state` → `./empty-state` |
| `components/chat/saved-products-panel.tsx`        | `lib/chat-ui/components/saved-products-panel.tsx`          | Lines 5–6: `@/components/chat/{empty-state,product-card}` → `./empty-state` + `./product-card` |
| `components/chat/message-parts.tsx`               | `lib/chat-ui/components/message-parts.tsx`                 | Lines 6–8: `../ui/text-shimmer` → `@/components/ui/text-shimmer`; `../ai-elements/response` → `@/components/ai-elements/response`; `@/components/chat/product-card` → `./product-card` |
| `components/chat/chat.tsx` (default export `Chat`) | `lib/chat-ui/components/chat-pane.tsx` (named export `ChatPane`) | Transport rewiring, prop signature change, surface-height removal (see UI-SPEC + transport sections) |

All `'use client'` directives preserved exactly: present on chat-pane, product-card, history-panel, saved-products-panel, empty-state, message-parts; absent on chat-message (matches legacy).

## UI-SPEC Delta Application

### Delta 1 — User bubble width clamp (UI-SPEC rule #5)

**File:** `lib/chat-ui/components/chat-message.tsx`
**Line:** 81

- **Before:** `isAiMessage ? "max-w-[calc(100%-40px)]" : "max-w-md",`
- **After:**  `isAiMessage ? "max-w-[calc(100%-40px)]" : "max-w-[min(448px,100%)]",`

Verified: `grep -c "max-w-\[min(448px,100%)\]" lib/chat-ui/components/chat-message.tsx` → `1`; `grep -c "max-w-md" lib/chat-ui/components/chat-message.tsx` → `0`.

### Delta 2 — Surface-height removal (UI-SPEC rule #4)

**File:** `lib/chat-ui/components/chat-pane.tsx`

Two height classes were stripped from the layout containers (they move to the surface shell in Plan 04):

| Container | Legacy class | New class |
|-----------|--------------|-----------|
| Outer `<div>` (formerly `chat.tsx:106`) | `flex flex-col w-full max-w-3xl h-[calc(100vh-100px)] mx-auto stretch gap-6 pt-3` | `flex flex-col w-full max-w-3xl mx-auto stretch gap-6 pt-3` |
| Message-list `<div>` (formerly `chat.tsx:107`) | `h-[calc(100%-180px)] flex flex-col flex-1 gap-4 overflow-auto pr-4` | `flex flex-col flex-1 gap-4 overflow-auto pr-4` |

Verified: both `grep -c "h-\[calc(100vh-100px)\]" lib/chat-ui/components/chat-pane.tsx` and `grep -c "h-\[calc(100%-180px)\]" lib/chat-ui/components/chat-pane.tsx` → `0`.

## ChatPane Transport Wiring

The `Chat` default export was renamed to a named `ChatPane` export with new props:

```ts
interface ChatPaneProps {
    adapter: ChatIdentityAdapter;
    savedProductIds: Set<string>;
    onToggleSave: (product: ChatProduct) => void;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
}
```

Transport (replaces legacy `const { messages, sendMessage, status } = useChat();`):

```ts
const transport = useMemo(
    () => new DefaultChatTransport({
        api: adapter.endpoint,
        headers: () => adapter.getAuthHeaders(),
        body: () => adapter.getRequestBody(),
    }),
    [adapter],
);
const { messages, sendMessage, status } = useChat({ transport });
```

The `headers` and `body` keys are passed as uncalled arrow functions (Resolvable<T>) so the AI SDK invokes them fresh on every `sendMessage` — short-lived JWTs cannot go stale (T-5-SC mitigation).

The legacy `savedProductIds` `useMemo` derivation (`chat.tsx:77–80`) was deleted; the Set is now a prop per CONTEXT D-02.

Every other line of `chat.tsx` — `handleSubmit`, the empty-state inline paragraph, the `messages.map` render, the `PromptInputProvider` block, `AttachmentItem`, `PromptInputAttachmentsDisplay` — is preserved byte-identically.

## Test Relocation Summary

Five test files relocated under `lib/chat-ui/__tests__/`:

| Source | Target | Import diff |
|--------|--------|-------------|
| `components/chat/__tests__/product-card.test.tsx` | `lib/chat-ui/__tests__/product-card.test.tsx` | Line 4: `@/components/chat/product-card` → `@/lib/chat-ui` (barrel) |
| `components/chat/__tests__/history-panel.test.tsx` | `lib/chat-ui/__tests__/history-panel.test.tsx` | Line 3: `@/components/chat/history-panel` → `@/lib/chat-ui` |
| `components/chat/__tests__/saved-products-panel.test.tsx` | `lib/chat-ui/__tests__/saved-products-panel.test.tsx` | Line 3: `@/components/chat/saved-products-panel` → `@/lib/chat-ui` |
| `components/chat/__tests__/message-parts.test.tsx` | `lib/chat-ui/__tests__/message-parts.test.tsx` | Line 5: `@/components/chat/message-parts` → `@/lib/chat-ui/components/message-parts` (deep-path; MessageParts is intentionally NOT in the barrel) |
| `components/chat/chat.integration-test.tsx` | `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` | Renamed `Chat` default import → `ChatPane` named import from `@/lib/chat-ui`; added stub `mockAdapter`; `savedProducts={[TEST_PRODUCT]}` render prop replaced by `adapter={mockAdapter} savedProductIds={new Set([TEST_PRODUCT.id])}`; `vi.mock('@ai-sdk/react', ...)` block preserved unchanged |

(No chat-message unit test was relocated: `components/chat/__tests__/chat-message.test.tsx` does not exist in the legacy tree.)

## Barrel Export List (verbatim contents of `lib/chat-ui/index.ts`)

```ts
// lib/chat-ui/index.ts — barrel.
// CONTRACT (D-04 + barrel-isolation.test.ts):
//   - Re-exports components + interfaces + store hooks.
//   - DOES NOT re-export concrete adapter modules. The type-only re-export from
//     `./adapters/types` is permitted because TypeScript erases type-only imports
//     at compile time — no runtime adapter code reaches the storefront bundle.
//   - Consumers import concrete adapters via sub-paths
//     (`@/lib/chat-ui/adapters/embedded` / `@/lib/chat-ui/adapters/storefront`).

export { ChatPane } from './components/chat-pane';
export { ChatMessage } from './components/chat-message';
export { ProductCard } from './components/product-card';
export { HistoryPanel } from './components/history-panel';
export { SavedProductsPanel } from './components/saved-products-panel';
export { EmptyState } from './components/empty-state';
// NOTE: message-parts is intentionally NOT exported — internal implementation
// detail of ChatMessage (RESEARCH §"Open Questions" item 1).

export type { ChatIdentityAdapter } from './adapters/types';
export type { HistoryStore, SavedProductsStore } from './stores/types';
export { useHistoryStore, useSavedProductsStore } from './stores/hooks';
```

## Verification Results

- **`bunx vitest run lib/chat-ui/__tests__/`** → 9 test files / 36 tests GREEN (barrel-isolation 2/2, embedded-adapter, storefront-adapter, local-storage-stores, product-card, history-panel, saved-products-panel, message-parts, chat-pane integration test).
- **`grep -rn '@/components/chat' lib/chat-ui/`** → zero matches (no cross-tree-by-alias imports inside the barrel tree).
- **`grep -rn "export default" lib/chat-ui/`** → zero matches (named-only contract honored).
- **`grep -c "new DefaultChatTransport" lib/chat-ui/components/chat-pane.tsx`** → 1.
- **`grep -c "headers: () => adapter.getAuthHeaders()" lib/chat-ui/components/chat-pane.tsx`** → 1.
- **`grep -c "body: () => adapter.getRequestBody()" lib/chat-ui/components/chat-pane.tsx`** → 1.

## bun build / TypeScript Status

- `bun run build` (Next.js production build) does not complete in this worktree due to a Next.js Turbopack root-inference issue specific to the linked worktree filesystem layout (it cannot resolve `next/package.json` from `/app`). This is an environment artifact unrelated to Plan 03 changes — surfaces with the same error before any Plan 03 edits were made. No code-level fix is in scope for Plan 03.
- `bunx tsc --noEmit` surfaces only one error inside the relocated tree: `lib/chat-ui/__tests__/message-parts.test.tsx(24,7)` — a `Mock` assignability issue. **This error is byte-identical to a pre-existing issue in the legacy `components/chat/__tests__/message-parts.test.tsx(24,7)` file** and was carried over verbatim during relocation. It is not a new strict violation introduced by Plan 03; vitest still passes it at runtime. All other TS errors surfaced by `tsc --noEmit` are pre-existing in unrelated subsystems (`app/api/proxy/chat`, `lib/db`, `prisma/seed`, `components/ai-elements/reasoning`).

## Legacy Path Status

Legacy `components/chat/*` files remain in place (unchanged):

```
components/chat/chat-message.tsx
components/chat/chat-shell.tsx
components/chat/chat.integration-test.tsx
components/chat/chat.tsx
components/chat/empty-state.tsx
components/chat/history-panel.tsx
components/chat/message-parts.tsx
components/chat/product-card.tsx
components/chat/saved-products-panel.tsx
components/chat/__tests__/*
```

These are still imported by `app/(embedded)/chat/page.tsx` + `components/chat/chat-shell.tsx`. Plan 04 owns the importer cut and the legacy deletion.

## Confirmation: barrel-isolation.test.ts UNCHANGED in Plan 03

`git diff 4cb67cf~..384afec -- lib/chat-ui/__tests__/barrel-isolation.test.ts` is empty — Plan 01 Task 1's authored regex (with the type-only-exempt negative lookahead `/from\s+['"]\.\/adapters\/(?!types['"])/`) was honored, not mutated. Both `it` blocks pass against the new barrel.

## Deviations from Plan

None. Plan executed exactly as written.

## Commits

- `4cb67cf` — `feat(05-03): lift six pure chat components + create barrel`
- `384afec` — `feat(05-03): lift chat.tsx → chat-pane.tsx with DefaultChatTransport + relocate tests`

## Self-Check: PASSED

- ✓ `lib/chat-ui/components/chat-pane.tsx` exists
- ✓ `lib/chat-ui/components/chat-message.tsx` exists
- ✓ `lib/chat-ui/components/product-card.tsx` exists
- ✓ `lib/chat-ui/components/history-panel.tsx` exists
- ✓ `lib/chat-ui/components/saved-products-panel.tsx` exists
- ✓ `lib/chat-ui/components/empty-state.tsx` exists
- ✓ `lib/chat-ui/components/message-parts.tsx` exists
- ✓ `lib/chat-ui/index.ts` exists
- ✓ `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` exists
- ✓ `lib/chat-ui/__tests__/product-card.test.tsx` exists
- ✓ `lib/chat-ui/__tests__/history-panel.test.tsx` exists
- ✓ `lib/chat-ui/__tests__/saved-products-panel.test.tsx` exists
- ✓ `lib/chat-ui/__tests__/message-parts.test.tsx` exists
- ✓ Commit `4cb67cf` present in git log
- ✓ Commit `384afec` present in git log
- ✓ `bunx vitest run lib/chat-ui/__tests__/` exits 0 (9 files / 36 tests GREEN)
