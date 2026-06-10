---
phase: 08-email-hard-cap
plan: 11
subsystem: inngest-sync
tags: [phase-08, inngest, sync, success-email, NOT-01, D-03, D-04, D-05]
requires:
  - 08-04 (services/email/EmailService.ts → sendSyncSuccess)
  - 08-05 (services/shopify/ShopifyShopService.ts → fetchShopContactEmail)
  - 08-06 (prisma: SyncRun.emailSentAt column)
  - 08-03 (lib/email/templates/SyncSuccessEmail.tsx)
provides:
  - send-success-email Inngest step inside syncProductsFunction
affects:
  - inngest/functions/sync-products.ts
tech-stack:
  added: []
  patterns:
    - Three-layer idempotency (step memoization + atomic emailSentAt stamp + Resend idempotencyKey)
    - Atomic UPDATE ... WHERE emailSentAt IS NULL stamp pattern
key-files:
  created: []
  modified:
    - inngest/functions/sync-products.ts
decisions:
  - D-03 honored: email send fires inside the Inngest sync function (success branch added; failure branch deferred to 08-12)
  - D-04 honored: idempotency via SyncRun.emailSentAt + atomic UPDATE WHERE IS NULL
  - D-05 honored: missing contactEmail = graceful skip (no throw, sync result preserved)
  - Defensive guard added: skip when run.state === 'failed' so success branch never sends after a failed run
metrics:
  duration: ~1 minute
  tasks: 1
  files: 1
  completed: 2026-05-27
---

# Phase 8 Plan 11: send-success-email Inngest Step Summary

Wire the success-branch transactional email into the canonical Phase 2 Inngest sync function: after `finalize` succeeds, send the catalog-sync-complete email via the just-shipped Phase 8 services, with three-layer idempotency and D-05 graceful skip on missing `contactEmail`.

## What Was Built

**Single file modified:** `inngest/functions/sync-products.ts` (+41 lines / –1 line, surgical diff).

Two changes:

1. **Imports added** (top of file):
   - `import { sendSyncSuccess } from '@/services/email/EmailService';`
   - `import { fetchShopContactEmail } from '@/services/shopify/ShopifyShopService';`

2. **Finalize step restructured + new email step appended:**
   - `return await step.run('finalize', ...)` → `const finalizeResult = await step.run('finalize', ...)` (body byte-identical).
   - New `step.run('send-success-email', async () => { ... })` block inserted between `finalize` and the function's terminal `return finalizeResult;`.

### `send-success-email` step body (6-action sequence per RESEARCH §System Architecture)

1. Reload `SyncRun` via `prisma.syncRun.findUnique`.
2. Skip when `run.emailSentAt` is non-null (D-04 idempotency) OR `run.state === 'failed'` (defensive — the success branch must not send when finalize judged failure; 08-12's `onFailure` owns the failure email).
3. `fetchShopContactEmail(session)` — if `null`, return early (D-05 graceful skip; never throw).
4. Build `adminUrl` from `process.env.SHOPIFY_APP_HANDLE` + shop slug (no user input in URL path → T-08-11-T3 mitigation; Assumption A1 defensive fallback to bare `/store/{shopSlug}` when env var missing).
5. `await sendSyncSuccess({ to, shop, productCount: run.processedCount, adminUrl, syncRunId })`.
6. Atomic stamp: `UPDATE sync_runs SET "emailSentAt" = NOW() WHERE id = ${syncRunId} AND "emailSentAt" IS NULL` (T-08-11-T2 mitigation — second concurrent update is a no-op).

### Three-layer idempotency

| Layer | Mechanism | Owner |
|-------|-----------|-------|
| 1 | `step.run('send-success-email', ...)` memoization | Inngest |
| 2 | `emailSentAt` atomic stamp with `WHERE emailSentAt IS NULL` guard | Application (this step) |
| 3 | `idempotencyKey: 'sync-success/{syncRunId}'` (24h server-side) | Resend (in EmailService) |

## Test Status (Wave 0 contract flip)

`bunx vitest run inngest/functions/__tests__/sync-products.test.ts`

- **Total: 15 tests, 13 passing, 2 failing.**
- All Phase 2 (5 tests) — GREEN (regression-clean; finalize return shape preserved).
- All Phase 3 (5 tests) — GREEN (regression-clean).
- Phase 8 success-branch (4 of 5 tests in this plan's scope) — GREEN:
  - `sends success email after finalize when emailSentAt is null (NOT-01)` ✓
  - `skips success email when emailSentAt is already set (D-04 idempotency)` ✓
  - `skips email when contactEmail is null (D-05) and does NOT throw / fail the sync` ✓
  - `uses distinct step IDs 'send-success-email' vs 'send-failure-email' (Pitfall 2)` — **success-branch assertions pass**; the test's failure-branch assertions still fail (see below).
- Phase 8 failure-branch (2 tests) — RED, **deferred to plan 08-12**:
  - `sends failure email inside onFailure when emailSentAt is null (NOT-02)` — out of 08-11 scope per plan: "Do NOT touch the `onFailure` handler (that's 08-12)."
  - `uses distinct step IDs ... (Pitfall 2)` — the second half of this combined test exercises the failure branch.

## Verification

| Check | Result |
|-------|--------|
| `grep -c "step.run('send-success-email'"` | `1` ✓ |
| `grep -cE "console\\." inngest/functions/sync-products.ts` | `0` ✓ |
| 4 success-email tests | all GREEN ✓ |
| Phase 2/3 regression check | all GREEN ✓ |
| Finalize return shape preserved (`state`, `processedCount`, `errorCount`) | ✓ |
| Atomic UPDATE uses `WHERE "emailSentAt" IS NULL` | ✓ |
| `adminUrl` built from server-side env, no user input in path | ✓ |

## Deviations from Plan

None — surgical edit followed the plan's `<action>` block exactly:

- Imports added at top as specified.
- Finalize step changed only at the call site (`return await` → `const finalizeResult = await`); inner body byte-identical.
- New `step.run('send-success-email', ...)` appended after finalize, before terminal `return finalizeResult`.
- All existing Phase 2/3 steps remain byte-identical (only the finalize call site + new email step + new return change — `git diff --stat` shows `+41 / -1`).

## Threat Mitigations (per `<threat_model>`)

| Threat ID | Status |
|-----------|--------|
| T-08-11-T1 (replay → duplicate send) | Mitigated — three-layer idempotency in place |
| T-08-11-T2 (emailSentAt double-write race) | Mitigated — `WHERE emailSentAt IS NULL` atomic guard |
| T-08-11-I1 (contactEmail / API key in logs) | Mitigated — zero `console.*` added; `fetchShopContactEmail` already bare-catches |
| T-08-11-D1 (sync fail due to email error) | Mitigated — D-05 path returns early on null contact; sendSyncSuccess throw propagates to Inngest step retry (sync result already committed in finalize) |
| T-08-11-T3 (open redirect via adminUrl) | Mitigated — `adminUrl` built from server-side env + authenticated session shop |

## Commits

- `598e19d` — `feat(08-11-01): add send-success-email Inngest step (D-03, D-04, D-05)`

## Self-Check: PASSED

- File `inngest/functions/sync-products.ts` modified — FOUND.
- Commit `598e19d` — FOUND in `git log`.
- Tests: 4 success-email tests GREEN; 2 failure-branch tests remain RED (deferred to 08-12 by design — out of 08-11 scope).
