# Plan 02-10 Summary

**Status:** complete
**Wave:** 6
**Requirements:** SYN-09, ADM-01, ADM-02

## What shipped

`app/(embedded)/onboarding/page.tsx` rewritten (~160 lines from 66) with the Phase 2 state machine:

**State additions** (5 new useState hooks):
- `syncRunId: string | null`
- `syncState: 'queued'|'running'|'succeeded'|'partial'|'failed'|null`
- `processedCount: number`
- `totalCount: number | null`
- `errors: string[]`

**handleStartSync rewritten:**
- Auto-clears prior terminal state for retry flow (Retry CTA → starts fresh)
- On 2xx POST: reads `{syncRunId}` from response, transitions to `queued`, resets counters
- Auth 401 / generic error toasts preserved

**Polling useEffect (D-13):**
- 2000ms constant interval (no exponential backoff in V1)
- Polls `/api/shopify/sync/status?syncRunId=…` with Bearer auth
- Updates state, processedCount, totalCount, errors from response
- Stops on terminal states (`succeeded | partial | failed`) — useEffect dep `syncState` triggers cleanup
- Swallows network errors so next tick retries (transient)

**Render branches (D-14):**
- `syncRunId === null` → original "Start sync" button (unchanged)
- Otherwise → progress view: `<s-progress-bar value={progressPercent}>`, counter `"X / Y products (P%)"` or fallback `"X products synced so far"`, state badge
- `state === 'succeeded'` → `<s-banner tone="success">…N products synced</s-banner>` + `<s-button href="/chat">Open admin chat</s-button>`
- `state === 'partial'` → `<s-banner tone="warning">N synced, K failed</s-banner>` + Retry CTA
- `state === 'failed'` → `<s-banner tone="critical">Sync failed</s-banner>` + Retry CTA

Test extensions:
- 4 new Phase 2 tests in `app/(embedded)/__tests__/onboarding.test.tsx`:
  - Progress bar + counter + state badge during `state=running`
  - Success banner + "Open admin chat" CTA → `/chat`
  - Warning banner + Retry CTA on partial
  - Critical banner + Retry CTA on failed
- Existing 7 tests preserved (with one mock update: default `fetchMock` now includes `json: () => ({syncRunId})` so the rewritten `await res.json()` chain works)

## Verification

- `bunx vitest run "app/(embedded)/__tests__/onboarding.test.tsx"` → 11/11 GREEN
- `bun run test` → **15 files, 95 GREEN, 0 SKIPPED** (all Wave-0 RED markers are now resolved)
- `bunx tsc --noEmit` clean for Phase 2 surface

## Notes

- Fake-timer-based tests for polling cadence didn't reliably advance the async chain inside `setInterval` (idToken → fetch → json → setState). Switched to real timers with `waitFor({timeout: 5000})` — the 2s polling tick is fast enough to verify state propagation within the timeout. The tests run in ~6s total.
- `<s-banner>` and other Polaris web components are loaded by `EmbeddedProviders` in Phase 1 — no setup needed here.
- The polling DOES NOT stop when the network temporarily fails. Each tick attempts a fresh fetch; only a terminal-state response stops the interval. This matches the "polling is the heartbeat; the server is the source of truth" design.

## Handoff

- Plan 02-11 verifies the end-to-end flow against the live Inngest + Postgres dev environment
- The completion banner's "Open admin chat" CTA points at `/chat` (admin playground) — Phase 4 wires the playground to real search results; Phase 2 just provides the entry-point CTA
- If profiling later shows the 2s polling QPS is too aggressive, the deferred "adaptive polling" idea from CONTEXT.md kicks in
