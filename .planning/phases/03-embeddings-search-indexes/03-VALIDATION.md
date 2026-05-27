---
phase: 3
slug: embeddings-search-indexes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for the test map is `03-RESEARCH.md` § Validation Architecture.
> The planner will populate the Per-Task Verification Map and the Wave 0 list from PLAN.md task IDs once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (jsdom environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run <file>` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~15-30 seconds (full suite, current Phase 2 baseline: 95 tests across 15 files) |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run <changed-test-file>` (target <30s)
- **After every plan wave:** Run `bun test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual verification (`db/manual-indexes.sql` re-apply + `EXPLAIN ANALYZE` smoke test)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by `gsd-planner` once PLAN.md files exist. Each PLAN.md task must have a row here mapping `(task ID, requirement, threat ref, test type, command, file exists / Wave 0)`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | EMB-01..06 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per RESEARCH.md § Wave 0 Gaps:

- [ ] `services/embeddings/__tests__/EmbeddingService.test.ts` — stubs for EMB-01, EMB-03 (mocked `embedMany` + mocked prisma)
- [ ] `services/search/__tests__/searchableText.test.ts` — pure-function tests for `buildSearchableText`
- [ ] `lib/db/__tests__/hnsw.test.ts` — `withHnswIterativeScan` callback assertions (mocked prisma `$transaction`)
- [ ] `app/api/shopify/webhook/__tests__/route.test.ts` — extend or create; cover the new inline `embedAndStore` call with EmbeddingService mocked
- [ ] Extend `inngest/functions/__tests__/sync-products.test.ts` — add EmbeddingService mocks and assertions for new step ID `embed-batch-${cursorKey}` + EMB-02 partial-failure behavior

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `db/manual-indexes.sql` is idempotent | EMB-04 | Requires real Postgres connection with pgvector ≥ 0.8.0; not exercised in Vitest jsdom env | Apply once via `bun db:indexes`; apply again; assert no errors, indexes still present (`\d product_embeddings`, `\d products`) |
| HNSW index is actually used | EMB-04, EMB-06 | Requires real query plan against populated table | `EXPLAIN ANALYZE` a shop-scoped cosine query inside `withHnswIterativeScan(...)` and confirm `Index Scan using product_embeddings_embedding_hnsw_idx` (not seq scan) |
| `current_setting('hnsw.iterative_scan')` returns `'relaxed_order'` inside transaction | EMB-06 | GUC value can only be asserted against a real DB, not a mock | Run `withHnswIterativeScan(async (tx) => tx.$queryRaw\`SELECT current_setting('hnsw.iterative_scan', true)\`)` in a smoke test against the dev DB; expect `relaxed_order` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
