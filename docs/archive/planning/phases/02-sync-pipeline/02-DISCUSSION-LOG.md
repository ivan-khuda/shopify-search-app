# Phase 2: Sync Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 2-Sync Pipeline
**Areas discussed:** Inngest workflow shape & batch size, Webhook model, Status polling auth & performance, Onboarding progress UX + completion state

---

## Inngest Workflow Shape

| Option | Description | Selected |
|--------|-------------|----------|
| One step.run per batch with cursor persist | Inngest function loops while cursor exists; each batch wrapped in `step.run('fetch-batch')` → `step.run('upsert-batch')` → `step.run('persist-cursor')`. Memoized; resumes after Vercel timeout from last unfinished step. | ✓ |
| Single function with internal cursor loop | One function does full pagination in a single invocation. Simpler but loses Inngest's main resumability benefit. | |
| step.run per product (not batch) | Maximum retry control but 5k step.run = expensive overhead and Inngest quota concern. Overkill for 5k SKU. | |

**User's choice:** One step.run per batch with cursor persist (re-confirmed after one-line follow-up).
**Notes:** Step IDs must be deterministic — `fetch-batch-${cursor}` — to preserve memoization across replays.

| Option | Description | Selected |
|--------|-------------|----------|
| 100 products per batch | Shopify GraphQL supports `first: 250` max, but nested variants/images multiply cost. 100 = ~50 step cycles for 5k catalog. | ✓ |
| 50 products per batch | Safer for shops with many variants/images; ~100 step cycles. | |
| 250 products per batch | Fewest step calls (~20); risk of GraphQL query-cost throttling. | |

**User's choice:** 100 products per batch.

---

## Webhook Model

| Option | Description | Selected |
|--------|-------------|----------|
| Inline: HMAC → dedup → direct ProductRepository call | Webhook route does HMAC verify, checks WebhookEvent for X-Shopify-Event-Id, calls upsertProduct/deleteProduct directly. Returns 200 only after DB write. | ✓ |
| Inngest event: HMAC → emit → step.function processes | Webhook returns 200 fast (<100ms); separate step.function does dedup + upsert with retries. Adds complexity. | |
| Inngest event + dead-letter table | Like (2) + WebhookEventFailed table for manual replay. Overkill V1. | |

**User's choice:** Inline HMAC → dedup → ProductRepository.
**Notes:** Shopify retries on 4xx/5xx, so transient failures get re-delivered. No Inngest indirection needed for V1.

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma WebhookEvent table | New model with `eventId @id`; insert + catch unique violation = duplicate. Persistent, audit trail. | ✓ |
| Redis SET with TTL | Faster but requires Upstash/Redis infra not in V1 stack. | |
| In-memory Map (per-instance) | 0 infra but breaks across cold starts and parallel instances. Unsafe. | |

**User's choice:** Prisma WebhookEvent table.
**Notes:** Cleanup of old rows deferred — table grows monotonically; add a 30-day Inngest cron in a later phase.

---

## Status Polling Auth & Performance

| Option | Description | Selected |
|--------|-------------|----------|
| Full withShopifySession (like sync POST) | Consistent with rest of embedded API. Each 2s poll = 1 DB query for session + 1 for SyncRun. | ✓ |
| Lightweight: verifyToken only (no session load) | New variant `verifyToken(req)` returning `{shop}` without DB hit. Better polling perf but adds second auth path. | |
| Adaptive client-side polling | Full wrapper + UI throttles interval based on state. Reduces QPS without code-path duplication. | |

**User's choice:** Full withShopifySession.
**Notes:** Polling at 2s constant; revisit if profiling shows the session-load DB hit is the bottleneck.

---

## Onboarding Progress UX

| Option | Description | Selected |
|--------|-------------|----------|
| Percent + 'X / Y products' + state label | `<s-progress-bar>` + text "142 / 3500 products synced (4%)" + state badge. Matches ROADMAP success criterion #2. | ✓ |
| Counter only | "Synced 142 products..." without progress bar. Simpler but blocks the SC. | |
| Skeleton/spinner without numbers | Indeterminate progress. Blocks SC outright. | |

**User's choice:** Percent + counter + state label.

| Option | Description | Selected |
|--------|-------------|----------|
| Banner with product count + CTA "Open admin chat" | "Your store is ready — N products synced" + primary CTA to /chat. Failed/partial: banner + Retry CTA. | ✓ |
| Lite banner without navigation | "Sync complete" + sync button disappears. No nav. | |
| Detailed summary + error list + history link | Rich completion summary; "View sync history" link. Sync history UI = scope creep V1. | |

**User's choice:** Banner with product count + CTA "Open admin chat".

---

## Claude's Discretion

- Inngest function name (recommend `shopify/product.sync`; final id is implementer's call).
- Whether to add `RetryConfig` to the Inngest function — default exponential backoff is fine for V1.
- Test mocking strategy for Inngest — prefer `@inngest/test` if available; otherwise stub `step.run` to invoke its callback inline.
- `SyncRun.errors[]` shape: `String[]` vs `Json[]` — `Json[]` richer; `String[]` simpler. Interface (one error per failed product) is locked.
- Whether webhook handler should write a `SyncRun` audit entry — V1 says no.

## Deferred Ideas

- Bulk Operations API (revisit at 50k+ catalogs).
- Resend completion email (Phase 8 owns this).
- Sync history view in admin (V1.x at earliest).
- WebhookEvent table cleanup cron (later phase).
- Adaptive client-side polling (revisit if QPS pressure).
- Fast-path `verifyToken` without DB hit (carried over from Phase 1; same trigger).
- SSE real-time progress (rejected V1 — adds Vercel pinning complexity).
- Per-product `step.run` retry (overkill for 5k).
- Webhook → Inngest event indirection (deliberately rejected V1).
- Webhook-triggered SyncRun row for audit (Claude's Discretion).
- Inngest dead-letter dashboard (Inngest provides at higher tiers).
- GraphQL query cost monitoring (V1 logs only in errors[]).
