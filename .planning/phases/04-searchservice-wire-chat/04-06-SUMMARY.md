---
phase: 04-searchservice-wire-chat
plan: 06
subsystem: chat-page-server-component-and-verification-gate
tags: [adm-05, d-11, server-component, banner, verification-gate, manual-smoke-deferred]
dependency_graph:
  requires:
    - "04-02 (services/chat/getActiveChatModel.ts — Phase 7 contract anchor)"
    - "04-03 (/api/chat AI Gateway rewrite — completes ADM-06 / EMB-07 admin half)"
    - "04-04 (/api/proxy/chat stub — completes EMB-07 SC #3 storefront half)"
    - "04-05 (chat.tsx gut + message-parts.tsx tool-state renderer + mock-products.ts deletion)"
  provides:
    - "ADM-05: server-rendered preview-mode banner above the tab strip with dynamic {model.displayName} interpolation"
    - "components/chat/chat-shell.tsx: client component holding tabbed Chat/History/Saved UI (Phase 5 hoisting candidate)"
    - "04-VERIFICATION.md: Phase 4 verification gate report (verified-with-deferred-smoke)"
    - "Phase 4 close-out: STATE.md and ROADMAP.md updated to reflect 4/8 phases at 50%"
  affects:
    - "Phase 5 (chat-shell.tsx is the lib/chat-ui/ hoisting candidate; inline hex literals are Phase 5 cleanup)"
    - "Phase 7 (getActiveChatModel.ts body-only swap propagates a new model name into the banner via {model.displayName} without touching page.tsx)"
tech-stack:
  added: []
  patterns:
    - "Next.js 16 App Router async Server Component awaiting Promise<searchParams> (Next 15+ pattern)"
    - "Server-rendered banner with role='status' + aria-live='off' (static at page load — distinct from message-parts.tsx aria-live='polite' for transient tool-state updates)"
    - "Server component / client component split: page.tsx is server-rendered + banner; chat-shell.tsx ('use client') owns tabs/state"
    - "Byte-precise typography (em-dash U+2014, middle-dot U+00B7) verified by Node.js codepoint inspection + grep on source file"
    - "Dynamic JSX interpolation `{model.displayName}` as the Phase 7 body-only-swap propagation anchor (literal 'Gemini 2.5 Flash' MUST NOT appear in page.tsx)"
key-files:
  created:
    - components/chat/chat-shell.tsx
    - app/(embedded)/chat/__tests__/chat-shell.test.tsx
    - app/(embedded)/chat/__tests__/page.test.tsx
    - .planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md
    - .planning/phases/04-searchservice-wire-chat/04-06-SUMMARY.md
  modified:
    - app/(embedded)/chat/page.tsx
    - .planning/STATE.md
    - .planning/ROADMAP.md
  deleted:
    - app/(embedded)/chat/page.integration-test.tsx
decisions:
  - "Refactor /chat into Server Component (page.tsx, 35 lines) + Client Component (chat-shell.tsx, 110 lines) per D-11. Banner is server-rendered above ChatShell; ChatShell owns all useState/useCallback for tabs, history, savedProducts."
  - "Banner uses dynamic `{model.displayName}` JSX interpolation; the literal 'Gemini 2.5 Flash' does NOT appear in page.tsx. Phase 7's body-only swap of getActiveChatModel propagates a new model name into the banner without touching page.tsx — this is the ADM-05 dynamic-binding contract."
  - "Banner aria-live='off' (static at page load) coexists with components/chat/message-parts.tsx aria-live='polite' (transient tool-state updates). Both are intentional and gated."
  - "Option (ii) — DELETE app/(embedded)/chat/page.integration-test.tsx. The lifted ChatShell does not introduce new branch coverage; Plan 04-05's components/chat/chat.integration-test.tsx already exercises the tool-result rendering path via the useChat mock against TEST_PRODUCT (not MOCK_PRODUCTS)."
  - "DEFER manual smoke (Task 2) — operator surfaced pre-existing shopify-install-flow OAuth callback cookie blocker that prevents embedded admin /chat from loading. The blocker is out of scope for Phase 4 (which wires SearchService into chat, not the install flow). All four manual smoke sub-cases have structural and automated surrogate evidence in 04-VERIFICATION.md."
  - "Phase 4 verification gate status: verified-with-deferred-smoke (NOT PASS, NOT FAIL). The structural and automated contract is complete; the empirical end-to-end visual confirmation is held until docs/superpowers/plans/2026-05-02-shopify-install-flow.md lands."
metrics:
  duration: ~25m (Task 1 RED+GREEN: ~15m, Task 3 verification gate authoring: ~10m, Task 2 manual smoke: deferred)
  completed: 2026-05-26
  tasks: 3 (2 complete, 1 deferred)
  files_created: 5
  files_modified: 3
  files_deleted: 1
  commits: 3 (01e644f Task 1 RED, 601f48e Task 1 GREEN, dec29f3 Task 3)
---

# Phase 4 Plan 6: Page Banner + Phase 4 Verification Gate Summary

The closing wave of Phase 4. Refactored `app/(embedded)/chat/page.tsx` into an async Server Component that awaits `getActiveChatModel(shop)` and server-renders the preview-mode banner above a new `components/chat/chat-shell.tsx` client component lifted from the old client-rendered page. Then authored `04-VERIFICATION.md` cataloging Phase 4's four requirements (EMB-05, EMB-07, ADM-05, ADM-06) as PASS with concrete per-test evidence, traced all 11 phase decisions D-01..D-11 to implementation locations, and recorded the four manual smoke sub-cases as DEFERRED behind a pre-existing shopify-install-flow OAuth callback cookie blocker that lives outside Phase 4's surface. STATE.md and ROADMAP.md flipped to reflect 4/8 phases at 50% with Phase 5 (shared-chat-ui-extraction) as the next discussable phase.

## Tasks Completed

| Task | Name | Commit | Status |
| ---- | ---- | ------ | ------ |
| 1 (RED) | Add failing tests for server page banner + chat-shell split | `01e644f` | Complete |
| 1 (GREEN) | Refactor /chat to Server Component + banner; lift client UI into chat-shell.tsx | `601f48e` | Complete |
| 2 | Manual smoke test (4 checks: banner glyphs, demo query, brand-name query, no-results affordance) | (none) | **DEFERRED — operator decision; pre-existing shopify-install-flow OAuth cookie blocker is out of scope for Phase 4** |
| 3 | Author 04-VERIFICATION.md + update STATE.md + ROADMAP.md | `dec29f3` | Complete |

## File Line Counts

| File | Lines | Plan minimum |
| ---- | ----- | ------------ |
| `app/(embedded)/chat/page.tsx` | 35 | n/a (gutted; banner + ChatShell only) |
| `components/chat/chat-shell.tsx` | 110 | (entire lifted body from old page.tsx) |

## Exact Rendered Banner String (from source — visual confirmation deferred)

The banner JSX in `app/(embedded)/chat/page.tsx` lines 22–31 renders:

```
Preview mode — using your real catalog · Model: Gemini 2.5 Flash
```

- Em-dash between "mode" and "using": U+2014 (verified byte-precise in source on line 29)
- Middle-dot between "catalog" and "Model": U+00B7 (verified byte-precise in source on line 29)
- "Gemini 2.5 Flash" is interpolated via `{model.displayName}` (JSX expression) — the literal string does NOT appear in page.tsx; it lives only in the `DEFAULT_MODEL` constant inside `services/chat/getActiveChatModel.ts`. Phase 7's body-only swap propagates a new displayName into the banner without touching page.tsx.
- Visual confirmation in the rendered embedded admin is the deferred manual smoke check (held behind the OAuth callback cookie blocker).

## Operator Resume Signal (Verbatim)

> "Yes — spawn continuation agent now"
> (Operator selection on 2026-05-26 in answer to "Defer manual smoke and close Phase 4 with deferred-smoke status?")

Operator-cited blocker:
> ngrok OAuth callback cookie error (`Could not find an OAuth cookie for shop url: khuda-test-site.myshopify.com`) prevents embedded admin /chat access. Pre-existing — not a Phase 4 regression. Tracked in `docs/superpowers/plans/2026-05-02-shopify-install-flow.md`.

## Links to GREEN Requirement Test Files

| Requirement | Test File | Tests | Status |
|-------------|-----------|-------|--------|
| EMB-05 | `services/search/__tests__/SearchService.test.ts` | 12 | PASS |
| EMB-07 (admin) | `app/api/chat/__tests__/route.test.ts` | 13 | PASS |
| EMB-07 (storefront stub) | `app/api/proxy/chat/__tests__/route.test.ts` | 5 | PASS |
| EMB-07 (MOCK_PRODUCTS deletion) | `components/chat/chat.integration-test.tsx` | 1 | PASS |
| ADM-05 | `app/(embedded)/chat/__tests__/page.test.tsx` | 8 | PASS |
| ADM-06 (route) | `app/api/chat/__tests__/route.test.ts` | 13 | PASS |
| ADM-06 (UI) | `components/chat/__tests__/message-parts.test.tsx` | 10 | PASS |

Total Phase 4 test count: 52 (across 7 files). Full project test suite: 176 tests across 24 files (Phase 3 baseline 125 → +51 Phase 4 net new).

## New STATE.md Frontmatter Snippet

```yaml
---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 verification gate verified-with-deferred-smoke
last_updated: "2026-05-26T09:58:56Z"
last_activity: 2026-05-26 -- Phase 04 verification gate closed (manual smoke deferred)
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 34
  completed_plans: 34
  percent: 50
---
```

## Coverage Handoff (Integration-Test Option Selected: ii — DELETE)

`app/(embedded)/chat/page.integration-test.tsx` was DELETED in Task 1 (commit `601f48e`).

**Rationale:** The lifted ChatShell does not introduce new branch coverage. Plan 04-05's `components/chat/chat.integration-test.tsx` already exercises the tool-result rendering path via the `useChat` mock against a `TEST_PRODUCT` fixture (post-MOCK_PRODUCTS deletion). The deleted page.integration-test.tsx asserted nothing that is not covered by:
- `components/chat/chat.integration-test.tsx` — tool-result rendering of ProductCards on assistant messages
- `app/(embedded)/chat/__tests__/page.test.tsx` (new in Task 1) — banner correctness, server-component shape, dynamic interpolation, ChatShell mount position
- `app/(embedded)/chat/__tests__/chat-shell.test.tsx` (new in Task 1) — tab switching, history side effects, saved-products handlers

The acceptance gate `test -f app/(embedded)/chat/page.integration-test.tsx` exits non-zero (the file does not exist).

## Phase Reflection — What Shipped, What Was Deferred, Rough Edges for Phase 5

**What shipped in Phase 4.** The admin chat playground is no longer a `MOCK_PRODUCTS.filter()` keyword shim. It is now a Vercel AI Gateway-routed `streamText({ tools: { searchCatalog: tool(...) } })` endpoint whose tool execute closure invokes `SearchService.hybridSearch(shop, query, opts)` — a shop-scoped SQL-side Reciprocal Rank Fusion over a pgvector cosine branch and a tsvector `websearch_to_tsquery` branch inside a single `withHnswIterativeScan` transaction with defense-in-depth shop filtering. The UI reads `message.parts[*].type === 'tool-searchCatalog'` directly as the single source of truth (no PendingProductAttachment glue, no client-side keyword filter). `MOCK_PRODUCTS` is deleted from disk. `/chat` is a Server Component server-rendering the preview-mode banner with byte-precise em-dash and middle-dot typography, above a new `components/chat/chat-shell.tsx` client component holding the tabbed UI. `/api/proxy/chat` ships as a Phase 6 stub that imports `hybridSearch` at the source level today, satisfying EMB-07 success criterion #3 ahead of the storefront drawer landing.

**What was deferred — and to which later phase.** The four-step manual smoke checklist (banner glyphs visual check, demo query end-to-end, brand-name query for BM25/RRF contribution proof, negative query for no-results affordance) is held behind a pre-existing Shopify OAuth callback cookie blocker that prevents the embedded admin /chat page from loading against the dev store. The blocker lives in `app/api/auth/callback/route.ts:4` and is documented as backlog work in `docs/superpowers/plans/2026-05-02-shopify-install-flow.md` — it is out of scope for Phase 4 (which wires SearchService into chat, not the install flow). All four manual smoke sub-cases have structural and automated surrogate evidence in 04-VERIFICATION.md. Phase 5 (shared-chat-ui-extraction) defers history derivation via a `useEffect` watching `messages[*].parts` (today `productCount` is recorded as `0` at submit time because tool-result cards arrive asynchronously) and the cleanup of inline hex literals (#008060, #e1e3e5) into Tailwind tokens during the `lib/chat-ui/` lift. Phase 6 (storefront drawer) defers the wholesale replacement of `/api/proxy/chat`'s stub body (HMAC verification, visitor identity, real streamText wiring, hard cap). Phase 7 (admin settings model picker) defers the body-only swap of `getActiveChatModel` (Phase 4 returns a hardcoded `Gemini 2.5 Flash`; Phase 7 reads `ShopSettings.activeChatModel` keyed by the shop parameter that is already plumbed through every call site).

**Rough edges to pick up early in Phase 5.** First, `components/chat/chat-shell.tsx` and `components/chat/chat.tsx` are both natural hoisting candidates for `lib/chat-ui/`. The only Shopify-embedded coupling is identity (Bearer session-token vs visitor_id); the `ChatIdentityAdapter` interface from Phase 5's roadmap is the right seam. Second, the inline hex literals noted in 04-UI-SPEC.md Risks-and-FLAGs item 2 should be replaced by Tailwind tokens during the lift — they are Phase 5 cleanup, not Phase 4 work. Third, the `productCount: 0` recorded at `handleSubmit` time in `chat.tsx` is a temporary measurement; Phase 5 or 6 should re-derive history from a `useEffect` that watches `messages[*].parts` so the history panel reflects actual surfaced card counts. Fourth, the page.tsx ↔ chat-shell.tsx split is currently propless — Phase 5 should preserve that simplicity, threading `ChatIdentityAdapter` and any other surface-specific seam as the ONLY parameterization the shared barrel needs.

## Deviations from Plan

The `<verify>` automated command in the Task 3 plan asserted the literal `"Phase 4 verification gate: PASS"` final-line marker. The operator's deferred-smoke decision means the correct status is `verified-with-deferred-smoke`, not `PASS`. 04-VERIFICATION.md was authored with the accurate status; the `PASS` literal is intentionally absent. This is Rule 2 (auto-add missing critical functionality — accurate verification status is a correctness requirement; a false `PASS` would misrepresent the deferred-smoke state).

The plan's STATE.md gate `completed_plans: 34` lines up with prior wave completion arithmetic (28 + 6 = 34) under the assumption that Phase 4 adds 6 plans. The plan also asserts `percent: 50` (round(4/8 * 100) = 50). Both have been written exactly. The frontmatter `last_updated` and `last_activity` are bumped to 2026-05-26 ISO.

No other deviations.

## Known Stubs

None new in this plan. `services/chat/getActiveChatModel.ts` remains a Phase 7 body-only-swap anchor (the hardcoded return is the V1 contract, not a stub-shaped placeholder). `app/api/proxy/chat/route.ts` remains a Phase 6 hand-off stub with a prominent JSDoc TODO list — not a Phase 4 deferred-implementation gap.

## Threat Flags

None. No new attack surface beyond the plan's `<threat_model>` enumeration (T-04-24, T-04-25, T-04-26, T-04-27 — all addressed in 04-VERIFICATION.md handoff notes and the verified-with-deferred-smoke fail-closed mechanism).

## Self-Check: PASSED

- `app/(embedded)/chat/page.tsx` FOUND (Server Component, 35 lines)
- `components/chat/chat-shell.tsx` FOUND (Client Component, 110 lines)
- `app/(embedded)/chat/__tests__/page.test.tsx` FOUND (8 tests PASS)
- `app/(embedded)/chat/__tests__/chat-shell.test.tsx` FOUND
- `.planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md` FOUND (status verified-with-deferred-smoke)
- `app/(embedded)/chat/page.integration-test.tsx` ABSENT (Option ii — deleted per Coverage handoff)
- Commit `01e644f` FOUND in `git log` (Task 1 RED)
- Commit `601f48e` FOUND in `git log` (Task 1 GREEN)
- Commit `dec29f3` FOUND in `git log` (Task 3)
- Full vitest suite: 24 files / 176 tests PASS
- STATE.md: `completed_phases: 4`, `completed_plans: 34`, `percent: 50` all present
- ROADMAP.md: Phase 4 checkbox [x] with deferred-smoke footnote; Plans 6/6; Wave 5 plan marked complete; Progress table row Complete (2026-05-26)
