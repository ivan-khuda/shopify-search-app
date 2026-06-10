---
phase: 08-email-hard-cap
plan: 10
subsystem: chat-services
tags: [phase-08, services, cap, chat, cap-02, cap-03]
requirements: [CAP-02, CAP-03]
dependency_graph:
  requires:
    - lib/db/repositories/RequestCounterRepository.ts (08-08)
    - lib/util/period.ts (08-07)
  provides:
    - services/chat/CapService.ts (tryConsumeRequest composer for chat routes)
  affects:
    - app/api/chat/route.ts (08-13 will import tryConsumeRequest)
    - app/api/proxy/chat/route.ts (08-14 will import tryConsumeRequest)
tech-stack:
  added: []
  patterns:
    - "Thin per-request resolver (mirrors getActiveChatModel.ts)"
    - "Env-at-call-time pattern (operator rotation + test override without module reset)"
key-files:
  created:
    - services/chat/CapService.ts
  modified:
    - services/chat/__tests__/CapService.test.ts (removed now-stale @ts-expect-error scaffolds)
decisions:
  - "D-09 default cap = 2000 locked as module-private DEFAULT_CAP constant"
  - "D-14 single-helper co-location honored: one function, one file, both chat routes import the same boolean verdict"
  - "Return shape narrowed to { allowed: boolean } (not the repo's discriminated union with requestCount) — routes only branch on allowed; requestCount is internal to the counter primitive"
metrics:
  duration: "~1.5 min"
  completed: "2026-05-27"
  tasks: 1
  files: 2
---

# Phase 8 Plan 10: CapService Composer Summary

Thin `tryConsumeRequest(shop)` resolver that wires `getCurrentPeriod()` + `requestCounterRepository.tryConsume()` + env-driven cap into a single boolean verdict consumed by both chat routes (08-13 admin, 08-14 storefront).

## What Shipped

**`services/chat/CapService.ts`** — one exported function, one module-private `readCap()` helper, one module-private `DEFAULT_CAP = 2000` constant. ~40 lines including JSDoc.

```ts
export async function tryConsumeRequest(shop: string): Promise<{ allowed: boolean }> {
  const period = getCurrentPeriod();
  const cap = readCap();
  const r = await requestCounterRepository.tryConsume(shop, period, cap);
  return { allowed: r.allowed };
}
```

`readCap()` parses `process.env.HARD_CAP_REQUESTS_PER_MONTH` via `parseInt(., 10)`; returns `DEFAULT_CAP` when missing, NaN, `≤ 0`, or non-finite — closing T-08-10-T1 (env-rotation tampering).

## Decisions Made

- **Env at call time, not module load.** `readCap()` runs per request so (a) operators can rotate `HARD_CAP_REQUESTS_PER_MONTH` without redeploy, and (b) the test file can override `process.env` per-case without `vi.resetModules()` gymnastics. Cost: one `process.env` lookup per chat request — negligible.
- **Return `{ allowed: boolean }`, not the repo's discriminated union.** The repo returns `{ allowed: true, requestCount } | { allowed: false }`. Routes only branch on `allowed`; they never display `requestCount` to the storefront visitor (D-13 — silent caps). Narrowing the return shape at this layer keeps the route contract minimal.
- **No empty-shop guard.** Both chat routes derive `shop` from authenticated context (`withShopifySession` ctx.shop / `withAppProxyHmac` signed query). An explicit empty-shop fallback here would mask the caller bug. Trust boundary documented in JSDoc and threat model.

## Deviations from Plan

**1. [Rule 3 - Blocking] Removed stale `@ts-expect-error` directives from test file**
- **Found during:** Post-implementation `bunx tsc --noEmit` check
- **Issue:** The RED scaffold for `CapService.test.ts` (shipped in Wave 0) had eight `@ts-expect-error` directives suppressing the "module does not exist yet" import error. After this plan landed the module, those directives became unused and `tsc` reported eight `TS2578: Unused '@ts-expect-error' directive` errors — direct blocking noise caused by my new file.
- **Fix:** Removed the now-stale directives and their accompanying `eslint-disable` lines. Mechanical change; no test behavior modified. All 8 tests still pass.
- **Files modified:** `services/chat/__tests__/CapService.test.ts`
- **Commit:** `98cddc2`

The plan's `files_modified` listed only `services/chat/CapService.ts`, but this cleanup was 100% caused by my change and would have left the test file perpetually broken at typecheck. Rule 3 (auto-fix blocking issues directly caused by current task's changes) applies.

## Verification

- `bunx vitest run services/chat/__tests__/CapService.test.ts` → **8/8 GREEN** (env default, env override, "abc" fallback, "-1" fallback, "0" fallback, period derivation, allowed-true pass-through, allowed-false pass-through)
- `bunx tsc --noEmit 2>&1 | grep -E "(CapService|services/chat)"` → **empty**
- `grep -nE "console\.(log|error|warn|info|debug|trace)" services/chat/CapService.ts` → **empty**

## Threat Coverage

| Threat ID | Mitigation Landed |
|-----------|---------------------|
| T-08-10-T1 (env tampered to bypass cap) | `readCap()` rejects NaN / ≤0 / non-finite via `Number.isFinite` + `> 0` guard; falls back to `DEFAULT_CAP=2000`. Asserted by 3 dedicated tests ("abc", "-1", "0"). |
| T-08-10-T2 (shop spoofing) | Mitigation at route layer (08-13/08-14) as documented; CapService trusts `shop` by contract. JSDoc cites the trust boundary. |

## Wave-Level Status

This is the Wave 5 implementation that completes the cap-service contract for chat routes. Wave 6 (08-13 admin chat route) and Wave 6 (08-14 storefront proxy chat route) can now import `tryConsumeRequest` and get a single boolean verdict — no inline env reads, no inline period derivation, no inline repo coordination.

## Self-Check: PASSED

- [x] `services/chat/CapService.ts` exists at expected path
- [x] Commit `98cddc2` exists in git log
- [x] Wave 0 test suite GREEN (8/8)
- [x] Zero `console.*` calls
- [x] Zero TypeScript errors in `services/chat/`
- [x] Signature matches plan: `tryConsumeRequest(shop): Promise<{ allowed: boolean }>`
- [x] D-09 default cap = 2000 enforced via `DEFAULT_CAP` constant
- [x] D-14 single-helper co-location: one file, one function
