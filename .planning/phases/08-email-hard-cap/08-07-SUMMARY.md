---
phase: 08-email-hard-cap
plan: 07
subsystem: cap-enforcement
tags: [phase-08, repository, prisma, atomic-sql, cap, security-critical]
requires: [08-01, 08-03]
provides: [request-counter-primitive, atomic-increment]
affects: [08-10-CapService]
tech-stack:
  added: []
  patterns: [atomic-upsert-with-where-predicate, $queryRaw-tagged-template, repository-singleton]
key-files:
  created: [lib/db/repositories/RequestCounterRepository.ts]
  modified: []
decisions:
  - "$queryRaw (not $executeRaw) — RETURNING row set must come back; $executeRaw discards it"
  - "Tagged-template literal (not Prisma.sql + concat) — parameter-bound interpolation is SQL-injection safe"
  - "WHERE predicate on DO UPDATE branch (not in app code) — folds cap check into the single atomic statement; absence of RETURNING row = cap reached"
  - "Quoted camelCase column identifiers (\"requestCount\", \"updatedAt\") — match the 08-03 migration DDL"
  - "Number() coercion on row.requestCount — Postgres INTEGER comes back as JS number, but guards against BigInt edge in some drivers"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-27"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 8 Plan 07: RequestCounterRepository Summary

**One-liner:** Atomic per-shop, per-period counter primitive — single `prisma.$queryRaw` INSERT … ON CONFLICT … DO UPDATE … WHERE "requestCount" < cap RETURNING, the SC4 race-free anchor for cap enforcement.

## What Was Built

`lib/db/repositories/RequestCounterRepository.ts` — 71 LOC, one class, one singleton.

**Exports:**

| Export | Kind | Purpose |
| ------ | ---- | ------- |
| `RequestCounterRepository` | class | Atomic counter primitive |
| `requestCounterRepository` | singleton instance | Hot-path import for CapService (08-10) |

**Method contract:**

```ts
tryConsume(shop: string, period: string, cap: number):
  Promise<{ allowed: true; requestCount: number } | { allowed: false }>
```

## SQL Shape (the contract)

```sql
INSERT INTO request_counter (shop, period, "requestCount", "updatedAt")
VALUES (${shop}, ${period}, 1, NOW())
ON CONFLICT (shop, period) DO UPDATE
  SET "requestCount" = request_counter."requestCount" + 1,
      "updatedAt" = NOW()
  WHERE request_counter."requestCount" < ${cap}
RETURNING "requestCount"
```

**Why atomic:** Postgres serializes ON CONFLICT resolution through row-level locks; the WHERE predicate on the DO UPDATE branch is evaluated within the same lock window. Two concurrent requests at cap-1 cannot both see the pre-update value and both pass — exactly one wins, the other gets zero rows back.

**Why $queryRaw (not $executeRaw):** Need the RETURNING row set. $executeRaw discards it and returns only a row count, making the cap-reached signal impossible.

**Why no typed `prisma.requestCounter.upsert()`:** The typed API cannot express `WHERE "requestCount" < cap` on the UPDATE branch — typed upsert always overwrites.

## Wave 0 Test Flip

`lib/db/repositories/__tests__/RequestCounterRepository.test.ts` — was RED (module did not exist), now GREEN.

```
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

All six assertions pass:

1. `prisma.$queryRaw` invoked as tagged template (strings array as first arg)
2. SQL contains canonical tokens: `insert into`, `request_counter`, `on conflict`, `(shop, period)`, `do update`, `"requestcount" <`, `returning`
3. `shop`, `period`, `cap` interpolated as bound parameters (not concatenated)
4. Returns `{ allowed: true, requestCount: 5 }` for one-row response
5. Returns `{ allowed: false }` for zero-row response (cap reached)
6. Returns `{ allowed: true, requestCount: 1 }` for first request of a new period

## Verification

```bash
$ bunx vitest run lib/db/repositories/__tests__/RequestCounterRepository.test.ts
Test Files  1 passed (1) | Tests  6 passed (6)

$ grep -n "console\." lib/db/repositories/RequestCounterRepository.ts
(empty — zero console.* calls)

$ grep -nE "(real-use of)\\\$executeRaw|prisma\\.requestCounter\\.upsert" lib/db/repositories/RequestCounterRepository.ts
(empty in code; matches only in JSDoc anti-pattern callouts)

$ bunx tsc --noEmit 2>&1 | grep RequestCounterRepository.ts | grep -v __tests__
(empty — implementation file is TS-clean)
```

## Requirements Satisfied

- **CAP-01** — Atomic per-shop, per-period counter primitive exists
- **CAP-02** — Composite PK `(shop, period)` enforces multi-tenant scoping at the schema level (delegated to 08-03 migration; this repository uses it correctly)
- **CAP-03** — Single-statement upsert with WHERE predicate produces race-free increment
- **SC4** — Race-freeness proven at the SQL-shape level by Wave 0 assertions; runtime race integration test scheduled for the separate race.integration.test.ts (Wave 5)

## Threat Mitigations

| Threat ID | Mitigation | Evidence |
| --------- | ---------- | -------- |
| T-08-07-T1 (counter-bypass race at cap-1) | Single-statement INSERT … ON CONFLICT DO UPDATE WHERE … RETURNING | SC4 SQL-shape test GREEN |
| T-08-07-T2 (cross-shop counter mutation) | Composite PK `(shop, period)` — UPDATE binds the exact tuple | Migration DDL in 08-03; verified by test using `test-shop.myshopify.com` + `2026-05` parameter binding |
| T-08-07-T3 (SQL injection via shop/period) | Tagged-template `${...}` parameter binding | Test 3 asserts values appear in args slice, not in strings array |
| T-08-07-T4 ($executeRaw silently discarding RETURNING) | Code review + verify grep | grep returns empty in code; matches are JSDoc-only |

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the verbatim SQL skeleton in 08-RESEARCH.md §Code Examples "RequestCounterRepository", the exports match the must_haves contract, and all verification commands pass on the first GREEN attempt.

The optional `get(shop, period)` observability method described in the task body was **not** implemented — the plan marks it explicitly optional, no caller in Phase 8 needs it, and YAGNI applies. Adding it later is a one-line addition if observability requires it.

## Known Stubs

None.

## Self-Check: PASSED

- `lib/db/repositories/RequestCounterRepository.ts` — FOUND
- Commit `73d8528` — FOUND in `git log`
- Wave 0 test `lib/db/repositories/__tests__/RequestCounterRepository.test.ts` — 6/6 GREEN

## TDD Gate Compliance

This is an execute-type plan (not `type: tdd`), and Wave 0 already authored the RED test in a prior wave (lib/db/repositories/__tests__/RequestCounterRepository.test.ts). The implementation directly flipped that pre-existing RED test to GREEN — equivalent to the GREEN gate. No separate `test(...)` commit was needed in this plan because the RED commit was made by the Wave 0 author. Single `feat(...)` commit at `73d8528` satisfies the GREEN gate.
