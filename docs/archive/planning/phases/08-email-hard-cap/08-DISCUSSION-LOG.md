# Phase 8: Email + Hard Cap — Discussion Log

**Date:** 2026-05-27
**Mode:** discuss (batched single-question per area)

> Human-only audit log. Downstream agents (researcher, planner, executor) read CONTEXT.md, not this file.

---

## Pre-Locked (from REQUIREMENTS.md)

These were NOT discussed because REQUIREMENTS.md already locks them:

- **NOT-03:** React Email templates live under `lib/email/templates/` → captured as **D-01**.
- **NOT-04:** Resend uses env-scoped sending domain, no per-shop verification in V1 → captured as **D-02**.
- **CAP-01:** New `RequestCounter` Prisma model with `(shop, period, requestCount)` → captured as **D-08**.
- **CAP-02:** Env-driven `HARD_CAP_REQUESTS_PER_MONTH` default `2000` → captured as **D-09**.
- **CAP-03:** Cap-reached returns HTTP 200 (not 4xx) → captured as **D-10**.

## Gray Areas Surfaced

After cross-referencing REQUIREMENTS.md (which locked 5 decisions), 4 high-value gray areas remained. All 4 were presented as a single batched AskUserQuestion turn with strong default recommendations.

### Area 1 — Email trigger location

**Question:** Where does the email send fire?

**Options presented:**
1. Inside the Inngest sync function (Recommended)
2. Webhook-style listener on SyncRun status flip
3. Polling endpoint flips status → email

**User selection:** Option 1 (Recommended) — Inside the Inngest sync function.

**Rationale captured:** Inngest already handles retries + observability; tightest coupling to the canonical sync outcome.

**Locked as:** **D-03**.

---

### Area 2 — Atomic counter increment mechanism

**Question:** How is the atomic counter increment implemented?

**Options presented:**
1. Single Postgres UPDATE with WHERE clause (Recommended)
2. SELECT then UPDATE inside a transaction
3. Advisory lock + SELECT/UPDATE

**User selection:** Option 1 (Recommended) — Single UPDATE … WHERE count < cap RETURNING.

**Rationale captured:** Atomic at the DB layer; zero-row return → graceful cap-reached path. No transaction needed.

**Locked as:** **D-11** (with explicit upsert primitive for first-of-month edge case).

---

### Area 3 — contactEmail resolution

**Question:** How is contactEmail resolved for the email send?

**Options presented:**
1. Fetch on-demand inside Inngest function via GraphQL (Recommended)
2. Cache on install / OAuth callback
3. Cache with TTL refresh

**User selection:** Option 1 (Recommended) — Fetch on-demand.

**Rationale captured:** Always fresh, no schema change. Skip the email (don't fail the sync) if contactEmail is missing.

**Locked as:** **D-05**.

---

### Area 4 — Cap-reached UI rendering

**Question:** How does the chat UI render the cap-reached response?

**Options presented:**
1. Stream an inline assistant message (Recommended)
2. Custom system banner above the thread
3. Disable input + tooltip

**User selection:** Option 1 (Recommended) — Stream inline assistant message via existing ChatMessage.

**Rationale captured:** Zero new UI component; works for both admin playground and storefront drawer.

**Locked as:** **D-13** (with **D-14** placing the cap helper at `services/chat/CapService.ts.tryConsumeRequest`).

---

## Claude's Discretion (deferred to planner)

These are implementation details the user did not need to weigh in on:

- Period derivation helper location (`lib/util/period.ts` vs inline)
- Email idempotency stamp implementation (`emailSentAt` column on `SyncRun`)
- Failure email retry-link shape (`/onboarding?retry={syncRunId}` — deep link, manual confirm)
- Email template visual / copy style (minimal transactional per D-07)
- Cap-reached message exact text (planner refines, then locks)
- `EmailService` wrapper module location (`lib/email/` vs `services/email/`)
- Whether the atomic UPDATE uses Prisma's typed API or raw SQL (`$queryRaw`)

These appear under **Claude's Discretion** in CONTEXT.md.

---

## Scope Creep Encountered

None during this discussion. The user accepted the recommendation set as-is.

Items pre-emptively redirected to **Deferred Ideas** in CONTEXT.md:

- Per-shop cap overrides (belongs to billing phase)
- Soft-cap warnings (future phase)
- Usage analytics dashboard (future phase)
- Email digests, marketing emails, A/B testing (out of V1 scope)
- Rolling 30-day cap window (V1 = calendar month UTC)
- Granular caps per request type (V1 = chat only)

---

*Phase: 8-email-hard-cap*
*Logged: 2026-05-27*
