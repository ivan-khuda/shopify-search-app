# Phase 8: Email + Hard Cap - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Two independent but co-shipped capabilities for V1 launch safety:

1. **Sync completion notifications** — every Inngest sync run that succeeds OR fails sends a Resend transactional email to the shop owner's `contactEmail`, using React Email templates stored at `lib/email/templates/`. Success emails include product count + admin link; failure emails include the failure reason + a retry deep-link to `/onboarding`.

2. **Per-shop monthly chat request cap** — every chat request through `/api/chat` (admin playground) and `/api/proxy/chat` (storefront) atomically increments a `RequestCounter` row keyed by `(shop, period)` where `period` is the current `YYYY-MM` UTC string. When the increment would exceed `HARD_CAP_REQUESTS_PER_MONTH` (env-driven, default 2000), the request returns HTTP 200 with a streamed assistant message — the chat UI renders it through the existing `ChatMessage` component, no new UI surface required.

**In scope:** Resend client init, React Email templates (success + failure), `EmailService` wrapper, sync-function step that fetches `shop { contactEmail }` GraphQL and sends the email with `emailSentAt` idempotency stamp on `SyncRun`, `RequestCounter` Prisma model, atomic increment via single `UPDATE … WHERE count < cap RETURNING` (with upsert for first request of the month), cap-check helper consumed by both chat routes, streamed "limit reached" assistant message.

**Out of scope:** Per-shop cap overrides (uniform via env in V1 per CLAUDE.md), billing / subscription tiers, opt-out for transactional emails (transactional ≠ marketing per CAN-SPAM), per-shop sending-domain verification (NOT-04 LOCKED — env-scoped domain), email template theming per shop, usage analytics dashboard, soft-cap warnings before hard cap, email digests / weekly summaries, multi-recipient email lists, deferred-send queues, A/B testing of email copy.

</domain>

<decisions>
## Implementation Decisions

### Notifications

- **D-01 (LOCKED in REQUIREMENTS.md NOT-03):** React Email components live under `lib/email/templates/` — one file per template (`SyncSuccessEmail.tsx`, `SyncFailureEmail.tsx`).
- **D-02 (LOCKED in REQUIREMENTS.md NOT-04):** Resend send respects environment-scoped sending domain (one verified domain across all shops, no per-shop domain verification in V1).
- **D-03:** **Email send fires inside the Inngest sync function.** Add a step after the upsert wave completes (success branch) or in the terminal `onFailure` handler (failure branch). Inngest already handles retries + observability; this keeps the email tightly coupled to the canonical sync outcome.
- **D-04:** **Email idempotency via `emailSentAt` on `SyncRun`** (additive Prisma column, nullable `DateTime`). The Inngest email step checks `if (run.emailSentAt) return;` before sending, then sets it via `UPDATE sync_run SET email_sent_at = NOW() WHERE id = $1 AND email_sent_at IS NULL` after a successful Resend send. Combined with Inngest's built-in step-level idempotency, this is defense in depth against double-sends across retries / cold restarts.
- **D-05:** **`contactEmail` fetched on-demand inside the Inngest function** via Shopify Admin GraphQL `query { shop { contactEmail } }`. Always-fresh, no schema change. If the field is missing/null, log the omission (without secrets) and **skip the email — do NOT fail the sync** (notifications are auxiliary; the sync result is the contract).
- **D-06:** **Failure email retry link → `/onboarding?retry={syncRunId}`.** Deep link surfaces a pre-filled "Retry sync" affordance on the existing onboarding page (Phase 2 already has the Start sync button). The merchant must click to actually re-trigger — no auto-retry — to avoid accidental double-syncs.
- **D-07:** **Minimal transactional template style.** Success: subject `Catalog sync complete — {productCount} products`, body = product count + "View in admin" button. Failure: subject `Catalog sync failed`, body = one-line failure reason + retry button. No marketing copy, no detailed stats breakdown, no embedded images beyond an inline SmartDiscovery wordmark.

### Hard Cap

- **D-08 (LOCKED in REQUIREMENTS.md CAP-01):** New `RequestCounter` Prisma model with `shop`, `period` (YYYY-MM string), `requestCount` (Int), `updatedAt`. Composite primary key `@@id([shop, period])` so each (shop, period) is a single row.
- **D-09 (LOCKED in REQUIREMENTS.md CAP-02):** Cap is env-driven via `HARD_CAP_REQUESTS_PER_MONTH` (default `2000`). Uniform across all shops in V1; per-shop overrides deferred to a future phase.
- **D-10 (LOCKED in REQUIREMENTS.md CAP-03):** Cap-reached path returns HTTP **200** (not 4xx) so the chat UI handles it as a normal response, not an error.
- **D-11:** **Atomic increment via single Postgres `UPDATE … WHERE … RETURNING`.**
  ```sql
  UPDATE request_counter
     SET request_count = request_count + 1, updated_at = NOW()
   WHERE shop = $1 AND period = $2 AND request_count < $cap
  RETURNING request_count;
  ```
  Zero rows returned → cap reached → graceful 200 path. One row returned → request proceeds. Wrap in an upsert primitive for the first request of a new period: if `UPDATE` returns zero rows AND a row for `(shop, period)` does not yet exist, `INSERT ... ON CONFLICT (shop, period) DO UPDATE SET request_count = request_count + 1 WHERE request_counter.request_count < $cap RETURNING request_count`. This collapses the "first request of the month" case into the same atomic primitive without a SELECT round-trip.
- **D-12:** **Period = `YYYY-MM` string in UTC.** Calendar-month reset (1st of month UTC). Simple, predictable, and easy to communicate to merchants ("resets on the 1st"). No rolling-window complexity in V1.
- **D-13:** **Cap-reached UI = streamed inline assistant message.** Server returns `streamText`-compatible stream with a fixed assistant message: `"You've reached this month's message limit. It resets on the 1st of the month. To raise your limit, contact support."` (exact copy refined in implementation). Renders through the existing `ChatMessage` component — zero new UI in `lib/chat-ui/`, identical behavior across admin playground and storefront drawer.
- **D-14:** **Check-and-increment is co-located in a single helper.** New `services/chat/CapService.ts` exposes `tryConsumeRequest(shop): Promise<{ allowed: true } | { allowed: false }>`. Both `/api/chat` and `/api/proxy/chat` call this helper as the first action after auth/session resolution and before reaching the AI Gateway. On `allowed: false`, route returns the streamed graceful message; on `allowed: true`, normal flow proceeds.

### Claude's Discretion

- Exact React Email template HTML / styling (typography, padding, color tokens) — planner picks; match SmartDiscovery brand if a brand color is in use elsewhere, else neutral system fonts.
- `EmailService` wrapper module location (`lib/email/client.ts` vs `services/email/EmailService.ts`) — planner picks; whichever matches existing `services/` vs `lib/` conventions in the repo.
- Whether `tryConsumeRequest` uses Prisma's raw SQL escape hatch (`$queryRaw`) for the atomic UPDATE or relies on Prisma's `update`/`upsert` (which generates equivalent SQL but may have edge cases with the `WHERE count < cap` predicate) — planner verifies the equivalence; raw SQL is fine if Prisma can't express the predicate cleanly.
- Whether the cap-reached message text lives as a constant in `CapService.ts` or in a small `messages.ts` module — planner picks based on whether other system messages exist.
- Subject line exact copy and brand voice in the React Email templates — planner picks within the minimal-transactional constraint of D-07.
- `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` env vars naming — follow CLAUDE.md conventions; default `noreply@<sending-domain>` if no explicit address requested.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 8 source-of-truth
- `.planning/ROADMAP.md` — Phase 8 section: goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — NOT-01..04, CAP-01..03 (D-01, D-02, D-08, D-09, D-10 are LOCKED here)

### Phase 2 contract anchors (LOCKED)
- `lib/inngest/client.ts` — Inngest client singleton; email step joins this existing function graph
- `lib/sync/productSync.ts` (or wherever Phase 2 placed it) — the Inngest sync function — the email step is appended here
- `prisma/schema.prisma` — `SyncRun` model (add nullable `emailSentAt DateTime?` column); pattern reference for `RequestCounter` model
- `services/shopify/ShopifyProductService.ts` — GraphQL pattern reference for the new `shop { contactEmail }` query

### Phase 4 / 6 contract anchors (cap consumers)
- `app/api/chat/route.ts` — admin playground entry; first call after `withShopifySession` becomes `tryConsumeRequest`
- `app/api/proxy/chat/route.ts` — storefront entry; first call after App Proxy HMAC verification becomes `tryConsumeRequest`
- `services/chat/getActiveChatModel.ts` — pattern reference for a thin per-request resolver consumed by both chat routes; mirror its style for `tryConsumeRequest`

### Phase 7 contract anchor (pattern reference)
- `lib/db/repositories/ShopSettingsRepository.ts` — singleton-per-shop repository pattern; `RequestCounterRepository` mirrors this structure (typed `findUnique` + atomic primitive method)
- `prisma/migrations/20260527161654_add_shop_settings/migration.sql` — non-destructive migration pattern for the Prisma 7 + manual-indexes drift workaround (see Phase 7 STATE.md note); Phase 8 must apply the same Option A pattern (`prisma db execute` + `prisma migrate resolve --applied`) if `migrate dev` flags drift again

### Project-level constraints
- `CLAUDE.md` § Constraints — Email provider is Resend with React Email templates (LOCKED)
- `CLAUDE.md` § Constraints — Hard cap enforced server-side until billing ships (this phase IS that enforcement)
- `CLAUDE.md` § Constraints — Vercel AI Gateway is SOLE chat runtime (the cap check is the new gatekeeper between auth and the gateway call)
- `CLAUDE.md` § Constraints — bun-only, TypeScript strict, no `console.*` in shipped code
- `CLAUDE.md` § Constraints — No secrets, no session tokens, no auth headers in logs (the email step must not log `contactEmail` or the Resend API key)

### Patterns to mirror
- `lib/shopify/auth.ts` — `withShopifySession` wrapper (admin route auth)
- `app/api/proxy/chat/route.ts` — App Proxy HMAC verification pattern (storefront route auth)
- `lib/db/repositories/ProductRepository.ts` / `lib/db/repositories/ShopSettingsRepository.ts` — Prisma repository class shape
- React Email docs — `https://react.email/docs/introduction` (researcher fetches fresh): component primitives + send integration with Resend

### Resend & React Email
- `https://resend.com/docs/api-reference/emails/send-email` (researcher fetches fresh): API surface, auth header, idempotency-key header support
- `https://react.email/docs/introduction` (researcher fetches fresh): template authoring, `render()` to HTML for Resend payload

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Inngest function (Phase 2):** Append a `step.run('send-completion-email', ...)` on success and a separate `step.run('send-failure-email', ...)` in `onFailure`. Inngest's step-level idempotency is the first line of defense against double-sends; `SyncRun.emailSentAt` is the second.
- **`SyncRun` model (Phase 2):** Add nullable `emailSentAt DateTime?` column. Migration uses Phase 7's non-destructive Option A pattern (see Canonical Refs).
- **`ShopifyProductService.ts` (Phase 2):** GraphQL plumbing already initialized; the `shop { contactEmail }` query is one more line on the existing Admin GraphQL client.
- **`withShopifySession` wrapper (Phase 1):** Admin chat route auth — `tryConsumeRequest(ctx.shop)` slots in as the first call.
- **App Proxy HMAC verification (Phase 6):** Storefront chat route auth — `tryConsumeRequest(shop)` slots in after HMAC verification, before forwarding to `streamText`.
- **`ChatMessage` component (`lib/chat-ui/`):** Renders streamed assistant messages — the cap-reached message uses this with zero changes.
- **Prisma singleton (`lib/db/client.ts`):** Standard DB access; `RequestCounter` queries route through this.

### Established Patterns
- **Multi-tenancy lock:** Every Prisma query filters by `shop`. `RequestCounter`'s composite PK `(shop, period)` makes the shop filter structurally implicit.
- **Bearer / HMAC route auth split:** Admin = Bearer session token via `withShopifySession`. Storefront = App Proxy HMAC. Both routes derive `shop` from their respective auth layer — never trust body/query.
- **No `console.*` in production paths:** CLAUDE.md hard constraint applies to the new email service + cap service. Use structured error objects.
- **Repository pattern for new singleton-per-shop tables:** `lib/db/repositories/{Model}Repository.ts` with typed methods. `RequestCounterRepository.tryConsume(shop, period, cap)` is the canonical entry.

### Integration Points
- **Email step injection:** Phase 2's Inngest function is extended in two places — after the final upsert step (success → `step.run('send-success-email', ...)`) and inside the function's `onFailure` handler (failure → `step.run('send-failure-email', ...)`). Both steps:
  1. Reload `SyncRun` row.
  2. Skip if `emailSentAt` is non-null.
  3. Fetch `shop { contactEmail }` via GraphQL — if missing, log + return.
  4. `render()` the React Email template to HTML.
  5. Call `EmailService.send({ to, subject, html })`.
  6. On 2xx: `UPDATE sync_run SET email_sent_at = NOW() WHERE id = ? AND email_sent_at IS NULL`.
- **Cap check injection:** `tryConsumeRequest(shop)` is invoked once per chat request, immediately after auth resolves the shop and before any AI Gateway call. The function is a thin wrapper over `RequestCounterRepository.tryConsume(shop, currentPeriod, cap)` which performs the atomic UPDATE/upsert in one statement.
- **Cap-reached response shape:** Same `streamText`-compatible UI message stream as the normal path. The route returns `result.toUIMessageStreamResponse()` where `result` is constructed via a small helper that synthesizes the "limit reached" assistant message as a single chunk. Routes do not branch their return shape — only the message content differs.
- **Period derivation:** A `lib/util/period.ts` (or inline helper) returns `YYYY-MM` from `new Date().toISOString().slice(0, 7)`. Pure, testable, no timezone library.

</code_context>

<specifics>
## Specific Ideas

- The 4 ROADMAP success criteria are the test contract. SC1 + SC2 → email step coverage (success + failure paths, idempotency, contactEmail-missing branch). SC3 → cap helper + both chat routes integration tests. SC4 → atomic increment unit test using concurrent calls against a real Postgres or a transactional Vitest setup.
- Phase 7's non-destructive Option A migration pattern (`prisma db execute` + `prisma migrate resolve --applied`) is the default expectation if `prisma migrate dev` flags Prisma-7 drift on the manual HNSW/GIN indexes. Document this in the migration plan upfront.
- The cap-reached message text doubles as user-facing copy — invest a single iteration on it during planning, then lock it.

</specifics>

<deferred>
## Deferred Ideas

- **Per-shop cap overrides** — granular limits per merchant (e.g., enterprise tier). Belongs to a billing phase.
- **Soft-cap warnings** — "You've used 80% of your monthly messages" email at threshold. Future phase.
- **Usage analytics dashboard** — `/settings/usage` page showing daily/monthly request graphs. Future phase.
- **Email digests / weekly summaries** — periodic aggregated emails (e.g., "5 syncs this week"). Future phase.
- **Marketing emails** — onboarding tips, product announcements. Out of scope for transactional service; would require subscribe/unsubscribe plumbing.
- **Per-shop sending-domain verification** — NOT-04 explicitly defers this. V1 uses one env-scoped domain.
- **Multi-recipient email lists** — sending to a list of admins instead of just `contactEmail`. Future phase.
- **A/B testing of email copy / templates** — future iteration.
- **Resend webhook listener for delivery/bounce events** — observability addition; future phase.
- **Rolling 30-day cap window** — V1 uses calendar month UTC. Could revisit if merchants find the 1st-of-month reset jarring.
- **Granular cap by request type** — separate caps for chat vs embedding refreshes vs sync triggers. V1 caps chat only.

</deferred>

---

*Phase: 8-email-hard-cap*
*Context gathered: 2026-05-27*
