---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 4 context gathered
last_updated: "2026-05-25T16:49:40.308Z"
last_activity: 2026-05-25 -- Phase 3 verification gate passed
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 28
  completed_plans: 28
  percent: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** A storefront visitor can describe what they want in natural language and immediately see relevant products from the merchant's catalog — synced reliably, embedded into their theme, with no dev work from the merchant.
**Current focus:** Phase 4 — SearchService + Wire Chat (next)

## Current Position

Phase: 4 (search-service-wire-chat) — READY FOR DISCUSSION
Plan: 0 of TBD
Status: Phase 3 complete
Last activity: 2026-05-25 -- Phase 3 verification gate passed

Progress: [███░░░░░░░] 37%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-roadmap: Use Inngest for durable sync (survives Vercel 60s timeout)
- Pre-roadmap: `localStorage` for visitor_id — App Proxy strips `Set-Cookie`
- Pre-roadmap: `lib/chat-ui/` in-tree barrel (not monorepo) with adapter pattern
- Pre-roadmap: Hybrid pgvector HNSW + tsvector RRF search (not pure vector)
- Pre-roadmap: `db/manual-indexes.sql` idempotent re-apply after every `prisma migrate deploy`
- Phase 3 (verified 2026-05-25): EMBEDDING_MODEL = 'openai/text-embedding-3-small' pinned via frozen constant; modelVersion column NOT NULL; HNSW + GIN indexes live in db/manual-indexes.sql (outside Prisma); withHnswIterativeScan helper consumed by Phase 4 SearchService.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3: Verify pgvector >= 0.8.0 on target Postgres before writing HNSW migration
- Phase 3: Verify `SET hnsw.iterative_scan` works with Prisma Accelerate connection pooler
- Phase 6: CSS z-index strategy across Dawn/Sense/Craft themes needs investigation
- Phase 6: `@shopify/shopify-api` is at 12.3.0; v13 breaking changes not yet audited

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-25T16:49:40.294Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-searchservice-wire-chat/04-CONTEXT.md
