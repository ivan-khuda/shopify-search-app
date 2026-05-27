---
phase: 07-admin-settings-model-picker
plan: 04
subsystem: chat-services
tags: [model-catalog, ai-gateway, cache, fallback-ladder, D-01, D-02, D-03]
requires: [07-01, 07-03]
provides:
  - fetchModelCatalog() function
  - BEST_FOR record (10 entries)
  - CatalogModel / CatalogResult types
  - __resetModelCatalogCacheForTests() hook (test-only)
affects:
  - services/chat/getActiveChatModel.ts (Plan 06 will import fetchModelCatalog)
  - app/(embedded)/settings/page.tsx (Plan 08 SSR import)
  - app/api/settings/model/route.ts (Plan 07 PATCH defense-in-depth)
tech-stack:
  added: []
  patterns:
    - module-level Map cache with epoch-based TTL expiry
    - last-known-good fallback ladder (cache → stale → cold-start)
    - structural duplication of DEFAULT_MODEL id literal to dodge circular import
key-files:
  created:
    - services/chat/model-catalog.ts
  modified: []
decisions:
  - "Removed the BEST_FOR-keyed filter from fetchModelCatalog (plan §behavior step 81 suggested it). The Wave-0 RED test asserts that an unknown-id language model still appears in the result with bestFor='General purpose' — keeping the filter in the catalog client would have failed `decorates rows with BEST_FOR descriptor, falling back to General purpose`. Filter moves to the call site (resolver / settings page) where active-id re-inclusion can also live. The test is the contract."
  - "Used Number(...) instead of parseFloat for pricing conversion — stricter parsing, identical result on the well-formed decimal strings the gateway emits."
  - "Mapper reads m.provider with m.owned_by fallback. The test fixture uses provider (matching one shape of the live response); supporting both keeps the code robust without changing externally-observable behavior."
  - "Cold-start fallback NOT cached. On the next fetchModelCatalog() call the real fetch retries; otherwise a single transient outage would pin DEFAULT_MODEL for 15 minutes."
  - "Stale-LKG path does NOT bump expiresAt. Each call retries the real fetch until success — matches the plan's directive."
metrics:
  duration: ~15min
  tasks: 1
  files: 1
  completed: 2026-05-27
---

# Phase 7 Plan 04: Model Catalog Client Summary

One-liner: New `services/chat/model-catalog.ts` exports `fetchModelCatalog()`, a 15-minute-cached client of Vercel AI Gateway `/v1/models` with a three-tier fallback ladder (cache → stale LKG → cold-start DEFAULT_MODEL row), driving all 6 Wave-0 RED tests to GREEN.

## What Was Built

**File:** `services/chat/model-catalog.ts` (203 lines)
**Commit:** `716ede2`

### Public exports

| Export                                  | Purpose                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `fetchModelCatalog()`                   | Async catalog client; returns `CatalogResult`                                      |
| `BEST_FOR`                              | `Record<string, string>` — 10 curated descriptors (D-02)                           |
| `CatalogModel` (type)                   | `{ id, displayName, provider, contextWindow, inputPricePerMillion, outputPricePerMillion, bestFor }` |
| `CatalogResult` (type)                  | `{ models: CatalogModel[], stale: boolean, coldStartFallback: boolean }`           |
| `__resetModelCatalogCacheForTests()`    | Test-only cache reset hook (imported by Wave-0 test setup)                         |

### BEST_FOR map (10 entries — D-02)

```ts
'google/gemini-2.5-flash'        → 'Fastest, low cost — great default'
'google/gemini-2.5-flash-lite'   → 'Highest throughput, simplest tasks'
'google/gemini-2.5-pro'          → 'Strong reasoning, vision, long context'
'google/gemini-3.1-pro-preview'  → 'Newest Google flagship reasoning'
'anthropic/claude-haiku-4.5'     → 'Anthropic balance of cost and quality'
'anthropic/claude-sonnet-4.5'    → 'Anthropic mid-tier for complex queries'
'anthropic/claude-opus-4.7'      → 'Best long-form reasoning, premium cost'
'openai/gpt-5-mini'              → 'OpenAI value tier'
'openai/gpt-5.5'                 → 'OpenAI flagship general purpose'
'xai/grok-4.3'                   → 'Real-time knowledge, opinionated reasoning'
```

Copy taken verbatim from RESEARCH §State of the Art proposal.

## Key Code Path

```
fetchModelCatalog()
  ├── cache.get('catalog') + expiresAt > now? → return { models: cached, stale: false }
  └── fetch(CATALOG_URL, { cache: 'no-store' })          ← Pitfall 4
        ├── ok:    json.data.filter(language).map(mapRaw)
        │           ├── pricing strings × 1e6 → $/M     ← Pitfall 5
        │           ├── m.provider ?? m.owned_by         ← shape tolerance
        │           └── BEST_FOR[id] ?? 'General purpose' ← D-02
        │          cache.set('catalog', { data, expiresAt: now + 15min })
        │          → return { models, stale: false, coldStartFallback: false }
        └── catch:
              ├── cached?  → return { models: cached, stale: true }    ← LKG
              └── !cached  → return { models: [coldStartRow()], coldStartFallback: true }
```

## Test Results

| Suite                                         | Result |
| --------------------------------------------- | ------ |
| filtering + mapping (D-01, Pitfall 5)         | PASS   |
| BEST_FOR decoration (D-02)                    | PASS   |
| failure fallback — stale LKG                  | PASS   |
| failure fallback — cold-start                 | PASS   |
| caching — 15-min TTL                          | PASS   |
| caching — cache:'no-store' on every fetch     | PASS   |

**6 of 6 Wave-0 catalog tests GREEN.** Run command:

```bash
bunx vitest run services/chat/__tests__/model-catalog.test.ts
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed the BEST_FOR-keyed allowlist filter from the catalog client**

- **Found during:** Task 1 (initial implementation following plan §behavior step 81 directly)
- **Issue:** The plan instructs filtering response models to `BEST_FOR-keyed ids`. The Wave-0 RED test, however, asserts that an unknown-id language model still appears in results with `bestFor: 'General purpose'`:

  ```ts
  const unknown = result.models.find((m) => m.id === unknownId);
  expect(unknown?.bestFor).toBe('General purpose');
  ```

  With the curated filter, `unknown` is `undefined` and `unknown?.bestFor` is `undefined`, not `'General purpose'`. The test fails. The test is the contract — Plan 01 fixed it in stone before this plan ran.

- **Fix:** Removed the `.filter((m) => BEST_FOR[m.id])` step. The catalog client now returns the full language-typed slice. The BEST_FOR-keyed curation moves to the **call site** (resolver in Plan 06, page in Plan 08), where active-id re-inclusion can also be expressed cleanly. This matches plan §behavior line 81's parenthetical: *"this is the simplest split; the alternative passing activeId in couples concerns badly."*
- **Files modified:** `services/chat/model-catalog.ts`
- **Commit:** `716ede2`

### None for the rest

Plan executed as written for the cache, fallback ladder, pricing conversion, no-store flag, type definitions, and BEST_FOR contents.

## Verification

```bash
# Tests
bunx vitest run services/chat/__tests__/model-catalog.test.ts
  → 6 passed (6)

# Constraints
grep -c 'console\.' services/chat/model-catalog.ts        → 0
grep -E ': any\b|<any>' services/chat/model-catalog.ts    → (no match)
grep -c "cache: 'no-store'" services/chat/model-catalog.ts → 1
# BEST_FOR entries
grep -c "^  '" services/chat/model-catalog.ts             → 10

# TypeScript
bunx tsc --noEmit 2>&1 | grep "model-catalog"             → (no errors)
```

## Handoff to Plan 06 (Resolver Body Swap)

- `fetchModelCatalog()` is now importable from `services/chat/model-catalog`.
- Plan 06 will:
  1. Read `ShopSettings.activeChatModelId` from Prisma.
  2. Call `fetchModelCatalog()` to hydrate `displayName`.
  3. Find the matching `CatalogModel` by id; on miss, synthesize `displayName` from the id segment (`'google/gemini-2.5-flash'` → `'gemini-2.5-flash'`).
  4. Apply the BEST_FOR-keyed curation + active-id re-inclusion in the resolver / page render layer (the catalog client deliberately no longer does this — see Deviation 1).
- The 3 RED tests in `services/chat/__tests__/getActiveChatModel.test.ts` (Phase 7 contract block) remain RED, awaiting Plan 06. Out of scope for this plan.

## Handoff to Plan 07 (PATCH route)

- Defense-in-depth: import `fetchModelCatalog`, validate the submitted `activeChatModelId` against the returned `models[].id` before writing to `ShopSettings`. Use the BEST_FOR-keyed slice for write validation if Open Question 1 should govern writes as well — defer to Plan 07's planner.

## Handoff to Plan 08 (Settings page SSR)

- Import `fetchModelCatalog` at the Server Component top level.
- Apply the curated filter at the page layer: `models.filter((m) => BEST_FOR[m.id] || m.id === activeId)` to render the ~10–12 row table.
- Use `result.stale` and `result.coldStartFallback` flags to render banner copy when the live catalog is unavailable.

## Self-Check: PASSED

- `services/chat/model-catalog.ts` exists at the expected path.
- Commit `716ede2` is present in `git log`.
- 6/6 Wave-0 catalog tests GREEN.
- `console.` count = 0.
- `cache: 'no-store'` count = 1.
- BEST_FOR has 10 entries.
- `__resetModelCatalogCacheForTests` is exported (verified by import succeeding in test file).
