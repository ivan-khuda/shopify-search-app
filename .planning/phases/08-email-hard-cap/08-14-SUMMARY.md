---
phase: 08-email-hard-cap
plan: 14
subsystem: api/storefront-chat
tags: [phase-08, api, chat, storefront, proxy, cap-check, CAP-02, CAP-03, D-14]
requirements: [CAP-02, CAP-03]
dependency-graph:
  requires:
    - "services/chat/CapService.ts (08-09)"
    - "lib/chat/cap-reached-response.ts (08-10)"
    - "app/api/proxy/chat/route.ts (Phase 6 D-21 host with stub)"
  provides:
    - "Storefront-surface enforcement of the per-shop monthly request cap"
    - "Wire-up parity with the admin route (08-13) — same helper, same response shape"
  affects:
    - "Storefront visitor → /api/proxy/chat cost path: AI Gateway no longer invoked on cap-reached requests"
tech-stack:
  added: []
  patterns:
    - "Single-helper cap-check (tryConsumeRequest + capReachedResponse) shared admin + storefront"
key-files:
  created: []
  modified:
    - app/api/proxy/chat/route.ts
decisions:
  - "Inject cap-check AFTER rate-limit and customer-id assert, BEFORE conversation create — rate-limit absorbs spam first, then cap enforces the monthly contract on legitimate traffic, and we avoid creating empty Conversation rows on cap-reached requests"
  - "JSDoc updated to reflect the cap is now wired (no longer a stub)"
metrics:
  duration: "~2m"
  completed: "2026-05-27"
---

# Phase 8 Plan 14: Inject hard-cap check at /api/proxy/chat — Summary

One-liner: **Wired `tryConsumeRequest(shop)` + `capReachedResponse()` into the storefront chat route, replacing the Phase-6 D-21 stub with the real CAP-02/03 enforcement (smallest-possible diff: +2 imports, 1 stub comment → 3 lines).**

## What changed

`app/api/proxy/chat/route.ts`:

1. Two new imports added after `hybridSearch`:
   ```ts
   import { tryConsumeRequest } from '@/services/chat/CapService';
   import { capReachedResponse } from '@/lib/chat/cap-reached-response';
   ```
2. The stub comment `// D-21 step 4: hard-cap stub (Phase 8 fills in via DB-backed RequestCounter).` was replaced with:
   ```ts
   // D-21 step 4 / D-14: hard cap (CAP-02/03). Last gate before AI Gateway.
   const consume = await tryConsumeRequest(shop);
   if (!consume.allowed) return capReachedResponse();
   ```
3. Top-of-file JSDoc lines 25–26 updated from "is a stub" → "enforces CAP-02/03 via tryConsumeRequest after HMAC + customer-id + rate-limit gates, before conversation lifecycle."

All other lines (HMAC wrapper, customer-id assert, rate-limit, conversation create, merge, streamText, onFinish) are byte-identical.

## Verification results

| Check | Result |
|---|---|
| `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` | **12/12 GREEN** (1.26s) |
| Phase 8 hard cap describe block (4 it() blocks) | GREEN |
| Existing Phase 6 HMAC / customer-id / rate-limit / conversation-lifecycle regression tests | GREEN |
| `grep -c "tryConsumeRequest" route.ts` | 3 (≥1 required: 2 imports + 1 call site) |
| `grep -c "capReachedResponse" route.ts` | 2 (≥1 required: 1 import + 1 call site) |
| `grep -c "D-21 step 4: hard-cap stub" route.ts` | 0 (stub gone) |
| `grep -E "console\." route.ts` | empty (CLAUDE.md hard rule) |
| Files modified outside scope | none (admin route, CapService, capReachedResponse untouched) |

## Position rationale (D-14)

The cap-check is positioned as the **last gate before the AI Gateway** call, after:
1. App Proxy HMAC verification (STR-04 — `withAppProxyHmac` wrapper)
2. `customer_id` body↔signed-query match (IDN-02)
3. Sliding-window rate-limit (Phase 6 — `rateLimit(visitor_id, 'chat')`)

and before:
4. Conversation lifecycle (no empty Conversation rows created on cap-reached)
5. `streamText(...)` model invocation (no AI Gateway billing on cap-reached)

This ordering matches the plan's "cap is the LAST gate before AI Gateway" contract and the threat-register entry T-08-14-T2 (rate-limit absorbs bursts; cap enforces the monthly contract on legitimate traffic).

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `4f64d5b` — feat(08-14-01): replace D-21 stub with cap-check at /api/proxy/chat (CAP-03, D-14)

## Self-Check: PASSED

- FOUND: app/api/proxy/chat/route.ts (modified — confirmed 3 hits for `tryConsumeRequest`, 2 for `capReachedResponse`, 0 for stub comment)
- FOUND: commit 4f64d5b in git log
