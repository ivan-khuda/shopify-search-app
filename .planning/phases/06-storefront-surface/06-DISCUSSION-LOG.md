# Phase 6: Storefront Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 06-storefront-surface
**Areas discussed:** Persistence layer scope, Visitor→customer identity merge, Extension bundle strategy, Conversation row granularity

---

## Persistence layer scope

### Q1 — Storefront persistence shape

| Option | Description | Selected |
|--------|-------------|----------|
| Pure DB, server is source of truth | Drawer mount fetches via App Proxy; all writes go through App Proxy; LocalStorage holds only visitor_id; cross-device merge is a simple DB rewrite | ✓ |
| DB + LocalStorage write-through cache | LocalStorage as read path, also POST to App Proxy on every write; reconcile on drawer mount; offline reads work but 2 stores of truth = sync edge cases | |
| DB for saved, LocalStorage for history | Cross-device for saves but session-bound history; violates IDN-03/IDN-04 as written | |

**User's choice:** Pure DB, server is source of truth.
**Notes:** Locked D-01. SC#3 (cross-device merge) requires server-side storage; LocalStorage cache only adds sync complexity.

### Q2 — Store implementation behind Phase 5 interfaces

| Option | Description | Selected |
|--------|-------------|----------|
| DbBacked*Store behind Phase 5 D-06 interfaces | App Proxy fetches under the hood; ChatPane stays prop-driven; Phase 8 swap pulled forward for storefront | ✓ |
| Skip the store abstraction on storefront | React Query / SWR hooks in DrawerShell only; divergence from admin | |
| You decide | Defer to planner | |

**User's choice:** DbBacked*Store behind Phase 5 interfaces.
**Notes:** Locked D-02. Preserves Phase 5 D-06 contract; admin keeps LocalStorage per D-07.

### Q3 — App Proxy endpoint shape

| Option | Description | Selected |
|--------|-------------|----------|
| REST per-resource | /api/proxy/conversations, /api/proxy/saved-products, /api/proxy/chat etc.; HMAC per route; cacheable | ✓ |
| Aggregated /api/proxy/state + per-resource writes | Single bootstrap fetch; fat boundary that grows | |
| RPC-style /api/proxy/op | Single endpoint with `op` field; non-idiomatic | |

**User's choice:** REST per-resource.
**Notes:** Locked D-03.

### Q4 — Conversation lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Per drawer-open session | First message creates row; appends until close or resume from History | ✓ |
| Rolling single conversation + New Chat button | Persistent row + explicit reset button; new UI affordance | |
| Time-bucketed (idle > 30min) | Auto-segmentation; opaque to users | |
| You decide | Defer to planner | |

**User's choice:** Per drawer-open session.
**Notes:** Locked D-04. Matches existing admin chat-shell behavior.

### Q5 — History pagination & cap

| Option | Description | Selected |
|--------|-------------|----------|
| Cap 20, no pagination, oldest dropped | Bounded storage, simple | |
| No cap, cursor pagination 20/page | Keep all, infinite scroll cursor; needs retention policy | ✓ |
| Cap 50 + 10/page cursor | Middle ground | |
| You decide | Defer | |

**User's choice:** No cap, cursor pagination 20/page.
**Notes:** Locked D-05. Drove the need for D-07 retention policy.

### Q6 — Clear All semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-delete all visitor rows | Irreversible, simple | ✓ |
| Soft-delete with deletedAt | Undo possible; storage bloat | |
| Hard-delete + 5s undo banner | Local optimistic hide + delayed DELETE; toast surface not in UI-SPEC | |

**User's choice:** Hard-delete all visitor rows.
**Notes:** Locked D-06.

### Q7 — Retention policy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-delete > 180 days, weekly Inngest cron | Bounded storage growth; weekly sweep | ✓ |
| No retention this phase | Defer to later | |
| 60-day stricter cleanup | Tighter window | |

**User's choice:** Auto-delete > 180 days, weekly Inngest cron.
**Notes:** Locked D-07.

### Q8 — Abuse guard before Phase 8 cap

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory per-visitor rate limit | Map + TTL; cheap, imperfect across instances | ✓ |
| DB-backed per-visitor rate limit | Accurate; pulls forward Phase 8 schema | |
| Defer all rate-limiting to Phase 8 | Endpoints unprotected in interim | |

**User's choice:** In-memory per-visitor rate limit.
**Notes:** Locked D-08. Phase 8's DB-backed RequestCounter supersedes once shipped.

---

## Visitor → customer identity merge

### Q1 — Merge trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Once per (visitor_id, customer_id) pair | VisitorCustomerLink marker row; subsequent opens are O(1) | ✓ |
| Every drawer-open with customer | Idempotent re-runs; extra DB churn | |
| Lazy on first WRITE only | UNION reads until merge happens; cursor complexity | |

**User's choice:** Once per (visitor_id, customer_id) pair.
**Notes:** Locked D-09.

### Q2 — Conflict resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Union with dedupe by productId | No data loss per IDN-06 | ✓ |
| Customer wins | Anon discarded; violates IDN-06 | |
| Anon wins | Customer overwritten; data loss | |

**User's choice:** Union with dedupe.
**Notes:** Locked D-10.

### Q3 — Merge row mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Re-key anon rows in place via UPDATE … SET customer_id | Both ids on the row; minimal movement | ✓ |
| Copy anon to new customer rows, soft-delete originals | Row duplication; soft-delete column already rejected | |
| Link table only, JOIN on reads | Every read pays join cost | |

**User's choice:** Re-key in place.
**Notes:** Locked D-11.

### Q4 — Logout / customer switch

| Option | Description | Selected |
|--------|-------------|----------|
| Logout = anon; switch = new merge per pair | Single visitor_id can link to multiple customer_ids over time | ✓ |
| Once-linked-always-linked | New customer on same browser = regenerated visitor_id | |
| Reset visitor_id on every transition | Defeats anon persistence | |

**User's choice:** Logout = anon; switch = new merge per pair.
**Notes:** Locked D-12.

---

## Extension bundle strategy

### Q1 — Bundle deployment model

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy-load: tiny loader, main bundle from your domain on first FAB click | Small extension; ~100–300ms cold-load latency on first open; iteration without `shopify app deploy` | ✓ |
| Single fat bundle in extension | 200–400KB shipped to every storefront page | |
| Iframe to Next.js page over App Proxy | Cross-origin pain; awkward z-index/scrim | |

**User's choice:** Lazy-load.
**Notes:** Locked D-13.

### Q2 — Bundle host + build pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| esbuild prebuild → public/storefront-bundle.[hash].js + manifest.json | Lightweight, scriptable | |
| Next.js API route streams bundle | Cold start; awkward caching | |
| Custom webpack/turbopack entry | Fights the framework | |
| You decide — planner picks esbuild vs Vite | Defer build tooling to planner; constraint is the file+manifest contract | ✓ |

**User's choice:** You decide.
**Notes:** Locked D-14 to planner discretion. Output contract (hashed .js + manifest.json) is locked.

### Q3 — Loader UX on first FAB click

| Option | Description | Selected |
|--------|-------------|----------|
| Drawer opens immediately with skeleton; bundle hydrates in place | Best perceived perf; needs ~1–2KB inline skeleton CSS in loader | ✓ |
| Blocking spinner overlay until bundle ready | Janky | |
| FAB shows mini-spinner; drawer opens when ready | Feels unresponsive at higher latencies | |

**User's choice:** Drawer opens immediately with skeleton.
**Notes:** Locked D-15. Requires a UI-SPEC supplement (skeleton state).

### Q4 — App Embed schema

| Option | Description | Selected |
|--------|-------------|----------|
| STR-02 minimum: enabled, accent_color, fab_position (br/bl) | Smallest viable; matches UI-SPEC | ✓ |
| Extended + drawer_position + greeting override + ARIA override | Copy override conflicts with UI-SPEC | |
| Minimum + locale override | Pulls forward i18n infrastructure | |
| You decide | Defer | |

**User's choice:** STR-02 minimum.
**Notes:** Locked D-16.

---

## Conversation row granularity

### Q1 — Message storage shape

| Option | Description | Selected |
|--------|-------------|----------|
| JSONB blob on Conversation row | Matches Vercel AI SDK UIMessage[]; single SELECT for resume; write-amplification negligible for short threads | ✓ |
| Related ChatMessage table | O(1) appends; supports cross-message search; harder mapping to AI SDK shape | |
| Hybrid: JSONB + denorm columns | Must keep denorm consistent | |
| You decide | Defer | |

**User's choice:** JSONB blob on Conversation row.
**Notes:** Locked D-17. Cross-message SQL search deferred.

### Q2 — Conversation title

| Option | Description | Selected |
|--------|-------------|----------|
| First user message, truncated to 60 chars | Stored at write time; zero AI cost | ✓ |
| AI-generated summary on close | Extra AI Gateway cost per conversation | |
| Timestamp only | Visitors can't tell conversations apart by content | |

**User's choice:** First user message, truncated to 60 chars.
**Notes:** Locked D-18.

### Q3 — DB write timing

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic user+assistant pair on stream complete | Single transaction via onFinish; mid-stream failures lose the user message (accepted) | ✓ |
| User message immediately + assistant on complete | 2x writes; handles orphan case in resume | |
| Streaming append every N tokens | Write thrashing | |

**User's choice:** Atomic user+assistant pair on stream complete.
**Notes:** Locked D-19.

### Q4 — SavedProduct uniqueness

| Option | Description | Selected |
|--------|-------------|----------|
| Two partial unique indexes (by visitor_id when customer NULL, by customer_id otherwise) | Matches D-11 merge semantics; raw-SQL migration | ✓ |
| Single unique on (shop, COALESCE(customer_id, visitor_id), product_id) | Functional index; not natively Prisma-modeled | |
| You decide | Defer | |

**User's choice:** Two partial unique indexes.
**Notes:** Locked D-20. Migrations extend `bun db:indexes` pattern.

---

## Claude's Discretion

- Exact bundle build tooling (esbuild vs Vite) — D-14
- Exact `useDbBackedHistoryStore` hook ergonomics — D-02
- Exact rate-limit Map eviction strategy (sliding window vs fixed bucket vs token bucket) — D-08
- Inngest function shape for D-07 retention sweep
- Whether to extract a `withAppProxyHmac` wrapper or inline HMAC per route — recommendation: extract
- Skeleton state CSS layout (D-15) — small UI-SPEC supplement

## Deferred Ideas

- AI-generated conversation summaries for History tab
- DB-backed History/Saved for the admin chat surface (Phase 8)
- Locale override / multilingual storefront support
- Greeting / CTA text overrides for App Embed
- Drawer position left/right slide
- Cross-message SQL search (denormalized ChatMessage shadow table or FTS over JSONB)
- Soft-delete on Clear All with undo banner
- DB-backed cross-instance rate limit (Phase 8 supersedes)
- Multi-tab same-visitor concurrent drawer coordination (BroadcastChannel)
- Inngest cron scheduling fallback (manual cleanup script if cron infrastructure isn't ready)
- Per-merchant audit log of merges (richer than VisitorCustomerLink)
