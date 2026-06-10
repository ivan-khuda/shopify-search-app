---
phase: 08-email-hard-cap
plan: 09
subsystem: chat
tags: [phase-08, chat, ai-sdk-v6, cap-reached, streaming]

# Dependency graph
requires:
  - phase: 08-email-hard-cap
    provides: "Wave 0 RED test (cap-reached-response.test.ts) — locks chunk sequence + HTTP 200 + locked copy contract"
provides:
  - "lib/chat/cap-reached-response.ts — single helper synthesizing the cap-reached UI message stream"
  - "CAP_REACHED_MESSAGE constant — single source of truth for the locked V1 copy (shared admin + storefront)"
  - "capReachedResponse(): Response — HTTP 200 streamed UI message identical in shape to streamText().toUIMessageStreamResponse()"
affects: ["08-13 (admin /api/chat integration)", "08-14 (storefront /api/proxy/chat integration)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI SDK v6 synthetic UI message stream via createUIMessageStream + createUIMessageStreamResponse"
    - "v6 chunk taxonomy: start → text-start → text-delta → text-end → finish with shared id correlation (Pitfall 5)"
    - "Bypass streamText for non-LLM synthetic responses (Anti-Pattern 2 avoided)"

key-files:
  created:
    - "lib/chat/cap-reached-response.ts"
  modified: []

key-decisions:
  - "Locked CAP_REACHED_MESSAGE copy: \"You've reached this month's message limit. It resets on the 1st of the month. To raise your limit, contact support.\" (per CONTEXT Resolved Items; overrides RESEARCH example which used '1st of next month')"
  - "HTTP 200 (D-10) — chat UI handles cap-reached as a normal assistant message, not an error toast"
  - "Single constant shared admin + storefront (Open Question 1 V1 resolution); future Phase 9 can specialize per-surface"

patterns-established:
  - "Pattern: synthetic v6 UI message streams via createUIMessageStream without LLM round-trip"
  - "Pattern: shared id from generateId() correlates text-start/text-delta/text-end chunks"
  - "Pattern: response helper module exports both the helper and the user-visible copy constant for test pinning"

requirements-completed: [CAP-03]

# Metrics
duration: ~3min
completed: 2026-05-27
---

# Phase 8 Plan 09: Cap-Reached Response Helper Summary

**Single helper synthesizing the AI SDK v6 streamed cap-reached message (HTTP 200), shared by admin + storefront chat routes for verifiably identical limit-reached UX.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-27T21:18:00Z
- **Completed:** 2026-05-27T21:20:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Authored `lib/chat/cap-reached-response.ts` with exported `capReachedResponse(): Response` + `CAP_REACHED_MESSAGE` constant
- Drove Wave 0 RED test (`lib/chat/__tests__/cap-reached-response.test.ts`) to GREEN — all 5 assertions pass
- Synthesized the v6 chunk sequence (start → text-start → text-delta → text-end → finish) with shared `id` correlation per Pitfall 5
- Avoided Anti-Pattern 2: no `streamText` call, no LLM round-trip on cap-reached responses

## Task Commits

1. **Task 1: Author lib/chat/cap-reached-response.ts** — `35ee5a7` (feat)

## Files Created/Modified
- `lib/chat/cap-reached-response.ts` — exports `CAP_REACHED_MESSAGE` (locked copy) and `capReachedResponse()` returning an AI SDK v6 `UIMessageStreamResponse` with the 5-chunk synthetic message

## Helper Contract (locked)

```ts
export const CAP_REACHED_MESSAGE =
  "You've reached this month's message limit. It resets on the 1st of the month. To raise your limit, contact support.";

export function capReachedResponse(): Response;
```

- **HTTP status:** 200 (D-10) — chat UI handles inline as a normal assistant message
- **Body:** `createUIMessageStreamResponse({ stream })` where the stream emits exactly:
  1. `{ type: 'start', messageId: id }`
  2. `{ type: 'text-start', id }`
  3. `{ type: 'text-delta', id, delta: CAP_REACHED_MESSAGE }`
  4. `{ type: 'text-end', id }`
  5. `{ type: 'finish' }`
- `id = generateId()` — same id across all `text-*` chunks (Pitfall 5 correlation)
- Zero `console.*` (T-04-10 secret-leak lock)
- Zero interpolation in `CAP_REACHED_MESSAGE` (T-08-09-I1 — no shop identity leakage)

## Decisions Made
- Used the CONTEXT.md Resolved Items locked copy ("1st of the month") — explicitly overriding the RESEARCH §Code Examples draft that read "1st of next month". The PLAN's `must_haves.truths` and `<behavior>` both reference the CONTEXT-locked string verbatim.
- Default HTTP 200 from `createUIMessageStreamResponse` honored — no custom headers, no status override (D-10).
- Constant shared between admin + storefront for V1 (no per-surface variant) per Open Question 1 resolution.

## Deviations from Plan

None — plan executed exactly as written. The locked-text discrepancy between PLAN's `<behavior>` (correct, "1st of the month") and RESEARCH §Code Examples (stale, "1st of next month") was already called out in the PLAN's `<action>` note; the executor followed the PLAN's authoritative text.

## Issues Encountered

None.

## Verification Results

- `bunx vitest run lib/chat/__tests__/cap-reached-response.test.ts` → **5/5 GREEN** (HTTP 200, constant exported, chunk order start→text-start→text-delta→text-end→finish, text-delta concatenation equals CAP_REACHED_MESSAGE, copy contract includes month/limit/1st)
- `bunx tsc --noEmit` on `cap-reached-response.ts` source → clean (the unused `@ts-expect-error` directives in the Wave 0 test file are an expected RED→GREEN transition artifact; not in scope for this plan)
- `grep -n "console\." lib/chat/cap-reached-response.ts` → empty
- `grep -c "You've reached this month's message limit" lib/chat/cap-reached-response.ts` → 1 (single source of truth)
- `grep -c "createUIMessageStreamResponse\|createUIMessageStream\b" lib/chat/cap-reached-response.ts` → 4 (imports + usage)

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- **08-13 (admin /api/chat integration):** Ready to import `capReachedResponse` and `CAP_REACHED_MESSAGE` from `@/lib/chat/cap-reached-response`. Pattern: `if (!consume.allowed) return capReachedResponse();` per RESEARCH §Chat route delta.
- **08-14 (storefront /api/proxy/chat integration):** Same helper, same import. Symmetry between surfaces is enforced by the shared module + constant.
- No blockers.

## Self-Check: PASSED

- `lib/chat/cap-reached-response.ts` — FOUND
- Commit `35ee5a7` — FOUND in `git log`

---
*Phase: 08-email-hard-cap*
*Completed: 2026-05-27*
