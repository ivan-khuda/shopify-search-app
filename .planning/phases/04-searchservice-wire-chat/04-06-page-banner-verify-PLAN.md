---
phase: 04-searchservice-wire-chat
plan: 06
type: execute
wave: 5
depends_on:
  - 04-02
  - 04-03
  - 04-04
  - 04-05
files_modified:
  - app/(embedded)/chat/page.tsx
  - components/chat/chat-shell.tsx
  - .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md
  - .planning/STATE.md
  - .planning/ROADMAP.md
autonomous: false
requirements:
  - ADM-05
must_haves:
  truths:
    - "D-11: The /chat page is a server component that awaits getActiveChatModel(shop) and server-renders a slim banner ABOVE the tab strip (Chat / History / Saved) — placement, server-render, and 'no client fetch' are all locked by D-11"
    - "D-11: The banner displays the literal string 'Preview mode — using your real catalog · Model: Gemini 2.5 Flash' character-for-character (em-dash U+2014, middle-dot U+00B7) with the muted Tailwind background style (bg-muted/40 text-muted-foreground text-xs) per D-11"
    - "The banner has role='status' and aria-live='off' (per UI-SPEC.md accessibility lock — banner is static at page load, not a transient notification)"
    - "The banner uses dynamic interpolation `{model.displayName}` (NOT a hardcoded 'Gemini 2.5 Flash' literal in the final JSX expression) so Phase 7's body-only swap of getActiveChatModel re-renders the banner without touching page.tsx"
    - "The banner aria-label string is exactly 'Chat playground preview mode banner. Active model: {displayName}.' per UI-SPEC.md Accessibility row"
    - "D-11: The banner stays visible throughout /chat (no dismiss button, no auto-hide) — it's a mode indicator, not a transient notification, per D-11"
    - "The tabbed Chat/History/Saved UI (previously the entire client page) is extracted into a new client component components/chat/chat-shell.tsx; page.tsx is server-rendered"
    - "All Phase 4 test files pass; full suite reports >= 150 total test cases (Phase 3 baseline 125 + ~25 new Phase 4 tests)"
    - "EMB-05, EMB-07, ADM-05, ADM-06 are each provable via specific automated assertions documented in 04-VERIFICATION.md"
    - "A manual smoke test confirms the demo query 'show me waterproof jackets under $100' surfaces real-catalog cards in /chat against a seeded dev shop (operator-confirmed via human checkpoint)"
  artifacts:
    - path: "app/(embedded)/chat/page.tsx"
      provides: "Server component that fetches active model and renders banner + ChatShell"
      contains: "Preview mode"
      exports: ["ChatPage (default)"]
    - path: "components/chat/chat-shell.tsx"
      provides: "Client component holding the tabbed Chat/History/Saved UI lifted from the old page.tsx"
      contains: "use client"
      exports: ["ChatShell"]
    - path: ".planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md"
      provides: "Phase 4 verification gate report"
      contains: "ADM-05"
  key_links:
    - from: "app/(embedded)/chat/page.tsx"
      to: "services/chat/getActiveChatModel.ts"
      via: "import { getActiveChatModel } from '@/services/chat/getActiveChatModel'"
      pattern: "from '@/services/chat/getActiveChatModel'"
    - from: "app/(embedded)/chat/page.tsx"
      to: "components/chat/chat-shell.tsx"
      via: "import { ChatShell } from '@/components/chat/chat-shell'"
      pattern: "from '@/components/chat/chat-shell'"
---

<objective>
Land the final wave of Phase 4: refactor `app/(embedded)/chat/page.tsx` into a server component that fetches the active model and server-renders the preview banner, with all client state (tabs, history, saved-products) lifted into a new `components/chat/chat-shell.tsx` client component. Then run the Phase 4 verification gate — full suite + manual smoke for the demo query and brand/SKU query — and update STATE.md + ROADMAP.md to reflect Phase 4 completion.

Purpose: This is the only ADM-05 implementation work in the phase (Preview banner with active model name) AND the verification gate that closes the phase. The banner is the visible affirmation to the merchant that they are looking at their real catalog, with the active model surfaced for transparency. Once green, /api/chat is wired and Phase 5's chat-ui extraction can proceed.

Output:
1. Refactored `app/(embedded)/chat/page.tsx` (server component) with the banner.
2. New `components/chat/chat-shell.tsx` (client component) holding the tabbed UI.
3. `04-VERIFICATION.md` documenting per-requirement test pass/fail status and the manual smoke results.
4. Updated `.planning/STATE.md` and `.planning/ROADMAP.md` reflecting Phase 4 completion.
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
@.planning/phases/04-searchservice-wire-chat/04-VALIDATION.md
@app/(embedded)/chat/page.tsx
@app/(embedded)/layout.tsx

<interfaces>
<!-- Wave 2/3/4 outputs (now landed) this plan consumes. -->

From services/chat/getActiveChatModel.ts (Wave 2):
- `export interface ActiveChatModel { id: string; displayName: string; }`
- `export async function getActiveChatModel(shop: string): Promise<ActiveChatModel>;`
- Phase 4 returns `{ id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }`

Next.js 16 App Router:
- Server Components are the default for files in `app/` (no client directive)
- `searchParams` in page props is `Promise<Record<string, string | undefined>>` (Next 15+ async pattern)
- Client components must declare the use-client directive at the top of the file

Existing /chat page state to lift into ChatShell:
- `selectedTab: string` (default 'chat')
- `history: ChatHistoryItem[]`
- `savedProducts: ChatProduct[]`
- Handlers: handleToggleSave, handleHistoryAdd, handleNewChat
- Render: Tabs + TabsList + TabsContents block (including the inline Sparkles header)

Banner constraints from UI-SPEC.md (Copywriting + Color + Accessibility):
- Text: `Preview mode — using your real catalog · Model: {displayName}` (em-dash U+2014, middle-dot U+00B7)
- Style: `bg-muted/40 text-muted-foreground text-xs py-1.5 px-4 sm:px-6 border-b border-border`
- DisplayName span: `text-foreground font-semibold`
- ARIA: role='status' aria-live='off' aria-label='Chat playground preview mode banner. Active model: {displayName}.'
- Banner total height ~28px (passive label, not interactive)
- Placement: ABOVE the TabsList in the page hierarchy
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Split chat page into server component (page.tsx with banner) + client component (chat-shell.tsx with tabs)</name>
  <files>app/(embedded)/chat/page.tsx, components/chat/chat-shell.tsx</files>
  <read_first>
    - app/(embedded)/chat/page.tsx (current file — the entire body becomes the new components/chat/chat-shell.tsx; the new page.tsx is server-rendered, fetches the model, and renders the banner + ChatShell)
    - app/(embedded)/chat/page.integration-test.tsx (current integration test — assess its mock target and either update to import from chat-shell OR delete per the directive in this task's action)
    - app/(embedded)/layout.tsx (only server-component precedent in the (embedded) route group — replicate the server-component shape)
    - .planning/phases/04-searchservice-wire-chat/04-UI-SPEC.md sections Copywriting Contract (banner exact-string + ARIA label), Color (bg-muted/40 token), Spacing Scale (28px banner-height exception), Accessibility Contract (role=status, aria-live=off — banner is static), Visual Hierarchy (banner is ABOVE the TabsList)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md Decisions D-11 (banner placement, style, server-rendered, no dismiss; locked phrasing)
    - .planning/phases/04-searchservice-wire-chat/04-RESEARCH.md Concrete Syntax section 6 (server-component template; em-dash and middle-dot literal characters), Pitfalls Pitfall 6 (banner typography drift via formatter rewrites — this task inlines the literal in JSX)
    - .planning/phases/04-searchservice-wire-chat/04-PATTERNS.md sections "app/(embedded)/chat/page.tsx (MODIFY)" and "ChatShell client component (extracted from current page.tsx)"
    - services/chat/getActiveChatModel.ts (Wave 2 output — the getActiveChatModel(shop) signature)
  </read_first>
  <behavior>
    - app/(embedded)/chat/page.tsx is a Server Component (no client directive at top); declared as async function for the await call to getActiveChatModel
    - On render, page.tsx awaits searchParams (Next 15+ async pattern) to read shop, then awaits getActiveChatModel(shop) and passes the resulting displayName to a wrapping banner
    - The banner is server-rendered above the ChatShell: a single div with role='status' aria-live='off' aria-label including the displayName, Tailwind classes per UI-SPEC.md, with the displayName wrapped in a span using text-foreground font-semibold
    - The banner JSX uses the JSX expression `{model.displayName}` to interpolate the dynamic value — the literal string 'Gemini 2.5 Flash' MUST NOT appear in app/(embedded)/chat/page.tsx (only the constant inside getActiveChatModel.ts owns that literal; Phase 7's body-only swap then re-renders the banner without page.tsx changes)
    - The banner text is EXACTLY 'Preview mode — using your real catalog · Model: {displayName}' (with em-dash U+2014 and middle-dot U+00B7 as literal characters in the source)
    - The banner aria-label is EXACTLY the literal string 'Chat playground preview mode banner. Active model: {displayName}.' (interpolated displayName, but the surrounding phrase is exact per UI-SPEC.md Accessibility row)
    - The banner aria-live attribute is 'off' (banner is static at page load, NOT a transient update) — distinct from tool-state affordances in components/chat/message-parts.tsx which use aria-live='polite' (transient updates emitted when the LLM tool resolves). The two values are intentional and must not be conflated.
    - components/chat/chat-shell.tsx is a Client Component containing all the state and handlers that were in the old page.tsx (tabs, history, saved products, handleToggleSave, handleHistoryAdd, handleNewChat) and the Tabs/TabsList/TabsContents render block including the inline Sparkles header
    - When shop is missing from searchParams (which middleware should prevent), page.tsx falls back to shop = empty string and getActiveChatModel returns the same DEFAULT_MODEL (Phase 4 stub is shop-agnostic). Do not crash; do not show an error page.
  </behavior>
  <action>
    Phase A — Create components/chat/chat-shell.tsx:

    1. New file with the use-client directive on line 1.
    2. Copy ALL imports and the entire ChatPage function body from the current app/(embedded)/chat/page.tsx into this file. Rename the exported function from ChatPage to ChatShell. Change the default export to a named export.
    3. The component takes NO props in Phase 4 — it owns all its own state. Header with Sparkles tile, tabs, all handlers, the tabbed header block with TabsList — all live here.
    4. Preserve the existing classes / colors / inline hex literals (#008060, #e1e3e5 etc.) — UI-SPEC.md Risks-and-FLAGs point 2 documents these as Phase 5 cleanup, NOT Phase 4 work.
    5. The new chat.integration-test still imports Chat from @/components/chat/chat — that is a different component than ChatShell; Chat is rendered inside the tabs by ChatShell.

    Phase B — Rewrite app/(embedded)/chat/page.tsx:

    1. DELETE the use-client directive on line 1. DELETE all imports that are now in chat-shell (Tabs, TabsContent, TabsContents, TabsList, TabsTrigger, Chat, HistoryPanel, SavedProductsPanel, the lucide icons Bookmark/HistoryIcon/MessageSquare/PlusIcon/Sparkles, Button, useState, cn, the type imports for ChatHistoryItem/ChatProduct). page.tsx keeps only the imports it actually uses.

    2. New imports — single block:
       - getActiveChatModel from @/services/chat/getActiveChatModel
       - ChatShell from @/components/chat/chat-shell

    3. New component signature: an async default export named ChatPage taking { searchParams } where searchParams is typed as Promise<{ shop?: string }>. Body: const { shop } = await searchParams; const model = await getActiveChatModel(shop ?? ''); return JSX containing the banner div + ChatShell.

    4. Banner JSX shape (inline, no separate component file in Phase 4):
       - Outer div wraps with className mx-auto w-full
       - Inner banner div has: role='status', aria-live='off', aria-label=`Chat playground preview mode banner. Active model: ${model.displayName}.`, className='bg-muted/40 text-muted-foreground text-xs py-1.5 px-4 sm:px-6 border-b border-border'
       - Banner text: literal 'Preview mode — using your real catalog · Model: ' (with em-dash U+2014 and middle-dot U+00B7) followed by a span with className='text-foreground font-semibold' wrapping the JSX expression `{model.displayName}` (DO NOT inline the literal string 'Gemini 2.5 Flash' here — interpolate via the JSX expression so Phase 7's body-only swap of getActiveChatModel propagates the new model name without touching this file)
       - After the banner: a self-closing ChatShell element

    5. The em-dash character (' — ') between 'mode' and 'using' MUST be U+2014 typed as the literal character. The middle-dot character (' · ') between 'catalog' and 'Model:' MUST be U+00B7 typed as the literal character. Type these characters directly into the source file (UTF-8 encoded). Verify after writing with the byte-precise grep gate.

    6. The aria-live value MUST be 'off' (NOT 'polite') per UI-SPEC.md Accessibility row — banner is static at page load, not a transient update. Note: this is the inverse of components/chat/message-parts.tsx (Plan 04-05 Task 1), where the tool-state pill / zero-results / error affordances use aria-live='polite' because they ARE transient updates announced when the LLM tool resolves. The two ARIA contracts coexist intentionally; the gates below verify both.

    7. The banner appears ABOVE the ChatShell (which contains the tabbed header with TabsList). This places it directly under the Polaris-injected admin chrome, above the embedded app's own header.

    Phase C — Validate no regressions:

    1. Run the full vitest suite — all Phase 1–4 tests must pass.
    2. Run bun lint — zero errors.
    3. Run bunx tsc --noEmit — zero type errors.

    Phase D — Handle the existing integration test at `app/(embedded)/chat/page.integration-test.tsx`:

    Pick ONE of the two options below and add the matching acceptance gate; do NOT defer to executor judgement.

    Option (i) — UPDATE the test to point at the lifted ChatShell:
    - Open `app/(embedded)/chat/page.integration-test.tsx`, replace any import or `vi.mock(...)` target referencing the old client-rendered page with one referencing `@/components/chat/chat-shell`.
    - The asserted client-side behaviors (tab switching, history side effects, saved-products handlers) should now render via the ChatShell client component.
    - Matching gate (must appear in acceptance_criteria below): `grep -c "chat-shell" app/(embedded)/chat/page.integration-test.tsx` returns at least 1.

    Option (ii) — DELETE the test entirely:
    - Justified only if the new `components/chat/chat.integration-test.tsx` (Plan 04-05 Task 2) covers the same scenarios.
    - Remove the file via `rm app/(embedded)/chat/page.integration-test.tsx`.
    - Add a one-line rationale to 04-06-SUMMARY.md under a "Coverage handoff" heading explaining the test deletion (e.g., "Deleted page.integration-test.tsx; client tab behaviors are now covered by components/chat/chat.integration-test.tsx which exercises ChatShell's rendering via the useChat mock.").
    - Matching gate (must appear in acceptance_criteria below): `test -f app/(embedded)/chat/page.integration-test.tsx` exits non-zero (the file does not exist).

    Default recommendation: pick Option (ii) (delete) — the lifted ChatShell does not introduce new branch coverage, and Plan 04-05's chat.integration-test.tsx already exercises the tool-result rendering path. Document the choice in the SUMMARY.
  </action>
  <verify>
    <automated>bunx vitest run &amp;&amp; bun lint &amp;&amp; bunx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File components/chat/chat-shell.tsx EXISTS and contains the use-client directive at the top
    - Command counting `export function ChatShell` occurrences in components/chat/chat-shell.tsx returns 1
    - Command counting useState occurrences in components/chat/chat-shell.tsx returns at least 3 (selectedTab, history, savedProducts)
    - Command counting Sparkles occurrences in components/chat/chat-shell.tsx returns at least 1 (tabbed header lives in shell)
    - File app/(embedded)/chat/page.tsx no longer contains the use-client directive: zero occurrences
    - File app/(embedded)/chat/page.tsx contains the literal 'export default async function ChatPage': one occurrence
    - File app/(embedded)/chat/page.tsx contains the literal banner substring 'Preview mode — using your real catalog · Model:' (byte-precise — em-dash U+2014 and middle-dot U+00B7 must be present): one occurrence
    - Verify the em-dash glyph is byte-precisely U+2014 via a Node.js one-liner that reads the file and asserts `fileContent.includes('—')` and `fileContent.includes('·')`
    - Command `grep -c '{model.displayName}' app/(embedded)/chat/page.tsx` returns 1 (banner uses dynamic JSX interpolation, not a hardcoded model-name literal) — this is the ADM-05 dynamic-binding gate
    - Command `grep -c "Model: Gemini 2.5 Flash" app/(embedded)/chat/page.tsx` returns 0 (the literal model name 'Gemini 2.5 Flash' MUST NOT appear in page.tsx; only the constant inside getActiveChatModel.ts owns that string; Phase 7 body-only swap depends on this separation)
    - Command `grep -c 'aria-live="off"' app/(embedded)/chat/page.tsx` returns 1 (banner is static — per UI-SPEC.md Accessibility row; explicitly NOT 'polite')
    - Command `grep -c 'aria-live="polite"' components/chat/message-parts.tsx` returns at least 1 (tool-state pill / zero-results / error affordances ARE transient updates, per Plan 04-05 Task 1 and UI-SPEC.md) — both intentional values must coexist; this gate prevents accidental conflation
    - Command `grep -c "Chat playground preview mode banner" app/(embedded)/chat/page.tsx` returns 1 (the exact aria-label phrase from UI-SPEC.md Accessibility row; verifies the locked aria-label text was not paraphrased)
    - Command `grep -c "role=\"status\"" app/(embedded)/chat/page.tsx` returns at least 1
    - Command `grep -c "bg-muted/40" app/(embedded)/chat/page.tsx` returns 1 (the Tailwind token from UI-SPEC.md Color row)
    - Command `grep -c "from '@/services/chat/getActiveChatModel'" app/(embedded)/chat/page.tsx` returns 1
    - Command `grep -c "from '@/components/chat/chat-shell'" app/(embedded)/chat/page.tsx` returns 1
    - Command `grep -c "text-foreground font-semibold" app/(embedded)/chat/page.tsx` returns 1 (the displayName span emphasis)
    - Running the full vitest suite exits 0 with all Phase 1–4 tests passing (Phase 3 baseline of 125 + ~25 new Phase 4 = expect >= 150 total)
    - Running bun lint exits 0
    - Running bunx tsc --noEmit exits 0
    - The Polaris-injected admin chrome (from app/(embedded)/layout.tsx) still wraps the page — no layout breakage
    - Integration-test directive (pick exactly one — the executor MUST commit to one of these gates; both gates must NOT pass simultaneously):
      - EITHER (Option i — update): `grep -c "chat-shell" app/(embedded)/chat/page.integration-test.tsx` returns at least 1 AND the file is committed in the same task
      - OR (Option ii — delete): `test -f app/(embedded)/chat/page.integration-test.tsx` exits non-zero AND the SUMMARY contains a one-line "Coverage handoff" rationale under that heading
  </acceptance_criteria>
  <done>page.tsx is a server component that awaits getActiveChatModel(shop) and renders the banner with byte-precise typography; the banner uses dynamic {model.displayName} interpolation (the literal 'Gemini 2.5 Flash' does NOT appear in page.tsx); aria-live='off' on the banner and aria-live='polite' on message-parts tool-state affordances are both verified; the existing page.integration-test.tsx is either updated to import from chat-shell OR deleted with a one-line SUMMARY rationale; chat-shell.tsx owns all client state; the full suite is green; UI-SPEC.md banner contract is met character-for-character including the exact aria-label phrase.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual smoke test — admin chat plays back real catalog cards for the demo query and brand-name query</name>
  <files>(none — manual verification only; no files modified by this task)</files>
  <action>Pause execution and present the verification checklist below to the operator. The operator opens the embedded /chat page against a seeded dev Shopify store and runs four tests: (1) confirm banner glyphs are U+2014 em-dash and U+00B7 middle-dot, (2) run the demo query 'show me waterproof jackets under $100' and confirm at least one real-catalog card surfaces with a non-MOCK title, (3) run a brand-name query and confirm at least one card surfaces (BM25 contribution proof for RRF), (4) run a nonsense query and confirm the no-results affordance renders. Resume only when the operator types 'approved' or surfaces an 'issue:' diagnostic.</action>
  <what-built>
    /api/chat (admin) now routes through AI Gateway with a searchCatalog tool that invokes SearchService.hybridSearch (Phase 4 plans 04-01 through 04-05); /chat displays the "Preview mode — using your real catalog · Model: Gemini 2.5 Flash" banner above the tab strip (this plan, Task 1); MOCK_PRODUCTS is deleted from disk (plan 04-05). The merchant should now see their real synced catalog when typing in the playground.
  </what-built>
  <how-to-verify>
    Operator runs these steps against a dev Shopify store with at least 10 synced products that include realistic titles. A brand-name product like 'Nike Pegasus 41' or 'Patagonia Rain Jacket' is required for test 3.

    1. Confirm AI_GATEWAY_API_KEY and SHOPIFY_API_* env vars are set in `.env` (the GOOGLE_GENERATIVE_AI_API_KEY may remain but is no longer used).

    2. If the dev store has fewer than 10 synced products, run a sync first:
       - Open the embedded admin → onboarding page → click 'Start sync'.
       - Wait for SyncRun.state = 'succeeded' (Phase 2 status polling).
       - Confirm via Prisma Studio or a one-off script that products + product_embeddings rows exist for the active shop.

    3. Open the Shopify-embedded admin → navigate to /chat (the playground page).

    4. Test #1 — Banner verification (ADM-05):
       - Verify the banner appears above the tab strip, single-line, muted background.
       - Confirm the visible text is EXACTLY: 'Preview mode — using your real catalog · Model: Gemini 2.5 Flash'
       - Inspect the em-dash and middle-dot characters: copy the banner text into a Unicode inspector (or paste into a U+ codepoint inspector); the em-dash MUST be U+2014, the middle-dot MUST be U+00B7.
       - Confirm the banner is persistent across tab switches and does not have a dismiss button.

    5. Test #2 — Demo query end-to-end (ADM-06, ROADMAP SC #1):
       - In the chat tab, type the demo query: 'show me waterproof jackets under $100'
       - Submit.
       - Observe: the 'Searching your catalog…' pill appears briefly (the tool-call running state).
       - Within ~1-2 seconds, the pill is replaced by either a grid of product cards OR the 'No matching products' affordance.
       - If the dev catalog includes jacket-like products under $100: confirm AT LEAST 1 card surfaces with a real product title from the merchant's catalog (NOT 'Midnight Runner Sneakers' / 'Arctic Down Parka' / 'Minimalist Leather Wallet' — those were the deleted MOCK_PRODUCTS titles).
       - Open the browser devtools Network tab and confirm the POST to /api/chat returns a stream containing a part of type 'tool-searchCatalog' with state 'output-available' and an output array containing real product IDs from the merchant's DB.
       - If the dev catalog has no jackets under $100: type a substitute query referring to a known-present product category (e.g., 'show me shoes under $200'). Document the substitution in the SUMMARY.

    6. Test #3 — Brand/SKU query (ROADMAP SC #4, BM25 contribution proof):
       - Type a query containing a brand name present in the dev catalog (e.g., 'Nike' or 'Patagonia' or the exact vendor field of a synced product).
       - Submit.
       - Confirm AT LEAST 1 product card surfaces and that the surfaced product's title or vendor matches the brand string.
       - Rationale: A pure semantic (vector) retrieval would not necessarily surface a brand name token; the BM25 lexical branch is what guarantees the match. Confirming a brand-name query returns a result is the proof that RRF fusion is operating across both retriever branches.

    7. Negative test:
       - Type a deliberately nonsensical query (e.g., 'xyzzy-zorp-quux-nonsense-noun').
       - Confirm the UI renders the 'No matching products / Try a broader description or remove the price filter.' affordance (NOT an error state, NOT a blank screen).
  </how-to-verify>
  <resume-signal>
    Type 'approved' if all three test cases pass and the banner glyphs are byte-precise. If issues are observed, describe them in the resume signal: 'issue: ...'. Examples of valid issue signals: 'issue: banner shows hyphens instead of em-dash', 'issue: demo query returned 0 cards even with seeded jackets', 'issue: tool-call pill never appears (Network tab shows no tool-searchCatalog part)'.
  </resume-signal>
  <verify>
    <automated>echo "Manual checkpoint — gate=blocking; advance only on operator approval signal."</automated>
  </verify>
  <done>Operator has typed 'approved' in the resume signal after confirming: (1) banner glyphs are byte-precise U+2014 and U+00B7, (2) demo query surfaces real-catalog cards (no MOCK_PRODUCTS titles), (3) brand-name query returns at least one matching product (RRF lexical contribution verified), (4) nonsense query renders the no-results affordance.</done>
</task>

<task type="auto">
  <name>Task 3: Author 04-VERIFICATION.md and update STATE.md + ROADMAP.md to reflect Phase 4 completion</name>
  <files>.planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md, .planning/STATE.md, .planning/ROADMAP.md</files>
  <read_first>
    - .planning/phases/04-searchservice-wire-chat/04-VALIDATION.md (the validation template — the verification gate completes the Per-Task Verification Map and the Validation Sign-Off section)
    - .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md (the 11 D-XX decisions; verification cross-references which were enforced where)
    - .planning/phases/03-embeddings-search-indexes/03-VERIFICATION.md (Phase 3 verification gate as a structure reference — same audience, same format)
    - .planning/STATE.md (current state — update Current Position, progress percent, last activity)
    - .planning/ROADMAP.md (current state — flip Phase 4 checkbox to [x], update Plans count to 6, mark each 04-NN-PLAN.md complete)
    - The Task 2 resume signal — if 'approved', record the manual smoke test results; if 'issue:' was raised, halt and surface to the orchestrator with a VERIFICATION BLOCKED return signal instead of completing this task
  </read_first>
  <action>
    Phase A — Create .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md. The file is a markdown document with these sections (fill bracketed placeholders with actual values from the test runs):

    - Frontmatter: phase 04, slug searchservice-wire-chat, status verified, verified_at ISO timestamp, verifier gsd-plan-executor.
    - Title: 'Phase 4 — Verification Gate'.
    - Summary section: one paragraph stating what was built, what is now live, what is intentionally deferred to later phases.
    - Requirements Coverage table with four rows — one per phase requirement ID (EMB-05, EMB-07, ADM-05, ADM-06) — each with PASS status and concrete evidence pointing at the specific test file and assertion that proves the requirement. ADM-05's evidence must cite BOTH the dynamic-binding gate (`grep -c "{model.displayName}" app/(embedded)/chat/page.tsx returns 1` AND `grep -c "Model: Gemini 2.5 Flash" app/(embedded)/chat/page.tsx returns 0`) AND the aria-label gate (`grep -c "Chat playground preview mode banner" app/(embedded)/chat/page.tsx returns 1`); EMB-07's evidence must cite BOTH the /api/chat side AND the /api/proxy/chat stub side (the latter from Plan 04-04 — confirms the EMB-07 SC #3 "both routes call SearchService" gate).
    - Automated Test Results section: total Phase 4 test count, total project test suite count (Phase 3 baseline 125 + new). Then a per-file table covering SearchService.test.ts, getActiveChatModel.test.ts, app/api/chat route.test.ts, app/api/proxy/chat route.test.ts, message-parts.test.tsx, chat.integration-test.tsx.
    - Decision Trace table mapping each D-01..D-11 decision from CONTEXT.md to the implementation location and the verification that confirmed it. Note D-05 must verify that v6 inputSchema is used (NOT v5 parameters).
    - Manual Smoke Results table with one row per Task 2 test (banner glyph correctness, demo query, brand-name query, negative query). Each row records PASS/FAIL and a one-line note describing what was observed.
    - Phase 5+ Handoff Notes section: list explicit pointers for Phase 5 (chat-shell.tsx is a candidate for lib/chat-ui/ hoisting), Phase 6 (/api/proxy/chat stub carries its TODO list), Phase 7 (getActiveChatModel body-only swap to read ShopSettings).
    - Deferred Items section: anything that came up during execution but was correctly deferred. If nothing new, state 'None — all deferred items remain in CONTEXT.md Deferred Ideas'.
    - Footer: 'Phase 4 verification gate: PASS' (or FAIL) + verified timestamp.

    Fill the bracketed sections with actual values from running the gates (test counts via `bunx vitest run --reporter=verbose | grep -c " ✓ "`, manual smoke results from Task 2, timestamps via `date -u +"%Y-%m-%dT%H:%M:%SZ"`).

    Phase B — Update .planning/STATE.md:

    1. Update frontmatter: bump last_updated and last_activity to reflect Phase 4 completion (use today's date).
    2. Update progress block:
       - completed_phases: 4
       - completed_plans: 28 + 6 = 34 (Phase 4 added 6 plans)
       - percent: round(4 / 8 * 100) = 50
    3. Update Current Position section: 'Phase: 5 (shared-chat-ui-extraction) — READY FOR DISCUSSION', 'Plan: 0 of TBD', 'Status: Phase 4 complete'.
    4. Update Performance Metrics if velocity data is available; otherwise leave as a placeholder.
    5. Append a new entry to Accumulated Context → Decisions: a one-line summary of Phase 4 verified decisions (hybrid RRF search, AI Gateway routing for chat completions via plain model string google/gemini-2.5-flash, searchCatalog tool wiring, MOCK_PRODUCTS deleted, preview banner with active model name).
    6. Update Session Continuity: stopped_at 'Phase 4 verification gate passed'; resume_file path pointing at .planning/phases/05-shared-chat-ui-extraction/ (the directory may not exist yet — that is fine; Phase 5 discuss-phase will create it).

    Phase C — Update .planning/ROADMAP.md:

    1. Find the Phase 4 line in the top-level phase list (around line 17). Flip its checkbox to [x].
    2. Find the '### Phase 4: SearchService + Wire Chat' section heading.
    3. Update the 'Plans' line to '**Plans**: 6 plans'.
    4. Replace the 'Plans: TBD' placeholder under the section with a structured checklist mirroring Phase 3's layout. Use these six entries (all marked [x] since the verification gate confirms completion):
       - Wave 1: 04-01-PLAN.md — Wave 0 RED test scaffolds (5 test files, ~43 it() blocks)
       - Wave 2: 04-02-PLAN.md — SearchService.ts + getActiveChatModel.ts (parallel-safe foundational services)
       - Wave 3: 04-03-PLAN.md — /api/chat rewrite (withShopifySession + AI Gateway + searchCatalog tool), 04-04-PLAN.md — /api/proxy/chat stub (EMB-07 success criterion #3)
       - Wave 4: 04-05-PLAN.md — UI refactor (message-parts.tsx tool-state renderer, chat.tsx gutting, MOCK_PRODUCTS deletion)
       - Wave 5: 04-06-PLAN.md — page.tsx server-component + banner + Phase 4 verification gate
    5. Update the Progress table at the bottom: row '4. SearchService + Wire Chat' becomes `6/6`, status `Complete`, completed `<today's date>`.

    Phase D — Validate the documentation updates:
    1. Run the full vitest suite — confirm still green.
    2. Run bun lint and bunx tsc --noEmit — confirm still green (no documentation change should break build).
    3. Open the updated STATE.md and ROADMAP.md and visually verify Phase 4 status reflects reality.

    If Task 2 (manual smoke) returned an 'issue:' signal instead of 'approved', DO NOT complete this task — instead, surface the issue to the orchestrator with a `## VERIFICATION BLOCKED` return signal. Phase 4 is not complete until manual smoke passes.
  </action>
  <verify>
    <automated>test -f .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md &amp;&amp; grep -c "Phase 4 verification gate: PASS" .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md &amp;&amp; grep -c "completed_phases: 4" .planning/STATE.md &amp;&amp; grep -E "^- \[x\] \*\*Phase 4:" .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - File .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md EXISTS
    - The verification file contains a Requirements Coverage table with rows for EMB-05, EMB-07, ADM-05, and ADM-06 — each marked PASS
    - The ADM-05 row in Requirements Coverage cites BOTH the dynamic-binding gate AND the aria-label-text gate (gate identifiers: `{model.displayName}` interpolation present, literal 'Gemini 2.5 Flash' absent in page.tsx, 'Chat playground preview mode banner' present in page.tsx)
    - The EMB-07 row in Requirements Coverage cites BOTH the /api/chat route side AND the /api/proxy/chat stub side (depends on Plan 04-04's stub artifact being committed; this is why Plan 04-06 lists 04-04 in depends_on)
    - The verification file contains a Decision Trace table covering D-01 through D-11
    - The verification file contains 'Phase 4 verification gate: PASS' (final-line status marker)
    - .planning/STATE.md has been updated: `grep -c "completed_phases: 4" .planning/STATE.md` returns 1
    - .planning/STATE.md has been updated: `grep -c "completed_plans: 34" .planning/STATE.md` returns 1
    - .planning/STATE.md has been updated: `grep -c "percent: 50" .planning/STATE.md` returns 1
    - .planning/STATE.md has a new entry in Accumulated Context Decisions referencing Phase 4 (hybrid RRF, AI Gateway chat, MOCK_PRODUCTS deleted) — verify with `grep -c "Phase 4" .planning/STATE.md` returns at least 1
    - .planning/ROADMAP.md has Phase 4 checkbox flipped: `grep -E "^- \[x\] \*\*Phase 4:" .planning/ROADMAP.md` finds the line
    - .planning/ROADMAP.md has 'Plans: 6 plans' for Phase 4: `grep -A 30 "### Phase 4:" .planning/ROADMAP.md | grep -c "6 plans"` returns 1
    - .planning/ROADMAP.md has all six 04-NN-PLAN.md entries listed under Phase 4: `grep -E "04-0[1-6]-PLAN.md" .planning/ROADMAP.md | wc -l` returns at least 6
    - .planning/ROADMAP.md Progress table updated: `grep -E "4\. SearchService.*6/6.*Complete" .planning/ROADMAP.md` returns at least 1 match
    - Running the full vitest suite still exits 0 (documentation updates did not break anything)
    - Running bun lint exits 0
    - Running bunx tsc --noEmit exits 0
    - If Task 2 returned an 'issue:' signal, this task instead outputs a `## VERIFICATION BLOCKED` block to the orchestrator and is not marked complete; the verification file is NOT written with a PASS status in that case
  </acceptance_criteria>
  <done>04-VERIFICATION.md is authored with PASS markers for all four requirements; STATE.md reflects 4/8 phases at 50%; ROADMAP.md shows Phase 4 complete with all 6 plans listed and the Progress table updated; full suite + lint + tsc all green; Phase 5 is the next discussable phase.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Shopify-embedded admin chrome → /chat server component | shop is forwarded via query params; the server component reads it but cannot trust it as authentic without middleware validation. Middleware validates session-token-based shop in (embedded) routes; the page server component reads searchParams.shop and passes it to getActiveChatModel (which is shop-agnostic in Phase 4, so this is a no-op risk today; Phase 7 will need real shop verification at this boundary). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-24 | Tampering | Server component reads malicious shop from searchParams | accept (Phase 4) / mitigate (Phase 7) | Phase 4 getActiveChatModel is shop-agnostic; the stub returns the same constant regardless of input, so a bad shop value cannot leak data. Phase 7 will need to verify the shop is the authenticated shop before reading ShopSettings. Documented as a Phase 7 prerequisite in the VERIFICATION handoff notes. |
| T-04-25 | Information Disclosure | Banner displays leaked secret in displayName | mitigate | displayName is sourced from a hardcoded constant ('Gemini 2.5 Flash') in Phase 4. No DB read, no env read. Phase 7 must validate that ShopSettings.displayName does not contain user-controlled HTML/text before swapping the body. |
| T-04-26 | Spoofing | Stale/incorrect banner glyphs ship to production | mitigate | Acceptance gate uses byte-precise grep + a Node.js codepoint verification. Operator-facing manual smoke (Task 2) further confirms the rendered glyphs are U+2014 and U+00B7. |
| T-04-27 | Repudiation | Phase 4 marked complete without manual smoke verification | mitigate | Task 2 is a blocking human checkpoint. Task 3 explicitly refuses to write VERIFICATION.md with PASS status if Task 2 returned an issue. The verification gate has a conditional escape hatch: VERIFICATION BLOCKED return signal halts the wave. |
</threat_model>

<verification>
After all three tasks complete:
1. Full vitest suite exits 0 (Phase 1–4 tests; expect >= 150 total).
2. bun lint exits 0.
3. bunx tsc --noEmit exits 0.
4. 04-VERIFICATION.md exists with 'Phase 4 verification gate: PASS' (assuming Task 2 returned 'approved').
5. STATE.md shows completed_phases: 4, completed_plans: 34, percent: 50.
6. ROADMAP.md shows Phase 4 checkbox checked, all six 04-NN-PLAN.md entries listed, progress table row reading '6/6 Complete'.
7. The em-dash glyph in app/(embedded)/chat/page.tsx is byte-precisely U+2014 (verified by Node.js codepoint check).
8. The middle-dot glyph in app/(embedded)/chat/page.tsx is byte-precisely U+00B7 (same).
9. The banner uses dynamic `{model.displayName}` JSX interpolation, NOT a hardcoded 'Gemini 2.5 Flash' literal (verified by grep counts).
10. The banner aria-live='off' coexists with components/chat/message-parts.tsx aria-live='polite' — both intentional, both gated.
</verification>

<success_criteria>
- /chat page is a server component rendering the preview banner above the tabs
- The banner uses the locked typography (U+2014 em-dash, U+00B7 middle-dot) — char-for-char per UI-SPEC.md D-11
- The banner dynamically interpolates {model.displayName} (Phase 7's body-only swap of getActiveChatModel propagates without page.tsx changes)
- The banner aria-label uses the exact UI-SPEC.md locked phrase 'Chat playground preview mode banner. Active model: {displayName}.'
- The banner aria-live='off' (static) and message-parts.tsx aria-live='polite' (transient updates) coexist as two intentional ARIA contracts; both are gated
- The existing page.integration-test.tsx is handled deterministically: either updated to import from chat-shell OR deleted with rationale (one chosen, one gate)
- All client state lifted into components/chat/chat-shell.tsx; page.tsx contains zero useState/useEffect
- Manual smoke verifies the demo query returns real-catalog cards, the brand-name query proves BM25 contribution, the negative query shows the no-results affordance
- VERIFICATION.md documents all four phase requirements (EMB-05, EMB-07, ADM-05, ADM-06) as PASS with evidence pointers; EMB-07's evidence cites BOTH /api/chat AND /api/proxy/chat stub (the dependency on Plan 04-04)
- STATE.md and ROADMAP.md reflect Phase 4 completion (4/8 phases, 34/?? plans, 50% progress, Phase 5 next)
- The phase verification gate fails closed if Task 2 returns an issue (VERIFICATION BLOCKED escape hatch)
</success_criteria>

<output>
Create `.planning/phases/04-searchservice-wire-chat/04-06-SUMMARY.md` when done. Include: line counts for page.tsx and chat-shell.tsx, the exact rendered banner string from a screenshot or copy-paste during Task 2, the operator's resume signal verbatim, links to the four GREEN requirement test files, the new STATE.md frontmatter snippet, and one paragraph reflecting on the phase as a whole — what shipped, what was deferred to which later phase, and any rough edges that should be picked up early in Phase 5. If Option (ii) was chosen for the integration test, include a "Coverage handoff" section explaining the deletion rationale.
</output>
</content>
