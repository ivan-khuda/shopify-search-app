---
phase: 03-embeddings-search-indexes
plan: 05
subsystem: db-schema-indexes
tags: [prisma, migration, pgvector, hnsw, tsvector, blocking]
requires: ["03-03", "03-04"]
provides:
  - "ProductEmbedding.modelVersion (typed required field on Prisma client)"
  - "ProductEmbedding.searchableText (typed required field on Prisma client)"
  - "@@unique(shop, productShop, productId) on product_embeddings (enables ON CONFLICT upsert)"
  - "products.searchVector tsvector GENERATED column (D-04)"
  - "product_embeddings_embedding_hnsw_idx (HNSW vector index)"
  - "products_searchVector_gin_idx (GIN tsvector index)"
  - "bun db:indexes script (idempotent index application)"
affects:
  - prisma/schema.prisma
  - prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql
  - db/manual-indexes.sql
  - scripts/apply-manual-indexes.ts
  - package.json
tech_stack:
  added:
    - "pg ^8.21.0 (direct top-level dep — was transitive via @prisma/adapter-pg)"
  patterns:
    - "Manual-indexes-outside-Prisma pattern: pgvector + tsvector indexes live in db/manual-indexes.sql, applied via bun db:indexes; Prisma drift detection silent because the schema cannot model these types"
    - "Idempotent DDL via CREATE INDEX IF NOT EXISTS / CREATE EXTENSION IF NOT EXISTS — re-running bun db:indexes is a no-op (EMB-04)"
    - "IMMUTABLE helper function smartdiscovery_immutable_array_to_string wraps the STABLE array_to_string so it can be referenced from a GENERATED ALWAYS expression"
    - "Pre-flight pgvector >= 0.8.0 check in apply-manual-indexes.ts (EMB-06 hnsw.iterative_scan gate)"
    - "Connection-URL selection: DIRECT_URL ?? DATABASE_URL, with explicit rejection of Accelerate prefix"
key_files:
  created:
    - prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql
    - db/manual-indexes.sql
    - scripts/apply-manual-indexes.ts
  modified:
    - prisma/schema.prisma
    - package.json
decisions:
  - "modelVersion + searchableText declared NOT NULL with no default; pre-Phase-3 dev rows DELETE'd because production has zero embedding rows (verified in 03-RESEARCH.md Runtime State Inventory)"
  - "searchVector lives in raw SQL only — not in schema.prisma — because Unsupported(\"tsvector\") in Prisma 6.7+/7.x breaks the search operator (bug #27186)"
  - "options column intentionally excluded from searchVector composition (D-04 asymmetry — semantic embeddings cover options)"
  - "HNSW opclass is vector_cosine_ops (not vector_l2_ops, not negative-inner-product) — matches cosine semantics of text-embedding-3-small and tolerates non-normalised vectors"
  - "Pin product_embeddings.embedding to vector(1536) inside this migration (deviation Rule 3): HNSW indexes require explicit dimensions and the init migration left the column unbounded — surfaced when `bun db:indexes` first ran"
  - "Wrap array_to_string in an IMMUTABLE PL/pgSQL helper (deviation Rule 3): GENERATED ALWAYS expressions reject STABLE functions; the wrapper is safe because the result is fully determined by inputs"
metrics:
  duration_minutes: 35
  tasks_completed: 5
  files_created: 3
  files_modified: 2
  migration_timestamp: 20260525110001
  completed_date: 2026-05-25
---

# Phase 03 Plan 05: Schema + Migration + Manual Indexes Summary

Ships the persistence + indexing layer that EmbeddingService writes to and Phase 4 will read from: typed `modelVersion` + `searchableText` + composite unique on `product_embeddings`, a raw-SQL `searchVector` tsvector generated column on `products`, the HNSW vector index, and the GIN tsvector index — applied to the dev DB and verified, with a regenerated Prisma client exposing the new typed fields.

## What This Plan Delivered

- **`prisma/schema.prisma`** — Added `modelVersion String` and `searchableText String @db.Text` to `ProductEmbedding`, plus `@@unique([shop, productShop, productId])`. Did NOT touch the `Product` model (the `searchVector` column lives entirely in raw SQL).
- **`prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql`** — Additive migration. `DELETE FROM product_embeddings` (dev wipe; modelVersion has no default), `ADD COLUMN modelVersion/searchableText TEXT NOT NULL`, composite unique index, `ALTER COLUMN embedding TYPE vector(1536)`, plus the hand-edited `ALTER TABLE products ADD COLUMN searchVector tsvector GENERATED ALWAYS AS (...)` with setweight composition title=A, tags+vendor+productType=B, description=C. Wraps `array_to_string` in an IMMUTABLE helper so the generated expression validates.
- **`db/manual-indexes.sql`** — Idempotent: `CREATE EXTENSION IF NOT EXISTS vector`, `CREATE INDEX IF NOT EXISTS product_embeddings_embedding_hnsw_idx ON product_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`, `CREATE INDEX IF NOT EXISTS products_searchVector_gin_idx ON products USING GIN ("searchVector")`. Header documents Pitfall 4 (re-run after `prisma migrate reset`).
- **`scripts/apply-manual-indexes.ts`** — Reads `DIRECT_URL ?? DATABASE_URL`, rejects Accelerate URLs, pre-flights pgvector >= 0.8.0 (EMB-06), then `await client.query(readFileSync('db/manual-indexes.sql'))`. Never logs the connection URL value (T-3-03 mitigation).
- **`package.json`** — Added `"db:indexes": "bunx tsx scripts/apply-manual-indexes.ts"` and `pg ^8.21.0` as a direct top-level dependency.

## Tasks Completed

| # | Description | Commit | Files |
|---|-------------|--------|-------|
| 1 | Add `modelVersion`, `searchableText`, composite `@@unique` to `ProductEmbedding` in schema.prisma | `a930c94` | `prisma/schema.prisma` |
| 2 | Hand-write additive migration SQL: dev wipe → ADD COLUMNs → unique index → vector(1536) pin → tsvector GENERATED column | `67e55b1` | `prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql` |
| 3 | Create idempotent `db/manual-indexes.sql` (CREATE EXTENSION + HNSW + GIN, all `IF NOT EXISTS`) | `5027881` | `db/manual-indexes.sql` |
| 4 | Create `scripts/apply-manual-indexes.ts` + wire `db:indexes` script + add `pg` direct dep | `6293608` | `scripts/apply-manual-indexes.ts`, `package.json`, `bun.lock` |
| 5 | [BLOCKING] Apply migration, run `bun db:indexes` twice (idempotency proof), regenerate Prisma client, tsc verify, post-flight DB queries; fixed generated-column immutability + embedding dimension pin inline | `da4cc70` | `prisma/migrations/.../migration.sql`, `scripts/apply-manual-indexes.ts` |

## Post-Flight Verification

```text
-- information_schema.columns
Columns: [ { column_name: 'modelVersion' }, { column_name: 'searchableText' } ]

-- pg_indexes
Indexes: [
  { indexname: 'product_embeddings_embedding_hnsw_idx' },
  { indexname: 'products_searchVector_gin_idx' }
]

-- products.searchVector
searchVector: [ { column_name: 'searchVector', data_type: 'tsvector' } ]

-- pgvector version
pgvector version: [ { extversion: '0.8.2' } ]   -- >= 0.8.0 (EMB-06 gate satisfied)
```

`bunx prisma migrate status` reports "Database schema is up to date!" with 6 migrations total.

## EMB-04 Idempotency Proof

```text
$ bun db:indexes
$ bunx tsx scripts/apply-manual-indexes.ts
manual indexes applied
$ bun db:indexes
$ bunx tsx scripts/apply-manual-indexes.ts
manual indexes applied
```

Second invocation produced identical output with no errors. `IF NOT EXISTS` clauses short-circuited every CREATE statement.

## Prisma Client — Typed Signature Excerpt

From `app/generated/prisma/models/ProductEmbedding.ts` (the regenerated typed client, line numbers preserved):

```ts
// line 210-211 (required-fields shape used by .create / .createMany)
210:  searchableText: string
211:  modelVersion: string
```

Both fields are typed as required `string` (no `| null`) on the create input — exactly what `EmbeddingService.embedAndStore` needs for the ON CONFLICT upsert that lands in plan 03-06.

## tsc --noEmit Result

Only the pre-existing ambient errors remain (`app/(embedded)/onboarding/page.tsx` `shopify` global typings + `components/ai-elements/reasoning.tsx` `@jenius/ui` module-not-found). No new errors in any Phase 3 file (`services/embeddings/*`, `lib/db/*`, `services/search/*`). The verify-command gate from the plan passes:

```text
$ ! (bunx tsc --noEmit 2>&1 | grep -v "ambient\|reasoning.tsx" | grep -E "error TS" | grep -qE "services/embeddings|lib/db/hnsw|services/search|prisma")
Task 5 tsc verify OK
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `to_tsvector('english', ...)` is STABLE, not IMMUTABLE — generated column rejected the expression**

- **Found during:** Task 5, on the first `bunx prisma migrate dev --name add_embeddings_indexes` invocation.
- **Issue:** `bunx prisma migrate dev` failed with `ERROR: generation expression is not immutable` during shadow-database validation. Postgres exposes both `to_tsvector(text)` (STABLE) and `to_tsvector(regconfig, text)` (IMMUTABLE); without an explicit cast the planner picked the STABLE overload.
- **Fix:** Cast every `'english'` literal to `'english'::regconfig`, forcing the IMMUTABLE overload.
- **Files modified:** `prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql` (3 lines).
- **Commit:** `da4cc70`.

**2. [Rule 3 — Blocking] `array_to_string(text[], text)` is STABLE — generated column still rejected**

- **Found during:** Task 5, on the second `prisma migrate dev` retry after the regconfig fix.
- **Issue:** Even with the IMMUTABLE `to_tsvector` overload locked in, the SQL spec from 03-RESEARCH.md still failed because `array_to_string` is provolatile='s' in Postgres (depends on locale rules). GENERATED ALWAYS expressions reject any STABLE function reference.
- **Fix:** Define an IMMUTABLE helper `CREATE OR REPLACE FUNCTION smartdiscovery_immutable_array_to_string(text[], text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string(arr, delim) $$;` in the migration, then reference the helper in the generated expression. The helper is safe because its output is fully determined by inputs — locale does not affect array concatenation with an explicit delimiter.
- **Files modified:** `prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql`.
- **Commit:** `da4cc70`.

**3. [Rule 3 — Blocking] `bun db:indexes` failed with `column does not have dimensions`**

- **Found during:** Task 5, first `bun db:indexes` invocation.
- **Issue:** The init migration (`20260207111413_init/migration.sql`) created `product_embeddings.embedding` as a bare `vector` (no dimension). `CREATE INDEX ... USING hnsw` requires the column to have an explicit dimension (`vector(N)`). The plan did not include an `ALTER COLUMN` for this.
- **Fix:** Added `ALTER TABLE "product_embeddings" ALTER COLUMN "embedding" TYPE vector(1536)` inside the same migration (safe because the migration's first statement is `DELETE FROM product_embeddings`, so the column is empty during the type change). 1536 matches `EMBEDDING_DIMENSIONS` exported by `services/embeddings/EmbeddingService.ts` (OpenAI text-embedding-3-small).
- **Files modified:** `prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql`.
- **Commit:** `da4cc70`.

**4. [Rule 3 — Blocking] tsx CJS-transform fails on top-level `await main();`**

- **Found during:** Task 5, second `bun db:indexes` invocation.
- **Issue:** `bunx tsx scripts/apply-manual-indexes.ts` errored with `Top-level await is currently not supported with the "cjs" output format`. tsx classified the script as CJS despite `import` statements.
- **Fix:** Replaced `await main();` with `main().catch((err) => { console.error(err instanceof Error ? err.message : String(err)); process.exit(1); });`. Functionally equivalent, no top-level await, no leaked error stacks to logs.
- **Files modified:** `scripts/apply-manual-indexes.ts`.
- **Commit:** `da4cc70`.

**5. [Rule 3 — Blocking] Prisma auto-created a second migration that DROPped `searchVector`**

- **Found during:** Task 5, immediately after the first `prisma migrate dev --name add_embeddings_indexes` succeeded.
- **Issue:** Prisma detected drift (the live DB now contained `searchVector`, but `schema.prisma` did not declare it) and offered "to bring the database in sync" by generating a second migration `20260525113021_add_embeddings_indexes/migration.sql` containing `ALTER TABLE "products" DROP COLUMN "searchVector"`. Running in non-interactive mode auto-accepted this — exactly the drift scenario the plan's whole architecture is designed to AVOID. The `searchVector` column was wiped.
- **Fix:** (a) Deleted the auto-generated `20260525113021_add_embeddings_indexes/` directory from disk; (b) re-applied the `CREATE FUNCTION` + `ALTER TABLE ... ADD COLUMN searchVector` SQL directly via `pg.Client`; (c) deleted the stale row from `_prisma_migrations` so `prisma migrate status` reports clean.
- **Follow-up risk:** Every future `prisma migrate dev` against this DB will tempt Prisma to do the same thing. Plan 03-08's verification gate (the `pg_indexes.indexname` check) will catch the regression. Adding `searchVector` to schema.prisma is explicitly forbidden by 03-RESEARCH.md (Prisma bug #27186 breaks the `search` operator). The long-term mitigation lives in 03-RESEARCH.md Pitfall 4 — keep `db/manual-indexes.sql` runnable and document that drift detection on `searchVector` is expected.
- **Files modified:** None retained in git (the auto-generated migration was deleted before commit).
- **Commit:** Captured implicitly in `da4cc70` (no new files added — the fix was operational, not source-level).

### Non-Critical Operational Note

- A `.env` symlink was created from the worktree root to the parent repo's `.env` so `dotenv/config` could resolve `DATABASE_URL` during migration/index runs. The symlink is not tracked by git and does not affect the merged-back branch.

## Threat Surface Check

No new threat surface beyond what the plan's `<threat_model>` enumerates. T-3-01 (multi-tenancy unique constraint) is implemented exactly as planned. T-3-03 (no URL leakage in script logs) verified via `grep -n "console.log.*URL\|console.error.*URL"` returning only error-message references to variable names, never values. T-3-V13-DDL accepted as planned (dev wipe was safe; production has zero embedding rows). T-3-V13-DRIFT is now actively mitigated — see Deviation 5 above for the operational countermeasure.

## What Plans 03-06 / 03-07 / 03-08 Can Now Do

- **03-06 (sync embed-batch step):** Call `prisma.productEmbedding.upsert({ where: { shop_productShop_productId: { ... } }, ... })` against the typed client. The composite unique constraint enables ON CONFLICT semantics.
- **03-07 (webhook re-embedding):** Same — typed `modelVersion` is now required on create, so the service is forced to record the model ID with every row.
- **03-08 (verification gate):** Query `pg_indexes` for `product_embeddings_embedding_hnsw_idx` and `products_searchVector_gin_idx` — both names are exact and stable. Run the smoke query against `<#>`/`<->` operators using the HNSW index.

## Self-Check: PASSED

- `prisma/schema.prisma`: FOUND (modelVersion/searchableText/@@unique present)
- `prisma/migrations/20260525110001_add_embeddings_indexes/migration.sql`: FOUND
- `db/manual-indexes.sql`: FOUND
- `scripts/apply-manual-indexes.ts`: FOUND
- `package.json` `db:indexes` script: FOUND
- Commit `a930c94`: FOUND (Task 1)
- Commit `67e55b1`: FOUND (Task 2)
- Commit `5027881`: FOUND (Task 3)
- Commit `6293608`: FOUND (Task 4)
- Commit `da4cc70`: FOUND (Task 5)
- Post-flight DB query for columns: PASSED
- Post-flight DB query for indexes: PASSED
- `bun db:indexes` idempotency check (2 invocations, both clean): PASSED
- `bunx tsc --noEmit` gate (no new errors in Phase 3 files): PASSED
