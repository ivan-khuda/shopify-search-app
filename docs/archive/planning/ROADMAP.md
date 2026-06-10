# Roadmap: SmartDiscovery AI

## Milestones

- ✅ **v1.0 SmartDiscovery AI MVP** — Phases 1–8 + 8.1 (shipped 2026-05-27)

## Phases

<details>
<summary>✅ v1.0 SmartDiscovery AI MVP (Phases 1–8 + 8.1) — SHIPPED 2026-05-27</summary>

- [x] **Phase 1: Foundation** — Security hardening, multi-tenancy schema, repository layer (5/5 plans)
- [x] **Phase 2: Sync Pipeline** — Inngest background sync, SyncRun model, webhooks, onboarding progress UI (12/12 plans)
- [x] **Phase 3: Embeddings + Search Indexes** — EmbeddingService, HNSW + GIN indexes, modelVersion column (8/8 plans)
- [x] **Phase 4: SearchService + Wire Chat** — RRF hybrid search, MOCK_PRODUCTS removed, admin playground on real data (6/6 plans)
- [x] **Phase 5: Shared Chat-UI Extraction** — `lib/chat-ui` barrel, adapter pattern, persistence models (5/5 plans)
- [x] **Phase 6: Storefront Surface** — Theme App Extension, App Proxy, FAB + drawer, visitor identity + persistence (14/14 plans)
- [x] **Phase 7: Admin Settings + Model Picker** — `ShopSettings` model, model picker UI, per-shop active model (13/13 plans)
- [x] **Phase 8: Email + Hard Cap** — Resend completion emails, per-shop request counter, graceful cap response (15/15 plans)
- [x] **Phase 8.1: Close v1.0 Milestone Gaps** — Edge auth guard, storefront bundle routing, drawer composition, retry email deep link, session-resolved shop banner (6/6 plans)

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`
**Requirements:** `.planning/milestones/v1.0-REQUIREMENTS.md` (54/54 satisfied)
**Audit:** `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (passed)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|---|---|---|---|---|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-05-23 |
| 2. Sync Pipeline | v1.0 | 12/12 | Complete | 2026-05-24 |
| 3. Embeddings + Search Indexes | v1.0 | 8/8 | Complete | 2026-05-25 |
| 4. SearchService + Wire Chat | v1.0 | 6/6 | Complete (verified-with-deferred-smoke) | 2026-05-26 |
| 5. Shared Chat-UI Extraction | v1.0 | 5/5 | Complete | 2026-05-26 |
| 6. Storefront Surface | v1.0 | 14/14 | Complete (verified-with-deferred-smoke) | 2026-05-27 |
| 7. Admin Settings + Model Picker | v1.0 | 13/13 | Complete (passed-with-deferred-smoke) | 2026-05-27 |
| 8. Email + Hard Cap | v1.0 | 15/15 | Complete (passed-with-deferred-smoke) | 2026-05-27 |
| 8.1. Close v1.0 Milestone Gaps | v1.0 | 6/6 | Complete | 2026-05-27 |

## Known Tech Debt (Tracked for v1.1)

- **Storefront bundle size > 250KB cap** — `__tests__/bundle-build.test.ts > D-14` fails. Bundle is 1420KB (was 197KB pre-8.1). Cause: real `ChatPane`/`HistoryPanel`/`SavedProductsPanel` + DbBacked stores wired into `extensions/chat-drawer/src/entry.tsx`. Resolution path: code-split entry to lazy-load heavy panes on FAB click. **First finding for v1.1.**

## Deferred Human Smokes (Live-Environment Verification)

Tracked in `.planning/STATE.md` Deferred Items. None block shipping; all require deployment to a real Shopify dev store.

- Phase 4: admin chat banner glyph cross-check; `/settings → /chat` propagation; D-03 cold-start banner.
- Phase 7: real Resend success/failure email sends.
- Phase 8: cap-reached cross-route behavior.
- Phase 8.1: live storefront extension deploy + FAB click; anonymous-direct-hit redirect on `/onboarding`, `/chat`, `/settings`.
