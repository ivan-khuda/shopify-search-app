---
phase: 04-searchservice-wire-chat
plan: 05
type: execute
wave: 4
depends_on:
  - 04-01
  - 04-03
files_modified:
  - components/chat/message-parts.tsx
  - components/chat/chat-message.tsx
  - components/chat/chat.tsx
  - components/chat/chat.integration-test.tsx
  - components/chat/mock-products.ts
autonomous: true
requirements:
  - ADM-06
  - EMB-07
must_haves:
  truths:
    - "Product cards render directly from message.parts tool-result entries (NOT from a parallel useState side channel)"
    - "When the LLM tool call is in flight, an inline 'Searching your catalog…' pill is visible with role=status and a Loader2 spinner"
    - "When the tool returns zero products, a 'No matching products' inline affordance renders with copy 'Try a broader description or remove the price filter.'"
    - "When the tool errors, a quiet 'Couldn't fetch results' inline affordance renders with a small destructive-colored AlertCircle icon"
    - "The legacy PendingProductAttachment glue and client-side MOCK_PRODUCTS.filter() block are deleted from components/chat/chat.tsx"
    - "The greeting copy is updated to reference the price-filter feature ('Try a search like \"warm winter clothes\" or \"running shoes under $80\".')"
    - "components/chat/mock-products.ts is deleted; no runtime file references it"
    - "The integration test no longer depends on MOCK_PRODUCTS; it mocks useChat to emit a tool-searchCatalog output-available part"
    - "The tool-searchCatalog renderer narrows the ToolUIPart union via discriminator checks (part.type === 'tool-searchCatalog' AND 'state' in part), NOT via a direct `as ToolUIPart` cast — Vercel AI SDK v6 generates tool types dynamically from the tool registry"
  artifacts:
    - path: "components/chat/message-parts.tsx"
      provides: "Extended renderer that handles tool-searchCatalog states (input-streaming, input-available, output-available with products, output-available empty, output-error)"
      contains: "tool-searchCatalog"
      min_lines: 200
    - path: "components/chat/chat-message.tsx"
      provides: "Thread savedProductIds and onToggleSave through to MessageParts"
      contains: "savedProductIds"
    - path: "components/chat/chat.tsx"
      provides: "Refactored chat shell with PendingProductAttachment/MOCK_PRODUCTS deleted; greeting copy updated"
      contains: "running shoes under $80"
      does_not_contain: ["MOCK_PRODUCTS", "buildMockResults", "PendingProductAttachment"]
  key_links:
    - from: "components/chat/message-parts.tsx"
      to: "components/chat/product-card.tsx"
      via: "import { ProductCard } from '@/components/chat/product-card'"
      pattern: "from '@/components/chat/product-card'"
    - from: "components/chat/chat.tsx"
      to: "components/chat/chat-message.tsx"
      via: "<ChatMessage savedProductIds={...} onToggleSave={...} />"
      pattern: "savedProductIds"
---

<objective>
Refactor the chat UI so product cards render from `message.parts` tool-result entries instead of the legacy MOCK_PRODUCTS side-channel. This is the load-bearing UI plan for ADM-06 (UI surfaces grounded results) and the second half of EMB-07 (delete the MOCK_PRODUCTS file). The plan modifies three components and one integration test, then deletes `mock-products.ts`.

Purpose: Today's chat UI runs a client-side keyword search against `MOCK_PRODUCTS` on every submit and threads a `PendingProductAttachment` glue object through state to anchor cards to the next assistant message. After Phase 3 + 4 plans 04-02/03/04, the source of product results is the `searchCatalog` tool inside `streamText`, surfaced via `message.parts[*].type === 'tool-searchCatalog'`. The UI must read from there directly — no side channel, no anchor glue, no mock.

Output:
1. `components/chat/message-parts.tsx` extended to handle the 4-state `tool-searchCatalog` switch (running / products / empty / error) per UI-SPEC.md.
2. `components/chat/chat-message.tsx` threads `savedProductIds` + `onToggleSave` to `MessageParts`.
3. `components/chat/chat.tsx` gutted of legacy state; greeting copy updated; renders only `ChatMessage` per message and lets `MessageParts` own product-grid rendering.
4. `components/chat/chat.integration-test.tsx` updated to mock useChat with a tool-searchCatalog output-available part.
5. `components/chat/mock-products.ts` deleted.

The 04-01 RED scaffold `components/chat/__tests__/message-parts.test.tsx` turns GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md
@.planning/phases/04-searchservice-wire-chat/04-RESEARCH.md
@.planning/phases/04-searchservice-wire-chat/04-PATTERNS.md
@.planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md
@components/chat/message-parts.tsx
@components/chat/chat-message.tsx
@components/chat/chat.tsx
@components/chat/chat.integration-test.tsx
@components/chat/mock-products.ts
@components/chat/product-card.tsx
@components/chat/__tests__/product-card.test.tsx
@types/product.ts

<interfaces>
<!-- Existing component shapes. -->

From components/chat/product-card.tsx (Phase 1+ — DO NOT MODIFY in this plan):
```typescript
interface ProductCardProps {
  product: ChatProduct;
  isSaved: boolean;
  onSave: () => void;
}
export function ProductCard(props: ProductCardProps): JSX.Element;
```

From components/chat/chat-message.tsx (existing — MODIFY for prop threading):
- Receives `{ message, status }` plus the new `{ savedProductIds, onToggleSave }`
- Delegates rendering of `message.parts` to `<MessageParts ... />`

From components/chat/message-parts.tsx (existing — MODIFY):
- Current props: `{ parts, messageId, status }`
- Target props: `{ parts, messageId, status, savedProductIds: Set<string>, onToggleSave: (p: ChatProduct) => void }`

From Vercel AI SDK 6 (`ai` package — types imported into the renderer):
- `type ToolUIPart` — discriminated union over tool-call parts whose `type` field follows the pattern `tool-<toolName>` where `<toolName>` is derived dynamically from the tool registry passed to `streamText` (so the v6 SDK does NOT export a literal `'tool-searchCatalog'` type alias; the type emerges at compile-time from the tool definition site in app/api/chat/route.ts)
- `part.type === 'tool-searchCatalog'` matches when the tool key in /api/chat is 'searchCatalog'
- `part.state` is one of: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'approval-requested'
- For `output-available`, `part.output` is the tool execute return value (ChatProduct[] in our case)
- For `output-error`, `part.errorText` is set
- Narrowing pattern for the dynamically-named tool branch: DO NOT use a direct `const toolPart = part as ToolUIPart;` cast (this masks discriminator errors because the dynamic tool key is not in the union's literal types at every consumer site). USE structural discriminator narrowing: first `if (part.type === 'tool-searchCatalog')` to narrow `part.type`, then `'state' in part` (or progressively narrow on each state literal) to access `part.state`, then condition on each `part.state === 'input-streaming' | 'input-available' | 'output-available' | 'output-error'` before reading `part.output` / `part.errorText`. The TypeScript compiler then narrows the union without a `as` assertion.

From lucide-react (already in deps):
- `Loader2` (16px spinner inside running pill)
- `SearchX` (20px muted icon inside empty-results affordance)
- `AlertCircle` (12px destructive-colored icon inside error affordance)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend message-parts.tsx with the tool-searchCatalog state-machine renderer + thread savedProductIds/onToggleSave; update chat-message.tsx to forward those props</name>
  <files>components/chat/message-parts.tsx, components/chat/chat-message.tsx</files>
  <read_first>
    - components/chat/message-parts.tsx (entire file — preserve the existing text/step-start/shimmer branches; add a new `tool-searchCatalog` branch BEFORE the catch-all return null; keep the existing prop destructure and add savedProductIds + onToggleSave)
    - components/chat/chat-message.tsx (entire file — find where MessageParts is invoked and thread the new props through; understand the existing message+status prop pattern)
    - components/chat/product-card.tsx (entire file — ProductCard prop signature is unchanged; verify the existing render call shape so the grid wraps it correctly)
    - components/chat/__tests__/message-parts.test.tsx (the RED scaffold from 04-01 — this is the executable spec; the test imports MessageParts and renders with the new prop signature)
    - node_modules/ai/dist/index.d.ts (AI SDK v6 type definitions — locate the `ToolUIPart` declaration to confirm the union is discriminated by the `type: \`tool-${string}\`` template-literal type and `state` enum; observe that no literal type `'tool-searchCatalog'` is exported because the tool key is dynamic at registration time. The narrowing pattern in this task relies on this shape.)
    - .planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md §"Copywriting Contract" (exact strings: 'Searching your catalog…', 'No matching products', 'Try a broader description or remove the price filter.', 'Couldn\'t fetch results', 'Please try that search again.'), §"Interaction + Motion Contract" (150ms opacity fade, no other motion), §"Color" (semantic mapping per tool state), §"Accessibility Contract" (role=status, aria-live=polite, aria-label='{N} matching products', ul role=list, en-dash for price range)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md §Decisions D-06 (UI reads message.parts directly; PendingProductAttachment glue and MOCK_PRODUCTS.filter block are deleted in the same plan)
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md §"Concrete Syntax" §2 (state enum values verbatim), §"Pitfalls" Pitfall 5 (tool name spelling 'tool-searchCatalog' must match exactly with the tool key in /api/chat from plan 04-03)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md §"components/chat/message-parts.tsx" + §"components/chat/__tests__/message-parts.test.tsx"
    - types/product.ts (ChatProduct shape used in tool output)
  </read_first>
  <behavior>
    - MessageParts accepts new props `savedProductIds: Set<string>` and `onToggleSave: (p: ChatProduct) => void` in addition to the existing `parts`, `messageId`, `status`
    - For parts of type 'tool-searchCatalog':
      - state 'input-streaming' or 'input-available' renders a `<div role="status" aria-live="polite">` pill with Loader2 spinner and exact text 'Searching your catalog…'
      - state 'output-available' with non-empty array renders `<ul role="list" aria-live="polite" aria-label="{N} matching products">` containing `<li>` wrappers around `ProductCard` (with `isSaved={savedProductIds.has(product.id)}` and `onSave={() => onToggleSave(product)}`)
      - state 'output-available' with empty array renders the zero-results affordance with SearchX icon, heading 'No matching products', and body 'Try a broader description or remove the price filter.'
      - state 'output-error' renders the quiet error affordance with AlertCircle (destructive color, 12px), heading 'Couldn\'t fetch results', body 'Please try that search again.'
      - any unrecognized state (e.g., 'approval-requested') renders nothing
    - Other parts (text, step-start, the existing shimmer branch) render unchanged — regression-free
    - State transitions use only a CSS opacity fade (150ms) — no layout animation
    - ChatMessage threads `savedProductIds` and `onToggleSave` through to MessageParts
    - Type-narrowing rule (binding): the tool-searchCatalog branch must narrow the discriminated union via `if (part.type === 'tool-searchCatalog')` followed by progressive `part.state === 'input-streaming' | ... | 'output-error'` discriminator guards. NO `const toolPart = part as ToolUIPart;` cast. This is enforced by an additional `bunx tsc --noEmit` gate in acceptance_criteria below.
  </behavior>
  <action>
    Modify `components/chat/message-parts.tsx`:

    1. Extend the import block:
       - From 'ai': add `type ToolUIPart` to the existing imports (`ChatStatus, DynamicToolUIPart, StepStartUIPart, ToolUIPart, UIMessage` — ToolUIPart is already imported; verify it's available). Note: ToolUIPart is used only for prop typing where structurally needed, NOT as a target of a `as` cast inside the renderer (see narrowing rule below).
       - From 'lucide-react': add `Loader2, SearchX, AlertCircle` (new imports)
       - From '@/components/chat/product-card': add `import { ProductCard } from '@/components/chat/product-card';`
       - From '@/types/product': add `import type { ChatProduct } from '@/types/product';`

    2. Extend the MessagePartProps interface:
       - Keep existing fields: `parts: UIMessage["parts"]; messageId: string; status?: ChatStatus;`
       - Add: `savedProductIds: Set<string>;`
       - Add: `onToggleSave: (product: ChatProduct) => void;`

    3. Extend the MessageParts function signature to destructure the two new props.

    4. Inside the existing `messageParts.map((part, index) => { ... })` callback, ADD a new branch BEFORE the existing `if (!isChatStreaming) return null;` line. The branch handles `tool-searchCatalog` parts.

       Narrowing pattern (REQUIRED — DO NOT deviate; this prevents the W6 type-narrowing regression):
       - Begin the branch with `if (part.type === 'tool-searchCatalog' && 'state' in part) {`
       - Inside that block, do not introduce an intermediate `toolPart` constant via `as ToolUIPart`. Reference `part.state` directly on the narrowed `part` — TypeScript narrows the union for you because v6's ToolUIPart union is discriminated by both `type` (template-literal `tool-${string}`) and `state` (string-literal enum).
       - For each sub-state, use a fresh `if (part.state === 'input-streaming' || part.state === 'input-available')` / `if (part.state === 'output-available')` / `if (part.state === 'output-error')` guard. The compiler narrows `part.output` (only present on output-available) and `part.errorText` (only present on output-error) by structural inference.
       - When reading `part.output` inside the `output-available` branch, you may declare `const products = Array.isArray(part.output) ? (part.output as ChatProduct[]) : [];` — the cast is on the `output` shape (which the SDK types as `unknown`), NOT on `part` as a whole. This is a localized shape coercion, not a discriminator bypass.
       - Rationale: Vercel AI SDK v6 generates the dynamically-named tool union from the tool registry passed to streamText, so the literal type `'tool-searchCatalog'` is not always present in the ambient union at the consumer site. Using `'state' in part` and progressive state discriminator guards narrows via structural inference and survives downstream SDK type churn.

       Sub-cases inside the tool-searchCatalog branch:

       a) `if (part.state === 'input-streaming' || part.state === 'input-available')` — render the running pill:
          - `<div key={key} role="status" aria-live="polite" className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-opacity duration-150">`
          - Inside: `<Loader2 className="size-4 animate-spin" aria-hidden="true" />` then literal text `Searching your catalog…`
          - Note: the ellipsis is a single Unicode character U+2026 (`…`), NOT three dots `...` (UI-SPEC.md Copywriting Contract row)

       b) `if (part.state === 'output-available')`:
          - `const products = Array.isArray(part.output) ? (part.output as ChatProduct[]) : [];`
          - If `products.length === 0`: render zero-results affordance:
            - `<div key={key} role="status" aria-live="polite" className="flex flex-col items-start gap-1 transition-opacity duration-150">`
            - Inner: `<div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">` containing `<SearchX className="size-5" aria-hidden="true" />` and literal text `No matching products`
            - Below: `<p className="text-xs text-muted-foreground">Try a broader description or remove the price filter.</p>`
          - Else (products.length > 0): render the grid:
            - `<ul key={key} role="list" aria-live="polite" aria-label={`${products.length} matching products`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-150">`
            - Map products to `<li key={product.id}><ProductCard product={product} isSaved={savedProductIds.has(product.id)} onSave={() => onToggleSave(product)} /></li>`

       c) `if (part.state === 'output-error')` — render the quiet error affordance:
          - `<div key={key} role="status" aria-live="polite" className="flex flex-col items-start gap-1 transition-opacity duration-150">`
          - Inner: `<div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">` containing `<AlertCircle className="size-3 text-destructive" aria-hidden="true" />` and literal text `Couldn't fetch results` (use the HTML entity `&apos;` in JSX so it matches the existing apostrophe convention in chat.tsx)
          - Below: `<p className="text-xs text-muted-foreground">Please try that search again.</p>`

       d) For any other state (e.g., 'approval-requested', 'output-denied', or future states): `return null;` — UI is intentionally silent.

    5. Preserve all existing branches: the streaming/Thinking shimmer at the top of the map, the text part rendering, the commented-out reasoning block, and the final `return null;`. Do not break the regression test for text parts.

    6. Preserve the helper functions defined at the top of the file (`isStepStartPart`, `isToolLikePart`, `isRenderableTextPart`, `isRenderableReasoningPart`, `isRenderableDataPart`, `hasRenderableContentAfter`, `shouldShowToolLoading`, `findNearestToolNeighbor`, `shouldShowStepStartLoading`). They are used by the existing branches and may be inspected by future plans.

    Modify `components/chat/chat-message.tsx`:

    1. Extend the props interface to include `savedProductIds: Set<string>` and `onToggleSave: (product: ChatProduct) => void`. Import `ChatProduct` from `@/types/product` if not already imported.

    2. Destructure the two new props.

    3. Pass them through to `<MessageParts ... />` invocation: `savedProductIds={savedProductIds}`, `onToggleSave={onToggleSave}`.

    4. The component's other behavior (avatar, role rendering, status forwarding) is unchanged.

    Do NOT modify `components/chat/product-card.tsx`. Do NOT modify `components/chat/chat.tsx` yet — that is Task 2.

    All assertions in `components/chat/__tests__/message-parts.test.tsx` (10+ tests from 04-01) must pass after this task.
  </action>
  <verify>
    <automated>bunx vitest run components/chat/__tests__/message-parts.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File components/chat/message-parts.tsx exists (modified) and contains the literal strings: `tool-searchCatalog`, `Searching your catalog`, `No matching products`, `Try a broader description or remove the price filter.`, `Couldn\'t fetch results` OR `Couldn&apos;t fetch results`, `Please try that search again.`, `aria-live="polite"`, `aria-label`, `role="status"`, `Loader2`, `SearchX`, `AlertCircle`, `ProductCard`
    - Command `grep -c "savedProductIds" components/chat/message-parts.tsx` returns at least 3 (prop signature, default destructure, ProductCard prop)
    - Command `grep -c "onToggleSave" components/chat/message-parts.tsx` returns at least 3
    - Command `grep -c "from '@/components/chat/product-card'" components/chat/message-parts.tsx` returns 1
    - Command `grep -c "from 'lucide-react'" components/chat/message-parts.tsx` returns at least 1 (existing or new import block containing Loader2, SearchX, AlertCircle)
    - Type-narrowing gate (W6 fix — discriminator narrowing, not a direct cast): Command `grep -c "part.type === 'tool-searchCatalog'" components/chat/message-parts.tsx` returns at least 1 (the discriminator entry guard)
    - Type-narrowing gate (W6 fix): Command `grep -c "'state' in part" components/chat/message-parts.tsx` returns at least 1 (the structural-narrowing companion guard)
    - Anti-pattern gate (W6 fix): Command `grep -c "as ToolUIPart" components/chat/message-parts.tsx` returns 0 (the direct cast is forbidden — discriminator narrowing replaces it)
    - File components/chat/chat-message.tsx contains `savedProductIds` and `onToggleSave` as props threaded to MessageParts
    - `grep -c "savedProductIds={savedProductIds}" components/chat/chat-message.tsx` returns 1
    - `grep -c "onToggleSave={onToggleSave}" components/chat/chat-message.tsx` returns 1
    - The existing `text` branch in message-parts.tsx still works — running `grep -c 'type === "text"' components/chat/message-parts.tsx` returns >= 1 (the branch remains)
    - Running `bunx vitest run components/chat/__tests__/message-parts.test.tsx` exits 0 with all 10+ assertions passing
    - Running `bun lint` exits 0
    - Running `bunx tsc --noEmit` exits 0 (catches discriminator narrowing failures — if the cast-free narrowing pattern is wrong, the compiler will flag invalid `part.output` / `part.errorText` accesses; this gate is the W6 type-safety check)
    - The ellipsis character at the end of 'Searching your catalog…' is U+2026 (a single character), verified via: `grep -c "Searching your catalog…" components/chat/message-parts.tsx` returns 1 (the file source must contain the literal U+2026, not `\\u2026` and not three dots)
  </acceptance_criteria>
  <done>message-parts.tsx renders the four tool-searchCatalog states per UI-SPEC.md, chat-message.tsx threads the new props through, the 04-01 RED scaffold for message-parts is GREEN, the discriminator narrowing pattern is in place (no `as ToolUIPart` cast), and TS strict + ESLint pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Gut components/chat/chat.tsx of MOCK_PRODUCTS glue, update greeting, rewrite integration test, delete components/chat/mock-products.ts</name>
  <files>components/chat/chat.tsx, components/chat/chat.integration-test.tsx, components/chat/mock-products.ts</files>
  <read_first>
    - components/chat/chat.tsx (entire file — identify the exact lines to delete: MOCK_PRODUCTS import line 18, ProductAttachmentState interface lines 77-80, PendingProductAttachment interface lines 82-85, buildMockResults function lines 87-103, pendingProducts useState line 106, attachedProducts useMemo lines 112-142, the buildMockResults call + setPendingProducts call in handleSubmit lines 153-158, the productsForMessage + inline ProductCard grid lines 184-202)
    - components/chat/chat.integration-test.tsx (entire file — identify the MOCK_PRODUCTS import line 4 and the savedProduct = MOCK_PRODUCTS[0] reference line 36; understand the useChat mock structure for refactoring)
    - components/chat/chat-message.tsx (after Task 1 — confirm it now accepts savedProductIds + onToggleSave so chat.tsx can pass them in)
    - .planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md §"Copywriting Contract" — exact greeting copy: `Hello! I'm your AI Shopping Assistant. Try a search like "warm winter clothes" or "running shoes under $80".`
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md §Decisions D-06 (delete same-plan: PendingProductAttachment, MOCK_PRODUCTS.filter, attachedProducts memo)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md §"components/chat/chat.tsx" (Lines to delete table) + §"components/chat/chat.integration-test.tsx" (rewire mock to emit tool-searchCatalog output-available)
  </read_first>
  <behavior>
    - components/chat/chat.tsx no longer imports MOCK_PRODUCTS or ProductCard (ProductCard rendering moved to message-parts.tsx in Task 1)
    - components/chat/chat.tsx no longer declares ProductAttachmentState, PendingProductAttachment, buildMockResults, pendingProducts, or attachedProducts
    - The greeting block shows the new copy: 'Hello! I'm your AI Shopping Assistant. Try a search like "warm winter clothes" or "running shoes under $80".' (apostrophe rendered as `&apos;` per existing JSX convention; quoted phrases use ASCII quotes via JSX entities or HTML-safe characters)
    - Inside the messages.map callback, only `<ChatMessage message={message} status={status} savedProductIds={savedProductIds} onToggleSave={onToggleSave} />` is rendered per message — no productsForMessage variable, no inline grid (those live in message-parts.tsx now)
    - handleSubmit still calls sendMessage({ text: query }) AND onHistoryAdd; productCount may default to 0 (cards count is no longer client-derivable at submit time since the tool result arrives later)
    - components/chat/mock-products.ts is deleted from disk
    - components/chat/chat.integration-test.tsx no longer imports MOCK_PRODUCTS; uses an inline ChatProduct test fixture and asserts that a product card renders when the useChat mock returns a message with a tool-searchCatalog output-available part
  </behavior>
  <action>
    Phase A — Modify `components/chat/chat.tsx`:

    1. DELETE the import at line 18: `import { MOCK_PRODUCTS } from '@/components/chat/mock-products';`
    2. DELETE the import at line 17: `import { ProductCard } from '@/components/chat/product-card';` (ProductCard is now imported by message-parts.tsx; chat.tsx no longer renders cards directly)
    3. DELETE the interfaces at lines 77-85: `ProductAttachmentState` and `PendingProductAttachment`
    4. DELETE the `buildMockResults` function at lines 87-103
    5. DELETE the useState at line 106: `const [pendingProducts, setPendingProducts] = useState<PendingProductAttachment | null>(null);`
    6. DELETE the `attachedProducts` useMemo at lines 112-142 (the entire block from `const attachedProducts = useMemo<...>(...)` through `}, [messages, pendingProducts]);`)
    7. Inside `handleSubmit` at lines 144-169: KEEP the parts that handle the empty-text guard, the `onHistoryAdd` call, and the `sendMessage({ text: query })` call. DELETE the `const products = hasText ? buildMockResults(query) : [];` line and the entire `setPendingProducts({ anchorMessageId: ..., products });` call. Update the `onHistoryAdd` call: replace `productCount: products.length` with `productCount: 0` and add an inline comment: `// productCount is no longer client-derivable at submit time; cards arrive via tool-result parts. Phase 5/6 may relocate history derivation to a useEffect that watches messages.`
    8. Replace the greeting block at lines 175-182 with the new copy. Exact JSX (apostrophes via `&apos;`, quotes as straight ASCII via `&quot;` or backslash-escaped):
       ```jsx
       <p>
         Hello! I&apos;m your AI Shopping Assistant. Try a search like &quot;warm winter clothes&quot; or &quot;running shoes under $80&quot;.
       </p>
       ```
       (JSX entities are used to match the existing convention at line 178; do NOT use raw `'` or `"` characters that could trigger JSX parser quirks.)
    9. Replace the messages.map block at lines 183-205. New shape:
       ```jsx
       {messages.map((message) => (
         <div key={message.id} className="space-y-4">
           <ChatMessage
             message={message}
             status={status}
             savedProductIds={savedProductIds}
             onToggleSave={onToggleSave}
           />
         </div>
       ))}
       ```
       The `productsForMessage` variable, the conditional, and the inline `<div className="grid ...">` ProductCard block are all deleted — `message-parts.tsx` owns this rendering now.

    10. The `useChat()` hook call, the `savedProductIds` useMemo, and the `PromptInput*` block remain unchanged. The component should still render its PromptInput footer exactly as before.

    Phase B — Modify `components/chat/chat.integration-test.tsx`:

    1. DELETE the import at line 4: `import { MOCK_PRODUCTS } from '@/components/chat/mock-products';`
    2. Replace the `savedProduct = MOCK_PRODUCTS[0]` reference with an inline fixture at the top of the describe block:
       ```typescript
       import type { ChatProduct } from '@/types/product';
       const TEST_PRODUCT: ChatProduct = {
         id: 'p-1',
         title: 'Test Sneakers',
         price: '$89.00',
         description: 'A test product.',
       };
       ```
    3. Update the `onHistoryAdd` expectation at lines 62-68: replace `productCount: 1` with `productCount: 0` (matches the new submit-time semantics from Phase A step 7).
    4. Update the `setMessages` block at lines 74-90. Append a tool-searchCatalog `output-available` part to the assistant-2 message:
       ```typescript
       setMessages([
         {
           id: 'assistant-1',
           role: 'assistant',
           parts: [{ type: 'text', text: 'Earlier suggestions are ready.' }],
         },
         {
           id: 'user-1',
           role: 'user',
           parts: [{ type: 'text', text: 'running shoes' }],
         },
         {
           id: 'assistant-2',
           role: 'assistant',
           parts: [
             { type: 'text', text: 'Fresh running options for you.' },
             // The tool-searchCatalog part shape must match what Vercel AI SDK v6 emits;
             // cast as never because the test composes raw runtime objects rather than going through the SDK.
             { type: 'tool-searchCatalog', state: 'output-available', output: [TEST_PRODUCT], input: {}, toolCallId: 't1' } as never,
           ],
         },
       ]);
       ```
    5. Update the `savedProducts` prop passed to the second `<Chat ... />` render: replace `savedProduct` (which was `MOCK_PRODUCTS[0]`) with `TEST_PRODUCT` everywhere. The test assertion `expect(screen.getByText(savedProduct.title)).toBeInTheDocument()` becomes `expect(screen.getByText(TEST_PRODUCT.title)).toBeInTheDocument()`.
    6. The `expect(screen.getByText('Earlier suggestions are ready.')).toBeInTheDocument()` and `expect(screen.getByText('Fresh running options for you.')).toBeInTheDocument()` assertions remain — they verify the text branches of message-parts still render. The new card assertion `expect(screen.getByText(TEST_PRODUCT.title)).toBeInTheDocument()` verifies the tool-result branch renders.

    Phase C — Delete `components/chat/mock-products.ts`:

    1. Use `rm components/chat/mock-products.ts` or the Bash tool to delete the file.
    2. Confirm no remaining references via: `grep -rn "MOCK_PRODUCTS\\|buildMockResults\\|from '@/components/chat/mock-products'" app components lib services types`
    3. Expected output: nothing (zero matches across all source directories).
  </action>
  <verify>
    <automated>bunx vitest run components/chat/chat.integration-test.tsx components/chat/__tests__/message-parts.test.tsx components/chat/__tests__/product-card.test.tsx 2>&amp;1 | tail -20 ; ! grep -rn "MOCK_PRODUCTS\|buildMockResults\|from '@/components/chat/mock-products'" app components lib services types</automated>
  </verify>
  <acceptance_criteria>
    - File components/chat/mock-products.ts DOES NOT EXIST (use `test ! -e components/chat/mock-products.ts && echo OK`)
    - Command `grep -rn "MOCK_PRODUCTS\|buildMockResults\|from '@/components/chat/mock-products'" app components lib services types` returns no matches (zero references runtime-wide)
    - Command `grep -c "MOCK_PRODUCTS\|buildMockResults\|PendingProductAttachment\|ProductAttachmentState\|attachedProducts\|pendingProducts\|setPendingProducts" components/chat/chat.tsx` returns 0
    - Command `grep -c "ProductCard" components/chat/chat.tsx` returns 0 (ProductCard rendering moved entirely to message-parts.tsx)
    - Command `grep -c "from '@/components/chat/product-card'" components/chat/chat.tsx` returns 0
    - Command `grep -c "Hello! I&apos;m your AI Shopping Assistant" components/chat/chat.tsx` returns 1
    - Command `grep -c "running shoes under \\\$80" components/chat/chat.tsx` returns 1 (the new greeting copy includes the literal price-filter demo)
    - Command `grep -c "warm winter clothes" components/chat/chat.tsx` returns 1
    - Command `grep -c "savedProductIds={savedProductIds}" components/chat/chat.tsx` returns 1
    - Command `grep -c "onToggleSave={onToggleSave}" components/chat/chat.tsx` returns 1
    - File components/chat/chat.integration-test.tsx no longer contains `MOCK_PRODUCTS`: `grep -c "MOCK_PRODUCTS" components/chat/chat.integration-test.tsx` returns 0
    - File components/chat/chat.integration-test.tsx contains `tool-searchCatalog`: `grep -c "tool-searchCatalog" components/chat/chat.integration-test.tsx` returns at least 1
    - File components/chat/chat.integration-test.tsx contains the inline fixture: `grep -c "TEST_PRODUCT" components/chat/chat.integration-test.tsx` returns at least 3
    - Running `bunx vitest run components/chat/chat.integration-test.tsx` exits 0
    - Running `bunx vitest run components/chat/__tests__/product-card.test.tsx` exits 0 (regression check — existing tests untouched)
    - Running `bunx vitest run components/chat/__tests__/message-parts.test.tsx` exits 0 (still GREEN from Task 1)
    - Running `bun lint` exits 0
    - Running `bunx tsc --noEmit` exits 0
    - EMB-07 final source-level proof: `grep -rn "MOCK_PRODUCTS\|buildMockResults" app components services lib types` returns NO matches anywhere in the runtime tree
  </acceptance_criteria>
  <done>chat.tsx is gutted of legacy MOCK_PRODUCTS state and renders only ChatMessage per message; the greeting copy includes the price-filter demo; chat.integration-test.tsx is rewritten to mock a tool-searchCatalog output-available part with an inline TEST_PRODUCT fixture; mock-products.ts is deleted; the runtime tree has zero MOCK_PRODUCTS references; TS strict + ESLint pass; integration test, product-card test, and message-parts test all pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tool result (LLM-orchestrated) → UI render | tool output is server-generated (SearchService rows projected to ChatProduct); LLM cannot inject products into `message.parts[*].output`, only into `text` parts |
| User's saved-products state → ProductCard onSave callback | local React state, no cross-tenant or persistence concerns in Phase 4 (persistence is Phase 5/6) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-19 | Tampering | LLM emits hallucinated product cards | mitigate | UI renders only `part.output` from `tool-searchCatalog` parts; LLM cannot populate that field — only the tool's `execute` (server-side hybridSearch) can. Per V4 ASVS + RESEARCH.md security row "LLM hallucinated product IDs". |
| T-04-20 | Tampering | LLM emits a tool-result for a tool we didn't define (e.g., `tool-searchAllShops`) | mitigate | The render switch matches only `part.type === 'tool-searchCatalog'` (Pitfall 5 exact-name lock). Unknown tool-* parts fall through to the existing `if (!isChatStreaming) return null;` branch and render nothing. |
| T-04-21 | Information Disclosure | Tool error message renders user-supplied content | mitigate | The error affordance uses fixed UI copy ('Couldn\'t fetch results' / 'Please try that search again.') — `part.errorText` is never rendered. SearchService catches and returns []; only `output-error` paths come from streamText/SDK level. |
| T-04-22 | XSS via tool output | tool returns malicious product fields | mitigate | ProductCard renders all fields as React text (auto-escaped) — no `dangerouslySetInnerHTML`. SearchService projects DB rows that are stored from Shopify's verified-by-them API (Phase 2 sync). |
| T-04-23 | Repudiation | Legacy MOCK_PRODUCTS surface returns silently after refactor | mitigate | Acceptance gate uses recursive grep across runtime directories (app, components, services, lib, types) and requires zero matches. The mock-products.ts file is deleted from disk. |
</threat_model>

<verification>
After both tasks complete:
1. `bunx vitest run components/chat/__tests__/message-parts.test.tsx components/chat/chat.integration-test.tsx components/chat/__tests__/product-card.test.tsx` exits 0.
2. `grep -rn "MOCK_PRODUCTS\|buildMockResults" app components services lib types` returns nothing.
3. `test ! -e components/chat/mock-products.ts && echo OK` prints OK.
4. `bun lint` exits 0.
5. `bunx tsc --noEmit` exits 0.
6. The greeting demo copy is visible: `grep "running shoes under \\\$80" components/chat/chat.tsx` returns one match.
7. The discriminator narrowing pattern in message-parts.tsx is in place: `grep -c "part.type === 'tool-searchCatalog'" components/chat/message-parts.tsx` >= 1 AND `grep -c "as ToolUIPart" components/chat/message-parts.tsx` == 0.
</verification>

<success_criteria>
- message-parts.tsx renders all four tool-searchCatalog states per UI-SPEC.md with correct ARIA roles + exact copy
- The tool-searchCatalog renderer uses discriminator narrowing (part.type === 'tool-searchCatalog' AND 'state' in part) — no direct `as ToolUIPart` cast (W6 fix)
- chat-message.tsx threads savedProductIds + onToggleSave through to MessageParts
- chat.tsx is gutted of MOCK_PRODUCTS / PendingProductAttachment glue; greeting copy updated
- mock-products.ts file is deleted from disk
- Integration test rewritten to mock useChat with a tool-searchCatalog output-available part
- Zero runtime references to MOCK_PRODUCTS or buildMockResults anywhere in app/components/services/lib/types
- Phase 4 success criterion #3 is fully proven at the source level: SearchService.hybridSearch is the sole product source; MOCK_PRODUCTS is gone from disk
- `bunx tsc --noEmit` passes (catches W6 narrowing-pattern regression at compile time)
</success_criteria>

<output>
Create `.planning/phases/04-searchservice-wire-chat/04-05-SUMMARY.md` when done. Include: a summary of deleted line ranges in chat.tsx, the new greeting copy verbatim, confirmation that the mock-products.ts file is deleted (with `test -e` exit code), the recursive grep output proving zero MOCK_PRODUCTS references, the discriminator narrowing pattern snippet from message-parts.tsx confirming `as ToolUIPart` is absent (W6 fix), and a list of all currently passing Phase 4 test files (running totals).
</output>
</content>
