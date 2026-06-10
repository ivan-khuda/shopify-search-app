---
phase: 08-email-hard-cap
plan: 02
subsystem: schema/prisma
tags: [phase-08, schema, prisma, hard-cap, notifications]
requires:
  - phase: 02
    plan: SyncRun model
    via: append nullable emailSentAt column
  - phase: 07
    plan: ShopSettings layout
    via: placement reference for shop-keyed singleton-ish tables
provides:
  - RequestCounter Prisma model (composite PK [shop, period])
  - SyncRun.emailSentAt nullable column (D-04 idempotency stamp)
affects:
  - prisma/schema.prisma
tech-stack:
  added: []
  patterns:
    - composite-pk-for-multi-tenancy
    - additive-nullable-column-migration
key-files:
  created: []
  modified:
    - prisma/schema.prisma
decisions:
  - "D-04: emailSentAt is a nullable DateTime on SyncRun; NULL = email not yet sent (idempotency sentinel for Inngest step + restart safety)"
  - "D-08: RequestCounter composite PK (shop, period) makes shop-scoping structurally implicit (V4 Access Control mitigation per 08-RESEARCH.md)"
  - "No @@index([shop]) on RequestCounter — composite PK already covers shop-prefix lookups; avoids exposing a cross-shop scan path"
  - "No FK from RequestCounter to other tables — counter rows are independent of shop installation lifecycle (T-08-02-E1 accepted)"
metrics:
  duration: "~5 min"
  completed: "2026-05-27"
  tasks_completed: 1
  files_modified: 1
---

# Phase 8 Plan 2: Prisma Schema Delta Summary

**One-liner:** Two additive hunks in `prisma/schema.prisma` — nullable `emailSentAt DateTime?` on `SyncRun` (D-04 email idempotency stamp) and a new `RequestCounter` model with composite PK `(shop, period)` (D-08 / CAP-01 per-shop monthly counter). No migration generated; that is plan 08-03's [BLOCKING] responsibility.

## Scope

Edit-only plan. Stage the schema delta so 08-03 can extract surgical DDL via `prisma migrate diff --from-config-datasource --to-schema-datamodel`. Splitting schema-edit from migration apply avoids letting `prisma migrate dev` touch the manual HNSW + GIN indexes (Pitfall 1; see Phase 7 STATE.md note).

## Changes

### Hunk 1 — `SyncRun.emailSentAt`

Appended one field immediately after `finishedAt`:

```prisma
emailSentAt    DateTime? // Phase 8 D-04 — NULL = email not yet sent
```

- Nullable: NULL sentinel = email not yet sent
- Updated to `NOW()` after a successful Resend send (D-04 + Inngest step idempotency = defense in depth against double-sends on retries / cold restarts)
- No `@map` — Postgres column name will be `emailSentAt` (Prisma default; consistent with sibling Phase 2 columns)

### Hunk 2 — `RequestCounter` model

Appended after `ShopSettings` (the existing shop-keyed singleton-ish table — sibling placement):

```prisma
// Phase 8 D-08 / CAP-01: per-shop monthly request counter.
// Empty by design — first chat request of a (shop, period) INSERTs the row
// via the atomic upsert primitive in RequestCounterRepository.tryConsume.
model RequestCounter {
  shop         String
  period       String   // YYYY-MM UTC — D-12
  requestCount Int      @default(0)
  updatedAt    DateTime @updatedAt

  @@id([shop, period])
  @@map("request_counter")
}
```

- Composite PK `(shop, period)` — multi-tenancy lock is structural (every lookup carries shop)
- Postgres table name explicitly `request_counter` via `@@map` (snake_case house style)
- No `@@index([shop])` — composite PK already covers shop-prefix lookups; avoids exposing a cross-shop scan path (T-08-02-I1 mitigation)
- No FK to `ShopifySession` or any other table — counter rows are independent of install lifecycle by design (T-08-02-E1 accepted; future operational cleanup task)

## Explicit Non-Actions

- **No migration generated.** `bunx prisma migrate dev` and `bunx prisma migrate diff` were NOT run. Plan 08-03 owns DDL extraction + application.
- **No `bunx prisma generate`.** Client regeneration is 08-03's responsibility (after migration applies).
- **No edits to `db/manual-indexes.sql`.** Not in scope.
- **No edits to any other model.** `git diff prisma/schema.prisma` is exactly two hunks (verified below).

## Verification

| Check                                              | Result   |
| -------------------------------------------------- | -------- |
| `bunx prisma format`                               | clean    |
| `bunx prisma validate`                             | valid    |
| `grep -c "model RequestCounter" prisma/schema.prisma` | `1`   |
| `grep -nE "emailSentAt\s+DateTime\?" prisma/schema.prisma` | `194:  emailSentAt    DateTime? // Phase 8 D-04 — NULL = email not yet sent` |
| `git diff --stat prisma/schema.prisma`             | 1 file changed, 14 insertions(+) |

## Deviations from Plan

None — plan executed exactly as written. Field placement is immediately after `finishedAt` (matches PLAN action), and the `RequestCounter` model is appended after `ShopSettings` per CONTEXT placement guidance.

## Decisions Made

- **D-04 stamp shape:** `emailSentAt DateTime?` (nullable, no default) — NULL is the "not yet sent" sentinel
- **D-08 model shape:** Composite PK `(shop, period)`, no separate `@@index([shop])`, no FK
- **Placement:** `RequestCounter` lives at the end of the file (after `ShopSettings`) following the convention of grouping new phase models at the bottom

## Threat Flags

None — all changes were anticipated in the plan's `<threat_model>` block.

## Commits

- `1c9046f` — feat(08-02-01): add RequestCounter model + SyncRun.emailSentAt to schema

## Self-Check: PASSED

- FOUND: prisma/schema.prisma (modified, two hunks, 14 insertions)
- FOUND: commit `1c9046f` in git log
- FOUND: `model RequestCounter` (exactly 1 occurrence)
- FOUND: `emailSentAt    DateTime?` field in SyncRun
- VALIDATED: `bunx prisma validate` reports schema valid
