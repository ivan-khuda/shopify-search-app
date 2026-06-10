---
phase: 08-email-hard-cap
plan: 04
subsystem: email
tags: [phase-08, email, resend, services, wave-4]
requires:
  - "08-01: Wave 0 RED scaffolds (services/email/__tests__/EmailService.test.ts)"
  - "Resend Node SDK contract (vendor-owned packages)"
provides:
  - "services/email/EmailService.ts — sendSyncSuccess + sendSyncFailure typed wrappers"
  - "Module-scope Resend client + FROM constant ready for vi.mock in unit tests"
  - "Idempotency-key construction centralized (D-04 contract: second-arg options bag)"
affects:
  - "Plan 08-05: replaces lib/email/templates/Sync{Success,Failure}Email.tsx stubs with real React Email components"
  - "Plan 08-11 / 08-12: Inngest function will consume sendSyncSuccess / sendSyncFailure"
tech-stack:
  added:
    - "resend@6.12.4"
    - "@react-email/components@1.0.12"
    - "@react-email/render@2.0.8"
  patterns:
    - "Module-scope SDK singleton + env-scoped FROM (NOT-04)"
    - "Idempotency via SDK options bag, not headers (D-04 / Pitfall 4)"
    - "Throw on result.error for Inngest retry semantics (Assumption A4)"
key-files:
  created:
    - services/email/EmailService.ts
    - lib/email/templates/SyncSuccessEmail.tsx  # stub — 08-05 replaces
    - lib/email/templates/SyncFailureEmail.tsx  # stub — 08-05 replaces
  modified:
    - package.json
    - bun.lock
    - services/email/__tests__/EmailService.test.ts  # removed stale @ts-expect-error
    - lib/email/templates/__tests__/sync-success-email.test.tsx  # removed stale @ts-expect-error
    - lib/email/templates/__tests__/sync-failure-email.test.tsx  # removed stale @ts-expect-error
decisions:
  - "Stub the React Email template files at lib/email/templates/ now (rather than wait for 08-05) — Vite's import-analysis transform pre-resolves path-aliased imports BEFORE vi.mock can intercept them. Without on-disk files the EmailService module fails to load, blocking the GREEN flip even though the template code is never executed."
metrics:
  duration: "3m"
  completed: "2026-05-27"
  tasks: 2
  test_results: "9/9 GREEN (services/email/__tests__/EmailService.test.ts)"
---

# Phase 8 Plan 04: EmailService Wrapper Summary

Installed Resend + React Email packages and shipped `services/email/EmailService.ts` — a thin, env-scoped wrapper over `resend.emails.send` with idempotency-key construction baked into both `sendSyncSuccess` and `sendSyncFailure`. Drives the Wave 0 RED EmailService test suite from RED to 9/9 GREEN.

## What Was Built

### Packages (Task 1 — commit `efd6d40`)

| Package | Version | Role |
|---------|---------|------|
| `resend` | `^6.12.4` | Transactional email SDK (CLAUDE.md lock) |
| `@react-email/components` | `^1.0.12` | Template primitives — consumed by 08-05 |
| `@react-email/render` | `^2.0.8` | `render()` produces the `html` string for `emails.send` |

All three vendor-owned (`github.com/resend/*`), no postinstall scripts, LOCKED by CLAUDE.md + NOT-03 — no slopcheck gate required (per 08-RESEARCH.md §Package Legitimacy Audit).

### EmailService (Task 2 — commit `abaa82b`)

`services/email/EmailService.ts` exports:

```ts
export interface SendSyncSuccessArgs {
  to: string;
  shop: string;
  productCount: number;
  adminUrl: string;
  syncRunId: string;
}
export async function sendSyncSuccess(args: SendSyncSuccessArgs): Promise<void>;

export interface SendSyncFailureArgs {
  to: string;
  shop: string;
  syncRunId: string;
  errorMessage: string;
  retryUrl: string;
}
export async function sendSyncFailure(args: SendSyncFailureArgs): Promise<void>;
```

Module-scope initialization:

```ts
const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM_ADDRESS!;
```

Both functions:
1. `render(<Template ...args />)` → HTML string
2. `resend.emails.send({ from: FROM, to, subject, html }, { idempotencyKey })`
3. Throw `Error('Resend send failed: ...')` when `result.error` is truthy

## Contract Anchors Hit

- **NOT-04 (env-scoped sender):** `from` reads from `process.env.RESEND_FROM_ADDRESS` at module load — never from caller args. Test `EmailService.test.ts:62, :158` asserts `payload.from === 'noreply@smartdiscovery.test'`.
- **D-04 (idempotency key shape):** `sync-success/${syncRunId}` / `sync-failure/${syncRunId}` passed in the **second-arg options bag**, not headers. Tests `:107, :173` assert `options === { idempotencyKey: '...' }`.
- **Assumption A4 (failures bubble):** When `result.error` truthy, throw so Inngest `step.run` sees the rejection and retries. Tests `:111, :177` assert `rejects.toThrow(/Resend send failed/)`.
- **CLAUDE.md + Pitfall 6 (no PII logging):** Zero `console.*` calls in shipped code. `args.to`, `args.errorMessage`, `RESEND_API_KEY` are never logged. Only `result.error.message` is interpolated into the thrown Error.

## Test Status Flip

```
services/email/__tests__/EmailService.test.ts
  EmailService.sendSyncSuccess (NOT-04, D-04)
    ✓ calls resend.emails.send with from === process.env.RESEND_FROM_ADDRESS (env-scoped, not per-shop)
    ✓ passes the rendered HTML as the html field
    ✓ uses subject `Catalog sync complete — {productCount} products`
    ✓ passes idempotencyKey === `sync-success/${syncRunId}` in the second-arg options bag (D-04)
    ✓ throws when Resend returns an error (A4 — must bubble so Inngest retries)
  EmailService.sendSyncFailure (NOT-04, D-04)
    ✓ uses subject `Catalog sync failed`
    ✓ reads `from` from process.env.RESEND_FROM_ADDRESS (NOT the args)
    ✓ passes idempotencyKey === `sync-failure/${syncRunId}` in the options bag
    ✓ throws when Resend returns an error (A4)

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Stub React Email template files at `lib/email/templates/`**

- **Found during:** Task 2, first test run
- **Issue:** Vite's `vite:import-analysis` transform pre-resolves path-aliased imports at file load time, BEFORE `vi.mock('@/lib/email/templates/SyncSuccessEmail', ...)` can intercept them. Without on-disk files at the import paths, the EmailService module fails to load with `Failed to resolve import "@/lib/email/templates/SyncFailureEmail"`, blocking the GREEN flip even though the template code is mocked and never executed at runtime.
- **Plan note acknowledged this risk** ("the template imports will be unresolved until 08-05 lands — that is expected") but the type-only forward-reference assumption did not hold against Vite's runtime resolver.
- **Fix:** Created minimal stub modules with the exact exports 08-05's `must_haves.artifacts` declares:
  - `lib/email/templates/SyncSuccessEmail.tsx` — exports `SyncSuccessEmail` (returns `null`) + `SyncSuccessEmailProps` interface
  - `lib/email/templates/SyncFailureEmail.tsx` — exports `SyncFailureEmail` (returns `null`) + `SyncFailureEmailProps` interface
- **Impact on 08-05:** Both stubs include a JSDoc block flagging them as 08-05's replacement target. The 08-05 RED template tests (`sync-success-email.test.tsx`, `sync-failure-email.test.tsx`) still fail at assertion time (`render()` of a null-returning component produces empty HTML, the tests assert specific strings) — preserving 08-05's RED contract.
- **Files modified:** `lib/email/templates/SyncSuccessEmail.tsx` (new), `lib/email/templates/SyncFailureEmail.tsx` (new)
- **Commit:** `abaa82b`

**2. [Rule 3 — Blocking issue] Remove stale `@ts-expect-error` directives**

- **Found during:** Task 2 type-check
- **Issue:** The three Wave 0 test files (`services/email/__tests__/EmailService.test.ts`, `lib/email/templates/__tests__/sync-success-email.test.tsx`, `lib/email/templates/__tests__/sync-failure-email.test.tsx`) carried `@ts-expect-error — RED scaffold: module does not exist yet` directives on every import of the target modules. With the EmailService module now shipped and the template stubs in place, those imports type-resolve, leaving the `@ts-expect-error` directives unused. `tsc --noEmit` flags this as `TS2578 Unused '@ts-expect-error' directive`.
- **Fix:** Removed all 11 `@ts-expect-error` + paired `eslint-disable-next-line` comments. Replaced the RED-scaffold comment on the template tests with a forward-reference to 08-05 explaining why those tests still RED at assertion time.
- **Files modified:** `services/email/__tests__/EmailService.test.ts`, `lib/email/templates/__tests__/sync-success-email.test.tsx`, `lib/email/templates/__tests__/sync-failure-email.test.tsx`
- **Commit:** `abaa82b` (bundled with stub creation — same root cause)

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Wave 0 RED → GREEN | `bunx vitest run services/email/__tests__/EmailService.test.ts` | 9/9 passed |
| Zero `console.*` in shipped code | `grep -nE "console\." services/email/EmailService.ts` | Only matches a JSDoc comment ("Zero `console.*` in this file"); no executable calls |
| Type-check | `bunx tsc --noEmit \| grep -E "services/email\|lib/email"` | Clean for new files |
| Package presence | `grep -E '"resend":\|"@react-email/(components\|render)":' package.json \| wc -l` | 3 |
| Lockfile integrity | `bun install --frozen-lockfile` | No changes — lockfile coherent |

## Commits

| # | Hash | Type | Summary |
|---|------|------|---------|
| 1 | `efd6d40` | `chore(08-04-01)` | install resend + @react-email/components + @react-email/render |
| 2 | `abaa82b` | `feat(08-04-02)` | add EmailService wrapper (D-01, D-02, NOT-04) + template stubs |

## Threat Surface

No new endpoints, auth paths, or trust boundaries introduced beyond the plan's `<threat_model>`:

- T-08-04-T1 (replay → duplicate email): **mitigated** — second-arg `idempotencyKey` (D-04 form) wired into both functions; key shape pins to `syncRunId`.
- T-08-04-I1 (PII logging): **mitigated** — zero `console.*` in `EmailService.ts`; error message construction never references `args.to`, `args.errorMessage`, or the API key.
- T-08-04-T2 (header-form idempotency that doesn't dedup): **mitigated** — used SDK's second-arg options bag exclusively; tests assert `[, options] = sendMock.mock.calls[0]` and check `options.idempotencyKey`, so any future regression to header-form would re-RED these tests.
- T-08-04-SC (supply chain): **mitigated** — three vendor-owned packages, no postinstall scripts, locked by CLAUDE.md.

## Known Stubs

| File | Purpose | Resolved by |
|------|---------|-------------|
| `lib/email/templates/SyncSuccessEmail.tsx` | Returns `null`; placeholder so Vite import-analysis resolves | Plan 08-05 Task 1 |
| `lib/email/templates/SyncFailureEmail.tsx` | Returns `null`; placeholder so Vite import-analysis resolves | Plan 08-05 Task 2 |

Both stubs preserve 08-05's RED contract: the template test files (`sync-success-email.test.tsx`, `sync-failure-email.test.tsx`) still fail because the rendered HTML is empty and the tests assert specific strings ("Catalog sync complete", `productCount`, `adminUrl`, button labels). 08-05 turning those RED tests GREEN is the explicit goal of that plan.

## Self-Check: PASSED

- FOUND: `services/email/EmailService.ts`
- FOUND: `lib/email/templates/SyncSuccessEmail.tsx`
- FOUND: `lib/email/templates/SyncFailureEmail.tsx`
- FOUND commit: `efd6d40` (chore install)
- FOUND commit: `abaa82b` (feat EmailService)
- VERIFIED: 9/9 EmailService tests green
- VERIFIED: zero `console.*` in shipped code
- VERIFIED: packages present in package.json at pinned versions
