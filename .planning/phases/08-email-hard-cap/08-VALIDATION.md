---
phase: 8
slug: email-hard-cap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from `08-RESEARCH.md` § Validation Architecture; planner fills the per-task table during PLAN.md generation; verification gate (final plan) flips `nyquist_compliant: true` after coverage audit.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + @testing-library/react + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `bunx vitest run <path>` (1–3 files, <5s) |
| **Full suite command** | `bunx vitest run` (NOT `bun test` — Bun's native runner does not have Vitest globals) |
| **Estimated runtime** | full suite ~10s as of Phase 7; per-task <5s |

---

## Sampling Rate

- **After every task commit:** `bunx vitest run <changed file's __tests__ dir>` (1–3 files, <5s)
- **After every plan wave:** `bunx vitest run services/email services/shopify services/chat lib/db/repositories lib/email lib/util lib/chat lib/inngest 'app/api/chat' 'app/api/proxy/chat'` (~30s)
- **Before `/gsd-verify-work`:** Full suite (`bunx vitest run`) must be green + `bunx tsc --noEmit` clean
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Per-task rows are populated by the verification-gate plan (final wave) during execution, once final task IDs crystallize. Each PLAN.md already carries an `<automated>` verify command (or explicit Wave-0 RED dependency) per task; this map aggregates them post-execution for the Nyquist sign-off.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (populated by verification gate) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/email/templates/__tests__/sync-success-email.test.tsx` — covers NOT-01 (template content + admin button URL)
- [ ] `lib/email/templates/__tests__/sync-failure-email.test.tsx` — covers NOT-02 (template content + retry URL)
- [ ] `services/email/__tests__/EmailService.test.ts` — covers NOT-04 (env-scoped `from` address) + send call shape + `idempotencyKey` propagation
- [ ] `services/shopify/__tests__/ShopifyShopService.test.ts` — covers `fetchShopContactEmail` happy + null + GraphQL-error paths
- [ ] `lib/db/repositories/__tests__/RequestCounterRepository.test.ts` — covers CAP-01 SQL shape (`INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING`) + cap-reached returns empty
- [ ] `services/chat/__tests__/CapService.test.ts` — covers CAP-02 env default + override + period derivation injection
- [ ] `lib/util/__tests__/period.test.ts` — covers `getCurrentPeriod(now)` returns `YYYY-MM` UTC under DI'd date
- [ ] `lib/chat/__tests__/cap-reached-response.test.ts` — covers CAP-03 streamed response shape (parse v6 chunk sequence)
- [ ] Extend `lib/inngest/__tests__/sync-products-function.test.ts` (or wherever Phase 2 placed the Inngest test) — append: sends success email; sends failure email; skips when `emailSentAt` is set; skips when `contactEmail` is missing; uses distinct step IDs (Inngest memoization)
- [ ] Extend or create `app/api/chat/__tests__/route.test.ts` — mock CapService allowed/denied; assert HTTP 200 + parse stream payload contains limit-reached copy
- [ ] Extend or create `app/api/proxy/chat/__tests__/route.test.ts` — same as above
- [ ] *(Optional, deferred-acceptable)* `lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` — gated on `INTEGRATION_DB_URL`; runs N=200 concurrent `tryConsume` calls and asserts exactly one wins at `count = cap - 1`. Falls back to manual smoke if env absent.
- [ ] No new framework install — Vitest, RTL, and `@testing-library/jest-dom` already in `devDependencies`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Real Resend send delivers the success email to the shop owner inbox | NOT-01 (operator-confirmable) | Requires verified sending domain + live Inngest run + real shop with `contactEmail` set | 1) Trigger a successful sync from `/onboarding` on a dev shop. 2) Confirm a "Catalog sync complete" email arrives at the shop's `contactEmail`. 3) Confirm the "View in admin" button links back to the embedded admin. | ⬜ deferred |
| Real Resend send delivers the failure email + retry link works | NOT-02 (operator-confirmable) | Requires inducing a controlled sync failure | 1) Force a sync failure (revoke product scope or stub the GraphQL client to throw). 2) Confirm a "Catalog sync failed" email arrives. 3) Click the retry button → lands on `/onboarding?retry={syncRunId}` with the pre-filled retry affordance. 4) Click retry → new SyncRun fires. | ⬜ deferred |
| Cap-reached cross-route smoke | CAP-03 (operator-confirmable) | Requires forcing the counter to cap-1 then issuing one extra request via the chat UI on both admin playground and storefront drawer | 1) Set `HARD_CAP_REQUESTS_PER_MONTH=3` temporarily (or seed the counter to cap-1 via psql). 2) Send 2 messages in `/chat` — both stream normally. 3) Send the 3rd → streamed assistant message reads the limit-reached copy. 4) Repeat in the storefront drawer for the same shop — same outcome. | ⬜ deferred |
| Race-condition smoke at cap-1 (optional) | SC4 (real-DB concurrency) | Unit-level mock of `$queryRaw` proves SQL shape; real-DB stress proves serialization | If `INTEGRATION_DB_URL` is configured, run the gated `RequestCounterRepository.race.integration.test.ts` — asserts exactly 1 of N=200 concurrent calls wins. Otherwise, document the SQL shape evidence + Postgres `ON CONFLICT` atomicity citation in the verification gate. | ⬜ deferred-or-automated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (flipped by verification gate)

**Approval:** pending
