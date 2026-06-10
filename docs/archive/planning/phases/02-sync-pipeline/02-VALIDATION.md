---
phase: 2
slug: sync-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `bunx vitest run inngest/functions/__tests__/ app/api/shopify/sync/__tests__/ app/api/shopify/sync/status/__tests__/ app/api/shopify/webhook/__tests__/ services/shopify/__tests__/` |
| **Full suite command** | `bun run test` |
| **Estimated runtime** | ~10 seconds (quick), ~25 seconds (full) |

---

## Sampling Rate

- **Per task commit:** Quick run command above
- **Per wave merge:** Full suite (`bun run test`)
- **Phase gate:** Full suite green + Inngest dev workflow smoke before `/gsd:verify-work`
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-XX-W0 | 01 | 0 | all SYN/ADM | T-2-* | Wave 0 RED test stubs created for all new modules | unit | `bunx vitest run inngest/functions/__tests__/ app/api/shopify/sync/status/__tests__/ app/api/shopify/webhook/__tests__/ services/shopify/__tests__/` | ❌ W0 | ⬜ pending |
| 2-XX-INS | TBD | 0 | n/a | n/a | Install `inngest` + `@inngest/test` + `concurrently` (optional dev) | install | `bun add inngest && bun add -d @inngest/test` | N/A | ⬜ pending |
| 2-XX-MIG | TBD | 1 | SYN-04 | T-2-data | Prisma migration adds SyncRun, WebhookEvent, SyncState enum, Product.updatedAtShopify column | manual smoke | `bunx prisma migrate dev --name add_sync_pipeline && bunx prisma migrate status` | N/A | ⬜ pending |
| 2-XX-SVC | TBD | 1 | SYN-01, SYN-02 | T-2-tenant | ShopifyProductService implements fetchProductBatch + mapToUpsertInput | unit | `bunx vitest run services/shopify/__tests__/ShopifyProductService.test.ts` | ❌ W0 | ⬜ pending |
| 2-XX-INN | TBD | 2 | SYN-03, SYN-06 | T-2-error, T-2-resumable | Inngest sync-products function with step.run per batch, error policy, cursor persist | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | ❌ W0 | ⬜ pending |
| 2-XX-POST | TBD | 2 | SYN-05, SYN-08 | T-2-dos | POST /api/shopify/sync creates SyncRun + idempotency + returns syncRunId in <2s | unit | `bunx vitest run app/api/shopify/sync/__tests__/route.test.ts` | ✅ exists (extend) | ⬜ pending |
| 2-XX-STAT | TBD | 2 | SYN-07 | T-2-iso | GET /status returns shop-scoped SyncRun; 403 on cross-shop | unit | `bunx vitest run app/api/shopify/sync/status/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| 2-XX-WH | TBD | 2 | SYN-10, SYN-11 | T-2-spoof, T-2-replay, T-2-stale | Webhook: HMAC via webhooks.validate, dedup by eventId (P2002 catch), updatedAt skip | unit | `bunx vitest run app/api/shopify/webhook/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| 2-XX-UI | TBD | 3 | SYN-09, ADM-01, ADM-02 | T-2-leak | Onboarding state machine: start → progress polling → completion banner; <s-progress-bar> + counter + state badge | component | `bunx vitest run "app/(embedded)/__tests__/onboarding.test.tsx"` | ✅ exists (extend) | ⬜ pending |
| 2-XX-INT | TBD | 4 | all | all | E2E sync run against local Postgres + Inngest dev runtime (manual smoke) | manual | see Manual Verifications below | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bun add inngest` and `bun add -d @inngest/test`
- [ ] `inngest/functions/__tests__/sync-products.test.ts` — RED stubs for SYN-03, SYN-06 (batch error policy + cursor persist)
- [ ] `app/api/shopify/sync/status/__tests__/route.test.ts` — RED stubs for SYN-07 (shop-scoped 200 + cross-shop 403 + missing-syncRunId 404)
- [ ] `app/api/shopify/webhook/__tests__/route.test.ts` — RED stubs for SYN-10, SYN-11 (HMAC accept/reject, dedup, stale-updatedAt skip)
- [ ] `services/shopify/__tests__/ShopifyProductService.test.ts` — RED stubs for SYN-01, SYN-02 (GraphQL paginate, map to ProductUpsertInput including new updatedAtShopify field)
- [ ] Extension of `app/api/shopify/sync/__tests__/route.test.ts` (already exists) — add idempotency test case + syncRunId-returned test case
- [ ] Extension of `app/(embedded)/__tests__/onboarding.test.tsx` (already exists) — add polling + progress bar + completion banner test cases

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inngest dev workflow runs end-to-end against local Docker Postgres | SYN-05, SYN-06 | Requires two-process local dev (Next.js + Inngest CLI) | (1) `bunx prisma migrate reset --force && bunx prisma migrate deploy` (2) Terminal A: `bun dev` (3) Terminal B: `bunx inngest-cli@latest dev -u http://localhost:3000/api/inngest` (4) Inngest dashboard at `localhost:8288` registers `shopify/product.sync` function (5) From a Shopify dev store, install the app and click Start sync; observe Inngest dashboard execution + SyncRun row updates in Prisma Studio (`bunx prisma studio`) |
| Shopify webhook delivery + dedup against live store | SYN-10, SYN-11 | Requires Shopify webhook subscriptions registered via CLI deploy | (1) Ensure `shopify.app.toml` `[webhooks.subscriptions]` block declares topics products/create, products/update, products/delete pointing at `${HOST}/api/shopify/webhook` (2) `bunx shopify app deploy` to register (3) From the dev store admin, create/edit/delete a product (4) Watch terminal for HMAC-valid webhook receipt and SyncRun-free upsert (5) Re-send a webhook from Shopify Admin and confirm 200 OK without duplicate DB write |
| Onboarding progress bar updates live during a real catalog sync | SYN-09, ADM-02 | Requires live Shopify catalog + Inngest dev runtime | After the sync starts, watch `/onboarding` polled responses every 2s; progress bar fills 0→100%; state transitions queued → running → succeeded; completion banner renders with `Open admin chat` CTA linking to `/chat` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (4 new test files + 1 install)
- [x] No watch-mode flags (all `vitest run`, not `vitest`)
- [x] Feedback latency < 25s for full suite
- [x] `nyquist_compliant: true` set in frontmatter (post plan-checker alignment)

**Approval:** approved 2026-05-23
