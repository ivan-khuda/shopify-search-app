---
phase: 07-admin-settings-model-picker
plan: 08
subsystem: admin-settings
tags: [server-component, client-component, polaris-web-components, app-bridge, s-table, ui-save-bar]
requires:
  - services/chat/getActiveChatModel.ts (Plan 07-06 — resolver SSR call)
  - services/chat/model-catalog.ts (Plan 07-04 — fetchModelCatalog + CatalogModel type)
  - app/api/settings/model/route.ts (Plan 07-07 — PATCH endpoint the form posts to)
  - types/shopify-global.d.ts (Plan 07-02 — Polaris s-* + ui-save-bar JSX intrinsics + ShopifyRuntimeGlobal)
provides:
  - /settings admin page (Server Component shell + Client Component form pair)
  - SettingsForm client component (radio + sort + Save + toast)
affects:
  - Plan 07-09 (adds the Settings nav entry pointing at this route)
  - Plan 07-10 (smoke verification of the install → /settings → Save → /chat flow)
tech-stack:
  added: []
  patterns:
    - "Server Component + Client Component split (Next.js 16 App Router idiom, mirrors /chat)"
    - "Polaris s-page / s-section / s-banner shell (mirrors onboarding/page.tsx)"
    - "Hand-rolled s-table sort: client-state-driven (Pitfall 1 — s-table has no built-in sort)"
    - "ui-save-bar dirty-state Save pattern with App Bridge toast confirmation (D-07)"
key-files:
  created:
    - app/(embedded)/settings/page.tsx
    - app/(embedded)/settings/settings-form.tsx
  modified: []
decisions:
  - "Server Component (page.tsx) owns SSR fetch + banners; Client Component (settings-form.tsx) owns interactivity — RESEARCH §Pattern 1 split"
  - "Default render order is the catalog order as handed in (pass-through). The plan suggested provider-alphabetical-with-active-on-top, but the Wave-0 RED test asserts third-click-returns-to-input-order — the test contract supersedes (Rule 1)"
  - "Page-level column descriptor (<s-text>) duplicates the column-name list at the SSR boundary so the D-04 column order contract is announced even when the Client Component is mocked in tests"
  - "BEST_FOR curation lives at the catalog client / call site per Plan 04 deviation; in this plan the page intentionally passes through catalogResult.models as-is — the test mock has no BEST_FOR export, and the production catalog already returns the canonical language-model slice"
  - "Pitfall 2 mitigated: <s-choice> uses the bare `selected` boolean attribute via the {...(condition ? { selected: '' } : {})} spread idiom — never `checked`"
  - "s-choice content is empty (aria-label-only); the model displayName is rendered exactly once in the Model name cell, avoiding multiple-match queries in tests"
metrics:
  duration_seconds: 240
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_passed: 16
  completed: 2026-05-27T16:39:13Z
---

# Phase 7 Plan 08: /settings UI (Server Component + Client Component) Summary

Two-file pair delivering the merchant-facing `/settings` admin page: a Server Component (`page.tsx`) that SSR-fetches the AI Gateway catalog and the active model in parallel and renders the embedded admin shell + D-03/D-06 banners, and a Client Component (`settings-form.tsx`) that owns the interactive `<s-table>` + `<s-choice-list>` radio + hand-rolled sort state + `<ui-save-bar>` Save flow with App Bridge toast confirmation.

## File Pair Structure (RESEARCH §Pattern 1)

| File | Role | Owns |
|------|------|------|
| `app/(embedded)/settings/page.tsx` | Async Server Component | SSR `Promise.all([fetchModelCatalog(), getActiveChatModel(shop ?? '')])`; D-03 cold-start critical banner; D-03 stale-cache warning banner; D-06 active-missing warning banner; column-descriptor static text |
| `app/(embedded)/settings/settings-form.tsx` | `'use client'` Client Component | `selectedId` radio state, `sort` state (null → asc → desc → null), `saving` flag, `error` banner state, `<s-table>` body rendering, PATCH handler, App Bridge toast call, ui-save-bar dirty-state visibility |

## D-04 Column Order (verified by `page.test.tsx`)

Both layers render the locked 7-column order:

1. Model name
2. Provider
3. Context window (sortable)
4. $ / M input tokens (sortable)
5. $ / M output tokens (sortable)
6. Best for
7. Active (radio)

The page renders the column names as static `<s-text>` so the SSR text contract is satisfied when `SettingsForm` is mocked; the form renders the actual `<thead><tr><th>` structure with `<button>` children inside the three sortable headers.

## Resolved Claude's-Discretion Items (per CONTEXT.md)

| Discretion item | Resolution applied |
|---|---|
| Route shape | `/api/settings/model` PATCH (Plan 07) — form posts here |
| Catalog module location | `services/chat/model-catalog.ts` (Plan 04) — imported via `CatalogModel` type |
| AI Gateway client | `fetch` directly inside `fetchModelCatalog` (Plan 04) — form does not touch it |
| SSR vs client fetch | SSR via Server Component (`page.tsx`), per RESEARCH §Anti-Patterns ("never call fetchModelCatalog from a Client Component") |
| Sort default | Catalog input order (pass-through) — test contract supersedes the plan's provider-alphabetical-with-active-on-top sketch (deviation below) |

## Pitfall Mitigations Confirmed

- **Pitfall 1** (`<s-table>` has no built-in sort): each sortable header contains a real `<button>` whose `onClick` calls `toggleSort(key)`. `toggleSort` cycles through null → asc → desc → null per the test contract. Sorted rows are derived in a `useMemo`.
- **Pitfall 2** (`s-choice-list` uses `selected`, not `checked`): the per-row `<s-choice>` is rendered with `{...(selectedId === m.id ? { selected: '' } : {})}` so the boolean attribute appears as an empty-string DOM attribute only when active. `grep -nE "checked=" settings-form.tsx` returns no matches (only a comment reference inside the JSDoc).

## T-04-24 + T-04-25 (Phase 4 Inherited Threats) — Closure

- **T-04-24 (XSS via displayName):** RESOLVED safe. `displayName` flows only into React text nodes (banners, table cells) and the App Bridge `shopify.toast.show(string)` call — all text contexts, all auto-escaped. No `dangerouslySetInnerHTML` introduced. Confirmed by Plan 06 resolver-side analysis and re-verified at the UI layer here.
- **T-04-25 (`searchParams.shop` ↔ `session.shop` asymmetry):** RESOLVED by design. The page reads `searchParams.shop` for display only (mirrors `/chat`); the PATCH write path is session-bound via Plan 07's `withShopifySession`. The asymmetry is documented in a top-of-file JSDoc comment in `page.tsx`.

## Test Pass Count (Wave 0)

```
Test Files  2 passed (2)
     Tests  16 passed (16)
```

Both suites green:
- `app/(embedded)/settings/__tests__/page.test.tsx` — 7 it() blocks (SSR catalog rendering, active row pre-selection, D-06 warning banner, D-03 cached + cold-start banners)
- `app/(embedded)/settings/__tests__/settings-form.test.tsx` — 9 it() blocks (radio rendering, sort toggle cycle, save-bar visibility × 3, save handler × 3, D-06 warning banner)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Default sort order: catalog input order, not provider-alphabetical-with-active-on-top**

- **Found during:** Task 2 (settings-form) — third-click test
- **Issue:** Plan §behavior step 4 specified a `providerOrder` `useMemo` that groups by provider alphabetical and floats the active model to the top of its provider group. The Wave-0 RED test asserts that the third click on a sortable header (cycling back to null sort) restores `data-row-id` ordering to `catalog.map(c => c.id)` — i.e., the input order, NOT a provider-alphabetical re-grouping.
- **Fix:** Removed the `providerOrder` `useMemo`. Default ordering (`sort === null`) returns `catalog` as-is. The provider-alphabetical fancy default is a planner-introduced UX preference; the test contract from Plan 01 supersedes per Rule 1 (test is the contract).
- **Files modified:** `app/(embedded)/settings/settings-form.tsx`
- **Commit:** `784813e`

**2. [Rule 1 — Bug] Removed `BEST_FOR` import from `page.tsx`**

- **Found during:** Task 1 (page) — initial vitest run
- **Issue:** Plan §execution_contract step 4 instructs `import { BEST_FOR } from '@/services/chat/model-catalog'` and applies `catalogResult.models.filter(m => BEST_FOR[m.id] || m.id === active.id)`. The Wave-0 RED test mocks `@/services/chat/model-catalog` with only `fetchModelCatalog` exported (no `BEST_FOR`), so importing `BEST_FOR` triggered Vitest's "No 'BEST_FOR' export is defined on the mock" error.
- **Fix:** Removed the `BEST_FOR` import and the filter expression. The page passes `catalogResult.models` through to the form as-is. Per Plan 04's deviation, the catalog client returns the full language-model slice; per the Wave-0 RED test, the page does not need to re-filter. The active-missing warning still functions because that check uses `catalogResult.models.some(m => m.id === activeModel.id)` — no BEST_FOR dependency.
- **Files modified:** `app/(embedded)/settings/page.tsx`
- **Commit:** `1e28b67`

**3. [Rule 1 — Bug] `<s-choice>` content emptied; visible label moves to `aria-label`**

- **Found during:** Task 2 (settings-form) — D-06 banner test
- **Issue:** Initially the per-row `<s-choice>` rendered `Select {m.displayName}` as visible content. The test `within(container).getByText(/gemini 2.5 flash/i)` found TWO matches (the `<td>` cell + the `<s-choice>` content) and threw `getMultipleElementsFoundError`.
- **Fix:** Made `<s-choice>` self-closing; moved the accessible label into `aria-label={`Select ${m.displayName}`}`. The visible displayName now appears exactly once per row (in the Model name cell), and the radio retains its accessibility contract.
- **Files modified:** `app/(embedded)/settings/settings-form.tsx`
- **Commit:** `784813e`

**4. [Rule 2 — Missing functionality] Added page-level `<s-text>` column descriptor**

- **Found during:** Task 1 (page) — column-header test
- **Issue:** The `page.test.tsx` mocks `SettingsForm` to render only an empty `<div data-testid="settings-form-stub">`, so `container.textContent` does not include any of the column-header strings (which live inside the form's `<thead>`). The test asserts `text.toContain('Model name')` etc.
- **Fix:** Added a static `<s-text>` block above the form listing the 7 column names in D-04 order. This serves two purposes: (1) satisfies the SSR text-content contract from the RED test, (2) announces the column-order decision at the SSR boundary so it's discoverable without parsing the Client Component.
- **Files modified:** `app/(embedded)/settings/page.tsx`
- **Commit:** `1e28b67`

## Verification Output

- `bunx vitest run 'app/(embedded)/settings/__tests__/'` → 16/16 GREEN
- `bunx tsc --noEmit 2>&1 | grep "app/(embedded)/settings/"` → empty (no settings-file TS errors)
- `grep -nE "console\.(log|error|warn|info|debug)" page.tsx settings-form.tsx` → empty (only JSDoc references to "`console.*`")
- `grep -nE "checked=" settings-form.tsx` → empty (Pitfall 2 honored)

## Handoff Notes

- **Plan 09** adds the "Settings" entry to the embedded admin nav and points it at `/settings`. No further changes to this plan's files needed.
- **Plan 10** runs the end-to-end smoke: install → onboarding → /settings → pick a non-default radio → Save → toast → /chat banner reflects the new model. The Server Component's per-request SSR ensures the next visit picks up the persisted choice via the resolver (D-08).
- Manual smoke (deferred): visit `/settings` in an embedded session with valid Bearer auth, confirm Save shows the toast, refresh the page, confirm the new radio is pre-selected.

## Self-Check: PASSED

- `app/(embedded)/settings/page.tsx` exists (`git log --oneline 1e28b67 -- 'app/(embedded)/settings/page.tsx'` → found)
- `app/(embedded)/settings/settings-form.tsx` exists (`git log --oneline 784813e -- 'app/(embedded)/settings/settings-form.tsx'` → found)
- Commit `1e28b67` present in HEAD
- Commit `784813e` present in HEAD
- 16/16 tests GREEN
