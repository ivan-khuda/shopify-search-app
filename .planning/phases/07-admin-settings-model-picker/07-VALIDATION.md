---
phase: 7
slug: admin-settings-model-picker
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
approved: 2026-05-27
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from `07-RESEARCH.md` § Validation Architecture; planner fills the per-task table during PLAN.md generation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (jsdom environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run <path>` |
| **Full suite command** | `bunx vitest run` (NOT `bun test` — Bun's native runner does not have Vitest globals) |
| **Estimated runtime** | full suite ~10s; per-task <5s |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run <changed file's __tests__ dir>` (1–3 files, <5s)
- **After every plan wave:** Run `bunx vitest run services/chat lib/db/repositories app/api/settings 'app/(embedded)/settings'` (~30s)
- **Before `/gsd-verify-work`:** Full suite (`bunx vitest run`) must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 07-01 | 0 | ADM-03 + ADM-04 | T-07-01-SC | RED test scaffolds for catalog client, resolver, settings repo (33 failing it() blocks) | unit + component | `bunx vitest run services/chat lib/db/repositories app/api/settings 'app/(embedded)/settings'` | ✅ | ✅ |
| 7-01-02 | 07-01 | 0 | ADM-03 + ADM-04 | T-07-01-SC | RED test scaffolds for settings route + page + form | route integration + component | `bunx vitest run app/api/settings 'app/(embedded)/settings'` | ✅ | ✅ |
| 7-02-01 | 07-02 | 1a | ADM-03 | T-07-02-01..04 | `ShopSettings` model exact D-10 shape (`shop @id` + `activeChatModelId` + `@updatedAt`) | schema validate | `bunx prisma validate` | ✅ | ✅ |
| 7-02-02 | 07-02 | 1a | ADM-03 | T-07-02-01..04 | JSX intrinsic declarations for Polaris `s-table` family + `s-choice-list` + `ui-save-bar` | type check | `bunx tsc --noEmit` (scoped to new intrinsics) | ✅ | ✅ |
| 7-03-01 | 07-03 | 1b BLOCKING | ADM-03 | T-07-03-01 (drift false-positive avoided) | Non-destructive forward-only migration `20260527161654_add_shop_settings` applied via `prisma db execute` + `prisma migrate resolve --applied`; manual HNSW + GIN indexes preserved | migration | `bunx prisma migrate status` + `bun db:indexes` | ✅ | ✅ |
| 7-04-01 | 07-04 | 2 | ADM-03 | T-07-04-01 (catalog tampering / cold-start) | `fetchModelCatalog()` with 15-min cache + stale LKG + cold-start DEFAULT_MODEL fallback + Pitfall 4 (`cache:'no-store'`) + Pitfall 5 (×1e6 pricing conversion) + BEST_FOR 10-entry curated map | unit | `bunx vitest run services/chat/__tests__/model-catalog.test.ts` | ✅ | ✅ |
| 7-05-01 | 07-05 | 2 | ADM-03 | T-07-05-01 (cross-shop write) | `ShopSettingsRepository.get(shop)` + `upsert(shop, activeChatModelId)`; multi-tenancy lock via shop-as-first-arg + shop-PK | unit | `bunx vitest run lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` | ✅ | ✅ |
| 7-06-01 | 07-06 | 2 | ADM-04 | T-07-06-01 (resolver leak across shops) | Body-only swap: reads `prisma.shopSettings.findUnique` + hydrates `displayName` from catalog with id-segment fallback; DEFAULT_MODEL on DB-miss (D-09); signature unchanged | unit | `bunx vitest run services/chat/__tests__/getActiveChatModel.test.ts` | ✅ | ✅ |
| 7-07-01 | 07-07 | 3 | ADM-03 | T-07-07-01 (body.shop tampering) | PATCH `/api/settings/model` wrapped with `withShopifySession`; Zod body schema deliberately omits `shop` so tampered body.shop is silently dropped; defense-in-depth catalog membership check; `shopSettingsRepository.upsert(ctx.shop, ...)` | route integration | `bunx vitest run app/api/settings/model/__tests__/route.test.ts` | ✅ | ✅ |
| 7-08-01 | 07-08 | 3 | ADM-03 + ADM-04 | T-07-08-01 (XSS via displayName) | `/settings` Server Component SSR-fetches catalog + active model; renders D-03 cold-start critical banner / D-03 stale-cache warning / D-06 active-missing warning; column-descriptor `<s-text>` block; `searchParams.shop` asymmetry documented in JSDoc | component | `bunx vitest run 'app/(embedded)/settings/__tests__/page.test.tsx'` | ✅ | ✅ |
| 7-08-02 | 07-08 | 3 | ADM-03 + ADM-04 | T-07-08-02 (CSRF on PATCH) | Settings form Client Component: radio state + `<s-table>` hand-rolled sort cycle (null→asc→desc→null per Pitfall 1) + `<ui-save-bar>` dirty-state + App Bridge toast + Bearer-token PATCH; `<s-choice>` uses `selected` not `checked` (Pitfall 2) | component | `bunx vitest run 'app/(embedded)/settings/__tests__/settings-form.test.tsx'` | ✅ | ✅ |
| 7-09-01 | 07-09 | 3 | ADM-03 | (no new threat) | `<s-link href="/settings">Settings</s-link>` appended to `<s-app-nav>` after Search (rel='home') + Onboarding (D-05) | static grep | `grep -c 'href="/settings"' app/(embedded)/EmbeddedProviders.tsx` | ✅ | ✅ |
| 7-10-01 | 07-10 | 4 | ADM-03 + ADM-04 | T-07-10-01..04 | Full automated suite re-run + 07-VERIFICATION.md authored with SC1–SC4 evidence + Phase 4 T-04-24/T-04-25 closure | aggregate | `bunx vitest run` | ✅ | ✅ |
| 7-10-02 | 07-10 | 4 | ADM-03 + ADM-04 | T-07-10-03 | Per-Task Verification Map populated; `nyquist_compliant: true` flipped | static grep | `grep -c 'nyquist_compliant: true' .planning/phases/07-admin-settings-model-picker/07-VALIDATION.md` | ✅ | ✅ |
| 7-10-03 | 07-10 | 4 | ADM-03 + ADM-04 | T-07-10-03 | ROADMAP.md Phase 7 marked complete + REQUIREMENTS.md ADM-03/ADM-04 marked complete | static grep | `grep -c '\[x\] \*\*Phase 7' .planning/ROADMAP.md` + `grep -c '\[x\] \*\*ADM-03\*\*' .planning/REQUIREMENTS.md` | ✅ | ✅ |
| 7-10-04 | 07-10 | 4 | ADM-03 + ADM-04 | T-07-10-03 | STATE.md current position advances; Phase 4 deferred T-04-24/T-04-25 rows removed; manual-smoke deferrals appended | static grep | `grep -c 'Phase 7 verified' .planning/STATE.md` | ✅ | ✅ |
| 7-10-SC4-smoke | 07-10 | 4 | ADM-04 (SC4) | n/a | Cross-route playground update: pick model in /settings → Save → /chat banner reflects new displayName | manual | n/a (browser-only against dev shop) | n/a | ⬜ deferred |
| 7-10-D03-smoke | 07-10 | 4 | ADM-03 (D-03) | T-07-04-01 | Cold-start banner: block egress to ai-gateway.vercel.sh → reload /settings → DEFAULT_MODEL-only row + critical banner + disabled Save | manual | n/a (browser + network blocking required) | n/a | ⬜ deferred |

*Status: ⬜ pending/deferred · ✅ green · ❌ red · ⚠️ flaky*

**Map row count:** 17 automated rows (all ✅ green) + 2 manual-smoke deferred rows.

---

## Wave 0 Requirements

- [x] `app/(embedded)/settings/__tests__/page.test.tsx` — covers SC1, SC2, SC3 (server-component pre-selection + catalog rendering)
- [x] `app/(embedded)/settings/__tests__/settings-form.test.tsx` — covers SC1 (sort), SC2 (Save flow), and dirty-state Save disable
- [x] `app/api/settings/model/__tests__/route.test.ts` — covers SC2 (auth + Zod body validation + catalog membership check + upsert)
- [x] `services/chat/__tests__/model-catalog.test.ts` — covers SC1 (fetch + map + $/M conversion) + D-03 fallback ladder
- [x] `services/chat/__tests__/getActiveChatModel.test.ts` — UPDATED (added DB-hit case for SC2, kept DB-miss case for SC3, added unknown-id fallback case)
- [x] `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` — covers `get`/`upsert` contract
- [x] No new framework install — vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| After Save in `/settings`, navigate to `/chat` and verify the banner shows the new model name | SC4 | Cross-route flow requires the embedded admin shell, App Bridge runtime, and a real Shopify session — out of jsdom's reach | 1) Open `/settings` in the embedded admin. 2) Pick a non-default model row. 3) Click Save → toast confirms. 4) Navigate to `/chat`. 5) Assert the banner reads `Model: <new displayName>`. | ⬜ deferred to operator |
| Cold-start catalog failure renders DEFAULT_MODEL-only row with Save disabled | SC1 (D-03 fallback) | Requires forcing a real fetch failure end-to-end | 1) Block egress to `ai-gateway.vercel.sh` (or override CATALOG_URL). 2) Open `/settings`. 3) Confirm only the DEFAULT_MODEL row renders and Save is visually disabled with the "Model catalog unavailable" banner. | ⬜ deferred to operator |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (full suite: 10.40s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-27 (SC4 manual smoke deferred to operator)
