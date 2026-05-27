# Phase 8: Email + Hard Cap - Research

**Researched:** 2026-05-27
**Domain:** Transactional email (Resend + React Email) + atomic per-shop request counter (Prisma/Postgres) embedded into existing Inngest sync function and AI SDK v6 chat routes.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notifications**
- **D-01 (LOCKED in REQUIREMENTS.md NOT-03):** React Email components live under `lib/email/templates/` — one file per template (`SyncSuccessEmail.tsx`, `SyncFailureEmail.tsx`).
- **D-02 (LOCKED in REQUIREMENTS.md NOT-04):** Resend send respects environment-scoped sending domain (one verified domain across all shops, no per-shop domain verification in V1).
- **D-03:** Email send fires inside the Inngest sync function. Add a step after the upsert wave completes (success branch) or in the terminal `onFailure` handler (failure branch). Inngest already handles retries + observability; this keeps the email tightly coupled to the canonical sync outcome.
- **D-04:** Email idempotency via `emailSentAt` on `SyncRun` (additive Prisma column, nullable `DateTime`). The Inngest email step checks `if (run.emailSentAt) return;` before sending, then sets it via `UPDATE sync_run SET email_sent_at = NOW() WHERE id = $1 AND email_sent_at IS NULL` after a successful Resend send. Combined with Inngest's built-in step-level idempotency, this is defense in depth against double-sends across retries / cold restarts.
- **D-05:** `contactEmail` fetched on-demand inside the Inngest function via Shopify Admin GraphQL `query { shop { contactEmail } }`. Always-fresh, no schema change. If the field is missing/null, log the omission (without secrets) and **skip the email — do NOT fail the sync** (notifications are auxiliary; the sync result is the contract).
- **D-06:** Failure email retry link → `/onboarding?retry={syncRunId}`. Deep link surfaces a pre-filled "Retry sync" affordance on the existing onboarding page (Phase 2 already has the Start sync button). The merchant must click to actually re-trigger — no auto-retry — to avoid accidental double-syncs.
- **D-07:** Minimal transactional template style. Success: subject `Catalog sync complete — {productCount} products`, body = product count + "View in admin" button. Failure: subject `Catalog sync failed`, body = one-line failure reason + retry button. No marketing copy, no detailed stats breakdown, no embedded images beyond an inline SmartDiscovery wordmark.

**Hard Cap**
- **D-08 (LOCKED in REQUIREMENTS.md CAP-01):** New `RequestCounter` Prisma model with `shop`, `period` (YYYY-MM string), `requestCount` (Int), `updatedAt`. Composite primary key `@@id([shop, period])` so each (shop, period) is a single row.
- **D-09 (LOCKED in REQUIREMENTS.md CAP-02):** Cap is env-driven via `HARD_CAP_REQUESTS_PER_MONTH` (default `2000`). Uniform across all shops in V1; per-shop overrides deferred to a future phase.
- **D-10 (LOCKED in REQUIREMENTS.md CAP-03):** Cap-reached path returns HTTP 200 (not 4xx) so the chat UI handles it as a normal response, not an error.
- **D-11:** Atomic increment via single Postgres `UPDATE … WHERE … RETURNING`, falling back to `INSERT ... ON CONFLICT (shop, period) DO UPDATE SET request_count = request_count + 1 WHERE request_counter.request_count < $cap RETURNING request_count` for first-of-month.
- **D-12:** Period = `YYYY-MM` string in UTC. Calendar-month reset (1st of month UTC).
- **D-13:** Cap-reached UI = streamed inline assistant message. Server returns `streamText`-compatible stream with a fixed message that renders through the existing `ChatMessage`. Zero new UI.
- **D-14:** Check-and-increment co-located in `services/chat/CapService.ts` exposing `tryConsumeRequest(shop): Promise<{ allowed: true } | { allowed: false }>`. Both `/api/chat` and `/api/proxy/chat` call this helper first.

### Claude's Discretion
- Exact React Email template HTML / styling — planner picks; match SmartDiscovery brand if a brand color exists elsewhere, else neutral system fonts.
- `EmailService` wrapper module location (`lib/email/client.ts` vs `services/email/EmailService.ts`) — planner picks; match existing `services/` vs `lib/` conventions.
- Whether `tryConsumeRequest` uses Prisma's raw SQL escape hatch (`$queryRaw`) or `update`/`upsert` — researcher recommendation below.
- Whether the cap-reached message text lives as a constant in `CapService.ts` or in a small `messages.ts` module — planner picks based on whether other system messages exist.
- Subject line exact copy and brand voice in React Email templates — planner picks within D-07 minimal-transactional constraint.
- `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` env var naming — follow CLAUDE.md conventions; default `noreply@<sending-domain>`.

### Deferred Ideas (OUT OF SCOPE)
- Per-shop cap overrides — belongs to billing phase.
- Soft-cap warnings (80% threshold email) — future phase.
- Usage analytics dashboard at `/settings/usage` — future phase.
- Email digests / weekly summaries — future phase.
- Marketing emails / subscribe-unsubscribe plumbing — out of scope (transactional only).
- Per-shop sending-domain verification — NOT-04 defers this.
- Multi-recipient email lists — future phase.
- A/B testing of email copy / templates — future iteration.
- Resend webhook listener for delivery/bounce events — future observability addition.
- Rolling 30-day cap window — V1 uses calendar month UTC.
- Granular caps per request type (chat vs embedding vs sync) — V1 caps chat only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOT-01 | Successful sync sends a Resend email to `shop.contactEmail` (Shopify GraphQL) with product count + admin link | §Standard Stack: `resend` v6.12.4 + `@react-email/components` v1.0.12; §Architecture Patterns: Email step inside Inngest function; §Code Examples: success template + send call |
| NOT-02 | Failed sync sends a Resend email with failure reason and retry link | §Architecture Patterns: `onFailure` handler in `inngest.createFunction` supports `step.run` for idempotent send; §Code Examples: failure template |
| NOT-03 | Email templates are React Email components stored under `lib/email/templates/` | §Standard Stack: `@react-email/components` + `@react-email/render`; §Code Examples: template structure |
| NOT-04 | Env-scoped sending domain, no per-shop verification | §Standard Stack: single `RESEND_FROM_ADDRESS` env var; §Architecture Patterns: stateless EmailService init |
| CAP-01 | `RequestCounter` Prisma model (shop, period, requestCount, updatedAt; composite PK) | §Architecture Patterns: schema delta; §Code Examples: Prisma model |
| CAP-02 | Configurable env-driven monthly cap (`HARD_CAP_REQUESTS_PER_MONTH=2000`) checked before each chat completion | §Architecture Patterns: `tryConsumeRequest` helper invoked before AI Gateway call; §Code Examples: atomic SQL |
| CAP-03 | Cap-reached returns HTTP 200 with graceful streamed message | §Code Examples: `createUIMessageStream` static-text path returning `createUIMessageStreamResponse` |
</phase_requirements>

## Summary

Phase 8 wires two independent capabilities that are both pure additions to existing surfaces: (1) an email step injected into the Phase 2 Inngest sync function (success branch + `onFailure` branch), and (2) a `tryConsumeRequest(shop)` cap check inserted at the top of both chat routes (admin + storefront) before any AI Gateway call. Every needed library is well-established and on stable major versions: `resend` (v6.12.4, owned by Resend, 8+ years on npm), `@react-email/components` (v1.0.12, same vendor), and `@react-email/render` (v2.0.8). The atomic counter primitive is a textbook Postgres `INSERT … ON CONFLICT (shop, period) DO UPDATE … WHERE … RETURNING` invoked through Prisma's `$queryRaw` tagged template (typed-API `update`/`upsert` cannot express the `WHERE count < cap` predicate).

The two non-obvious risks are (1) **Prisma 7 + manual-indexes drift** — Phase 7 hit this and resolved it via "Option A" non-destructive migration (`prisma db execute` + `prisma migrate resolve --applied`). Phase 8 must reuse that exact pattern when adding the `RequestCounter` table and the nullable `SyncRun.emailSentAt` column. (2) **AI SDK v6 cap-reached stream synthesis** — bypassing `streamText` is required because `streamText` always calls a model. Use `createUIMessageStream` + `createUIMessageStreamResponse` to emit `text-start`/`text-delta`/`text-end` chunks as a single synthetic assistant message. This is a documented v6 API, not a workaround.

**Primary recommendation:** Wave 0 RED test scaffolds → schema delta (Option A migration) → `EmailService` + `RequestCounterRepository` → React Email templates → CapService helper → inject into Inngest function + both chat routes → Phase 8 verification gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resend SDK client init + send | API / Backend (Node-only `services/email/`) | — | Resend SDK requires API key; must never load in browser bundle |
| React Email template authoring | Build-time / Server (`lib/email/templates/`) | — | Templates compile to HTML at send-time via `render()`; never shipped to client |
| `EmailService.send` wrapper | Service layer (`services/email/EmailService.ts`) | — | Mirrors `ShopifyProductService` / `EmbeddingService` patterns |
| Sync-completion email send step | Inngest function (`inngest/functions/sync-products.ts`) | Email Service (callee) | Step.run gives idempotency + retry semantics for free |
| Shopify `shop { contactEmail }` fetch | Service layer (`services/shopify/ShopifyShopService.ts` — new) | — | New GraphQL query mirrors `ShopifyProductService` plumbing |
| `RequestCounter` schema | Database / Storage (Prisma + Postgres) | — | Composite PK `(shop, period)` makes shop-scoping structurally implicit |
| Atomic counter increment | Repository (`lib/db/repositories/RequestCounterRepository.ts`) | Postgres (single-statement upsert) | Mirrors `ShopSettingsRepository` pattern; SQL primitive runs in Postgres for ACID atomicity |
| `tryConsumeRequest(shop)` | Service layer (`services/chat/CapService.ts`) | RequestCounterRepository (callee) | Mirrors `services/chat/getActiveChatModel.ts` thin-resolver pattern |
| Cap-reached streamed assistant message | API / Backend (route handler synthesizes via `createUIMessageStream`) | UI (re-uses existing `ChatMessage`) | Zero new UI per D-13 |
| Cap check injection | API / Backend (`app/api/chat/route.ts`, `app/api/proxy/chat/route.ts`) | CapService (callee) | First call after auth, before `getActiveChatModel` and `streamText` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `^6.12.4` [VERIFIED: npm registry + official docs] | Resend Node SDK — `Resend.emails.send()` with built-in idempotency-key option | Locked by CLAUDE.md as the email provider. Repo `github.com/resend/resend-node`. First published 2017; current weekly downloads in the millions. |
| `@react-email/components` | `^1.0.12` [VERIFIED: npm registry + official docs] | React Email primitives (`Html`, `Head`, `Body`, `Container`, `Text`, `Button`, `Hr`, `Section`, `Img`) | The canonical companion to Resend (same vendor, `github.com/resend/react-email`). Locked by CLAUDE.md + NOT-03. |
| `@react-email/render` | `^2.0.8` [VERIFIED: npm registry + official docs] | `render(reactElement)` → HTML string for the `html` field of `resend.emails.send()` | Required to convert templates to the wire format Resend accepts. Same vendor. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai` (Vercel AI SDK) | `^6.0.77` (already installed) | `createUIMessageStream` + `createUIMessageStreamResponse` for the cap-reached synthetic stream | Required ONLY in the cap-reached branch of both chat routes — normal-path continues using `streamText(...).toUIMessageStreamResponse()` |
| `inngest` | `^4.4.0` (already installed) | `step.run` for per-step idempotent execution inside both the success path and the `onFailure` handler | Already in use; this phase appends two new `step.run` calls (success email, failure email) |
| Prisma `$queryRaw` | via `@prisma/client` `^7.3.0` (already installed) | Atomic upsert-with-predicate SQL primitive (`INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING`) | Prisma's typed `update`/`upsert` cannot express a conditional `WHERE count < cap` predicate on the conflict-update branch; raw SQL is the documented escape hatch |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `resend` Node SDK | Direct HTTPS calls to `https://api.resend.com/emails` | Loses typed API + idempotency-key helper; reinvents nothing of value. SDK is recommended by Resend's docs as the supported path. |
| `@react-email/components` | Hand-rolled HTML email strings | Loses preview tooling, accessibility helpers (button hit targets, MSO-safe table layout), Outlook/Gmail rendering compatibility. NOT-03 locks this anyway. |
| `$queryRaw` for atomic increment | Prisma `update`/`upsert` typed API | Cannot express the `WHERE count < cap` predicate cleanly on the `DO UPDATE` branch. Workarounds (SELECT-then-UPDATE) introduce a race. Raw SQL is the simplest, race-free, single-roundtrip option. |
| `createUIMessageStream` for cap-reached | Hand-rolled `ReadableStream` emitting raw SSE | Requires re-implementing the v6 SSE chunk format (`text-start`/`text-delta`/`text-end` + `start`/`finish`). The SDK helper is the documented entry point and is forward-compatible. |
| Resend `react: <Template />` prop | `render(<Template />)` + `html` prop | Both work, but `render()` makes the HTML output deterministically snapshot-testable and decouples template rendering from SDK calls (planner can unit-test rendering without mocking Resend). |
| Composite-PK `(shop, period)` on `RequestCounter` | Auto-increment `id` PK + unique index on `(shop, period)` | Composite PK is structurally cleaner (one row per shop-period by construction), produces a primary-key conflict for `ON CONFLICT (shop, period)` without needing a named unique index, and matches D-08. |

**Installation:**
```bash
bun add resend@^6.12.4 @react-email/components@^1.0.12 @react-email/render@^2.0.8
```

**Version verification (executed 2026-05-27):**
- `npm view resend version` → `6.12.4` (vendor: `github.com/resend/resend-node`; first published 2017-02-25)
- `npm view @react-email/components version` → `1.0.12` (vendor: `github.com/resend/react-email`; first published 2023-02-19)
- `npm view @react-email/render version` → `2.0.8` (same vendor)
- `npm view resend scripts.postinstall` → empty (no postinstall scripts)
- `npm view @react-email/components scripts.postinstall` → empty
- `npm view @react-email/render scripts.postinstall` → empty

## Package Legitimacy Audit

> slopcheck was not available at research time (`pip` missing in this environment). The audit below is performed manually using `npm view` ecosystem metadata + repository ownership cross-check + official-docs verification.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `resend` | npm | 8+ yrs (since 2017-02-25; current line 6.x mid-2024+) | Millions/wk (industry-standard email SDK) | github.com/resend/resend-node (vendor-owned) | unavailable | Approved [VERIFIED: npm registry + official docs] |
| `@react-email/components` | npm | 3+ yrs (since 2023-02-19) | High (canonical paired SDK) | github.com/resend/react-email (vendor-owned) | unavailable | Approved [VERIFIED: npm registry + official docs] |
| `@react-email/render` | npm | 3+ yrs (sibling package, same monorepo) | High | github.com/resend/react-email (vendor-owned) | unavailable | Approved [VERIFIED: npm registry + official docs] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Why these are safe even without slopcheck:**
1. All three packages are owned by the same vendor (Resend) — repository URLs verified via `npm view <pkg> repository.url`.
2. CLAUDE.md hard-locks Resend + React Email as the email stack (so the name is not LLM-hallucinated — it is project-decided).
3. NOT-03 / NOT-04 in REQUIREMENTS.md cite "Resend" and "React Email" by name as locked vendor decisions.
4. No `postinstall` scripts present — no install-time code execution risk.
5. All three are referenced by their exact package names in the official Resend documentation pages fetched during research.

If slopcheck becomes available, the planner SHOULD run `slopcheck install resend @react-email/components @react-email/render --json` before the install task and gate behind a `checkpoint:human-verify` if any package returns `[SLOP]` or `[SUS]`.

## Architecture Patterns

### System Architecture Diagram

```
                                          ┌────────────────────────────┐
                                          │  Inngest event:            │
                                          │  shopify/product.sync      │
                                          └─────────────┬──────────────┘
                                                        │
                                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  inngest/functions/sync-products.ts  (Phase 2 — extended in Phase 8)           │
│                                                                                 │
│   1. mark-running                                                              │
│   2. fetch-total-count                                                         │
│   3. (loop) fetch-batch-* → upsert-batch-* → embed-batch-* → persist-cursor-*  │
│   4. finalize                                                                  │
│   5. *** NEW (Phase 8 — success branch) ***                                    │
│      step.run('send-success-email', ...) ──┐                                   │
│                                            │                                   │
│   onFailure(error, event, step) {          │                                   │
│     5'. *** NEW (Phase 8 — failure branch) ***                                 │
│         step.run('send-failure-email', ...) ──┐                                │
│   }                                            │                               │
└────────────────────────────────────────────────┼───────────────────────────────┘
                                                 │
                                                 ▼
                          ┌──────────────────────────────────────────┐
                          │ services/email/EmailService.ts (NEW)    │
                          │                                          │
                          │   1. Reload SyncRun                      │
                          │   2. if (emailSentAt) return; // dedup   │
                          │   3. Shopify GraphQL: shop{contactEmail} │
                          │   4. if (!contactEmail) log+skip; return │
                          │   5. render(<TemplateXxx />)             │
                          │   6. resend.emails.send({...},           │
                          │        { idempotencyKey:                 │
                          │          'sync-{success|failure}/{runId}'│
                          │        })                                │
                          │   7. UPDATE sync_run SET email_sent_at   │
                          │      = NOW() WHERE id=? AND              │
                          │      email_sent_at IS NULL               │
                          └──────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

                ┌────────────────────────┐         ┌────────────────────────┐
                │ POST /api/chat         │         │ POST /api/proxy/chat   │
                │ (admin, Bearer auth)   │         │ (storefront, HMAC)     │
                └───────────┬────────────┘         └───────────┬────────────┘
                            │                                  │
                            └──────────────┬───────────────────┘
                                           ▼
                       ┌──────────────────────────────────────────┐
                       │ services/chat/CapService.ts (NEW)       │
                       │   tryConsumeRequest(shop):              │
                       │     period = YYYY-MM (UTC)              │
                       │     cap    = env HARD_CAP_…             │
                       │     -> RequestCounterRepository         │
                       │           .tryConsume(shop,period,cap)  │
                       └────────────────┬─────────────────────────┘
                                        │
                  allowed=true ◀────────┴────────▶ allowed=false
                       │                                 │
                       ▼                                 ▼
            ┌──────────────────────┐         ┌──────────────────────────────┐
            │ existing streamText  │         │ createUIMessageStream:       │
            │ → toUIMessageStream… │         │  text-start/delta/end with   │
            └──────────────────────┘         │  "monthly limit reached" copy│
                                             │ → createUIMessageStream…     │
                                             │     Response                 │
                                             └──────────────────────────────┘
                       │                                 │
                       └─────────────────┬───────────────┘
                                         ▼
                                   Browser/Drawer:
                                  ChatMessage renders
                                  identically for both
```

### Recommended Project Structure

```
prisma/
├── schema.prisma                           # adds RequestCounter model + SyncRun.emailSentAt
└── migrations/
    └── 20260528xxxxxx_add_phase_08_email_hard_cap/
        └── migration.sql                   # CREATE TABLE request_counter + ALTER TABLE sync_runs ADD emailSentAt

lib/
├── email/
│   └── templates/                          # NOT-03 lock
│       ├── SyncSuccessEmail.tsx            # React Email component
│       └── SyncFailureEmail.tsx
├── util/
│   └── period.ts                           # getCurrentPeriod(now?: Date): YYYY-MM (UTC)
└── db/
    └── repositories/
        └── RequestCounterRepository.ts     # tryConsume(shop, period, cap)

services/
├── email/
│   └── EmailService.ts                     # client init + send wrapper + ResendError typing
├── shopify/
│   └── ShopifyShopService.ts               # fetchContactEmail(session) — new GraphQL plumbing
└── chat/
    └── CapService.ts                       # tryConsumeRequest(shop)

inngest/functions/
└── sync-products.ts                         # +2 step.run blocks (success email, failure email)

app/api/
├── chat/route.ts                            # +1 line: tryConsumeRequest before streamText
└── proxy/chat/route.ts                      # +1 line: tryConsumeRequest after HMAC, before streamText
```

### Pattern 1: Inngest step.run idempotency

**What:** Wrap each I/O-effecting operation in `step.run('stable-id', async () => …)`. Inngest persists the return value keyed by step ID once the function exits successfully. On retries, completed steps are NOT re-executed — Inngest replays the cached result.

**When to use:** ANY side-effecting work inside an Inngest function. For Phase 8 specifically: the email send must be wrapped so a function-level retry does not re-send the email.

**Why this matters for Phase 8:** Even though `SyncRun.emailSentAt` is the application-level idempotency record (D-04), wrapping the send in `step.run('send-success-email', ...)` provides defense-in-depth: Inngest will not re-execute the step if the function retries after the step succeeded. This is two layers of protection per CONTEXT.md.

**Example:**
```typescript
// Source: https://www.inngest.com/docs/learn/inngest-steps (verified)
await step.run('send-success-email', async () => {
  await emailService.sendSyncSuccess({ syncRunId, shop });
});
```

### Pattern 2: Inngest `onFailure` handler with `step`

**What:** The `onFailure` option on `inngest.createFunction({ ... })` is invoked after all retries are exhausted. It receives `{ event, error, step, runId }` and can use `step.run` for idempotent failure-side operations.

**When to use:** Phase 2's `syncProductsFunction` already declares an `onFailure` that updates `SyncRun.state = 'failed'`. Phase 8 appends a `step.run('send-failure-email', ...)` to that same handler.

**Critical caveat from Phase 2 code:** The existing handler reads `event` differently from the main handler — `event.data` in `onFailure` is the wrapping `inngest/function.failed` event payload; the original event data is at `event.data.event.data`. Phase 2 already wrote this destructuring (`(event.data as { event: { data: SyncEventData } }).event.data`). Phase 8 must reuse the same shape inside the new `step.run`.

**Example:**
```typescript
// Source: https://www.inngest.com/blog/improved-error-handling (verified) +
//         inspection of existing inngest/functions/sync-products.ts lines 30-40
onFailure: async ({ event, error, step }) => {
  const original = (event.data as { event: { data: SyncEventData } }).event.data;
  // Phase 2 — already present
  await prisma.syncRun.update({ where: { id: original.syncRunId }, ... });
  // Phase 8 — new
  await step.run('send-failure-email', async () => {
    await emailService.sendSyncFailure({
      syncRunId: original.syncRunId,
      shop: original.shop,
      errorMessage: String(error?.message ?? error),
    });
  });
}
```

### Pattern 3: React Email render → Resend send

**What:** Compose templates as React components using `@react-email/components` primitives (`Html`, `Body`, `Container`, `Text`, `Button`). Call `render(<Template props={...} />)` from `@react-email/render` to produce an HTML string. Pass it as the `html` field of `resend.emails.send()`. Pass an `idempotencyKey` as the SECOND argument (NOT a header) for SDK-native dedup at the Resend platform level.

**When to use:** Every email send in Phase 8.

**Why `render()` over Resend's `react: <Template />` prop:** Both work, but `render()`-then-`html` is unit-testable (snapshot test the HTML output) without mocking the Resend client. It also decouples template rendering from SDK calls — a value when Wave 0 RED tests need to assert template content independent of Resend mocks.

**Example:**
```typescript
// Source: https://react.email/docs/introduction +
//         https://resend.com/docs/api-reference/emails/send-email +
//         https://resend.com/docs/dashboard/emails/idempotency-keys
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { SyncSuccessEmail } from '@/lib/email/templates/SyncSuccessEmail';

const html = await render(
  <SyncSuccessEmail shop={shop} productCount={count} adminUrl={url} />
);

const result = await resend.emails.send(
  {
    from: process.env.RESEND_FROM_ADDRESS!,
    to: contactEmail,
    subject: `Catalog sync complete — ${count} products`,
    html,
  },
  { idempotencyKey: `sync-success/${syncRunId}` }  // platform-level dedup
);
if (result.error) throw new Error(result.error.message);
```

### Pattern 4: Atomic counter upsert-with-predicate (Postgres)

**What:** A single Postgres statement that:
- Inserts a new `(shop, period, request_count=1)` row if none exists, OR
- Increments `request_count` on conflict, BUT ONLY IF the existing count is below the cap, OR
- Returns zero rows if neither condition can be satisfied (cap reached) — `tryConsumeRequest` returns `{ allowed: false }`.

**When to use:** Every chat request in both `/api/chat` and `/api/proxy/chat`.

**Critical correctness detail:** The conflict-update predicate `WHERE request_counter.request_count < $cap` is what makes this race-free. Two concurrent requests at `count = cap - 1` both attempt the upsert; Postgres serializes the conflict resolution, and exactly one wins (returns the incremented count), while the other's `DO UPDATE WHERE` evaluates to false and returns zero rows. `INSERT … ON CONFLICT DO UPDATE … RETURNING` is documented as atomic per Postgres docs.

**Example:**
```sql
-- Source: https://www.postgresql.org/docs/current/sql-insert.html (verified)
INSERT INTO request_counter (shop, period, "requestCount", "updatedAt")
VALUES ($1, $2, 1, NOW())
ON CONFLICT (shop, period)
DO UPDATE SET
  "requestCount" = request_counter."requestCount" + 1,
  "updatedAt"    = NOW()
  WHERE request_counter."requestCount" < $3
RETURNING "requestCount";
```

Wrapped in Prisma:
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries (verified)
const rows = await prisma.$queryRaw<Array<{ requestCount: number }>>`
  INSERT INTO request_counter (shop, period, "requestCount", "updatedAt")
  VALUES (${shop}, ${period}, 1, NOW())
  ON CONFLICT (shop, period)
  DO UPDATE SET
    "requestCount" = request_counter."requestCount" + 1,
    "updatedAt"    = NOW()
    WHERE request_counter."requestCount" < ${cap}
  RETURNING "requestCount"
`;
return { allowed: rows.length > 0, requestCount: rows[0]?.requestCount };
```

`$queryRaw` (not `$executeRaw`) is required because we need the `RETURNING` rows back. Tagged-template `${var}` is parameter-bound (SQL-injection safe per Prisma docs). Empty result array = cap reached → return `{ allowed: false }`. **A single statement covers BOTH the first-of-month and the steady-state cases — no SELECT-then-UPDATE race window exists.**

### Pattern 5: AI SDK v6 synthetic UI message stream (cap-reached path)

**What:** Both chat routes currently return `streamText(...).toUIMessageStreamResponse()`. For the cap-reached branch, we need to return the same wire format WITHOUT calling a model. `createUIMessageStream` + `createUIMessageStreamResponse` (from `ai` v6) emit the v6 chunk taxonomy directly.

**When to use:** Inside `tryConsumeRequest`-gated chat routes, when `allowed: false`.

**Why this matters:** `streamText` always invokes a model. Using it to emit static text would (a) cost a real LLM call, (b) be non-deterministic, and (c) be unnecessary. `createUIMessageStream` is the documented v6 helper for this exact case.

**Example:**
```typescript
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream +
//         https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol (verified)
import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';

const CAP_REACHED_MESSAGE =
  "You've reached this month's message limit. It resets on the 1st of the month. " +
  "To raise your limit, contact support.";

function capReachedResponse(): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = generateId();
      writer.write({ type: 'start', messageId: id });
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: CAP_REACHED_MESSAGE });
      writer.write({ type: 'text-end', id });
      writer.write({ type: 'finish' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

// In the route:
const consume = await tryConsumeRequest(shop);
if (!consume.allowed) return capReachedResponse();
// ... existing streamText path unchanged
```

### Pattern 6: Repository singleton (mirroring Phase 7)

**What:** Mirror `lib/db/repositories/ShopSettingsRepository.ts` shape:

```typescript
export class RequestCounterRepository {
  async tryConsume(shop: string, period: string, cap: number): Promise<{ allowed: boolean; requestCount?: number }> {
    const rows = await prisma.$queryRaw<Array<{ requestCount: number }>>`...`;
    return rows.length > 0 ? { allowed: true, requestCount: rows[0].requestCount } : { allowed: false };
  }
  async get(shop: string, period: string): Promise<RequestCounter | null> {
    return prisma.requestCounter.findUnique({ where: { shop_period: { shop, period } } });
  }
}
export const requestCounterRepository = new RequestCounterRepository();
```

`get(...)` is for observability/tests; the hot path is `tryConsume`.

### Anti-Patterns to Avoid

- **SELECT-then-UPDATE counter logic.** Splitting "is the counter below cap?" and "increment" into two statements introduces a race window where two concurrent requests both pass the SELECT and both UPDATE past the cap. The single `INSERT … ON CONFLICT DO UPDATE WHERE … RETURNING` is the only race-free shape. SC4 explicitly tests for this.
- **Calling `streamText` with a hardcoded prompt for cap-reached messages.** Wastes a real LLM call, is non-deterministic, can fail open if the model is down. Use `createUIMessageStream` (Pattern 5).
- **Embedding email logic in the chat route or anywhere outside the Inngest function.** D-03 locks email to the Inngest step graph. A chat-route email send would lose Inngest's retry + idempotency semantics and run inside Vercel's per-request timeout.
- **Letting Resend's `react: <Template />` prop replace `render()`.** `render()` is unit-testable in isolation; the prop approach forces template tests to mock the Resend client. Phase 7's pattern (separable rendering and persistence) is preferred.
- **Using `prisma.requestCounter.upsert()` for the atomic primitive.** Prisma's typed upsert cannot express the `WHERE count < cap` predicate on the conflict-update branch. The generated SQL is `INSERT … ON CONFLICT DO UPDATE … RETURNING *` without the cap guard, defeating the entire purpose.
- **Logging `contactEmail` or `RESEND_API_KEY` anywhere.** CLAUDE.md hard constraint. The email step error handler must use a structured error object that does NOT include either.
- **Re-using a single `step.run` id for both branches.** `send-success-email` and `send-failure-email` MUST be distinct step IDs — they live in different code paths (main handler vs `onFailure`) but Inngest still tracks state by ID; conflating them would let success memoization mask a real failure-path retry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic per-key counter | Custom advisory-lock or mutex | Postgres `INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING` | One statement = ACID atomic. No app-level locks. |
| Email HTML composition | String templating with backticks | `@react-email/components` + `render()` | Outlook MSO compat, accessibility, preview tooling, hot-reload during dev |
| HTTPS calls to Resend | `fetch` against the REST endpoint | `resend` Node SDK | Typed API + idempotency-key helper + error normalization |
| Idempotency tracking for emails | Custom dedup table | `step.run` step ID (Inngest) + `SyncRun.emailSentAt` + Resend `idempotencyKey` (24h server-side) | Three layers: replay-cache, application stamp, vendor platform — defense in depth per D-04 |
| UI message stream synthesis | Hand-rolled `ReadableStream` emitting raw SSE | `createUIMessageStream` + `createUIMessageStreamResponse` | Vendor-blessed chunk format, forward-compatible with future v6 patches |
| Period derivation | Custom date parsing | `new Date().toISOString().slice(0, 7)` (UTC by construction) | ISO format guarantees UTC + YYYY-MM prefix; pure function, trivially testable with a `now?: Date` parameter |
| Shopify shop fields fetch | New REST endpoint | One-line GraphQL query through existing `shopifyClient.clients.Graphql` | `ShopifyProductService` already establishes the Admin GraphQL pattern; copy it |

**Key insight:** Phase 8 is almost entirely composition of existing primitives. The only NEW logic is (1) two small templates, (2) one SQL primitive, (3) two `step.run` blocks. Everything else is wiring.

## Runtime State Inventory

> Phase 8 is greenfield additions (new tables, new files, new env vars). No rename/refactor/migration of existing runtime state. Section included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New: `RequestCounter` table (additive); New nullable `SyncRun.emailSentAt` column (additive — existing rows default to NULL, which is the "email not yet sent" sentinel) | Schema migration only — no data migration needed for existing `SyncRun` rows (NULL means historical runs simply will not retroactively send emails, which is correct behavior) |
| Live service config | None — Resend domain config is done once via the Resend dashboard against `RESEND_FROM_ADDRESS`; this is operator setup, not application-state-aware | None for code — operator action to verify a sending domain in Resend before deploy |
| OS-registered state | None | None |
| Secrets / env vars | New: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `HARD_CAP_REQUESTS_PER_MONTH` (already noted in PROJECT.md goals); existing `SHOPIFY_APP_HANDLE` used for admin link in success email | Add to Vercel env config and to `.env.example`. No existing secret renames. |
| Build artifacts / installed packages | New: `resend`, `@react-email/components`, `@react-email/render` (bun add — lockfile updates) | `bun install` after `bun add`; commit `bun.lock` |

**Nothing found in category 'Live service config' / 'OS-registered state'** — verified by repo inspection (no `pm2`, no Task Scheduler, no `launchd` artifacts).

## Common Pitfalls

### Pitfall 1: Prisma 7 + manual indexes drift on every migration

**What goes wrong:** Phase 7 documented that `prisma migrate dev` treats the manual HNSW + GIN indexes in `db/manual-indexes.sql` as drift (they exist in DB but not in `schema.prisma`). The default `migrate dev` flow tries to "reset" the DB, which would drop those indexes. This is a known Prisma 7.3 false-positive — see STATE.md Phase 7 entry.

**Why it happens:** Prisma has no `vector` / `tsvector` type support (Prisma issues #21850 + #27186). The manual-indexes file is held outside Prisma's migration history by design (EMB-04 + Phase 3 D-06).

**How to avoid (the Phase 7 Option A workaround, MANDATORY for Phase 8):**
1. Author the migration SQL by hand at `prisma/migrations/{timestamp}_add_phase_08_email_hard_cap/migration.sql` containing `CREATE TABLE request_counter (...)` + `ALTER TABLE sync_runs ADD COLUMN "emailSentAt" TIMESTAMP(3)`.
2. Apply with `bunx prisma db execute --file prisma/migrations/.../migration.sql --schema prisma/schema.prisma`.
3. Mark the migration as applied without resetting: `bunx prisma migrate resolve --applied "{timestamp}_add_phase_08_email_hard_cap"`.
4. Regenerate the client: `bunx prisma generate`.
5. Run `bun db:indexes` to reaffirm manual HNSW + GIN indexes survived (they should — Phase 7 verified the pattern).

**Warning signs:**
- `prisma migrate dev` prompts about "drift detected" referencing index names from `db/manual-indexes.sql`.
- HNSW or GIN indexes missing after a migration apply.

**Reference:** STATE.md Phase 7 entry; `prisma/migrations/20260527161654_add_shop_settings/migration.sql`.

### Pitfall 2: Confusing `step.run` ID semantics in onFailure

**What goes wrong:** Inngest's `onFailure` handler is itself a separate function execution (`inngest/function.failed` system event). Inside it, `step.run('id', ...)` uses the SAME memoization layer as the main handler — so picking the wrong ID (e.g., reusing `send-completion-email` for both branches) would let the success path's cached result mask a real failure send.

**Why it happens:** Step IDs are a flat namespace per function-run; the success and failure paths share that namespace.

**How to avoid:** Use distinct, intention-revealing step IDs: `send-success-email` and `send-failure-email`. Never reuse.

**Warning signs:**
- Failure emails not sending after retries exhaust.
- Inngest dashboard shows the failure handler executed but the email step is marked "memoized" with stale data.

### Pitfall 3: `contactEmail` field may be null in practice despite GraphQL non-null type

**What goes wrong:** Shopify's `Shop.contactEmail` is typed `String!` (non-null), but in real installations the field can return an empty string or `null` for shops that were created via certain CLI paths or that have never set a contact email. The non-null GraphQL type is a Shopify schema declaration, not a runtime guarantee.

**Why it happens:** Older shops + dev stores commonly lack a contact email; the type annotation has not been retroactively enforced.

**How to avoid (per D-05):** Defensive check `if (!contactEmail) { /* structured-log + return */ }`. Email-skipped is NOT a sync failure — the sync result is the contract, not the email.

**Warning signs:**
- TypeScript shape suggests `contactEmail: string` (non-nullable) from a generated GraphQL client → coerce defensively at the boundary.
- Test cases for empty-string contactEmail must exist.

### Pitfall 4: `Idempotency-Key` vs `idempotencyKey` SDK shape

**What goes wrong:** Resend's HTTP API uses the `Idempotency-Key` HTTP header. The Node SDK exposes it via an SDK-level options bag, NOT a header object: `resend.emails.send(payload, { idempotencyKey: '...' })`. Passing `headers: { 'Idempotency-Key': '...' }` does NOT enable idempotency in the SDK path.

**Why it happens:** SDKs commonly remap headers into typed options; the source-of-truth example in `https://resend.com/docs/dashboard/emails/idempotency-keys` uses the options form.

**How to avoid:** Always use the second-argument options form: `await resend.emails.send({...}, { idempotencyKey: 'sync-success/{syncRunId}' })`. Key format `<event-type>/<entity-id>` is the documented convention, max 256 chars, 24-hour retention server-side.

### Pitfall 5: AI SDK v6 chunk type names changed from v5

**What goes wrong:** v5's `text-delta` chunk used different field names; v6 expects `text-start` → `text-delta { id, delta }` → `text-end { id }`, plus framing `start { messageId }` and `finish`. Mixing v5-style chunks crashes the client.

**Why it happens:** Phase 4 RESEARCH already flagged that v6 has breaking API changes (e.g., `inputSchema` vs `parameters`); the chunk taxonomy is another such change.

**How to avoid:** Use the exact chunk types listed in §Code Examples Pattern 5. Phase 4 STATE.md note confirms `ai` v6.0.77 is the installed version.

### Pitfall 6: Logging `contactEmail` would violate CLAUDE.md secrets rule

**What goes wrong:** `contactEmail` is technically PII — and STATE.md / CLAUDE.md forbid logging secrets, session tokens, and "auth headers" but the spirit of the rule covers any identifying merchant data. Phase 7 verified zero `console.*` calls in shipped paths.

**How to avoid:** EmailService failure logs use a structured object that includes `syncRunId`, `shop`, and `errorClass` only — never the email value. Tests should grep for `console.*` in all new files.

### Pitfall 7: Period derivation under non-UTC server times

**What goes wrong:** A naive `new Date().toISOString().slice(0,7)` works because `toISOString()` is always UTC. But `new Date().getFullYear() + '-' + (new Date().getMonth() + 1)` is local time and would slip by a month near midnight UTC.

**How to avoid:** Use `toISOString().slice(0, 7)` exclusively. Wrap in `getCurrentPeriod(now: Date = new Date()): string` so tests can inject a fake `now` without `vi.useFakeTimers()`. The fake-timers pattern is also acceptable but DI is simpler.

## Code Examples

### React Email template — Success

```tsx
// Source: https://react.email/docs/introduction (verified) + D-07 minimal-transactional brief
// lib/email/templates/SyncSuccessEmail.tsx
import { Html, Head, Body, Container, Section, Text, Button, Hr } from '@react-email/components';

export interface SyncSuccessEmailProps {
  shop: string;
  productCount: number;
  adminUrl: string; // e.g., https://admin.shopify.com/store/{shop}/apps/{appHandle}
}

export function SyncSuccessEmail({ shop, productCount, adminUrl }: SyncSuccessEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f6f9fc' }}>
        <Container style={{ padding: '32px', backgroundColor: '#ffffff', maxWidth: '480px' }}>
          <Text style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 16px' }}>
            Catalog sync complete
          </Text>
          <Text style={{ fontSize: '14px', color: '#374151' }}>
            SmartDiscovery AI synced {productCount} products from {shop}.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={adminUrl}
              style={{ backgroundColor: '#008060', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
            >
              View in admin
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb' }} />
          <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
            SmartDiscovery AI · transactional notification
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### React Email template — Failure

```tsx
// Source: https://react.email/docs/introduction (verified) + D-06 retry-link pattern
// lib/email/templates/SyncFailureEmail.tsx
import { Html, Head, Body, Container, Section, Text, Button, Hr } from '@react-email/components';

export interface SyncFailureEmailProps {
  shop: string;
  syncRunId: string;
  errorMessage: string;
  retryUrl: string; // e.g., {HOST}/onboarding?retry={syncRunId}
}

export function SyncFailureEmail({ shop, errorMessage, retryUrl }: SyncFailureEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f6f9fc' }}>
        <Container style={{ padding: '32px', backgroundColor: '#ffffff', maxWidth: '480px' }}>
          <Text style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 16px', color: '#b91c1c' }}>
            Catalog sync failed
          </Text>
          <Text style={{ fontSize: '14px', color: '#374151' }}>
            We couldn't finish syncing products from {shop}.
          </Text>
          <Text style={{ fontSize: '13px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '4px' }}>
            {errorMessage}
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Button
              href={retryUrl}
              style={{ backgroundColor: '#008060', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px' }}
            >
              Retry sync
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb' }} />
          <Text style={{ fontSize: '12px', color: '#9ca3af' }}>
            SmartDiscovery AI · transactional notification
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### EmailService wrapper

```typescript
// Source: Resend Node SDK docs (verified)
// services/email/EmailService.ts
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { SyncSuccessEmail } from '@/lib/email/templates/SyncSuccessEmail';
import { SyncFailureEmail } from '@/lib/email/templates/SyncFailureEmail';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM_ADDRESS!;

export interface SendSyncSuccessArgs {
  to: string;
  shop: string;
  productCount: number;
  adminUrl: string;
  syncRunId: string;  // used as idempotency key suffix
}

export async function sendSyncSuccess(args: SendSyncSuccessArgs): Promise<void> {
  const html = await render(
    SyncSuccessEmail({ shop: args.shop, productCount: args.productCount, adminUrl: args.adminUrl })
  );
  const result = await resend.emails.send(
    {
      from: FROM,
      to: args.to,
      subject: `Catalog sync complete — ${args.productCount} products`,
      html,
    },
    { idempotencyKey: `sync-success/${args.syncRunId}` }
  );
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message ?? 'unknown'}`);
  }
}

export interface SendSyncFailureArgs {
  to: string;
  shop: string;
  syncRunId: string;
  errorMessage: string;
  retryUrl: string;
}

export async function sendSyncFailure(args: SendSyncFailureArgs): Promise<void> {
  const html = await render(
    SyncFailureEmail({
      shop: args.shop,
      syncRunId: args.syncRunId,
      errorMessage: args.errorMessage,
      retryUrl: args.retryUrl,
    })
  );
  const result = await resend.emails.send(
    {
      from: FROM,
      to: args.to,
      subject: 'Catalog sync failed',
      html,
    },
    { idempotencyKey: `sync-failure/${args.syncRunId}` }
  );
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message ?? 'unknown'}`);
  }
}
```

### Shop contact-email fetch

```typescript
// Source: https://shopify.dev/docs/api/admin-graphql/latest/objects/Shop (verified)
// services/shopify/ShopifyShopService.ts
import { shopifyClient } from '@/lib/shopify/client';
import type { Session } from '@shopify/shopify-api';

export const SHOP_CONTACT_EMAIL_QUERY = /* GraphQL */ `
  query ShopContactEmail {
    shop {
      contactEmail
    }
  }
`;

export async function fetchShopContactEmail(session: Session): Promise<string | null> {
  const client = new shopifyClient.clients.Graphql({ session });
  try {
    const response = await client.request<{ shop?: { contactEmail?: string | null } }>(
      SHOP_CONTACT_EMAIL_QUERY
    );
    const email = response.data?.shop?.contactEmail;
    return email && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}
```

### Inngest function integration (delta to existing file)

```typescript
// Delta on inngest/functions/sync-products.ts
// — append after `finalize` step, INSIDE the main handler (success branch):

await step.run('send-success-email', async () => {
  const run = await prisma.syncRun.findUnique({ where: { id: syncRunId } });
  if (!run || run.emailSentAt) return;
  if (run.state === 'failed') return;  // failure branch handles its own send
  const contactEmail = await fetchShopContactEmail(session);
  if (!contactEmail) return;  // D-05: log + skip, do NOT fail
  const adminUrl = `https://admin.shopify.com/store/${shop.replace('.myshopify.com', '')}/apps/${process.env.SHOPIFY_APP_HANDLE}`;
  await sendSyncSuccess({
    to: contactEmail,
    shop,
    productCount: run.processedCount,
    adminUrl,
    syncRunId,
  });
  // Atomic stamp — only if still NULL (defense in depth vs Inngest replay):
  await prisma.$executeRaw`
    UPDATE sync_runs SET "emailSentAt" = NOW()
    WHERE id = ${syncRunId} AND "emailSentAt" IS NULL
  `;
});

// — and inside onFailure (failure branch):

onFailure: async ({ event, error, step }) => {
  const original = (event.data as { event: { data: SyncEventData } }).event.data;
  await prisma.syncRun.update({  // existing Phase 2 code
    where: { id: original.syncRunId },
    data: {
      state: 'failed',
      finishedAt: new Date(),
      errors: { push: [String(error?.message ?? error)] },
    },
  });
  // Phase 8 — new
  await step.run('send-failure-email', async () => {
    const run = await prisma.syncRun.findUnique({ where: { id: original.syncRunId } });
    if (!run || run.emailSentAt) return;
    const offlineId = shopifyClient.session.getOfflineId(original.shop);
    const session = await sessionStorage.loadSession(offlineId);
    if (!session) return;
    const contactEmail = await fetchShopContactEmail(session);
    if (!contactEmail) return;
    const retryUrl = `${process.env.HOST}/onboarding?retry=${original.syncRunId}`;
    await sendSyncFailure({
      to: contactEmail,
      shop: original.shop,
      syncRunId: original.syncRunId,
      errorMessage: String(error?.message ?? error),
      retryUrl,
    });
    await prisma.$executeRaw`
      UPDATE sync_runs SET "emailSentAt" = NOW()
      WHERE id = ${original.syncRunId} AND "emailSentAt" IS NULL
    `;
  });
}
```

### Period helper

```typescript
// lib/util/period.ts
export function getCurrentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);  // YYYY-MM (UTC by construction of toISOString)
}
```

### RequestCounterRepository

```typescript
// lib/db/repositories/RequestCounterRepository.ts
import { prisma } from '@/lib/db/client';

export class RequestCounterRepository {
  /**
   * Atomic single-statement upsert-with-predicate. Returns
   * { allowed: true, requestCount } if the increment succeeded
   * (including the first-of-month INSERT), else { allowed: false }.
   *
   * Race semantics: Postgres serializes the ON CONFLICT resolution,
   * so two concurrent calls at count = cap - 1 produce exactly one winner.
   * Verified by SC4 stress test.
   */
  async tryConsume(
    shop: string,
    period: string,
    cap: number
  ): Promise<{ allowed: true; requestCount: number } | { allowed: false }> {
    const rows = await prisma.$queryRaw<Array<{ requestCount: number }>>`
      INSERT INTO request_counter (shop, period, "requestCount", "updatedAt")
      VALUES (${shop}, ${period}, 1, NOW())
      ON CONFLICT (shop, period)
      DO UPDATE SET
        "requestCount" = request_counter."requestCount" + 1,
        "updatedAt"    = NOW()
        WHERE request_counter."requestCount" < ${cap}
      RETURNING "requestCount"
    `;
    return rows.length > 0
      ? { allowed: true, requestCount: rows[0].requestCount }
      : { allowed: false };
  }
}

export const requestCounterRepository = new RequestCounterRepository();
```

### CapService

```typescript
// services/chat/CapService.ts
import { requestCounterRepository } from '@/lib/db/repositories/RequestCounterRepository';
import { getCurrentPeriod } from '@/lib/util/period';

const DEFAULT_CAP = 2000;

function readCap(): number {
  const raw = process.env.HARD_CAP_REQUESTS_PER_MONTH;
  if (!raw) return DEFAULT_CAP;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

export async function tryConsumeRequest(shop: string): Promise<{ allowed: boolean }> {
  const period = getCurrentPeriod();
  const cap = readCap();
  const r = await requestCounterRepository.tryConsume(shop, period, cap);
  return { allowed: r.allowed };
}
```

### Chat route delta (admin)

```typescript
// app/api/chat/route.ts — minimal delta (D-14)
import { tryConsumeRequest } from '@/services/chat/CapService';
import { capReachedResponse } from '@/lib/chat/cap-reached-response';

export const POST = withShopifySession(async ({ shop, req }) => {
  const consume = await tryConsumeRequest(shop);
  if (!consume.allowed) return capReachedResponse();   // <— D-13 streamed synthetic message
  // ... rest of existing handler unchanged
});
```

### Cap-reached response helper

```typescript
// lib/chat/cap-reached-response.ts
import { createUIMessageStream, createUIMessageStreamResponse, generateId } from 'ai';

const CAP_REACHED_MESSAGE =
  "You've reached this month's message limit. It resets on the 1st of next month. " +
  "Reach out to support to raise your cap.";

export function capReachedResponse(): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = generateId();
      writer.write({ type: 'start', messageId: id });
      writer.write({ type: 'text-start', id });
      writer.write({ type: 'text-delta', id, delta: CAP_REACHED_MESSAGE });
      writer.write({ type: 'text-end', id });
      writer.write({ type: 'finish' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
```

### Prisma schema delta

```prisma
// prisma/schema.prisma — additions

model SyncRun {
  // ... existing fields unchanged
  emailSentAt    DateTime?  // Phase 8 D-04 — nullable; NULL = email not yet sent
  // (rest unchanged)
}

// Phase 8 D-08: per-shop monthly request counter.
// Empty by design — first chat request of a (shop, period) inserts the row.
// Atomic INSERT … ON CONFLICT … DO UPDATE … WHERE in $queryRaw enforces cap.
model RequestCounter {
  shop         String
  period       String    // YYYY-MM (UTC) — D-12
  requestCount Int       @default(0)
  updatedAt    DateTime  @updatedAt

  @@id([shop, period])
  @@map("request_counter")
}
```

### Migration SQL (Option A hand-authored)

```sql
-- prisma/migrations/{timestamp}_add_phase_08_email_hard_cap/migration.sql

ALTER TABLE "sync_runs" ADD COLUMN "emailSentAt" TIMESTAMP(3);

CREATE TABLE "request_counter" (
  "shop"          TEXT          NOT NULL,
  "period"        TEXT          NOT NULL,
  "requestCount"  INTEGER       NOT NULL DEFAULT 0,
  "updatedAt"     TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "request_counter_pkey" PRIMARY KEY ("shop", "period")
);
```

Apply via:
```bash
bunx prisma db execute --file prisma/migrations/{timestamp}_add_phase_08_email_hard_cap/migration.sql --schema prisma/schema.prisma
bunx prisma migrate resolve --applied "{timestamp}_add_phase_08_email_hard_cap"
bunx prisma generate
bun db:indexes  # reaffirm manual HNSW + GIN
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resend SDK headers-based Idempotency-Key | Second-argument `{ idempotencyKey }` options bag | 2024 | Simpler typed API; SDK now handles the header injection |
| Vercel AI SDK v5 `parameters` field on tools | v6 `inputSchema` (also affects chunk format) | AI SDK v5 → v6 (2025) | Tool schema lives under `inputSchema`; UI stream chunks are `text-start/text-delta/text-end` framed by `start`/`finish` |
| Hand-rolled SSE streaming from Next.js routes | `createUIMessageStream` + `createUIMessageStreamResponse` | AI SDK v6 (2025) | Vendor-blessed chunk format; forward-compatible |
| Soft caps via custom dedup tables for email | `step.run` ID memoization + Resend `idempotencyKey` + application-level stamp column | n/a (current best practice) | Three-layer defense in depth |

**Deprecated/outdated:**
- React Email v0.x (Tailwind component) — superseded by `@react-email/components` v1.x (current line at 1.0.12). [VERIFIED: npm registry]
- Resend SDK v5.x (pre-options-bag idempotency) — superseded by v6.x. We pin `^6.12.4`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SHOPIFY_APP_HANDLE` env var holds the slug for constructing the admin "View in admin" URL `https://admin.shopify.com/store/{shop-slug}/apps/{handle}` | Inngest delta (success branch) | If the env var is unset or the format is wrong, the success email's button leads to a 404. Mitigation: defensive fallback to bare `https://admin.shopify.com/store/{shop-slug}` if `SHOPIFY_APP_HANDLE` is missing. Listed in CLAUDE.md env section — assumed present. |
| A2 | `HOST` env var is set in all environments (used to construct the retry URL in failure emails) | Inngest delta (failure branch) | If unset, retry URL is broken. CLAUDE.md lists `HOST` as required — assumed present. |
| A3 | Resend account has the `RESEND_FROM_ADDRESS` domain verified before deploy | EmailService | Resend will return 403 on send if the domain is unverified. This is an operator setup task, not a code task. Planner should add a verification checkpoint task before the verification gate. |
| A4 | A failed Resend send (5xx, network error) should be allowed to throw out of `step.run` so Inngest retries the step (up to the function's retries config) — NOT swallowed silently | EmailService | If swallowed, transient Resend outages would skip emails permanently. The current pattern (throw on `result.error`) is correct. Validation: SC1/SC2 tests assert thrown errors. |
| A5 | The Inngest 'send-failure-email' step inside `onFailure` is allowed to fail without bubbling — `onFailure` itself has no retries-after-retries behavior; throwing here just logs to Inngest dashboard | onFailure pattern | If failure-email send fails permanently, the sync is already marked failed — no further action. Acceptable risk per D-05 (notifications are auxiliary). |

## Open Questions

1. **Should the cap-reached message vary between admin (`/api/chat`) and storefront (`/api/proxy/chat`)?**
   - What we know: D-13 says "identical behavior across admin playground and storefront drawer" and the copy is "monthly limit reached" — one constant.
   - What's unclear: Admin operators might benefit from a "contact support" link in a different shape than a storefront visitor sees.
   - Recommendation: Ship ONE constant in V1. Surface-specific copy belongs to a future polish iteration.

2. **What scope does the offline session token need for `shop { contactEmail }`?**
   - What we know: The existing offline session is granted whatever scopes Phase 1 OAuth requested (likely `read_products`, `write_products`, and `read_orders` per typical SmartDiscovery app needs).
   - What's unclear: Whether reading `Shop.contactEmail` requires an additional scope (e.g., `read_shop` or no scope at all — Shop fields are commonly readable with any granted scope).
   - Recommendation: Test with the existing offline session early in the phase (`shop { contactEmail }` query against a dev shop); if it returns null due to scope, add `read_shop_data` or equivalent to the Shopify app scopes config. Document the answer in the verification gate.

3. **Should `SC4` (atomic increment race-condition test) hit a real Postgres or mock Prisma's raw query?**
   - What we know: The atomicity is enforced by Postgres ON CONFLICT — mocking Prisma can verify the SQL shape but cannot verify race-freeness.
   - What's unclear: Whether the team has a transactional Vitest setup (e.g., `pg-mem` or a dedicated test database).
   - Recommendation: Two-tier: (a) unit test with `prisma.$queryRaw` mocked, asserts the SQL string shape includes `ON CONFLICT (shop, period) DO UPDATE ... WHERE` + `RETURNING`; (b) optional integration test against a real Postgres invoked via Vitest if available — runs N=200 concurrent `tryConsume` calls at `count = cap - 1` and asserts exactly 1 returns `allowed: true`. If no real Postgres in CI, defer the stress test to the manual verification gate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + bun | All TypeScript code | ✓ | bun present | — |
| Postgres with pgcrypto + pgvector | RequestCounter table + manual indexes | ✓ (Phase 3 verified) | — | — |
| Inngest dev server | Local testing of sync-function steps | ✓ | inngest 4.4.0 (already installed) | Cloud dev environment |
| Resend account + verified domain | Real email sends | TBD (operator setup) | n/a | EmailService throws on bad config; tests mock the SDK |
| Shopify dev store with `contactEmail` set | NOT-01/02 end-to-end smoke | TBD | n/a | Mock `fetchShopContactEmail` in unit tests; manual smoke needs operator-configured store |
| `RESEND_API_KEY` env var | EmailService init | TBD | n/a | If missing in tests, `Resend` client init throws — tests must mock the module |
| `RESEND_FROM_ADDRESS` env var | EmailService send | TBD | n/a | Same as above |
| `HARD_CAP_REQUESTS_PER_MONTH` env var | CapService | TBD | default `2000` | Code falls back to 2000 if unset |

**Missing dependencies with no fallback:**
- None at code level — the only operator-blocking items are Resend domain verification and a dev store with a `contactEmail`. Both are setup tasks, not code blockers.

**Missing dependencies with fallback:**
- `HARD_CAP_REQUESTS_PER_MONTH` falls back to 2000 (the documented default per D-09). The planner should add a verification task to confirm the env var is present in production.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + @testing-library/react + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `bunx vitest run <file>` (single test file < 5s) |
| Full suite command | `bun test` (all 51 files / 354 tests as of Phase 7 verification) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOT-01 | Sync success → Resend email with productCount + admin link | unit (Inngest function step) | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts -t "sends success email"` | ❌ Wave 0 — extend existing test |
| NOT-01 | SyncSuccessEmail template renders correct copy + button URL | unit (template snapshot) | `bunx vitest run lib/email/templates/__tests__/sync-success-email.test.tsx` | ❌ Wave 0 |
| NOT-02 | Sync failure → Resend email with errorMessage + retry link | unit (Inngest function onFailure) | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts -t "sends failure email"` | ❌ Wave 0 — extend existing test |
| NOT-02 | SyncFailureEmail template snapshot + retry URL shape | unit (template snapshot) | `bunx vitest run lib/email/templates/__tests__/sync-failure-email.test.tsx` | ❌ Wave 0 |
| NOT-03 | Templates physically located under `lib/email/templates/` | static check | grep for `lib/email/templates/*.tsx` existence in verification gate | n/a |
| NOT-04 | EmailService uses `RESEND_FROM_ADDRESS` (env-scoped, not per-shop) | unit | `bunx vitest run services/email/__tests__/EmailService.test.ts -t "from address from env"` | ❌ Wave 0 |
| CAP-01 | `RequestCounter` model present in schema | static check | `bunx prisma generate` succeeds + grep schema.prisma | n/a |
| CAP-02 | `tryConsumeRequest` checks env-driven cap (default 2000) | unit | `bunx vitest run services/chat/__tests__/CapService.test.ts` | ❌ Wave 0 |
| CAP-03 | Cap-reached returns HTTP 200 with v6 UI message stream containing the limit-reached copy | integration (both routes) | `bunx vitest run app/api/chat/__tests__/route.test.ts -t "cap reached"` AND `…app/api/proxy/chat/__tests__/route.test.ts -t "cap reached"` | ❌ Wave 0 |
| CAP-03 / SC4 | Atomic increment SQL shape includes `ON CONFLICT (shop, period) DO UPDATE ... WHERE ... RETURNING` | unit (mock $queryRaw, assert template literal) | `bunx vitest run lib/db/repositories/__tests__/RequestCounterRepository.test.ts` | ❌ Wave 0 |
| SC4 | Race condition: concurrent calls at `count = cap - 1` yield exactly one allowed | integration (real Postgres) | `bunx vitest run lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` (gated on env) | ❌ Wave 0 — gated, may defer to manual smoke |
| D-04 | Idempotency: re-running the success step is a no-op if emailSentAt is set | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts -t "skips email when emailSentAt is set"` | ❌ Wave 0 |
| D-05 | If contactEmail is null/empty, sync does NOT fail; email skipped | unit | `bunx vitest run inngest/functions/__tests__/sync-products.test.ts -t "skips email when contactEmail missing"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bunx vitest run <changed-file>` (sub-5-second feedback for targeted change)
- **Per wave merge:** `bun test` (full suite — currently ~30-60s based on Phase 7's 51-file suite)
- **Phase gate:** Full suite green before `/gsd-verify-work` AND `bunx tsc --noEmit` clean

### Wave 0 Gaps

- [ ] `lib/email/templates/__tests__/sync-success-email.test.tsx` — covers NOT-01 (template content + URL)
- [ ] `lib/email/templates/__tests__/sync-failure-email.test.tsx` — covers NOT-02 (template content + retry URL)
- [ ] `services/email/__tests__/EmailService.test.ts` — covers NOT-04 (env-scoped from address) + send call shape + idempotency-key shape
- [ ] `services/shopify/__tests__/ShopifyShopService.test.ts` — covers `fetchShopContactEmail` happy + null + GraphQL-error paths
- [ ] `lib/db/repositories/__tests__/RequestCounterRepository.test.ts` — covers CAP-01 SQL shape + cap-reached returns empty
- [ ] `services/chat/__tests__/CapService.test.ts` — covers CAP-02 env default + env override + period derivation
- [ ] `lib/util/__tests__/period.test.ts` — covers `getCurrentPeriod(now)` returns YYYY-MM UTC under DI'd date
- [ ] `lib/chat/__tests__/cap-reached-response.test.ts` — covers CAP-03 streamed response shape (parse chunk sequence)
- [ ] Extend `inngest/functions/__tests__/sync-products.test.ts` — append: sends success email; sends failure email; skips when emailSentAt set; skips when contactEmail missing; uses distinct step IDs
- [ ] Extend `app/api/chat/__tests__/route.test.ts` (or create) — mock CapService allowed/denied; assert HTTP 200 + parse stream payload contains limit copy
- [ ] Extend `app/api/proxy/chat/__tests__/route.test.ts` (or create) — same as above
- [ ] *(Optional)* `lib/db/repositories/__tests__/RequestCounterRepository.race.integration.test.ts` — gated on `INTEGRATION_DB_URL`; runs N=200 concurrent `tryConsume` calls and asserts exactly 1 wins; falls back to manual smoke if env absent

*Framework install: not needed — Vitest and React Testing Library already in devDependencies (per Phase 5/7 work).*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirectly) | Phase 1 `withShopifySession` (admin) + Phase 6 `withAppProxyHmac` (storefront) gate every chat request before `tryConsumeRequest` is called. No new auth surface in Phase 8. |
| V3 Session Management | yes (indirectly) | `shop` is sourced from authenticated session (admin) or HMAC-validated query (storefront). `tryConsumeRequest(shop)` MUST receive the trusted shop string — never body/query. |
| V4 Access Control | yes | `RequestCounter` rows are scoped by composite PK `(shop, period)`; structurally impossible to read or mutate another shop's counter. `SyncRun.emailSentAt` updates are gated by `shop` filter inherited from the syncRunId lookup (the run row already carries shop). |
| V5 Input Validation | yes | Failure-email `errorMessage` comes from a thrown `Error` inside the Inngest function — it may contain user-controlled GraphQL fragments. Template must HTML-escape (React Email primitives do auto-escape text nodes — Pitfall: do NOT `dangerouslySetInnerHTML` the message). |
| V6 Cryptography | no | No new crypto. Resend SDK handles TLS via its HTTPS client. |
| V7 Errors & Logging | yes | CLAUDE.md hard rule: no `console.*` in shipped paths; no secrets/PII in logs. `contactEmail` is PII — never log it. `RESEND_API_KEY` never referenced in source (read implicitly by SDK init). |
| V9 Communications | yes | Email transport is HTTPS to Resend (TLS by default in SDK). Sending domain has SPF/DKIM via Resend DNS setup (operator task). |
| V14 Configuration | yes | New env vars `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `HARD_CAP_REQUESTS_PER_MONTH` must be in Vercel env config; planner adds verification step. |

### Known Threat Patterns for {Phase 8 stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Counter-bypass race (two requests both pass cap check) | Tampering / DoS | Single-statement atomic `INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING` (Pattern 4). Never SELECT-then-UPDATE. |
| Cross-shop counter read/write | Information disclosure / Tampering | Composite PK `(shop, period)`; `tryConsume(shop, ...)` always parameter-binds `shop` from the authenticated session. No body/query trust. |
| Email injection via merchant-supplied `errorMessage` | Tampering | React Email auto-escapes `{errorMessage}` text nodes. Pitfall: no `dangerouslySetInnerHTML`. |
| Email-header injection via `contactEmail` | Tampering | Resend SDK validates email format; reject sends to malformed addresses at the SDK boundary. |
| Replay of sync-completion event causing duplicate emails | Tampering / Spoofing | Three-layer defense: Inngest `step.run` step ID memoization + `SyncRun.emailSentAt` stamp + Resend `idempotencyKey` (24h) |
| Secret leakage via logs (`RESEND_API_KEY`, `contactEmail`) | Information disclosure | Structured error objects exclude these fields; verification gate greps for `console.*` |
| Resend webhook spoofing | Spoofing | N/A — Phase 8 does NOT register Resend webhooks (deferred to a future observability phase per CONTEXT.md). |
| Open redirect via failure-email retry link | Tampering | Retry URL is constructed server-side from `HOST` + `syncRunId` — no user input in the URL path. |

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Next.js 16 App Router + bun + TypeScript strict + Prisma + Postgres + pgvector + Tailwind 4. No framework migrations in V1.
- **Package manager:** bun only — never `npm install` / `pnpm` / `yarn`.
- **AI provider:** Vercel AI Gateway is the sole runtime entry for chat completions. The cap check is the new gatekeeper between auth and the gateway call.
- **Email provider:** Resend with React Email templates — LOCKED.
- **Hard cap:** Per-shop monthly cap enforced server-side until billing ships. Phase 8 IS this enforcement.
- **Security:** No secrets, no session tokens, no auth headers in logs. No `console.*` in shipped paths. CLAUDE.md hard rule.
- **Multi-tenancy:** Every Prisma model with merchant data carries a `shop` column. Queries always filter by shop. `RequestCounter` composite PK `(shop, period)` makes this structurally implicit.
- **Hosting:** Vercel-first. Email send must not block beyond Vercel function timeout — it lives in Inngest, which has its own timeout budget.
- **Catalog scale:** ≤5k products per shop. Bulk Operations API explicitly out of scope.
- **Storefront identity:** Anonymous visitor cookie (Phase 6) — Phase 8 does not change identity handling.
- **`db/manual-indexes.sql`:** Idempotent re-apply after every `prisma migrate reset` (Phase 3 lock); Phase 8 migrations use Option A pattern to avoid touching this file.

## Sources

### Primary (HIGH confidence)

- `npm view resend` (executed 2026-05-27) — version 6.12.4, repo `github.com/resend/resend-node`, no postinstall, first published 2017-02-25
- `npm view @react-email/components` (executed 2026-05-27) — version 1.0.12, same vendor repo `github.com/resend/react-email`
- `npm view @react-email/render` (executed 2026-05-27) — version 2.0.8, same vendor
- `npm view inngest` (executed 2026-05-27) — version 4.4.0 (already pinned in package.json)
- `npm view ai` (executed 2026-05-27) — version 6.0.191 latest; project pinned at ^6.0.77
- Resend Idempotency Keys docs — https://resend.com/docs/dashboard/emails/idempotency-keys (verified send signature, options bag form)
- Resend Send API reference — https://resend.com/docs/api-reference/emails/send-email (verified parameters, response shape)
- React Email introduction — https://react.email/docs/introduction (verified primitives + render() pattern)
- Vercel AI SDK v6 stream protocol — https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol (verified chunk taxonomy)
- Vercel AI SDK createUIMessageStream reference — https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream (verified signature, writer methods)
- Inngest createFunction reference — https://www.inngest.com/docs/reference/typescript/functions/create (verified onFailure option)
- Inngest steps guide — https://www.inngest.com/docs/learn/inngest-steps (verified step.run memoization)
- PostgreSQL INSERT docs — https://www.postgresql.org/docs/current/sql-insert.html (verified ON CONFLICT atomicity + RETURNING + WHERE on DO UPDATE)
- Prisma raw queries docs — https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/raw-queries (verified $queryRaw vs $executeRaw)
- Shopify Admin GraphQL `Shop` object — https://shopify.dev/docs/api/admin-graphql/latest/objects/Shop (verified `contactEmail: String!` type)

### Secondary (MEDIUM confidence)

- WebSearch on inngest step.run memoization (cross-verified Inngest official docs)
- Inngest improved error handling blog — https://www.inngest.com/blog/improved-error-handling (onFailure signature mention)

### Tertiary (LOW confidence)

- None — all critical claims verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified on npm with vendor-owned repo, official docs grep, no postinstall scripts
- Architecture: HIGH — patterns drawn from Phase 7's verified ShopSettings/getActiveChatModel template; Phase 2's existing Inngest function code inspected
- Pitfalls: HIGH — Pitfall 1 (Prisma 7 drift) is documented in STATE.md Phase 7; Pitfalls 2-5 verified against vendor docs; Pitfalls 6-7 derived from CLAUDE.md hard rules + Phase 4/7 conventions
- Atomic counter SQL: HIGH — Postgres docs explicitly cover ON CONFLICT atomicity + the `WHERE` predicate on DO UPDATE
- AI SDK v6 stream synthesis: HIGH — verified createUIMessageStream + chunk taxonomy on official v6 docs
- Inngest step idempotency: HIGH — verified across two official docs pages
- Shopify contactEmail: HIGH on type (verified against official Shopify GraphQL reference); MEDIUM on runtime null-tolerance (training data + D-05 guidance — defensive code handles either)

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days — Resend SDK and React Email are stable, but the `ai` v6 line is evolving rapidly; recheck if planning slips past 2026-06-15)
