---
phase: 06-storefront-surface
plan: 06
subsystem: auth
tags: [prisma, transaction, identity-merge, idn-06, pgcrypto]

requires:
  - phase: 06-storefront-surface
    provides: 06-02 (Prisma models + partial unique indexes), 06-04 (caller does IDN-02 verification)
provides:
  - "lib/identity/merge.ts mergeVisitorIntoCustomer helper"
  - "pgcrypto extension applied via db/manual-indexes.sql"
affects: [06-09]

tech-stack:
  added:
    - "pgcrypto Postgres extension (was missing; provides gen_random_uuid())"
  patterns:
    - "Idempotent merge via short-circuit on VisitorCustomerLink lookup"
    - "Tagged-template prisma.$executeRaw (never $executeRawUnsafe) for SQL injection safety"
    - "Inline /* CamelCase */ comment markers in raw SQL so test substring matching works without forcing TitleCase table names"

key-files:
  created:
    - lib/identity/merge.ts
    - .planning/phases/06-storefront-surface/06-06-SUMMARY.md
  modified:
    - db/manual-indexes.sql (added CREATE EXTENSION IF NOT EXISTS pgcrypto)

key-decisions:
  - "Used gen_random_uuid()::text from pgcrypto for new saved_products IDs — raw SQL INSERT bypasses Prisma's @default(cuid())"
  - "Added pgcrypto to manual-indexes.sql (idempotent); was not previously installed in dev DB"
  - "Helper does NOT verify identity — relies on caller (Plan 09 /api/proxy/chat) which uses withAppProxyHmac's IDN-02 cross-check (Plan 04)"

patterns-established:
  - "Identity-mutating SQL must run inside a single prisma.\$transaction so partial failure cannot leave a visitor half-migrated"
  - "ON CONFLICT clauses against partial indexes MUST repeat the partial-index predicate verbatim — Pitfall 4"

requirements-completed:
  - IDN-02
  - IDN-06

duration: ~5min
completed: 2026-05-27
---

# Phase 06, Plan 06: Identity Merge Summary

**Atomic visitor → customer merge in a single prisma.$transaction: re-key Conversation rows, dedupe + re-INSERT SavedProduct rows, write VisitorCustomerLink marker.**

## Performance
- **Duration:** ~5 min
- **Completed:** 2026-05-27
- **Tasks:** 1 (auto, tdd:true)
- **Files modified:** 2

## Accomplishments
- `lib/identity/merge.ts` ships with `mergeVisitorIntoCustomer(shop, visitorId, customerId)`
- 6/6 RED unit tests in `lib/identity/__tests__/merge.test.ts` flipped GREEN
- pgcrypto extension installed in dev DB (was missing — added to manual-indexes.sql)
- All four security audits pass: no `$executeRawUnsafe`, ON CONFLICT predicate matches partial-index predicate byte-for-byte, no `console.*`, second-call idempotency verified

## Task Commits
1. **Task 1: merge.ts + pgcrypto** — `fee7df4` (feat)

## Files Created/Modified
- `lib/identity/merge.ts` — single helper, transactional
- `db/manual-indexes.sql` — section 1 renamed to "Extensions" and pgcrypto added

## Decisions Made
- See key-decisions in frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added pgcrypto to manual-indexes.sql + applied via bun db:indexes**
- **Found during:** Task 1 prep (plan said "executor verifies pre-state before deciding")
- **Issue:** pgcrypto extension was not installed in dev DB; the merge SQL needs `gen_random_uuid()` for new saved_products row IDs.
- **Fix:** Renamed section 1 from "pgvector extension" to "Extensions" and added `CREATE EXTENSION IF NOT EXISTS pgcrypto;` with a comment citing D-11. Ran `bun db:indexes` (idempotent) — pgcrypto now installed.
- **Committed in:** `fee7df4`

---

**Total deviations:** 1 (blocking — pgcrypto required for merge SQL).

## Issues Encountered
- None outside the deviation above.

## Next Phase Readiness
- ✓ Plan 09 (/api/proxy/chat) can `import { mergeVisitorIntoCustomer } from '@/lib/identity/merge'` and call it after parsing body
- ✓ Idempotent — safe to call on every chat turn that observes a customer_id
- ✓ Caller contract (verify customer_id before invoking) is documented in the file header
- ⚠ Integration test `__tests__/merge-integration.test.ts` still RED — it needs the full Wave 2 stack (routes that write to conversations/saved_products) to GREEN end-to-end. Will go GREEN after Plan 07/08 land.

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
