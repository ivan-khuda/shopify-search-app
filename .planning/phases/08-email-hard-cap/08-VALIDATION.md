---
phase: 8
slug: email-hard-cap
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-27
approved: 2026-05-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated by 08-15 verification gate from `08-RESEARCH.md` § Validation Architecture.
> `nyquist_compliant: true` flipped on 2026-05-27 after full automated suite + structural coverage audit.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + @testing-library/react + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run <path>` (1–3 files, <5s) |
| **Full suite command** | `bunx vitest run` (NOT `bun test` — Bun's native runner does not have Vitest globals) |
| **Estimated runtime** | full suite ~11s as of Phase 8 gate; per-task <5s |

---

## Sampling Rate

- **After every task commit:** `bunx vitest run <changed file's __tests__ dir>` (1–3 files, <5s)
- **After every plan wave:** `bunx vitest run services/email services/shopify services/chat lib/db/repositories lib/email lib/util lib/chat lib/inngest 'app/api/chat' 'app/api/proxy/chat'` (~30s)
- **Before `/gsd-verify-work`:** Full suite (`bunx vitest run`) must be green + `bunx tsc --noEmit` clean
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 01 | 1 | NOT-01..04, CAP-01..03 | T-08-01-T1 | RED test scaffolds assert specific symbols / chunk types / SQL substrings; no vacuous it.todo | static | `bunx vitest run lib/email/templates/__tests__ services/email/__tests__ services/shopify/__tests__ lib/db/repositories/__tests__/RequestCounterRepository.test.ts services/chat/__tests__/CapService.test.ts lib/util/__tests__/period.test.ts lib/chat/__tests__/cap-reached-response.test.ts` | ✅ | ✅ |
| 08-01-T2 | 01 | 1 | n/a | T-08-01-I1 | Test fixtures use literal placeholder strings only (no real shop / contact emails) | static | grep for fixture strings | ✅ | ✅ |
| 08-02-T1 | 02 | 2 | CAP-01 | T-08-02-T1, T-08-02-I1, T-08-02-E1 | RequestCounter composite PK (shop, period) + SyncRun.emailSentAt nullable column; schema diff is two hunks only | unit (schema) | `bunx prisma validate` | ✅ | ✅ |
| 08-03-T1 | 03 | 3 | CAP-01 | T-08-03-T1, T-08-03-T2, T-08-03-D1 | Option A non-destructive migration (db execute + migrate resolve --applied); manual HNSW + GIN preserved | static | `bunx prisma migrate status` | ✅ | ✅ |
| 08-04-T1 | 04 | 4 | NOT-01, NOT-02, NOT-04 | T-08-04-T1, T-08-04-I1, T-08-04-T2, T-08-04-D1, T-08-04-SC | EmailService sendSyncSuccess/sendSyncFailure with idempotencyKey second-arg form; env-scoped FROM; zero console.* | unit | `bunx vitest run services/email/__tests__/EmailService.test.ts` | ✅ | ✅ |
| 08-05-T1 | 05 | 4 | NOT-01, NOT-02, NOT-03 | T-08-05-T1, T-08-05-T2, T-08-05-I1 | React Email templates use only auto-escaping primitives; no `dangerouslySetInnerHTML`; static subject strings | unit | `bunx vitest run lib/email/templates/__tests__/` | ✅ | ✅ |
| 08-06-T1 | 06 | 4 | NOT-01, NOT-02 | T-08-06-I1, T-08-06-T1, T-08-06-D1 | fetchShopContactEmail returns null on every failure path; bare catch (no error binding); zero console.* | unit | `bunx vitest run services/shopify/__tests__/ShopifyShopService.test.ts` | ✅ | ✅ |
| 08-07-T1 | 07 | 4 | CAP-01 | T-08-07-T1, T-08-07-T2, T-08-07-T3, T-08-07-T4 | RequestCounterRepository.tryConsume: single-statement INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING; tagged-template parameter binding (SQLi safe); $queryRaw NOT $executeRaw | unit | `bunx vitest run lib/db/repositories/__tests__/RequestCounterRepository.test.ts` | ✅ | ✅ |
| 08-08-T1 | 08 | 4 | CAP-02 | T-08-08-T1 | getCurrentPeriod via toISOString().slice(0,7) — UTC by construction; boundary cases asserted | unit | `bunx vitest run lib/util/__tests__/period.test.ts` | ✅ | ✅ |
| 08-09-T1 | 09 | 4 | CAP-03 | T-08-09-T1, T-08-09-D1, T-08-09-I1 | capReachedResponse returns HTTP 200 + v6 chunk sequence (start → text-start → text-delta → text-end → finish); locked CAP_REACHED_MESSAGE copy | unit | `bunx vitest run lib/chat/__tests__/cap-reached-response.test.ts` | ✅ | ✅ |
| 08-10-T1 | 10 | 5 | CAP-02, CAP-03 | T-08-10-T1, T-08-10-T2 | CapService.tryConsumeRequest reads HARD_CAP_REQUESTS_PER_MONTH at call time; default 2000; period DI; readCap guards Number.isFinite + > 0 | unit | `bunx vitest run services/chat/__tests__/CapService.test.ts` | ✅ | ✅ |
| 08-11-T1 | 11 | 5 | NOT-01 | T-08-11-T1, T-08-11-T2, T-08-11-I1, T-08-11-D1, T-08-11-T3 | send-success-email step after finalize; three-layer idempotency (step memo + emailSentAt + Resend idempotencyKey); D-05 graceful skip on missing contactEmail; adminUrl from server-side env | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | ✅ | ✅ |
| 08-12-T1 | 12 | 5 | NOT-02 | T-08-12-T1, T-08-12-T2, T-08-12-T3, T-08-12-D1, T-08-12-I1 | send-failure-email step in onFailure (distinct step ID per Pitfall 2); inline fallback in failing step.run; retryUrl from server-side HOST env; errorMessage auto-escaped | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts` | ✅ | ✅ |
| 08-13-T1 | 13 | 6 | CAP-02, CAP-03 | T-08-13-T1, T-08-13-T2, T-08-13-I1 | Admin /api/chat: cap-check is first action inside withShopifySession callback (D-14); shop sourced from ctx, never body; cap-reached returns capReachedResponse() | integration | `bunx vitest run app/api/chat/__tests__/route.test.ts` | ✅ | ✅ |
| 08-14-T1 | 14 | 6 | CAP-02, CAP-03 | T-08-14-T1, T-08-14-T2, T-08-14-T3, T-08-14-I1, T-08-14-D1 | Storefront /api/proxy/chat: cap-check after rate-limit + customer-id assert, before conversation create; shop from withAppProxyHmac signed query | integration | `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` | ✅ | ✅ |
| 08-15-T1 | 15 | 7 | NOT-01..04, CAP-01..03 | T-08-15-T1, T-08-15-I1, T-08-15-R1 | Verification gate aggregates evidence; manual-smoke deferral status documented; no secrets in artifacts | static | `bunx vitest run && bunx tsc --noEmit && bun lint` | ✅ | ✅ |
| **Manual smoke 1** | — | — | NOT-01 | T-08-04-T1 (operator-confirm) | Real Resend success-email lands at shop's contactEmail; admin URL works | manual | operator browser + Resend dashboard | n/a | ⬜ deferred |
| **Manual smoke 2** | — | — | NOT-02 | T-08-12-T2 (operator-confirm) | Real Resend failure-email lands + retry link → /onboarding?retry={syncRunId} | manual | operator browser + Resend dashboard + force-failure stub | n/a | ⬜ deferred |
| **Manual smoke 3** | — | — | CAP-03 | T-08-13-T2 + T-08-14-T2 (operator-confirm) | Cross-route cap-reached at HARD_CAP_REQUESTS_PER_MONTH=3: 4th admin message + 1st storefront message both stream locked copy; HTTP 200 in Network tab | manual | operator browser (admin /chat + storefront FAB drawer) | n/a | ⬜ deferred |
| **Optional integration race** | — | — | CAP-01 (SC4 empirical) | T-08-07-T1 (real-DB stress) | N=200 concurrent tryConsume calls at cap-1 → exactly 1 wins; race-free under real Postgres | integration | `INTEGRATION_DB_URL=… bunx vitest run lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` | ✅ (gated) | ⬜ deferred-or-optional |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⬜ deferred (manual smoke held to operator)*

---

## Wave 0 Requirements

- [x] `lib/email/templates/__tests__/sync-success-email.test.tsx` — covers NOT-01 (template content + admin button URL)
- [x] `lib/email/templates/__tests__/sync-failure-email.test.tsx` — covers NOT-02 (template content + retry URL)
- [x] `services/email/__tests__/EmailService.test.ts` — covers NOT-04 (env-scoped `from` address) + send call shape + `idempotencyKey` propagation
- [x] `services/shopify/__tests__/ShopifyShopService.test.ts` — covers `fetchShopContactEmail` happy + null + GraphQL-error paths
- [x] `lib/db/repositories/__tests__/RequestCounterRepository.test.ts` — covers CAP-01 SQL shape (`INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING`) + cap-reached returns empty
- [x] `services/chat/__tests__/CapService.test.ts` — covers CAP-02 env default + override + period derivation injection
- [x] `lib/util/__tests__/period.test.ts` — covers `getCurrentPeriod(now)` returns `YYYY-MM` UTC under DI'd date
- [x] `lib/chat/__tests__/cap-reached-response.test.ts` — covers CAP-03 streamed response shape (parse v6 chunk sequence)
- [x] Extend `inngest/functions/__tests__/sync-products.test.ts` — append: sends success email; sends failure email; skips when `emailSentAt` is set; skips when `contactEmail` is missing; uses distinct step IDs (Inngest memoization)
- [x] Extend `app/api/chat/__tests__/route.test.ts` — mock CapService allowed/denied; assert HTTP 200 + parse stream payload contains limit-reached copy
- [x] Extend `app/api/proxy/chat/__tests__/route.test.ts` — same as above
- [x] *(Optional, deferred-acceptable)* `lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` — gated on `INTEGRATION_DB_URL`; runs N=200 concurrent `tryConsume` calls; deferred-or-optional per row above
- [x] No new framework install — Vitest, RTL, and `@testing-library/jest-dom` already in `devDependencies`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Real Resend send delivers the success email to the shop owner inbox | NOT-01 (operator-confirmable) | Requires verified sending domain + live Inngest run + real shop with `contactEmail` set | See 08-VERIFICATION.md § Smoke 1 — 6-step checklist | ⬜ deferred |
| Real Resend send delivers the failure email + retry link works | NOT-02 (operator-confirmable) | Requires inducing a controlled sync failure | See 08-VERIFICATION.md § Smoke 2 — 6-step checklist | ⬜ deferred |
| Cap-reached cross-route smoke | CAP-03 (operator-confirmable) | Requires forcing the counter to cap-1 then issuing one extra request via the chat UI on both admin playground and storefront drawer | See 08-VERIFICATION.md § Smoke 3 — 7-step checklist | ⬜ deferred |
| Race-condition smoke at cap-1 (optional) | SC4 (real-DB concurrency) | Unit-level mock of `$queryRaw` proves SQL shape; real-DB stress proves serialization | See 08-VERIFICATION.md § Smoke 4 — gated on `INTEGRATION_DB_URL` | ⬜ deferred-or-optional |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (flipped by verification gate)

**Approval:** approved 2026-05-27 (3 manual smokes + 1 optional integration race test deferred to operator)
