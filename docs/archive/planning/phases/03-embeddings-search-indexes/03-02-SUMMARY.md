---
phase: 03-embeddings-search-indexes
plan: 02
subsystem: embeddings/search
tags: [embeddings, search, pure-function, phase-3-wave-1, d-03]
dependency_graph:
  requires:
    - "03-01 (RED scaffold at services/search/__tests__/searchableText.test.ts)"
  provides:
    - "services/search/searchableText.ts — single source of truth for embed input text (D-03)"
    - "buildSearchableText(product) named export consumed by plan 03-06 (sync embed-batch) and plan 03-07 (webhook embed-after-upsert)"
  affects:
    - "services/search/__tests__/searchableText.test.ts (filled — was scaffold)"
tech_stack:
  added: []
  patterns:
    - "Pure-function module — named export, no class, no singleton (lib/utils.ts convention)"
    - "field?.trim() ?? '' for nullable strings; (arr ?? []).join() for nullable arrays"
    - "import type for type-only imports (tree-shaking + zero runtime dependency)"
    - "ASYMMETRY comment block documenting code-level decision boundaries"
key_files:
  created:
    - services/search/searchableText.ts
  modified:
    - services/search/__tests__/searchableText.test.ts
decisions:
  - "D-03 implemented verbatim per RESEARCH.md lines 561-585 (no deviation from canonical example)"
  - "ASYMMETRY comment block placed above function body to document that options appear in embed input (D-03) but NOT in tsvector (D-04) — protects Phase 4 SearchService"
  - "TDD order: RED (single happy-path assertion fails import) → GREEN (helper implementation passes RED) → fill remaining 4 it.todo + 1 defensive test"
  - "baseInput() factory in test file builds full ProductUpsertInput shape with safe defaults to keep individual assertions focused on the field under test"
metrics:
  duration: "~10 minutes"
  completed_date: 2026-05-25
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 3
  source_line_count: 35
  test_count: 6
requirements: [EMB-01, EMB-02]
---

# Phase 03 Plan 02: `buildSearchableText` Helper Summary

**One-liner:** Implemented `buildSearchableText(product: ProductUpsertInput): string` at `services/search/searchableText.ts` — the D-03 source-of-truth pure function that produces the labelled multi-line embed-input string consumed identically by Phase 3's sync batch path (plan 03-06) and webhook handler (plan 03-07), with an ASYMMETRY comment block guarding against Phase 4 accidentally diverging the tsvector composition (D-04).

## Objective

Without a single helper, the sync path and webhook path could embed different text shapes for the "same" product, silently destroying search recall. This plan eliminates that drift by putting both downstream call sites behind one pure function — and fills the RED scaffold's 5 `it.todo` entries from plan 03-01 with real assertions plus one defensive "no undefined literal" check.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| RED | First failing assertion (happy-path exact-string equality) | `981e1f4` | `services/search/__tests__/searchableText.test.ts` |
| 1 (GREEN) | Implement `buildSearchableText` with ASYMMETRY comment | `f0c37cb` | `services/search/searchableText.ts` |
| 2 | Fill remaining 4 `it.todo` + add defensive "no undefined" test | `df59039` | `services/search/__tests__/searchableText.test.ts` |

## Verification

```bash
bunx vitest run services/search/__tests__/searchableText.test.ts --reporter=verbose
```

Result:
```
✓ buildSearchableText > Title/Description/Tags/Vendor/Type/Options labels appear in output in that exact order
✓ buildSearchableText > Missing optional fields produce empty value after label (e.g. `Title: \n`)
✓ buildSearchableText > Empty options array produces `Options: ` with no trailing comma or dangling separator
✓ buildSearchableText > Leading/trailing whitespace on title/description/vendor/productType is trimmed
✓ buildSearchableText > options serialise as `name (v1/v2)` joined by `, `
✓ buildSearchableText > produces no "undefined" literal in any output

Test Files  1 passed (1)
Tests       6 passed (6)
```

**Acceptance criteria checks:**
- `services/search/searchableText.ts` exists — ✅
- Line count: 35 (≤40 required) — ✅
- `import type { ProductUpsertInput }` from repository — ✅ (no runtime import)
- ASYMMETRY comment block — ✅ (`grep -c "ASYMMETRY" services/search/searchableText.ts` → 1)
- Exports `buildSearchableText` as named function — ✅
- Fully-populated input → exact labelled multi-line string in order Title/Description/Tags/Vendor/Type/Options — ✅ (Test 1, exact-string `toBe`)
- Input with `description: null`, `tags: []`, `options: []` → all 6 labels still appear with empty values — ✅ (Test 2 + Test 6)
- `bunx vitest run …` exits 0 with ≥5 passing tests — ✅ (6/6 passing)
- Zero `it.todo` remaining — ✅ (`grep -c "it\.todo" …test.ts` → 0)
- No `vi.mock`/`vi.hoisted` in test file — ✅ (only mentioned in comment header explaining absence)

**TSC pre-existing-errors-only check:** `bunx tsc --noEmit` does NOT report any errors in `services/search/searchableText.ts` or `services/search/__tests__/searchableText.test.ts`. All remaining errors are pre-existing (Prisma client not generated for `@/app/generated/prisma/client`; other RED scaffolds from plan 03-01).

## D-03 Happy-Path Exact Output (canonical assertion)

For input:
```typescript
{ title: 'T', description: 'D', tags: ['a','b'], vendor: 'V',
  productType: 'P', options: [{ name: 'Size', position: 1, values: ['S','M'] }] }
```

Output is exactly:
```
Title: T
Description: D
Tags: a, b
Vendor: V
Type: P
Options: Size (S/M)
```

(asserted via `expect(out).toBe('Title: T\\nDescription: D\\nTags: a, b\\nVendor: V\\nType: P\\nOptions: Size (S/M)')` in Test 1).

## ASYMMETRY Comment Confirmation

```bash
$ grep -A 1 "ASYMMETRY" services/search/searchableText.ts
 * ASYMMETRY (D-03 vs D-04):
```

The comment block (lines 3-22 of `searchableText.ts`) documents:
1. This helper INCLUDES options (D-03);
2. The tsvector column EXCLUDES options (D-04, applied via raw SQL in plan 03-05);
3. Phase 4 SearchService relies on this asymmetry — semantic queries see options, lexical queries don't (avoiding BM25 dilution from high-frequency tokens like "Size"/"Color");
4. Explicit "DO NOT" guidance on both directions.

## Deviations from Plan

**None — plan executed exactly as written.**

The implementation matches `RESEARCH.md` §`buildSearchableText (D-03)` lines 561-585 verbatim. The ASYMMETRY comment block was specified in the plan's `<action>` ("Add an `// ASYMMETRY:` comment block above the function") and is present (extended slightly to give explicit DO-NOT guidance).

## Authentication Gates

None encountered.

## Known Stubs

**None.** Plan 03-02 produces a complete pure function with no placeholders. All 6 tests assert concrete behaviour against `searchableText.ts`.

## Threat Flags

No new security surfaces introduced. The plan's `<threat_model>` accepts T-3-V5-01 (input validation done upstream by Phase 2's `mapToUpsertInput`) and T-3-V8-01 (embed text contains plaintext description that's already stored in `products.description`/`products.descriptionHtml` from Phase 1). No additional flags.

## Downstream Contracts Established

- **Plan 03-06 (sync embed-batch):** Will import `buildSearchableText` from `@/services/search/searchableText` and feed the returned string into `embed()` / `embedBatch()`. The `buildSearchableTextMock` hoisted spy already exists in `inngest/functions/__tests__/sync-products.test.ts` (created by plan 03-01).
- **Plan 03-07 (webhook embed-after-upsert):** Same import + call pattern. `buildSearchableTextMock` already exists in `app/api/shopify/webhook/__tests__/route.test.ts`.
- **Plan 03-05 (manual indexes SQL — D-04 tsvector):** Must NOT mirror this function's options inclusion. The ASYMMETRY comment in `searchableText.ts` is the canonical reminder.

## Self-Check: PASSED

Verified before return:

- **Files exist:**
  - `services/search/searchableText.ts` — FOUND (35 lines)
  - `services/search/__tests__/searchableText.test.ts` — FOUND (109 lines, 6 `it(...)`, 0 `it.todo`)
- **Commits exist (`git log --oneline -3`):**
  - `981e1f4` test(03-02): add failing assertion for buildSearchableText happy path — FOUND
  - `f0c37cb` feat(03-02): implement buildSearchableText helper (D-03) — FOUND
  - `df59039` test(03-02): convert remaining it.todo to real assertions for buildSearchableText — FOUND
- **Acceptance criteria scripted checks:**
  - `grep -c "ASYMMETRY" services/search/searchableText.ts` → 1 ✅
  - `wc -l services/search/searchableText.ts` → 35 (≤40) ✅
  - `grep -c "it\.todo" services/search/__tests__/searchableText.test.ts` → 0 ✅
  - `grep -cE "^\s*it\(" services/search/__tests__/searchableText.test.ts` → 6 (≥5) ✅
  - Vitest exit code 0 with 6 passes / 0 failures / 0 todos ✅

## TDD Gate Compliance

- RED: `981e1f4` (`test(03-02): add failing assertion …`) — import of `../searchableText` fails ✅
- GREEN: `f0c37cb` (`feat(03-02): implement buildSearchableText helper …`) — 1/1 test passes ✅
- REFACTOR: not needed; helper is 35 lines and already idiomatic ✅
- Fill-tests: `df59039` (`test(03-02): convert remaining it.todo …`) — 6/6 tests pass ✅
