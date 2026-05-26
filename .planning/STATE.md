---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 4 verification gate verified-with-deferred-smoke
last_updated: "2026-05-26T09:58:56Z"
last_activity: 2026-05-26 -- Phase 04 verification gate closed (manual smoke deferred)
progress:
  total_phases: 8
  completed_phases: 4
  total_plans: 34
  completed_plans: 34
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** A storefront visitor can describe what they want in natural language and immediately see relevant products from the merchant's catalog — synced reliably, embedded into their theme, with no dev work from the merchant.
**Current focus:** Phase 05 — shared-chat-ui-extraction (ready for discussion)

## Current Position

Phase: 05 (shared-chat-ui-extraction) — READY FOR DISCUSSION
Plan: 0 of TBD
Status: Phase 04 verified-with-deferred-smoke (manual smoke held behind shopify-install-flow OAuth blocker — out of scope)
Last activity: 2026-05-26 -- Phase 04 verification gate closed (manual smoke deferred)

Progress: [█████░░░░░] 50%

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
- Phase 4 (verified-with-deferred-smoke 2026-05-26): Hybrid RRF search (`services/search/SearchService.hybridSearch`) ships shop-scoped pgvector + tsvector retrieval inside a single `withHnswIterativeScan` transaction with defense-in-depth shop filtering. `/api/chat` migrated to AI Gateway routing via plain model id `google/gemini-2.5-flash`; single camelCase `searchCatalog` tool with Vercel AI SDK v6 `inputSchema` (NOT v5 `parameters`); execute closure forwards shop from withShopifySession ctx. `/api/proxy/chat` ships as a Phase 6 stub importing `hybridSearch` (EMB-07 SC #3 source-level proof). `MOCK_PRODUCTS` deleted from disk; UI reads `message.parts[*].type === 'tool-searchCatalog'` directly. `/chat` is a Server Component server-rendering the preview-mode banner (`Preview mode — using your real catalog · Model: Gemini 2.5 Flash`, em-dash U+2014 + middle-dot U+00B7 byte-precise) above a new `components/chat/chat-shell.tsx` client component. Manual smoke deferred behind pre-existing shopify-install-flow OAuth cookie blocker (out of scope for Phase 4).

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
| Verification — manual smoke | 4-step end-to-end checklist for /chat against a seeded dev shop (banner glyphs, demo query, brand-name query, no-results affordance) | held behind shopify-install-flow OAuth callback cookie blocker (`docs/superpowers/plans/2026-05-02-shopify-install-flow.md`) — out of scope for Phase 4 | 2026-05-26 |
| Phase 5 cleanup | Inline hex literals (#008060, #e1e3e5) in chat-shell.tsx / chat.tsx — replace with Tailwind tokens during `lib/chat-ui/` lift | tracked in 04-VERIFICATION.md Handoff Notes | 2026-05-26 |
| Phase 5/6 | `productCount` history derivation — currently 0 at submit because tool-result arrives async; re-derive from useEffect watching messages | tracked in 04-VERIFICATION.md Handoff Notes | 2026-05-26 |
| Phase 7 prerequisites | displayName XSS validation gate + searchParams.shop ↔ session.shop verification before body-only swap of `getActiveChatModel` | tracked in 04-VERIFICATION.md Handoff Notes (T-04-24, T-04-25) | 2026-05-26 |

## Session Continuity

Last session: 2026-05-26T09:58:56Z
Stopped at: Phase 4 verification gate closed (verified-with-deferred-smoke)
Resume file: .planning/phases/05-shared-chat-ui-extraction/ (directory not yet created — Phase 5 discuss-phase will scaffold)
