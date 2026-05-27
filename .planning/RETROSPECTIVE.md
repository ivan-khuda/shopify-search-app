# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — SmartDiscovery AI MVP

**Shipped:** 2026-05-27
**Phases:** 9 (1–8 + gap-closure 8.1) | **Plans:** 84 | **Tests:** 425/425 passing

### What Was Built

- Multi-tenant Shopify-embedded app with secure session-token Bearer auth on admin routes and App Proxy HMAC on storefront routes
- Inngest cursor-resumable product sync pipeline with `SyncRun` state machine and onboarding progress UI
- pgvector + HNSW + GIN full-text indexes with hybrid RRF search via Vercel AI Gateway embeddings
- Shared `@/lib/chat-ui` barrel (`ChatPane`, `HistoryPanel`, `SavedProductsPanel`, DbBacked stores) consumed by both admin and storefront
- Theme App Extension with FAB + drawer; anonymous visitor identity via signed cookie with optional customer linking
- Per-shop model picker over Vercel AI Gateway catalog with banner reflecting active model
- Resend success/failure emails with `?retry={syncRunId}` deep link surfacing retry banner
- Per-shop monthly hard cap on chat requests via `CapService` (last gate before AI Gateway)

### What Worked

- **Cross-phase integration audit as a separate phase (8.1).** Per-phase verifications passed individually, but the storefront chat (the V1 core-value flow) was broken at 4 independent integration points. Inserting a dedicated gap-closure phase caught and fixed all 4 blockers. Pattern: always run `/gsd-audit-milestone` before assuming completion.
- **Parallel wave execution with worktree isolation.** Wave 1 of phase 8.1 ran 4 plans in parallel (different file scopes), cut wall time by ~75% vs sequential.
- **TDD discipline on routing/contract changes.** Phase 8.1-02 caught the wrong-endpoint test that was *reinforcing* the bug — RED test pinned the correct contract before the fix.
- **`gsd-sdk milestone.complete` + audit-open as a pre-flight gate** prevented losing in-flight debug sessions during milestone close.
- **Empirical curl probes over speculation** (Phase 8.1-01) — the audit thought `proxy.ts` wasn't auto-registered; a single curl confirmed Next.js 16.1.6 auto-registers it, downgrading a "rename file" plan to a "one-line matcher" fix.

### What Was Inefficient

- **Bundle-size regression not caught earlier.** Phase 6 set a 250KB cap when StorefrontDrawer was placeholder JSX (197KB). Phase 8.1-03 wired real components and blew the cap to 1420KB. The `bundle-build.test.ts` was a known-skip RED scaffold in Phase 6 that never moved to GREEN; the budget should have been measured against real composition, not the placeholder.
- **CWD-drift during parallel execution.** Worktree merges leaked an untracked SUMMARY.md into the wrong worktree, blocking `gsd-tools worktree cleanup-wave`. Required manual fall-through to `git merge` in the primary worktree.
- **Orphaned commit during wave 3 merge.** A background hook (or executor cwd-drift) committed REQUIREMENTS/STATE/ROADMAP changes directly to the trunk while the worktree branch was still pending merge, causing a merge conflict that required cherry-picking the worktree-only commits (VALIDATION flips, VERIFICATION.md, SUMMARY.md).
- **`human_verify_mode: end-of-phase` deferred 7+ smokes.** Phases 4, 7, 8, and 8.1 each pushed live-environment validation downstream. v1.1 should batch them into a single live-deploy validation phase.
- **Per-phase audit blind spots.** Each phase's VERIFICATION.md said `passed` while the cross-phase chat flow was broken at 4 points — the verifier reads phase artifacts and doesn't know storefront chat depends on Phase 6's drawer composition matching Phase 5's barrel exports matching Phase 4's adapter endpoints.

### Patterns Established

- **Milestone audit as a hard gate.** Don't run `/gsd-complete-milestone` until `/gsd-audit-milestone` reports `passed`. If gaps found, insert a closure phase (`/gsd-phase --insert N.1`) before close.
- **Decimal phases (X.Y) for gap closure.** Pattern: 8 → 8.1 keeps milestone version stable while threading audit-driven fixes through the standard discuss → plan → execute chain.
- **Worktree isolation + sequential dispatch** for parallel waves. `Agent(run_in_background: true)` one at a time, then await all → `git merge --no-ff` each worktree branch from the primary.
- **Empirical-probe-first audits.** Before believing "X is broken because we changed it last week," try the actual operation (curl, console, repl) — assumptions about platform behavior decay fast.
- **`StorefrontAdapter` + `AdminAdapter` pattern.** Surface-specific data plumbing isolated behind a common interface — admin uses `useChat` directly, storefront uses `useChat` via adapter that hits App Proxy.

### Key Lessons

1. **Budget caps set against placeholders are noise.** If a `bundle-build.test.ts > size < N KB` test was added when the component was a placeholder, the cap is a wish, not a budget. Measure once the real implementation lands, then set the cap.
2. **Per-phase verification is necessary but not sufficient.** Phases pass in isolation; user-facing flows fail at integration points. Always run a milestone-level integration audit before claiming done.
3. **Worktree CWD drift is a real failure mode.** Orchestrator + multiple worktrees + manual `cd` operations can land commits or untracked files in unexpected places. Pin orchestrator to primary worktree path between agent dispatches.
4. **Background-hook commits + parallel worktree merges can race.** If an executor agent's commit hook propagates changes to shared tracking files (STATE.md, ROADMAP.md) outside its own worktree branch, the parent worktree's merge can conflict. Either disable hooks during waves or ensure all tracking writes happen in the orchestrator.
5. **`autonomous: false` on a checkpoint plan means the wave needs an inline human-handler.** Don't dispatch a checkpoint plan to a background agent and expect a `keep going` to substitute for the human-verify response.
6. **Deferred smokes accumulate quickly under `human_verify_mode: end-of-phase`.** Consider switching to mid-phase mode for any phase that touches platform-external behavior (real Shopify install, real email delivery, real domain probes).
7. **The "first finding for v1.1" comes from v1.0's audit, not v1.1's research.** Cap the v1.0 close by enumerating known v1.1 candidates in MILESTONES.md and PROJECT.md.

### Cost Observations

- Model mix during v1.0 close phase: ~100% sonnet (executor + verifier) + sonnet orchestrator
- Sessions for 8.1: 1 (this one)
- Notable: parallel worktree execution amortized 4-plan wave 1 down to ~6 minutes wall-clock vs ~24 minutes sequential

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | many (across multiple weeks) | 9 (1–8 + 8.1) | Established gap-closure phase pattern (8 → 8.1); validated milestone-audit-as-gate |

### Cumulative Quality

| Milestone | Tests | Coverage | LOC |
|-----------|-------|----------|-----|
| v1.0 | 425 passing | (not measured this milestone) | 26,200 TypeScript |

### Top Lessons (Verified Across Milestones)

1. (Add cross-milestone-verified lessons as v1.1+ ship.)
