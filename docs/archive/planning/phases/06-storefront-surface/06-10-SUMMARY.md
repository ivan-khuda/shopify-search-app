---
phase: 06-storefront-surface
plan: 10
subsystem: infra
tags: [inngest, cron, retention, jsonb, idempotent-delete]

requires:
  - phase: 06-storefront-surface
    provides: 06-02 (Conversation table + lastMessageAt index)
provides:
  - "Weekly cron 'conversation-retention-sweep' (Sundays 03:00 UTC)"
  - "Synchronous fallback: bun run script:cleanup-conversations"
affects: []

tech-stack:
  added: []
  patterns:
    - "Bounded loop pattern (100 batches × 1000 rows) for idempotent DELETE sweeps"
    - "Inngest retries are safe for naturally idempotent operations (DELETE WHERE id IN)"
    - "vi.resetAllMocks (not clearAllMocks) when test uses mockResolvedValueOnce"

key-files:
  created:
    - inngest/functions/retention-sweep.ts
    - scripts/cleanup-conversations.ts
    - .planning/phases/06-storefront-surface/06-10-SUMMARY.md
  modified:
    - app/api/inngest/route.ts
    - inngest/functions/__tests__/retention-sweep.test.ts (fixed clearAllMocks → resetAllMocks)
    - package.json (added script:cleanup-conversations)

key-decisions:
  - "Dropped step.run wrapping around the loop body — InngestTestEngine treats nested step.run as deferred work and short-circuits multi-batch drains. The DELETE is idempotent on retry, so unwrapping is safe."
  - "Exported as retentionSweepFunction (test contract) not retentionSweep (plan)"
  - "Fixed test scaffold's beforeEach: vi.clearAllMocks doesn't reset mockResolvedValueOnce queues; previous test's leftover queue values bled into this one. Switched to vi.resetAllMocks."

patterns-established:
  - "When InngestTestEngine + step.run loops misbehave, run the work directly inside the function body and rely on at-least-once + idempotent operations for safety"

requirements-completed:
  - IDN-03

duration: ~8min
completed: 2026-05-27
---

# Phase 06, Plan 10: Retention Sweep Cron Summary

**Inngest cron 'conversation-retention-sweep' drains Conversation rows older than 180 days every Sunday 03:00 UTC. Bounded at 100 batches × 1000 rows per invocation. Idempotent on retry.**

## Performance
- **Duration:** ~8 min
- **Completed:** 2026-05-27
- **Tasks:** 3 (Task 1 tdd:true, Tasks 2/3 auto)

## Accomplishments
- 5/5 RED tests in retention-sweep.test.ts flipped GREEN
- retentionSweepFunction registered alongside syncProductsFunction in app/api/inngest/route.ts
- scripts/cleanup-conversations.ts ships with same logic for manual ops use

## Task Commits
1. **All three tasks** — single commit covering function + registration + fallback script

## Deviations from Plan

**1. [Rule 3 - Blocking] Test scaffold bug — clearAllMocks vs resetAllMocks**
- **Found during:** Task 1 test debugging (multi-batch test failed even with correct impl)
- **Issue:** The previous test's unconsumed `mockResolvedValueOnce({count: 0})` bled into the next test because `vi.clearAllMocks()` clears history but not queued implementations. Resulted in deleteMany returning 0 on first iter, breaking the loop early, and total = 0.
- **Fix:** Changed `vi.clearAllMocks()` → `vi.resetAllMocks()` in beforeEach. Documented in commit.
- **Committed in:** retention-sweep commit (above)

**2. [Rule 4 - Implementation Choice] Dropped step.run wrap around loop body**
- **Found during:** After fixing test scaffold, totalDeleted was still incorrect when step.run wrapped the batch DELETE.
- **Root cause:** InngestTestEngine appears to treat nested step.run calls inside a loop as deferred work — second step.run never resolves within a single execute(). The fix unwraps the loop. Safety is preserved because the DELETE is naturally idempotent on Inngest's at-least-once retry semantics (Pitfall 6).
- **Trade-off:** No per-batch memoization. Production retries replay the full function from the top, but since DELETE WHERE id IN is idempotent, this is safe (re-runs delete 0 rows for already-deleted ids).

**3. [Rule 4 - Test Contract] Exported as retentionSweepFunction (not retentionSweep)**

---

## Issues Encountered
- See deviations.

## Next Phase Readiness
- ✓ Weekly retention enforcement ships
- ✓ Operator can drain manually via `bun run script:cleanup-conversations` if cron unavailable
- ⚠ Inngest cron must be registered in the Inngest dashboard before the cron actually fires in production — a deployment-time step, not in scope here

---
*Phase: 06-storefront-surface*
*Completed: 2026-05-27*
