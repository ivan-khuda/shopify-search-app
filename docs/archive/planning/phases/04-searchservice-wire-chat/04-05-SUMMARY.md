---
phase: 04-searchservice-wire-chat
plan: 05
subsystem: chat-ui
tags: [ui, chat, tool-result, adm-06, emb-07, tdd-green, w6-narrowed]
dependency_graph:
  requires:
    - "04-01 (RED scaffold components/chat/__tests__/message-parts.test.tsx)"
    - "04-03 (/api/chat tool-call wiring — searchCatalog tool emits message.parts[*].type === 'tool-searchCatalog')"
  provides:
    - "ADM-06 success criterion: UI surfaces grounded results from the searchCatalog tool"
    - "EMB-07 success criterion #3: MOCK_PRODUCTS file deleted; zero runtime references across app/components/services/lib/types"
    - "GREEN status for 04-01 message-parts RED scaffold (10/10 tests pass)"
  affects:
    - "Phase 5/6 — history derivation may relocate to a useEffect that watches messages (productCount currently 0 at submit)"
    - "Phase 6 storefront drawer (will reuse MessageParts unchanged once /api/proxy/chat streams the searchCatalog tool)"
tech-stack:
  added: []
  patterns:
    - "Discriminator narrowing on Vercel AI SDK v6 ToolUIPart union via (part.type === 'tool-searchCatalog' && 'state' in part) — no direct ToolUIPart cast (W6 fix)"
    - "Progressive state discriminator guards (input-streaming | input-available | output-available | output-error) inside the entry-guard block — TypeScript narrows part.output and part.errorText structurally"
    - "ProductCard grid mounted inside <ul role=\"list\" aria-live=\"polite\" aria-label={`${N} matching products`}>; each card wrapped in <li>"
    - "150ms CSS opacity fade on every state transition (no layout animation per UI-SPEC.md motion contract)"
    - "tool-result-driven rendering — chat.tsx is gutted of pendingProducts/attachedProducts side-channel state; message.parts is the single source of truth"
key-files:
  created:
    - .planning/phases/04-searchservice-wire-chat/04-05-SUMMARY.md
  modified:
    - components/chat/message-parts.tsx
    - components/chat/chat-message.tsx
    - components/chat/chat.tsx
    - components/chat/chat.integration-test.tsx
    - .planning/phases/04-searchservice-wire-chat/deferred-items.md
  deleted:
    - components/chat/mock-products.ts
decisions:
  - "Use discriminator narrowing (part.type === 'tool-searchCatalog' && 'state' in part) instead of a direct `as ToolUIPart` cast — Vercel AI SDK v6's ToolUIPart union is dynamically generated from the streamText tool registry, so the literal type 'tool-searchCatalog' is not always present in the ambient union at consumer sites. Progressive state guards narrow part.output and part.errorText structurally."
  - "Local `as ChatProduct[]` shape coercion on part.output (typed `unknown` by the SDK) is acceptable inside the output-available branch — it's a shape coercion, not a discriminator bypass."
  - "productCount in onHistoryAdd at submit time is now 0 because cards arrive asynchronously via the tool-result; history derivation that watches messages is deferred to Phase 5/6."
  - "Pre-existing 04-01 RED scaffold typing (ReturnType<typeof vi.fn> vs (product: ChatProduct) => void) and the lib/shopify/auth.ts ESLint error are out-of-scope; logged to deferred-items.md."
metrics:
  duration: ~14m
  completed: 2026-05-25
  tasks: 2
  files_modified: 4
  files_deleted: 1
---

# Phase 4 Plan 5: UI Refactor — Tool-Result Rendering Summary

One-liner: Extended `MessageParts` to render the 4-state `tool-searchCatalog` switch (running pill / product grid / zero-results affordance / quiet error) directly from `message.parts`, gutted `chat.tsx` of the legacy `MOCK_PRODUCTS` + `PendingProductAttachment` side-channel, and deleted `components/chat/mock-products.ts` — turning the 04-01 RED scaffold GREEN and fulfilling the EMB-07 source-level proof.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Extend message-parts.tsx with tool-searchCatalog state-machine renderer + thread savedProductIds/onToggleSave; update chat-message.tsx | `090a336` | components/chat/message-parts.tsx, components/chat/chat-message.tsx |
| 2 | Gut chat.tsx of MOCK_PRODUCTS glue, update greeting, rewrite integration test, delete mock-products.ts | `902d483` | components/chat/chat.tsx, components/chat/chat.integration-test.tsx, components/chat/mock-products.ts (deleted) |

## chat.tsx Deletion Map

| Original Range | Deleted Item | Replacement |
| -------------- | ------------ | ----------- |
| line 14 | `useState` from React import | removed from import (only `useCallback`, `useMemo`, `memo` remain) |
| line 17 | `import { ProductCard } from '@/components/chat/product-card';` | (gone; ProductCard now imported only by message-parts.tsx) |
| line 18 | `import { MOCK_PRODUCTS } from '@/components/chat/mock-products';` | (gone; file deleted) |
| lines 77-80 | `interface ProductAttachmentState` | (gone) |
| lines 82-85 | `interface PendingProductAttachment` | (gone) |
| lines 87-103 | `const buildMockResults = (query: string) => { ... }` | (gone) |
| line 106 | `const [pendingProducts, setPendingProducts] = useState<...>(...)` | (gone) |
| lines 112-142 | `const attachedProducts = useMemo<ProductAttachmentState \| null>(() => { ... }, [messages, pendingProducts])` | (gone — message.parts is the source of truth now) |
| lines 153-158 | `const products = hasText ? buildMockResults(query) : []; setPendingProducts({ ... });` inside handleSubmit | replaced by inline `productCount: 0` comment with Phase 5/6 TODO |
| lines 184-202 | `productsForMessage` lookup + inline `<div className="grid ...">` ProductCard rendering inside messages.map | replaced by a single `<ChatMessage savedProductIds={...} onToggleSave={...} />` per message |

## New Greeting Copy (Verbatim)

```jsx
<p>
    Hello! I&apos;m your AI Shopping Assistant. Try a search like &quot;warm winter clothes&quot; or &quot;running shoes under $80&quot;.
</p>
```

(Replaces the prior copy at chat.tsx lines 177-180 which referenced "warm winter clothes" and "minimalist accessories" — the new copy advertises the price-filter demo to align with Phase 4 plan 04-03's `searchCatalog` tool schema `{ query, priceMin?, priceMax? }`.)

## mock-products.ts Deletion Proof

```bash
$ test ! -e components/chat/mock-products.ts && echo "OK: deleted"
OK: deleted
$ test -e components/chat/mock-products.ts; echo $?
1
```

(Exit code 1 = file does not exist.)

## Recursive Grep — Zero MOCK_PRODUCTS / buildMockResults References

```bash
$ grep -rn "MOCK_PRODUCTS\|buildMockResults\|from '@/components/chat/mock-products'" app components lib services types
(no output — zero matches)
```

This is the final EMB-07 source-level proof: SearchService.hybridSearch (Phase 4 plan 04-02 / wired into /api/chat in plan 04-03 / surfaced in the UI by this plan 04-05) is the sole product source in the runtime tree. No mock, no client-side keyword search, no anchor-glue side channel.

## Discriminator Narrowing Snippet (W6 Fix Proof)

```tsx
// tool-searchCatalog renderer — discriminator narrowing (no direct ToolUIPart cast).
// Vercel AI SDK v6 generates the dynamically-named tool union from the tool
// registry passed to streamText, so the literal type 'tool-searchCatalog' is
// not always present in the ambient union at the consumer site. The pattern
// below uses (part.type === 'tool-searchCatalog' && 'state' in part) followed
// by progressive part.state discriminator guards to narrow structurally.
if (part.type === 'tool-searchCatalog' && 'state' in part) {
  if (part.state === 'input-streaming' || part.state === 'input-available') {
    return (
      <div role="status" aria-live="polite" ...>
        <Loader2 ... />
        Searching your catalog…
      </div>
    );
  }
  if (part.state === 'output-available') {
    const products = Array.isArray(part.output) ? (part.output as ChatProduct[]) : [];
    // ... grid or zero-results affordance
  }
  if (part.state === 'output-error') {
    // ... quiet error affordance
  }
  return null;
}
```

Grep gates (W6 enforcement):

| Gate | Expected | Actual |
| ---- | -------- | ------ |
| `grep -c "part.type === 'tool-searchCatalog'" components/chat/message-parts.tsx` | >= 1 | **2** |
| `grep -c "'state' in part" components/chat/message-parts.tsx` | >= 1 | **2** |
| `grep -c "as ToolUIPart" components/chat/message-parts.tsx` | 0 | **0** (cast absent — discriminator narrowing replaces it) |
| `grep -c "Searching your catalog…" components/chat/message-parts.tsx` | 1 | **1** (literal U+2026 ellipsis) |

## Currently Passing Phase 4 Test Files (Running Totals)

```bash
$ bunx vitest run \
    components/chat/__tests__/message-parts.test.tsx \
    components/chat/chat.integration-test.tsx \
    components/chat/__tests__/product-card.test.tsx

Test Files  3 passed (3)
     Tests  12 passed (12)
```

| Test File | Assertions | Status |
| --------- | ---------- | ------ |
| components/chat/__tests__/message-parts.test.tsx | 10 | **GREEN** (was RED at 04-01 — now turned by this plan) |
| components/chat/chat.integration-test.tsx | 1 (rewritten to mock tool-searchCatalog output-available) | **GREEN** |
| components/chat/__tests__/product-card.test.tsx | 1 | **GREEN** (regression check — untouched by this plan) |
| app/api/chat/__tests__/route.test.ts | 13 | **GREEN** (from plan 04-03) |
| app/api/proxy/chat/__tests__/route.test.ts | 8 | **GREEN** (from plan 04-04) |
| services/search/__tests__/SearchService.test.ts | (from 04-02) | **GREEN** (from plan 04-02) |

## Acceptance Criteria Status

### Task 1 (message-parts.tsx + chat-message.tsx)

| Criterion | Expected | Actual |
| --------- | -------- | ------ |
| message-parts.tsx contains tool-searchCatalog renderer | yes | yes |
| Literal strings (`Searching your catalog`, `No matching products`, `Try a broader description or remove the price filter.`, `Couldn&apos;t fetch results`, `Please try that search again.`, `aria-live="polite"`, `role="status"`, `Loader2`, `SearchX`, `AlertCircle`, `ProductCard`) | all present | all present |
| `savedProductIds` references | >= 3 | 4 |
| `onToggleSave` references | >= 3 | 4 |
| ProductCard import | exactly 1 | 1 |
| lucide-react import | >= 1 | 1 |
| `part.type === 'tool-searchCatalog'` | >= 1 | 2 |
| `'state' in part` | >= 1 | 2 |
| `as ToolUIPart` (forbidden direct cast) | 0 | 0 |
| chat-message.tsx threads `savedProductIds={savedProductIds}` | 1 | 1 |
| chat-message.tsx threads `onToggleSave={onToggleSave}` | 1 | 1 |
| message-parts test (10 assertions) | GREEN | GREEN |

### Task 2 (chat.tsx + integration test + mock-products.ts)

| Criterion | Expected | Actual |
| --------- | -------- | ------ |
| `mock-products.ts` file exists | no | **deleted** |
| `MOCK_PRODUCTS \| buildMockResults \| from '@/components/chat/mock-products'` runtime references | 0 | 0 |
| `MOCK_PRODUCTS \| buildMockResults \| PendingProductAttachment \| ProductAttachmentState \| attachedProducts \| pendingProducts \| setPendingProducts` in chat.tsx | 0 | 0 |
| `ProductCard` in chat.tsx | 0 | 0 |
| Greeting `Hello! I&apos;m your AI Shopping Assistant` | 1 | 1 |
| Greeting `running shoes under $80` | 1 | 1 |
| Greeting `warm winter clothes` | 1 | 1 |
| `savedProductIds={savedProductIds}` in chat.tsx | 1 | 1 |
| `onToggleSave={onToggleSave}` in chat.tsx | 1 | 1 |
| integration test has zero `MOCK_PRODUCTS` references | 0 | 0 |
| integration test has `tool-searchCatalog` | >= 1 | 1 |
| integration test has `TEST_PRODUCT` | >= 3 | 7 |
| integration test exit code | 0 | 0 |

## Threat Mitigations Verified

| Threat ID | Disposition | Verification |
| --------- | ----------- | ------------ |
| T-04-19 (LLM hallucinated cards) | mitigate | UI reads only `part.output` from `tool-searchCatalog` parts — LLM cannot populate that field; only the server-side tool `execute` (hybridSearch) can. |
| T-04-20 (LLM tool-result for undefined tool) | mitigate | The render switch matches only `part.type === 'tool-searchCatalog'`; unknown tool-* parts fall through to `return null`. |
| T-04-21 (Error message leaks user content) | mitigate | The error affordance uses fixed UI copy (`Couldn&apos;t fetch results` / `Please try that search again.`); `part.errorText` is never rendered. |
| T-04-22 (XSS via tool output) | mitigate | ProductCard renders all fields as React text (auto-escaped) — no `dangerouslySetInnerHTML`. |
| T-04-23 (Legacy MOCK_PRODUCTS surface returns silently) | mitigate | Recursive grep across runtime directories returns zero matches; the file is deleted from disk. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed obsolete streaming-shimmer return for tool parts during streaming**

- **Found during:** Task 1
- **Issue:** The original message-parts.tsx had `if (status === "streaming" || (type === "text" && part.text === "Thinking..."))` returning a TextShimmer for **every** part during streaming — including tool parts. With the new tool-searchCatalog branch, this would have masked the `Searching your catalog…` pill behind a generic "Thinking..." shimmer while the tool is mid-call.
- **Fix:** Placed the tool-searchCatalog discriminator branch **before** the streaming-shimmer fallback, so tool parts render their state-specific affordance regardless of `status === "streaming"`. Other part types (text) still fall through to the streaming shimmer when appropriate. This preserves the original behavior for non-tool parts while letting the tool branch render through.
- **Files modified:** components/chat/message-parts.tsx
- **Commit:** 090a336

**2. [Rule 1 - Bug] Avoided forbidden `as ToolUIPart` substring even in code comments**

- **Found during:** Task 1 acceptance-criteria grep
- **Issue:** The plan's W6 gate is `grep -c "as ToolUIPart" components/chat/message-parts.tsx` returns **0**. My initial comment included the literal string "no `as ToolUIPart` cast" which tripped the grep at 1 match.
- **Fix:** Rephrased the comment to "no direct ToolUIPart cast" — preserves the documentation intent without tripping the substring gate. Runtime semantics unchanged.
- **Files modified:** components/chat/message-parts.tsx
- **Commit:** 090a336 (final version)

### Out-of-Scope (Deferred)

- **components/chat/__tests__/message-parts.test.tsx:24** — `ReturnType<typeof vi.fn>` mock assignability error against `(product: ChatProduct) => void`. The 04-01 RED scaffold typed `renderParts(parts, onToggleSave: ReturnType<typeof vi.fn>)` and Vitest 4's `Mock<Procedure | Constructable>` is not structurally compatible with the typed callback. Runtime tests pass (10/10). The plan instructs "Do NOT modify the 04-01 RED scaffold". Logged to deferred-items.md.
- **lib/shopify/auth.ts:14** — `@typescript-eslint/prefer-as-const` ESLint error. Pre-existing; not touched by plan 04-05. Already logged in deferred-items.md from plan 04-04.

## Authentication Gates

None — this is a UI-only plan with no auth surface.

## Self-Check: PASSED

- [x] commit `090a336` exists (`git log --oneline | grep 090a336` → present)
- [x] commit `902d483` exists (`git log --oneline | grep 902d483` → present)
- [x] components/chat/message-parts.tsx exists
- [x] components/chat/chat-message.tsx exists
- [x] components/chat/chat.tsx exists
- [x] components/chat/chat.integration-test.tsx exists
- [x] components/chat/mock-products.ts does NOT exist
- [x] all 12 tests pass (10 message-parts + 1 integration + 1 product-card regression)
- [x] zero MOCK_PRODUCTS / buildMockResults runtime references
- [x] discriminator narrowing in place; no `as ToolUIPart` substring
