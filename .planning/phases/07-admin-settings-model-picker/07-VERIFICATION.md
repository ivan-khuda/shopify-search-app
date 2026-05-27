---
phase: 07
slug: admin-settings-model-picker
status: passed-with-deferred-smoke
verified_at: 2026-05-27T18:45:03Z
verifier: gsd-plan-executor
manual_smoke: deferred
deferred_reason: SC4 cross-route playground update + D-03 cold-start banner require operator-only browser smoke against a seeded dev shop
plans_verified: ["07-01", "07-02", "07-03", "07-04", "07-05", "07-06", "07-07", "07-08", "07-09"]
requirements_proven: ["ADM-03", "ADM-04"]
---

# Phase 7 — Verification Gate

## Summary

Phase 7 ("Admin Settings + Model Picker") wires a merchant-facing `/settings` page to a persistent `ShopSettings` row that drives the active chat model for every subsequent `/api/chat` and `/api/proxy/chat` request. The Phase 4 D-09 contract anchor (`services/chat/getActiveChatModel.ts`) was honored as a **body-only swap** — signature `(shop: string) => Promise<ActiveChatModel>` unchanged, callers in `app/api/chat/route.ts` and `app/api/proxy/chat/route.ts` unchanged. New code paths:

- `services/chat/model-catalog.ts` — 15-minute-cached client of Vercel AI Gateway `/v1/models` with a three-tier fallback ladder (cache → stale LKG → cold-start DEFAULT_MODEL row) and a 10-entry curated `BEST_FOR` descriptor map (D-01, D-02, D-03).
- `services/chat/getActiveChatModel.ts` — body swapped: reads `prisma.shopSettings.findUnique({ where: { shop } })`, hydrates `displayName` from `fetchModelCatalog()` with id-segment synthesis as silent fallback (D-06, D-08, D-09).
- `lib/db/repositories/ShopSettingsRepository.ts` — thin Prisma wrapper exposing `get(shop)` + `upsert(shop, activeChatModelId)`; singleton export mirrors `ProductRepository` pattern.
- `app/api/settings/model/route.ts` — PATCH endpoint wrapped with `withShopifySession` (Bearer session token); Zod-validated body, defense-in-depth catalog membership check, then `shopSettingsRepository.upsert(ctx.shop, ...)`. Multi-tenancy lock: Zod schema deliberately omits `shop` so any tampered body.shop is silently dropped.
- `app/(embedded)/settings/page.tsx` — async Server Component SSR-fetching the catalog + active model in parallel, rendering D-03 cold-start critical banner / D-03 stale-cache warning banner / D-06 active-missing warning banner, with column-descriptor `<s-text>` block above the form.
- `app/(embedded)/settings/settings-form.tsx` — Client Component owning radio state, hand-rolled `<s-table>` sort cycle (null → asc → desc → null per Pitfall 1), `<ui-save-bar>` dirty-state visibility, App Bridge `shopify.toast` confirmation (D-04, D-07).
- `app/(embedded)/EmbeddedProviders.tsx` — appended `<s-link href="/settings">Settings</s-link>` to the existing `<s-app-nav>` (D-05).

Prisma model `ShopSettings` (`shop @id` + `activeChatModelId` + `updatedAt @updatedAt`) and migration `20260527161654_add_shop_settings` applied non-destructively via `prisma db execute` + `prisma migrate resolve --applied` (Plan 03 deviation — Prisma 7.3 flags the manual HNSW + GIN indexes as false-positive drift; documented in `db/manual-indexes.sql`). Manual indexes preserved.

**Manual smoke status:** DEFERRED — SC4 (cross-route playground update: pick a model in /settings → Save → navigate to /chat → banner shows new displayName) and the D-03 cold-start banner smoke (block egress to `ai-gateway.vercel.sh`, reload /settings, confirm DEFAULT_MODEL-only row + critical banner + disabled Save) both require a real Shopify dev shop session, real browser navigation, and either a real or stubbed gateway outage. They cannot be exercised inside jsdom. Structural and automated evidence below verifies every Phase 7 contract; the empirical end-to-end smoke is held until the operator runs the documented checklist.

---

## Automated Suite Outcome

Command: `bunx vitest run`

```
Test Files  51 passed (51)
     Tests  354 passed | 4 skipped (358)
  Duration  10.40s
```

- **Total project tests:** 358 (354 passed + 4 intentionally-skipped Phase 4 historical cases preserved in `services/chat/__tests__/getActiveChatModel.test.ts` via `describe.skip` per Plan 01 decision).
- **Total test files:** 51 (Phase 6 baseline 45 + 6 new Phase 7 test files from Plan 01 Wave 0).
- **Failures:** 0.
- **Regressions in Phases 1–6 test files:** 0.

**Note on plan vs runtime command:** Plan 07-10 instructs `bun test`. Bun's native test runner does not have Vitest globals (`describe`/`it`/`expect`), so the project uses `bunx vitest run` exclusively (verified by re-running both — `bun test` reports "0 tests ran" against the existing vitest suites). All automated evidence in this document derives from `bunx vitest run`.

### Phase 7 Wave-0 Files (all 6 GREEN)

| Test File | Tests | Status | Drives Plan |
|-----------|-------|--------|-------------|
| `services/chat/__tests__/model-catalog.test.ts` | 6 | PASS | 07-04 (D-01 + D-02 + D-03 + Pitfall 4 + 5) |
| `services/chat/__tests__/getActiveChatModel.test.ts` | 5 active + 3 skipped historical | PASS | 07-06 (D-06 + D-09 body-only swap) |
| `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` | 5 | PASS | 07-05 (D-10 get + upsert contract) |
| `app/api/settings/model/__tests__/route.test.ts` | 7 | PASS | 07-07 (Zod + catalog membership + multi-tenancy lock) |
| `app/(embedded)/settings/__tests__/page.test.tsx` | 7 | PASS | 07-08 (SSR catalog rendering + D-06 + D-03 banners) |
| `app/(embedded)/settings/__tests__/settings-form.test.tsx` | 9 | PASS | 07-08 (radio + sort cycle + ui-save-bar + toast) |
| **Phase 7 total** | **39 active + 3 skipped historical** | **PASS** | |

---

## Success Criteria Coverage

| SC | Description | Status | Evidence |
|----|-------------|--------|----------|
| SC1 | Navigating to `/settings` shows a list of available Vercel AI Gateway chat models with name, provider, context window, per-token pricing, and a "best for" descriptor | PASS (automated) | `app/(embedded)/settings/__tests__/page.test.tsx` — SSR 7-column render verified (`Model name` · `Provider` · `Context window` · `$ / M input tokens` · `$ / M output tokens` · `Best for` · `Active`); `services/chat/__tests__/model-catalog.test.ts` — fetch + map + Pitfall 5 ×1e6 conversion verified; `BEST_FOR` 10-entry map present in `services/chat/model-catalog.ts`. Plan 07-04 + 07-08. |
| SC2 | Selecting a model and saving persists the choice per-shop in the `ShopSettings` table; a page refresh on `/settings` shows the previously selected model still active | PASS (automated) | `app/api/settings/model/__tests__/route.test.ts` — 7 it() blocks verify PATCH happy-path + Zod validation + catalog membership check + multi-tenancy lock (shop from session ctx, never body) + upsert call shape + no-secret-logging; `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` — 5 it() blocks verify get/upsert against `prisma.shopSettings`; `app/(embedded)/settings/__tests__/page.test.tsx` — pre-selection on page load via `getActiveChatModel(shop)` SSR call. Plan 07-05 + 07-07 + 07-08. |
| SC3 | On first install, a sensible default model (Gemini 2.5 Flash or equivalent) is pre-selected without any merchant action | PASS (automated) | `services/chat/__tests__/getActiveChatModel.test.ts` — DB-miss branch returns `DEFAULT_MODEL = { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }` (D-09 — never seed); empty-shop guard short-circuits to DEFAULT_MODEL. `services/chat/getActiveChatModel.ts:78-84` — `if (!row) return DEFAULT_MODEL`. Plan 07-06. |
| SC4 | The admin playground's active-model label updates immediately after the merchant changes the model setting | DEFERRED (manual smoke) | Server-rendered banner in `app/(embedded)/chat/page.tsx` reads `{model.displayName}` via per-request `getActiveChatModel(shop)` call (Phase 4 dynamic-binding gate verified — `grep -c "{model.displayName}" app/(embedded)/chat/page.tsx` = 1, `grep -c "Gemini 2.5 Flash" app/(embedded)/chat/page.tsx` = 0). The body-only swap of `getActiveChatModel` means the next navigation to `/chat` after Save reads the freshly-upserted row and re-renders the banner. **Cross-route navigation cannot be exercised in jsdom** — the SSR re-fetch requires real Next.js routing in a real Shopify embedded session. Plan 07-06 + 07-08 + structural surrogate evidence below. |

### SC4 Structural Surrogate Evidence (verified automatically)

| Gate | Source | Result |
|------|--------|--------|
| Banner uses dynamic binding | `grep -c "{model.displayName}" app/(embedded)/chat/page.tsx` | 1 |
| Banner has no hardcoded literal | `grep -c "Gemini 2.5 Flash" app/(embedded)/chat/page.tsx` | 0 |
| Banner is server-rendered (no `'use client'`) | `grep -c "use client" app/(embedded)/chat/page.tsx` | 0 |
| Banner awaits resolver | `grep -c "await getActiveChatModel" app/(embedded)/chat/page.tsx` | ≥1 |
| Resolver reads ShopSettings | `grep -c "prisma.shopSettings.findUnique" services/chat/getActiveChatModel.ts` | ≥1 (1 call + JSDoc refs) |
| PATCH upsert path | `grep -c "shopSettingsRepository.upsert" app/api/settings/model/route.ts` | ≥1 |
| Settings nav entry exists | `grep -c 'href="/settings"' app/(embedded)/EmbeddedProviders.tsx` | 1 |

The chain Save (PATCH) → DB upsert → next /chat SSR → resolver DB read → banner re-render is end-to-end test-asserted module-by-module; only the *visual* cross-route navigation is held until manual smoke.

---

## Manual Smoke — DEFERRED

Both manual smokes are held pending operator browser interaction. Document the outcome here once executed.

### Smoke 1 — SC4 cross-route playground update (operator instructions)

| # | Step | Expected |
|---|------|----------|
| 1 | Start dev server: `bun dev` with valid `.env` (DATABASE_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, AI_GATEWAY_API_KEY, HOST, SHOPIFY_APP_HANDLE, NEXT_PUBLIC_SHOPIFY_API_KEY) and an installed dev shop session | Server starts; embedded admin shell loads |
| 2 | Open the embedded admin in your dev shop's Shopify Admin; navigate to `/settings` via the new nav entry | Table renders ~10 BEST_FOR-keyed model rows; one row is pre-selected. For a never-saved shop, the pre-selected row should be `google/gemini-2.5-flash` ("Gemini 2.5 Flash"). For a previously-saved shop, the previously-saved model is pre-selected. |
| 3 | Note the current pre-selected displayName | Recorded as `<initial-model>` |
| 4 | Pick a different row (e.g., `anthropic/claude-sonnet-4.5`); click Save in the `<ui-save-bar>` | Toast appears reading `Model updated to <new displayName>` (e.g., `Model updated to Claude Sonnet 4.5`) |
| 5 | Navigate to `/chat` | The banner above the chat shell reads `Preview mode — using your real catalog · Model: <new displayName>` (em-dash U+2014 + middle-dot U+00B7 byte-precise). The Server Component re-fetched `getActiveChatModel(shop)` on this navigation. |
| 6 | (Optional) Send a test chat query | Chat streams a response routed through Vercel AI Gateway against the new model id |

**Outcome:** _Pending — awaiting operator execution._

### Smoke 2 — D-03 cold-start banner (operator instructions)

| # | Step | Expected |
|---|------|----------|
| 1 | Stop the dev server | — |
| 2 | Block egress to `ai-gateway.vercel.sh` — choose ONE: (a) edit `/etc/hosts` to add `127.0.0.1 ai-gateway.vercel.sh`, or (b) temporarily override `CATALOG_URL` in `services/chat/model-catalog.ts` to an unreachable host, or (c) disconnect from network entirely | — |
| 3 | Restart dev server: `bun dev` (ensures cold-start — module-level cache is empty in the new process) | Server starts |
| 4 | Open `/settings` in the embedded admin | A critical banner reads "Model catalog unavailable — showing default only"; the `<s-table>` shows ONE row (`google/gemini-2.5-flash` / "Gemini 2.5 Flash"); the `<ui-save-bar>` is hidden / Save is disabled (per D-03 + Plan 08 `saveDisabled` prop) |
| 5 | Restore `/etc/hosts` or `CATALOG_URL` value; restart dev server | Subsequent reload of `/settings` shows the full ~10-row catalog |

**Outcome:** _Pending — awaiting operator execution._

---

## Decision Trace

Mapping `07-CONTEXT.md` decisions D-01..D-10 to their implementation locations and the verification that confirmed each.

| Decision | Statement | Implementation | Verification |
|----------|-----------|----------------|--------------|
| D-01 | Model list fetched at runtime from Vercel AI Gateway | `services/chat/model-catalog.ts` — `fetchModelCatalog()` fetches `CATALOG_URL` with `cache: 'no-store'` (Pitfall 4) | model-catalog test: filtering + mapping PASS |
| D-02 | Curated `BEST_FOR` map keyed by model id; unknown ids fall back to `'General purpose'` | `services/chat/model-catalog.ts` — 10-entry `BEST_FOR` record + `BEST_FOR[id] ?? 'General purpose'` decoration | model-catalog test: BEST_FOR decoration + unknown-id fallback PASS |
| D-03 | 15-min in-memory cache; stale LKG on fetch failure; cold-start renders DEFAULT_MODEL-only row + critical banner; Save disabled in cold-start | `services/chat/model-catalog.ts` — module-level `Map` cache with epoch TTL; `coldStartFallback` flag; `app/(embedded)/settings/page.tsx` renders critical banner; `settings-form.tsx` `saveDisabled` prop | model-catalog test: 15-min TTL + stale LKG + cold-start PASS; page test: D-03 banners PASS |
| D-04 | Table layout with 7 columns (Model name, Provider, Context window, $/M in, $/M out, Best for, Active); sortable on Context + both pricing columns | `app/(embedded)/settings/settings-form.tsx` — `<s-table>` with hand-rolled `<button>`-based sort headers; `<s-text>` column descriptor on `page.tsx` | page test: column descriptor PASS; settings-form test: 3-click sort cycle (null → asc → desc → null) PASS |
| D-05 | Route is top-level `/settings`; nav entry alongside Chat and Onboarding | `app/(embedded)/EmbeddedProviders.tsx` — `<s-link href="/settings">Settings</s-link>` appended to `<s-app-nav>` after Search (rel='home') + Onboarding | grep: `href="/settings"` count = 1 |
| D-06 | Active row pre-selected on page load by matching `getActiveChatModel(shop).id` against rendered rows; warning banner if active id not in catalog | `app/(embedded)/settings/page.tsx` — SSR `Promise.all([fetchModelCatalog(), getActiveChatModel(shop)])`; warning banner when `!catalogResult.models.some(m => m.id === activeModel.id)` | page test: active-row pre-selection + active-missing warning banner PASS |
| D-07 | Explicit Save button with toast confirmation; Save disabled when no change; PATCH `/api/settings/model` on click | `app/(embedded)/settings/settings-form.tsx` — `<ui-save-bar>` dirty-state visibility; `shopify.toast.show('Model updated to <displayName>')` via App Bridge; PATCH with Bearer session token | settings-form test: save-bar visibility × 3 + save handler × 3 PASS |
| D-08 | Playground reflects new model on the next chat request via existing per-request resolver call; no shared client state | `services/chat/getActiveChatModel.ts` — per-request DB read; consumers in `app/api/chat/route.ts` + `app/api/proxy/chat/route.ts` UNCHANGED | `git diff app/api/chat/route.ts app/api/proxy/chat/route.ts` empty after Plan 06 |
| D-09 | Never explicitly seed `ShopSettings`; rely on resolver's DEFAULT_MODEL fallback for DB-miss | `services/chat/getActiveChatModel.ts:83-84` — `if (!row) return DEFAULT_MODEL` | resolver test: DB-miss branch returns DEFAULT_MODEL PASS |
| D-10 | `ShopSettings` Prisma model: `shop @id` + `activeChatModelId` + `updatedAt @updatedAt`; `@@map("shop_settings")` | `prisma/schema.prisma:256-261` | `prisma validate` exits 0; `prisma migrate status` "Database schema is up to date" |

---

## Phase 4 Deferred Items Closure

| Item | Resolution |
|------|------------|
| **T-04-24** (XSS via `displayName`) | RESOLVED safe by code-path inspection. `displayName` flows only into React text nodes (admin chat banner JSX, settings table cell, App Bridge `shopify.toast.show(string)`) — all auto-escaped text contexts; no `dangerouslySetInnerHTML` exists downstream. Source is either AI Gateway catalog (trusted, ids match `^[a-z-]+/[a-z0-9.-]+$`) or id-segment synthesis (alphanumeric + dashes + dots only). Documented in `services/chat/getActiveChatModel.ts` JSDoc (lines ~30–60) per Plan 06 + re-verified at the UI layer per Plan 08. |
| **T-04-25** (`searchParams.shop` ↔ `session.shop` asymmetry) | RESOLVED by design. The resolver takes `shop: string` on trust; trust boundary is enforced at consumers: `/api/chat` + `/api/proxy/chat` derive shop from session token / App Proxy HMAC; `/api/settings/model` PATCH (Plan 07) derives shop strictly from `withShopifySession` ctx with the Zod schema deliberately omitting `shop` so any tampered body.shop is silently dropped; `/settings` SSR page (Plan 08) reads `searchParams.shop` for display only (mirrors `/chat`) — the asymmetry is documented in `app/(embedded)/settings/page.tsx` JSDoc per Plan 08. |

Both items are closed at the documentation + code-path inspection layer per the Phase 7 plan contract (Plan 06 + Plan 08 JSDoc additions).

---

## Phase 7 File Inventory

### New Source Files (7)

| File | Plan | Lines | Role |
|------|------|-------|------|
| `services/chat/model-catalog.ts` | 07-04 | 203 | AI Gateway catalog client + BEST_FOR map + fallback ladder |
| `lib/db/repositories/ShopSettingsRepository.ts` | 07-05 | 40 | Prisma wrapper for `shop_settings` table |
| `app/api/settings/model/route.ts` | 07-07 | 69 | PATCH endpoint (session-bound, Zod, defense-in-depth) |
| `app/(embedded)/settings/page.tsx` | 07-08 | — | SSR Server Component shell + banners |
| `app/(embedded)/settings/settings-form.tsx` | 07-08 | — | Client Component form (radio + sort + ui-save-bar + toast) |
| `prisma/migrations/20260527161654_add_shop_settings/migration.sql` | 07-03 | 8 | Forward-only DDL for `shop_settings` table |
| (6 new Phase 7 test files — see Wave-0 table above) | 07-01 | — | RED → GREEN scaffolds |

### Modified Source Files (4)

| File | Plan | Change |
|------|------|--------|
| `services/chat/getActiveChatModel.ts` | 07-06 | Body-only swap; reads `prisma.shopSettings.findUnique` + hydrates from catalog with id-segment fallback |
| `prisma/schema.prisma` | 07-02 | Appended `ShopSettings` model |
| `types/shopify-global.d.ts` | 07-02 | 10 new JSX intrinsic declarations for `<s-table>`, `<s-choice-list>`, `<ui-save-bar>` family |
| `app/(embedded)/EmbeddedProviders.tsx` | 07-09 | Appended `<s-link href="/settings">Settings</s-link>` to `<s-app-nav>` |

### Modified Test File (1)

| File | Plan | Change |
|------|------|--------|
| `services/chat/__tests__/getActiveChatModel.test.ts` | 07-01 | Wrapped 3 Phase 4 it() blocks in `describe.skip`; added 5 Phase 7 it() blocks (DB-hit hydration, DB-miss DEFAULT_MODEL, id-segment fallback on catalog miss + catalog throw, shop-agnostic guarantee preserved) |

**Untouched (contract-preserved):**
- `app/api/chat/route.ts` (admin caller) — `git diff` empty after Plan 06
- `app/api/proxy/chat/route.ts` (storefront caller) — `git diff` empty after Plan 06
- `app/(embedded)/chat/page.tsx` (banner) — Phase 4 dynamic-binding gate honored; Phase 7 body-only swap propagates without touching this file

---

## Anti-Pattern Scan

| Check | Result |
|-------|--------|
| `console.log` in new source files | 0 (only JSDoc references to "no-console rule") |
| `: any` / `<any>` in new source files | 0 |
| `dangerouslySetInnerHTML` in settings tree | 0 |
| `NextResponse` in `/api/settings/model/route.ts` | 0 (uses `Response.json` App Router idiom) |
| `GET` export in `/api/settings/model/route.ts` | 0 (PATCH-only surface) |
| Hardcoded `'Gemini 2.5 Flash'` in `app/(embedded)/chat/page.tsx` | 0 (dynamic `{model.displayName}` binding) |
| Plan-deviation count | 6 (all auto-fixed Rule 1/2 in plans 04 + 08; documented in each plan's SUMMARY.md) |

---

## Threat Model Compliance

Phase 7 threat register items (per plan frontmatters) all mitigated:

- **T-07-04-01** (catalog endpoint compromise / pricing tampering) → mitigated by 15-min cache + cold-start fallback to known-good DEFAULT_MODEL + structural pricing format validation
- **T-07-05-01** (cross-shop write) → mitigated at repository layer: `shop` is the PK; every method takes `shop` as the first arg
- **T-07-07-01** (multi-tenancy lock bypass via body.shop) → mitigated: Zod schema deliberately omits `shop`; only `ctx.shop` from `withShopifySession` reaches the repository; route test `derives shop from session ctx, NOT from request body` PASS
- **T-07-08-01** (XSS via displayName) → resolved by code-path inspection per T-04-24 closure
- **T-07-08-02** (CSRF on PATCH) → mitigated by Shopify session-token Bearer auth (CSRF-immune); no cookie auth on this route
- **T-07-10-01** (manual smoke result repudiation) → mitigated: smoke is explicitly DEFERRED to operator; no self-attestation in this document
- **T-07-10-02** (session token in verification artifacts) → mitigated: this document describes behaviors only; no token strings captured
- **T-07-10-03** (wrong-row updates in ROADMAP/REQUIREMENTS/STATE) → mitigated: each update verified by exact-string grep anchors
- **T-07-10-04** (Phase marked Complete despite failed smoke) → status is `passed-with-deferred-smoke`, NOT `complete`; closure conditional on operator confirmation

---

## Approval

**Status:** `passed-with-deferred-smoke` — automated SC1, SC2, SC3 fully verified; SC4 + D-03 cold-start manual smoke deferred to operator per Plan 07-10 Task 2 protocol.

**Score:** 2/2 requirements (ADM-03 + ADM-04) satisfied · 3/4 ROADMAP success criteria satisfied at the structural/automated level + 1 deferred-with-structural-surrogate · 354/354 active tests pass + 4 historical skipped · 0 blocker anti-patterns.

Phase 7 verification gate: PASSED WITH DEFERRED MANUAL SMOKE — 2026-05-27T18:45:03Z
