---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 8 context gathered
last_updated: "2026-05-27T19:27:11.153Z"
last_activity: 2026-05-27
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 78
  completed_plans: 73
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-22)

**Core value:** A storefront visitor can describe what they want in natural language and immediately see relevant products from the merchant's catalog — synced reliably, embedded into their theme, with no dev work from the merchant.
**Current focus:** Phase 8 — email + hard cap (final phase)

## Current Position

Phase: 8
Plan: 7 of 15 (complete)
Status: Ready to execute
Last activity: 2026-05-27

Progress: [█████████░] 94%

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06 | 13 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 07 P04 | 15min | 1 tasks | 1 files |
| Phase 07 P05 | 5min | 1 tasks | 1 files |
| Phase 07 P07 | 66 | 1 tasks | 1 files |
| Phase 07 P08 | 240 | 2 tasks | 2 files |
| Phase 07 P09 | <1m | 1 tasks | 1 files |
| Phase 08 P01 | 25min | 2 tasks | 12 files |
| Phase 08 P02 | 5min | 1 tasks | 1 files |
| Phase 08 P04 | 3m | 2 tasks | 6 files |
| Phase 08 P06 | 3 min | 1 tasks | 1 files |
| Phase 08 P08 | 2m | 1 tasks | 1 files |
| Phase 08 P09 | 3min | 1 tasks | 1 files |
| Phase 8 P10 | 1.5min | 1 tasks | 2 files |

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
- Phase 5 (verified 2026-05-26): `lib/chat-ui/` barrel ships ChatPane (renamed from Chat, named export, adapter-driven DefaultChatTransport with Resolvable headers/body), ChatMessage, ProductCard, HistoryPanel, SavedProductsPanel, EmptyState. ChatIdentityAdapter interface in lib/chat-ui/adapters/types.ts implemented by EmbeddedAdapter (App Bridge runtime global, ZERO @shopify/* imports) and StorefrontAdapter (localStorage 'smartdiscovery.visitor_id' + crypto.randomUUID, SSR-safe). HistoryStore + SavedProductsStore interfaces in lib/chat-ui/stores/types.ts with LocalStorage default implementations namespaced by scope (T-5-01 empty-scope throw guard). useHistoryStore + useSavedProductsStore React hooks via useSyncExternalStore with SSR snapshot. Embedded surface shell app/(embedded)/chat/chat-shell.tsx instantiates EmbeddedAdapter + store hooks; legacy components/chat/ tree fully deleted (14 files). UI-SPEC locked deltas: chat-message.tsx user bubble clamp `max-w-[min(448px,100%)]`; ChatPane no longer carries surface-specific heights. Barrel-isolation static-grep test (lib/chat-ui/__tests__/barrel-isolation.test.ts) enforces SHR-01 with adapter sub-path exemption (D-04). Full vitest suite GREEN (28 files / 194 tests). `bun build` failure on pre-existing unimported dead file `components/ai-elements/reasoning.tsx` (`@jenius/ui` external package) is unrelated to Phase 5 deliverables — `tsc --noEmit` scoped to `lib/chat-ui/` is clean.
- Phase 7 (verified-with-deferred-smoke 2026-05-27): Admin Settings + Model Picker complete (10/10 plans, ADM-03 + ADM-04 satisfied). New `services/chat/model-catalog.ts` exposes `fetchModelCatalog()` with 15-min cache + stale-LKG + cold-start DEFAULT_MODEL fallback ladder (D-01, D-02, D-03); 10-entry curated BEST_FOR map. `services/chat/getActiveChatModel.ts` body-only swapped per Phase 4 D-09 contract anchor — reads `prisma.shopSettings.findUnique` + hydrates `displayName` from catalog with id-segment synthesis fallback; consumers `/api/chat` + `/api/proxy/chat` UNCHANGED (`git diff` empty). New Prisma `ShopSettings` model (`shop @id` + `activeChatModelId` + `@updatedAt`) applied via non-destructive `prisma db execute` + `prisma migrate resolve --applied` (Prisma 7.3 flags manual HNSW + GIN indexes as false-positive drift; manual indexes preserved). New `lib/db/repositories/ShopSettingsRepository.ts` (singleton; get + upsert mirroring ProductRepository pattern). New PATCH `/api/settings/model` wrapped with `withShopifySession`; Zod schema deliberately omits `shop` so tampered body.shop is silently dropped; defense-in-depth catalog membership check before upsert. New `/settings` Server Component + `settings-form.tsx` Client Component pair with D-04 7-column `<s-table>` + hand-rolled sort cycle (null→asc→desc→null) + `<ui-save-bar>` dirty-state + App Bridge toast. Settings nav entry appended to `<s-app-nav>` (D-05). Phase 4 deferred items T-04-24 (XSS via displayName) + T-04-25 (`searchParams.shop` asymmetry) closed at JSDoc layer in `getActiveChatModel.ts` + `settings/page.tsx`. Full vitest suite: 51 files / 354 passed / 4 skipped historical / 0 failed. SC4 cross-route playground manual smoke + D-03 cold-start manual smoke deferred to operator (browser-only against dev shop / network-blocking required).
- [Phase 07]: Plan 07-08: Default render order is catalog-as-passed (pass-through) — Wave-0 test contract supersedes the plan's provider-alphabetical-with-active-on-top sketch (Rule 1)
- [Phase 07]: Plan 07-08: BEST_FOR curation is NOT applied at the /settings page layer — Wave-0 mock doesn't expose BEST_FOR; production catalog client already returns the canonical language-model slice
- [Phase 07]: Plan 07-08: <s-choice> rendered self-closing with aria-label only; visible displayName lives in the Model-name cell to avoid duplicate text-query matches
- [Phase 07]: Plan 07-09: D-05 fulfilled — Settings is a top-level nav entry in <s-app-nav> (order: Search rel='home' -> Onboarding -> Settings)
- [Phase ?]: Phase 8 D-04: SyncRun.emailSentAt nullable DateTime — NULL = email not yet sent (idempotency sentinel)
- [Phase ?]: Phase 8 D-08: RequestCounter composite PK (shop, period); no @@index([shop]); no FK
- [Phase ?]: Stub React Email templates at lib/email/templates/Sync{Success,Failure}Email.tsx in 08-04 (Rule 3) so Vite import-analysis resolves — 08-05 replaces with real components
- [Phase ?]: Plan 08-08: getCurrentPeriod via Date#toISOString().slice(0,7) — UTC-by-construction (D-12, Pitfall 7)
- [Phase ?]: 08-09: CAP_REACHED_MESSAGE locked to '1st of the month' copy; capReachedResponse returns HTTP 200 synthetic v6 UI message stream
- [Phase ?]: Phase 8: HARD_CAP_REQUESTS_PER_MONTH env read at call time

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
| Verification — manual smoke | SC4 cross-route playground update (navigate /settings → Save → /chat banner reflects new model) | held behind operator-only browser smoke against a seeded dev shop | 2026-05-27 |
| Verification — manual smoke | D-03 cold-start banner (block egress to ai-gateway.vercel.sh, reload /settings, confirm DEFAULT_MODEL-only row + critical banner + disabled Save) | held behind operator-only network-blocking smoke | 2026-05-27 |

## Session Continuity

Last session: 2026-05-27T19:27:04.454Z
Stopped at: Phase 8 context gathered
Resume file: None
