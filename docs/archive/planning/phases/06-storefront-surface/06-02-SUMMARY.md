---
phase: 06-storefront-surface
plan: 02
subsystem: database
tags: [prisma, postgres, schema-migration, pgvector, partial-unique-index]

requires:
  - phase: 03-embeddings-search-indexes
    provides: db/manual-indexes.sql + bun db:indexes pattern for indexes outside Prisma's migration history
provides:
  - Conversation table (JSONB messages, indexed for cursor pagination)
  - SavedProduct table with two partial unique indexes (anon vs customer-linked)
  - VisitorCustomerLink table (composite PK)
  - phase-06-storefront-models migration applied + manual indexes idempotent
affects: [06-06, 06-07, 06-08, 06-09, 06-10, 06-11]

tech-stack:
  added: []
  patterns:
    - "Partial unique indexes via raw SQL in db/manual-indexes.sql (D-20) — never @@unique in schema.prisma"
    - "JSONB column with default '[]' for UIMessage[] storage (D-17)"
    - "Composite primary key via @@id for natural-key tables (VisitorCustomerLink)"

key-files:
  created:
    - prisma/migrations/20260527113607_phase_06_storefront_models/migration.sql
    - .planning/phases/06-storefront-surface/06-02-SUMMARY.md
  modified:
    - prisma/schema.prisma
    - db/manual-indexes.sql

key-decisions:
  - "Edited the Prisma-generated migration to remove the spurious ALTER TABLE products DROP COLUMN searchVector — that column is hand-maintained per Prisma bug #27186 and persists across migrations"
  - "Surfaced a pre-existing dev-DB drift root cause: migration 20260525110001_add_embeddings_indexes's ALTER TABLE products ADD COLUMN searchVector statement does not survive prisma migrate reset (likely Prisma migrate-runner mishandling the preceding CREATE OR REPLACE FUNCTION ... $$ ... $$ block). Worked around by re-adding the column manually post-reset; full repair is out of scope for this plan"

patterns-established:
  - "Auto-generated migrations must be hand-audited for spurious DROPs against hand-maintained columns (searchVector pattern)"
  - "Migration checksum can be updated in _prisma_migrations after manual edits to keep migrate status clean"

requirements-completed:
  - IDN-03
  - IDN-05
  - IDN-06

duration: ~25min
completed: 2026-05-27
---

# Phase 06, Plan 02: Storefront Persistence Models Summary

**Conversation + SavedProduct + VisitorCustomerLink Prisma models with two partial unique indexes for saved-product uniqueness (anon-only and customer-linked).**

## Performance

- **Duration:** ~25 min (including dev-DB reset + drift remediation)
- **Completed:** 2026-05-27
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Three new Prisma models added per D-03/D-04/D-09/D-11/D-17/D-18/D-20 spec
- Two partial unique indexes (anon-only, customer-linked) appended to `db/manual-indexes.sql` with stable identifiers (`saved_products_anon_unique_idx`, `saved_products_customer_unique_idx`)
- Migration applied, manual indexes idempotent, Prisma client regenerated
- Sanity check confirms `prisma.conversation.count()`, `prisma.savedProduct.count()`, `prisma.visitorCustomerLink.count()` all succeed

## Task Commits

1. **Task 1: Add three new Prisma models** — `e118145` (feat)
2. **Task 2: Append partial unique indexes** — `321c55a` (feat)
3. **Task 3: Apply migration + indexes + regenerate** — `f749355` (feat) [hand-edited migration]

## Files Created/Modified
- `prisma/schema.prisma` — three new `model` blocks after `WebhookEvent`
- `db/manual-indexes.sql` — sections 4 + 5 appended (44 new lines of SQL + comments)
- `prisma/migrations/20260527113607_phase_06_storefront_models/migration.sql` — created tables + secondary indexes (hand-edited to strip spurious DROP)

## Decisions Made

- **SavedProduct has NO `@@unique` declaration in schema.prisma** — uniqueness is enforced via two partial indexes in raw SQL per D-20. Prisma cannot model `WHERE` clauses on unique indexes.
- **VisitorCustomerLink uses `@@id([shop, visitorId, customerId])`** — the triple IS the identity per D-09; no surrogate cuid needed.
- **Conversation.title has `@db.VarChar(60)`** — D-18 truncation is enforced at the app layer; this column constraint provides defense in depth.
- **Conversation.messages: `Json @default("[]")`** — stores `UIMessage[]` verbatim per D-17.
- **Hand-edited the new migration to strip `ALTER TABLE "products" DROP COLUMN "searchVector"`** — Prisma's migrate dev produced this because the column is hand-maintained outside `schema.prisma` (Prisma bug #27186). Letting it ship would break the GIN index in `db/manual-indexes.sql` and the hybrid search path on every fresh DB reset. Migration checksum was updated in `_prisma_migrations` to match the edited file.

## Deviations from Plan

**1. [Pre-existing dev-DB drift] `prisma migrate reset` + manual `ALTER TABLE products ADD COLUMN searchVector` required**
- **Found during:** Task 3 (Apply migration)
- **Issue:** Dev DB had pre-existing drift — an applied migration `20260526093316_init` was not present in the local migrations folder, and `products.searchVector` column had disappeared. `prisma migrate dev` refused to proceed.
- **Root cause (suspected):** Migration `20260525110001_add_embeddings_indexes` declares the `searchVector` column inside the same `.sql` file as a `CREATE OR REPLACE FUNCTION ... AS $$ ... $$;` dollar-quoted block. Prisma's migration runner appears to commit after the function definition and silently skip the subsequent `ALTER TABLE`. The function exists in the DB after reset; the column does not.
- **Fix:** User explicitly consented to `prisma migrate reset --force` (with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var). Manually ran the `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "searchVector" tsvector GENERATED ALWAYS AS (...) STORED;` against the dev DB to restore the column.
- **Verification:** `bun db:indexes` succeeds twice (idempotent), GIN index exists, sanity check passes.
- **Committed in:** Pre-existing drift, no code committed by this plan to fix it. Full repair of the embeddings migration is out of scope here — see "Next Phase Readiness" for follow-up.

**2. [Auto-generated migration drift] Stripped spurious `ALTER TABLE products DROP COLUMN searchVector`**
- **Found during:** Task 3 (after `prisma migrate dev`)
- **Issue:** Prisma's generator added a DROP for `searchVector` because the column isn't in `schema.prisma`. Per Prisma bug #27186, this is unavoidable for `tsvector` columns.
- **Fix:** Edited `prisma/migrations/20260527113607_phase_06_storefront_models/migration.sql` to remove the DROP. Updated the checksum in `_prisma_migrations` to match.
- **Committed in:** `f749355` — file lands without the destructive line.

---

**Total deviations:** 2 (1 pre-existing drift requiring manual remediation, 1 auto-generated DROP stripped)
**Impact on plan:** No scope creep. The drift surfaced a deeper repo bug worth fixing later but unrelated to the plan's scope.

## Issues Encountered

- See deviations above. Both resolved.

## Next Phase Readiness

- ✓ Three new tables exist with all required indexes
- ✓ Prisma typed client knows about them
- ✓ `bun db:indexes` is idempotent and applies cleanly after every reset
- ⚠ **Follow-up debt:** Migration `20260525110001_add_embeddings_indexes` has a real bug — `ALTER TABLE products ADD COLUMN searchVector` does not survive `prisma migrate reset`. The migration must be repaired (e.g., move the function to a prior migration, or restructure the `$$ ... $$` block) so that future resets don't require manual fix-up. Suggest filing this against the embeddings phase or as a standalone fix plan.

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
