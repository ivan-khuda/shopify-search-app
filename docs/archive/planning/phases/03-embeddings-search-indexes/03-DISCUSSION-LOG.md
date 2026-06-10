# Phase 3: Embeddings + Search Indexes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 3-Embeddings + Search Indexes
**Areas discussed:** Where embedding generation lives, Searchable text composition, HNSW + manual-indexes.sql lifecycle, Embedding batching + retry/error policy

---

## Embedding Generation Location

| Option | Description | Selected |
|--------|-------------|----------|
| New step inside Phase 2 syncProductsFunction | Add `embed-batch-${cursor}` between upsert-batch and persist-cursor. | ✓ |
| Separate Inngest function on 'product.synced' event | More decoupled; adds latency + complexity. | |
| EmbeddingRun own table + workflow | Symmetric to SyncRun; more infra. | |

**User's choice:** New step inside syncProductsFunction.

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook calls embedProduct inline | After upsertProduct, EmbeddingService.embedAndStore synchronously. | ✓ |
| Webhook fires Inngest event; embed async | Risk of search returning stale results. | |
| Skip embedding on webhook | Embedding lags until next manual sync. | |

**User's choice:** Webhook → embedProduct inline.

---

## Searchable Text Composition

| Option | Description | Selected |
|--------|-------------|----------|
| title + description + tags + vendor + productType + options | Full set; best quality. | ✓ |
| title + description only | Cheaper; skips important filter dimensions. | |
| title + description + tags | Middle ground. | |

**User's choice:** Full set.

| Option | Description | Selected |
|--------|-------------|----------|
| tsvector: same field set with setweight (A=title, B=tags+vendor+type, C=desc) | Generated column auto-updates on UPDATE. | ✓ |
| tsvector: title + tags only | Optimized for short brand/SKU queries. | |
| Whole row with setweight ranks | Same fields, different weights. | |

**User's choice:** Same field set with setweight.

---

## HNSW + Manual-SQL Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| m=16, ef_construction=64 (pgvector default) | Tuned for <100k vectors; ~32MB per 5k. | ✓ |
| m=32, ef_construction=128 | 2× memory; overkill for V1. | |
| IVFFlat alternative | Conflicts with research-locked HNSW. | |

**User's choice:** m=16, ef_construction=64.

| Option | Description | Selected |
|--------|-------------|----------|
| package.json `bun db:indexes` script | psql -f db/manual-indexes.sql via npm script. | ✓ |
| Postinstall hook | Risk: fails on CI/Vercel without DB. | |
| Inngest cron + post-migrate hook | Overkill. | |

**User's choice:** `bun db:indexes`.

---

## Embedding Batching + Retry/Error Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Batch size = 100 (matches sync) | 1 AI call per sync batch; ~$0.05 per 5k sync. | ✓ |
| 25 per AI call (4× dispatch) | Better rate-limit isolation; more overhead. | |
| 1 per AI call | 5k calls; expensive + rate-limit risk. | |

**User's choice:** Batch size = 100.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-batch try/catch + errors[] (mirrors Phase 2 D-15) | Partial success persists; full-batch failure throws → Inngest retry. | ✓ |
| Exponential backoff inside step | Redundant with Inngest retries. | |
| Fail fast | Contradicts EMB-02. | |

**User's choice:** Per-batch try/catch (Phase 2 D-15 mirror).

---

## Claude's Discretion

- `embedBatch` return shape (`(number[] | null)[]` vs `{ok, failed}` discriminated).
- Whether `db/manual-indexes.sql` includes redundant `CREATE EXTENSION IF NOT EXISTS vector`.
- `EMBEDDING_DIMENSIONS` runtime assert vs Postgres CHECK constraint.
- `buildSearchableText` whitespace trimming.
- `bun db:indexes` vs `bun run db:indexes`.

## Deferred Ideas

- Re-embed worker for model upgrades.
- Multimodal embeddings (OOS).
- Embedding-cost dashboard → Phase 8.
- Truncation logic for >8192-token products.
- CHECK constraint on embedding dimensions.
- Per-product step.run.
- Adaptive batch size on rate-limit headers.
- Redis embedding cache.
- Vector-store provider abstraction.
- Embedding model A/B testing.
- searchableText content-hash dedup.
