---
phase: 05-shared-chat-ui-extraction
plan: 01
subsystem: chat-ui
tags: [refactor, testing, vitest, chat-ui, red-phase, wave-0]
requires: []
provides: ["wave-0-red-tests", "shr-01-barrel-guard", "shr-03-adapter-contracts", "t-5-01-scope-guard"]
affects: ["lib/chat-ui/__tests__"]
tech-stack:
  added: []
  patterns:
    - "Static-grep barrel-isolation test (Pattern E)"
    - "vi.stubGlobal('shopify', ...) for runtime-global mocking"
    - "vi.spyOn(crypto, 'randomUUID') for deterministic UUID assertions"
    - "Scope-or-throw constructor guard (Pattern G)"
key-files:
  created:
    - "lib/chat-ui/__tests__/barrel-isolation.test.ts"
    - "lib/chat-ui/__tests__/embedded-adapter.test.ts"
    - "lib/chat-ui/__tests__/storefront-adapter.test.ts"
    - "lib/chat-ui/__tests__/local-storage-stores.test.ts"
  modified: []
decisions:
  - "Authored the type-only-exempt adapter regex `/from\\s+['\"]\\.\\/adapters\\/(?!types['\"])/` from the start (D-04) — Plan 03 does not need to mutate the barrel-isolation test."
  - "EmbeddedAdapter Test 4 asserts shopify.idToken() is called twice across two getAuthHeaders() calls (T-5-AC: no module-level token caching)."
  - "StorefrontAdapter Test 5 simulates SSR via vi.stubGlobal('window', undefined) and asserts getRequestBody() returns {}."
  - "Local-storage tests use 'test-shop.myshopify.com' (history) and 'test-shop' (saved) as distinct scope values to confirm key namespacing per scope."
metrics:
  duration: "~14 minutes"
  completed: "2026-05-26"
  tasks_completed: 3
  files_created: 4
  test_lines: 246
---

# Phase 5 Plan 01: Wave 0 RED Test Scaffolds Summary

Authored the four Wave 0 RED test files at `lib/chat-ui/__tests__/` that lock the SHR-01..03 + T-5-01 contracts before any production code in `lib/chat-ui/` exists; all four files fail today with the expected module-not-found / ENOENT signals.

## Tasks Completed

| # | Task                                                            | Commit    | Files                                                    |
| - | --------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| 1 | barrel-isolation.test.ts (SHR-01 static-grep guard)             | `15e017a` | lib/chat-ui/__tests__/barrel-isolation.test.ts           |
| 2 | embedded-adapter.test.ts + storefront-adapter.test.ts (SHR-03)  | `c0644a2` | lib/chat-ui/__tests__/embedded-adapter.test.ts, lib/chat-ui/__tests__/storefront-adapter.test.ts |
| 3 | local-storage-stores.test.ts (D-07 round-trip + T-5-01 throw)   | `7d63bd5` | lib/chat-ui/__tests__/local-storage-stores.test.ts       |

## Files Created

| File                                                            | Lines | Role                                                 |
| --------------------------------------------------------------- | ----- | ---------------------------------------------------- |
| `lib/chat-ui/__tests__/barrel-isolation.test.ts`                | 44    | Static-grep guard for SHR-01 (Shopify SDK isolation) |
| `lib/chat-ui/__tests__/embedded-adapter.test.ts`                | 38    | Bearer header + no-cache assertions (SHR-03, T-5-AC) |
| `lib/chat-ui/__tests__/storefront-adapter.test.ts`              | 49    | visitor_id round-trip + SSR guard (SHR-03)           |
| `lib/chat-ui/__tests__/local-storage-stores.test.ts`            | 115   | Store round-trip + scope-or-throw (D-07, T-5-01)     |
| **Total**                                                       | 246   |                                                      |

## RED-state Evidence

Combined run `bunx vitest run lib/chat-ui/__tests__/` exits with code 1. Excerpt:

```
 Test Files  4 failed (4)
      Tests  1 failed | 1 passed (2)

 FAIL  lib/chat-ui/__tests__/embedded-adapter.test.ts
Error: Failed to resolve import "@/lib/chat-ui/adapters/embedded" from "lib/chat-ui/__tests__/embedded-adapter.test.ts"

 FAIL  lib/chat-ui/__tests__/storefront-adapter.test.ts
Error: Failed to resolve import "@/lib/chat-ui/adapters/storefront" from "lib/chat-ui/__tests__/storefront-adapter.test.ts"

 FAIL  lib/chat-ui/__tests__/local-storage-stores.test.ts
Error: Failed to resolve import "@/lib/chat-ui/stores/local-storage" from "lib/chat-ui/__tests__/local-storage-stores.test.ts"

 FAIL  lib/chat-ui/__tests__/barrel-isolation.test.ts > ... > barrel index.ts does NOT re-export concrete adapters (type-only re-export from ./adapters/types is permitted)
Error: ENOENT: no such file or directory, open '.../lib/chat-ui/index.ts'
```

All failures are of the form "Cannot resolve module @/lib/chat-ui/..." or ENOENT — NOT logic failures. This is the planned RED state; Plan 02 (adapter + store source) and Plan 03 (barrel index.ts) turn the suite green.

Note: the first barrel-isolation test (`walks BARREL_ROOT ... offenders === []`) trivially passes today because no `.ts/.tsx` source files exist outside the `/__tests__` subdirectory. It becomes meaningful once Plan 02 lifts components into `lib/chat-ui/components/` — at which point it actively guards against `@shopify/*` imports leaking into the shared barrel.

## Contract Assertions Present

| Contract | Test File | Assertion |
| -------- | --------- | --------- |
| SHR-01: no @shopify/* outside /adapters | barrel-isolation.test.ts | `walkTs` skips `/adapters` and `/__tests__`, asserts `offenders.toEqual([])` against `FORBIDDEN_IN_BARREL` regex array |
| D-04 type-only re-export exemption | barrel-isolation.test.ts | `expect(src).not.toMatch(/from\s+['"]\.\/adapters\/(?!types['"])/)` — concrete adapter re-exports forbidden, `./adapters/types` permitted (TS erases types at compile time) |
| SHR-03 (embedded): Bearer header from shopify.idToken | embedded-adapter.test.ts | `expect(headers).toEqual({ Authorization: 'Bearer fake-jwt-token' })` |
| T-5-AC: no token caching across invocations | embedded-adapter.test.ts | `expect(idTokenMock).toHaveBeenCalledTimes(2)` after two getAuthHeaders() calls |
| SHR-03 (storefront): visitor_id round-trip | storefront-adapter.test.ts | `expect(window.localStorage.getItem('smartdiscovery.visitor_id')).toBe(FIXED_UUID)` |
| Storefront SSR guard | storefront-adapter.test.ts | `vi.stubGlobal('window', undefined)` → `expect(body).toEqual({})` |
| T-5-01: scope-or-throw (history) | local-storage-stores.test.ts | `expect(() => new LocalStorageHistoryStore('')).toThrow(/non-empty scope/)` |
| T-5-01: scope-or-throw (saved) | local-storage-stores.test.ts | `expect(() => new LocalStorageSavedProductsStore('')).toThrow(/non-empty scope/)` |
| D-07: HISTORY_CAP = 10, newest first | local-storage-stores.test.ts | After adding 11 entries: `items.length === 10`, `items[0].id === 'h11'`, `items[9].id === 'h2'` |
| D-07: SavedProducts uncapped | local-storage-stores.test.ts | After 100 toggle adds: `store.list().length === 100` |

## Threat-Model Coverage

| Threat ID | Mitigation Asserted | Test                          |
| --------- | ------------------- | ----------------------------- |
| T-5-01    | Empty-scope constructor throws (prevents multi-tenant key collision `smartdiscovery.history.`) | local-storage-stores.test.ts tests 1 & 2 |
| T-5-02    | Barrel `lib/chat-ui/index.ts` does NOT re-export concrete adapters (type-only re-export from `./adapters/types` permitted per D-04) | barrel-isolation.test.ts test 2 |
| T-5-AC    | EmbeddedAdapter.getAuthHeaders() calls shopify.idToken() fresh on every invocation (no module-level cache) | embedded-adapter.test.ts test 4 |

## Acceptance-Criteria Verification

Spot-check greps against the plan's acceptance lists:

```
$ grep -c "describe('lib/chat-ui barrel — Shopify SDK isolation (SHR-01)'" lib/chat-ui/__tests__/barrel-isolation.test.ts
1
$ grep -c "FORBIDDEN_IN_BARREL" lib/chat-ui/__tests__/barrel-isolation.test.ts
2
$ grep -c "function\* walkTs" lib/chat-ui/__tests__/barrel-isolation.test.ts
1
$ grep -F "from\\s+['\"]\\.\\/adapters\\/(?!types['\"])" lib/chat-ui/__tests__/barrel-isolation.test.ts | wc -l
1
$ grep -c "type-only re-export" lib/chat-ui/__tests__/barrel-isolation.test.ts
2
$ grep -c "from '@/lib/chat-ui/adapters/embedded'" lib/chat-ui/__tests__/embedded-adapter.test.ts
1
$ grep -c "from '@/lib/chat-ui/adapters/storefront'" lib/chat-ui/__tests__/storefront-adapter.test.ts
1
$ grep -c "vi.stubGlobal('shopify'" lib/chat-ui/__tests__/embedded-adapter.test.ts
1
$ grep -c "smartdiscovery.visitor_id" lib/chat-ui/__tests__/storefront-adapter.test.ts
2
$ grep -c "from '@/lib/chat-ui/stores/local-storage'" lib/chat-ui/__tests__/local-storage-stores.test.ts
1
$ grep -c "non-empty scope" lib/chat-ui/__tests__/local-storage-stores.test.ts
2
$ grep -c "smartdiscovery.history" lib/chat-ui/__tests__/local-storage-stores.test.ts
2
$ grep -c "smartdiscovery.saved" lib/chat-ui/__tests__/local-storage-stores.test.ts
1
```

All counts meet or exceed the acceptance-criteria thresholds.

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

This plan follows the Wave 0 RED pattern: three `test(...)` commits, no `feat(...)` follow-on (the GREEN gate lives in downstream plans 02 + 03). RED commits are:

- `15e017a` test(05-01): add barrel-isolation RED test for SHR-01
- `c0644a2` test(05-01): add EmbeddedAdapter + StorefrontAdapter RED tests for SHR-03
- `7d63bd5` test(05-01): add LocalStorage*Store RED tests for D-07 + T-5-01

## Threat Flags

None — this plan introduces no new security-relevant surface. All assertions cover the threat register entries already enumerated in the plan's `<threat_model>`.

## Self-Check: PASSED

- All four files exist at expected paths (verified via `ls lib/chat-ui/__tests__/`).
- All three commits exist in branch history (verified via `git log --oneline`).
- Combined vitest run exits non-zero with module-not-found / ENOENT failures (verified at /tmp/v_all.out).
