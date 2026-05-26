# Phase 6: Storefront Surface — Research

**Researched:** 2026-05-26
**Domain:** Shopify Theme App Extension + App Proxy + storefront drawer + visitor/customer identity persistence
**Confidence:** HIGH (every Claude's Discretion item resolved against authoritative sources)

## Summary

Phase 6 wires a FAB-triggered chat drawer into merchant storefronts via a Shopify Theme App Extension (App Embed block, `target: body`) and an App Proxy at `/apps/smartdiscovery/*`. The drawer composes the runtime-neutral `lib/chat-ui/*` components shipped in Phase 5, mounted by a custom `<smartdiscovery-app>` element. All identity flows through `visitor_id` in localStorage (App Proxy strips `Set-Cookie`), optionally upgraded to a `customer_id` link when `window.Shopify.customer` is present. New Prisma models — `Conversation`, `SavedProduct`, `VisitorCustomerLink` — back DB-only persistence; LocalStorage variants stay scoped to the admin surface. The streaming chat endpoint at `/api/proxy/chat` replaces the existing 501 stub, validating App Proxy HMAC via `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` and writing the conversation atomically inside Vercel AI SDK v6's `onFinish` callback.

The bundle is **lazy-loaded** on first FAB click from `https://<vercel-host>/storefront-bundle.<hash>.js` (D-13). The extension itself ships only a tiny loader (~5–15KB) plus skeleton CSS — chat iteration no longer requires `shopify app deploy`. Bundle build pipeline resolves to **esbuild** (smallest dependency, scriptable, native content-hash + manifest output, runs cleanly inside `bun run prebuild`). Rate limiting is an in-memory sliding window per visitor with documented Vercel cold-start caveats; retention sweep is a single Inngest cron with paginated `step.run` deletes.

**Primary recommendation:** Plan should produce 8 waves: (1) Wave 0 RED scaffolds + Prisma schema + partial-index SQL author; (2) [BLOCKING] migration apply + `bun db:indexes` adapter; (3) `withAppProxyHmac` wrapper + `rateLimit` helper + `DbBacked*` stores + storefront adapter customer_id edit; (4) eight `/api/proxy/*` REST routes + replacement of `/api/proxy/chat` 501 stub; (5) Inngest retention cron; (6) `extensions/chat-drawer/` package (App Embed liquid + loader.js + loader.css) + `shopify.app.toml` `[app_proxy]` block; (7) `public/storefront-bundle.*` build pipeline (esbuild prebuild script) + manifest + drawer shell component; (8) verification gate (HMAC fuzz tests + manual smoke against dev store).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Persistence layer scope (storefront)**
- **D-01:** Pure DB on storefront — Postgres `Conversation` + `SavedProduct` tables are the sole source of truth. Only `visitor_id` UUID lives in `localStorage`.
- **D-02:** `DbBackedHistoryStore` + `DbBackedSavedProductsStore` implement the Phase 5 D-06 store interfaces; live alongside `LocalStorage*Store` in `lib/chat-ui/stores/`; admin continues using LocalStorage variants.
- **D-03:** REST per-resource App Proxy endpoints under `app/api/proxy/`. Each route HMAC-verifies independently via `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })`. Eight routes total (see decision body).
- **D-04:** New Conversation row per drawer-open session. First user message calls `POST /api/proxy/conversations`; subsequent messages `PATCH`.
- **D-05:** No per-visitor cap. 20 conversations/page, cursor pagination, ordered by `lastMessageAt DESC`.
- **D-06:** "Clear All" hard-deletes for visitor_id + linked customer_id. No soft-delete, no undo banner.
- **D-07:** Weekly Inngest cron sweeps `lastMessageAt < now() - INTERVAL '180 days'`. Fallback to manual `bun script:cleanup-conversations` if Inngest cron not ready.
- **D-08:** Per-visitor in-memory rate limit. `/api/proxy/chat`: 30 messages / 5 minutes. Reads + writes: 60 / minute. 429 + `Retry-After`.

**B. Visitor → customer identity merge**
- **D-09:** Merge fires once per `(visitor_id, customer_id)` pair via new `VisitorCustomerLink` model.
- **D-10:** SavedProduct: union with dedupe by product_id. Conversation: union by row id.
- **D-11:** Merge transactional SQL (see CONTEXT.md for exact statements).
- **D-12:** Logout reverts to anon (new threads, no past-customer visibility). Different customer = new merge pair.

**C. Extension bundle strategy**
- **D-13:** Lazy-load model. Loader (~5–15KB) in extension; main bundle dynamically `import()`ed from app's `public/`.
- **D-14:** Bundle build pipeline — **researcher resolves** → see "Bundle Build Pipeline" section. Constraint: single `.js` content-hashed + `public/storefront-manifest.json`.
- **D-15:** Skeleton state on first FAB click; bundle hydrates into existing container. Skeleton CSS lives in loader inline.
- **D-16:** App Embed schema STR-02 minimum: `enabled` (checkbox), `accent_color` (color), `fab_position` (select).

**D. Conversation row granularity**
- **D-17:** Messages as JSONB blob on Conversation row (UIMessage[] verbatim).
- **D-18:** Conversation title = first user message truncated to 60 chars.
- **D-19:** DB write timing = `onFinish` callback in `/api/proxy/chat` handler. Atomic user+assistant message append.
- **D-20:** SavedProduct uniqueness via two partial unique indexes — raw SQL migration.

**E. Storefront chat endpoint completion**
- **D-21:** Replace 501 stub per TODO checklist already in `app/api/proxy/chat/route.ts` (10 numbered steps).

### Claude's Discretion (resolved by this research — see body for evidence)

| # | Question | Resolution |
|---|----------|------------|
| 1 | Bundle build tooling (D-14) | **esbuild** prebuild script (`bun run prebuild`) — see "Bundle Build Pipeline" |
| 2 | `withAppProxyHmac` wrapper extraction | **Extract** — paralleling `withShopifySession`. Signature locked in section. |
| 3 | Rate-limit Map eviction (D-08) | **Sliding-window** with per-bucket TTL eviction on Map. Document Vercel cold-start + cross-instance limitations explicitly. |
| 4 | Inngest cron shape (D-07) | `inngest.createFunction({ id, triggers: [{ cron: '0 3 * * 0' }] }, ...)` with paginated `step.run` deletes batched at 1000 rows. |
| 5 | Vercel AI SDK v6 contract | Confirmed: `streamText` with `onFinish: async (result) => { ... }` is the supported async DB-write site. `toUIMessageStreamResponse()` (NOT `toAIStreamResponse`) is the v6 response shape — same call as `app/api/chat/route.ts:100`. |
| 6 | Theme App Extension generation | `shopify app generate extension --type theme_app_extension`. Schema target: `body`. designMode guard checked at FAB-click time, NOT mount. |
| 7 | App Proxy specifics | `[app_proxy]` block: `url`, `subpath`, `prefix=apps`. HMAC algo: SHA-256, params alphabetized, joined `key=value` with **NO delimiter** (NOT `&`). Param name is `signature`, not `hmac`. |
| 8 | Prisma partial unique indexes | Raw SQL in `db/manual-indexes.sql` (existing pattern); both `CREATE UNIQUE INDEX IF NOT EXISTS … WHERE customerId IS NULL` and `… IS NOT NULL`. |
| 9 | `window.Shopify.customer` lifecycle | Available **only when customer logged into theme**. Properties: `id`, `email`, etc. NOT a JS API — it is an object Shopify injects via theme liquid. May not be set synchronously; check at first FAB click. |

### Deferred Ideas (OUT OF SCOPE)

- AI-generated conversation summaries for History titles
- DB-backed History/Saved for admin surface (Phase 8 D-09 carry-over)
- Locale override / multilingual storefront
- Greeting/CTA copy overrides for App Embed
- Drawer-side override (left slide)
- Cross-message SQL search (JSONB precludes it)
- Soft-delete + undo banner for Clear All
- DB-backed cross-instance rate limit (Phase 8)
- Multi-tab same-visitor coordination
- Per-merchant merge audit log

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STR-01 | Theme App Extension package `extensions/chat-drawer/` with App Embed block | Theme App Extension generation + file structure section; bundle build pipeline |
| STR-02 | App Embed JSON schema: enabled, accent_color, fab_position | Schema settings section; Shopify CLI schema attribute reference (color/checkbox/select) |
| STR-03 | `shopify.app.toml` `[app_proxy]` block routing `/apps/smartdiscovery/*` | App Proxy configuration block decision; locked TOML format |
| STR-04 | HMAC verification via `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` | App Proxy HMAC details + `withAppProxyHmac` wrapper |
| STR-05 | FAB 56px circle, 380–420px desktop drawer, full-height mobile bottom-sheet, Chat/History/Saved tabs | Phase 6 UI-SPEC (already locked); drawer shell implementation in `extensions/chat-drawer/src/components/StorefrontDrawer.tsx` |
| STR-06 | Empty state with greeting + 3–4 chips; no-results inherits Phase 4 | UI-SPEC + carried Phase 4 `MessageParts` |
| STR-07 | Z-index strategy; `Shopify.designMode` guard | designMode lifecycle + z-index sections |
| STR-08 | All storefront-to-backend traffic via App Proxy (no cross-origin) | All requests pattern: storefront client → `/apps/smartdiscovery/*` → backend |
| IDN-01 | UUID visitor_id in localStorage | `StorefrontAdapter` already implements (`smartdiscovery.visitor_id` key) |
| IDN-02 | When `window.Shopify.customer` present, link visitor_id → customer_id | `StorefrontAdapter` edit + merge transaction (D-09/D-11) |
| IDN-03 | Conversation Prisma model with shop, visitorId, customerId?, messages JSONB | Schema additions section |
| IDN-04 | History tab opens past conversations to resume | `DbBackedHistoryStore` + `GET /api/proxy/conversations/:id` |
| IDN-05 | SavedProduct Prisma model | Schema additions section |
| IDN-06 | Merge anon visitor data into customer-keyed records (no data loss) | D-09/D-10/D-11 + `VisitorCustomerLink` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FAB rendering + drawer slide animation | Browser (theme-injected) | — | Storefront-only; no SSR; theme context owns paint |
| Lazy-load bundle download | Browser → CDN (Vercel static) | — | Loader fetches manifest, then bundle; both static |
| visitor_id generation + persistence | Browser (localStorage) | — | Per IDN-01; App Proxy strips Set-Cookie so cookies aren't viable |
| `window.Shopify.customer` read | Browser (theme global) | — | Shopify injects in theme; only readable client-side |
| App Proxy HMAC verification | API (Next.js route handler) | — | Per STR-04; must occur server-side with `SHOPIFY_API_SECRET` |
| Streaming chat completion | API → Vercel AI Gateway | — | Identical to admin `/api/chat`; Gateway handles model routing |
| `searchCatalog` tool execution | API → DB (pgvector + tsvector) | — | Same `hybridSearch(shop, ...)` import as admin route |
| Conversation/SavedProduct CRUD | API (Next.js route handlers) | DB (Prisma) | REST endpoints; transactional |
| visitor_id → customer_id merge | API (Postgres transaction) | — | Atomicity required; runs inside same tx as new Conversation create |
| Retention sweep (180-day delete) | Inngest scheduled function | DB (Prisma) | Cron-driven background work, batched deletes |
| Rate limiting | API in-memory (this phase) → DB (Phase 8) | — | Phase 8 supersedes; Phase 6 ships in-memory placeholder |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@shopify/shopify-api` | 12.3.0 (already installed) | App Proxy HMAC validation + session storage | `signator: 'appProxy'` is officially supported and documented in 12.x [VERIFIED: github.com/Shopify/shopify-app-js docs/reference/utils/validateHmac.md] |
| `inngest` | ^4.4.0 (already installed) | Weekly retention cron via `triggers: [{ cron: '...' }]` | Already wired in `lib/inngest/client.ts` + `app/api/inngest/route.ts` [VERIFIED: codebase] |
| `ai` | ^6.0.77 (already installed) | `streamText` + `onFinish` callback + `toUIMessageStreamResponse` | Mirrors admin chat exactly. v6 confirmed via [CITED: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text]. Phase 4 already uses these APIs in `app/api/chat/route.ts:76-100` |
| `@prisma/client` | ^7.3.0 (already installed) | Conversation / SavedProduct / VisitorCustomerLink models + transactional merge | Established pattern; `lib/db/client.ts` singleton |
| `zod` | ^4.3.6 (already installed) | Request body validation for `/api/proxy/*` routes | Mirrors admin Zod-on-tool-input pattern |
| `esbuild` | NEW — add as devDependency, latest `~0.25.x` | Build single content-hashed `storefront-bundle.<hash>.js` from `extensions/chat-drawer/src/entry.tsx` | Smallest dep footprint; scriptable; native content-hash via `entryNames: '[name].[hash]'`; ~50ms cold builds [CITED: esbuild.github.io/api] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` | ^8.21.0 (already installed) | Raw SQL apply for partial unique indexes via `scripts/apply-manual-indexes.ts` | Existing pattern from pgvector/GIN; D-20 partial unique indexes extend `db/manual-indexes.sql` |
| `motion` | ^12.38.0 (already installed) | Drawer slide animation (UI-SPEC locked) | Already in package.json |
| `lucide-react` | ^0.563.0 (already installed) | Sparkles / X icons | UI-SPEC locked |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild | Vite (library mode) | Vite is more familiar but adds Rollup + plugin ecosystem dep weight; library mode supports manifest emission but is heavier than esbuild's flat output. Reject for V1: bundle output is a single entry, no HMR needed at storefront, esbuild's simpler API wins. |
| esbuild | Custom Next.js webpack/turbopack entry | Fights the framework — Next.js wants pages, not loose bundles. Rejected. |
| esbuild | Bun's built-in bundler (`bun build --target browser`) | **Plausible alternative** — Bun is the package manager, `bun build` is integrated, content-hash naming works. Researcher recommendation: try `bun build` first; fall back to esbuild only if `--entry-naming '[name]-[hash].js'` + manifest emission proves awkward. Both are HIGH confidence to work. [VERIFIED: bun.sh/docs/bundler] |
| `signator: 'appProxy'` with v12 library | Hand-rolled `crypto.createHmac('sha256', SHOPIFY_API_SECRET)` | Hand-rolled is the documented workaround in the historical bug reports (issue #878). **Currently unnecessary** — `signator: 'appProxy'` works in 12.x [VERIFIED: github.com/Shopify/shopify-app-js docs]. Keep hand-rolled implementation as fallback if integration test fails. |
| In-memory rate limit (D-08) | DB-backed RequestCounter | Phase 8 ships DB-backed. D-08 acknowledges the imperfection. Don't over-engineer. |

**Installation:**
```bash
bun add -d esbuild
# (Bun's built-in bundler is already available — esbuild is a fallback)
```

**Version verification (run during planning):**
```bash
bun pm view esbuild version          # confirm latest stable
bun pm view @shopify/shopify-api version    # confirm 12.3.x still current
bun pm view ai version               # confirm 6.x still current
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `esbuild` | npm | 5+ yrs | 100M+/wk | github.com/evanw/esbuild | unavailable (no slopcheck tool present) | `[ASSUMED]` — planner adds checkpoint:human-verify before install. (Realistically: this is the single most-downloaded bundler on npm and is unambiguously legitimate; verifying via `bun pm view esbuild` is sufficient.) |

All other packages listed in Standard Stack are **already installed** (verified by reading `package.json`). No new third-party additions beyond esbuild. If the planner chooses Bun's built-in bundler, **zero** new packages are added.

## Architecture Patterns

### System Architecture Diagram

```
                                                Merchant Storefront (browser)
                                                        │
                                                        │ 1. Page load
                                                        ▼
                                  ┌──────────────────────────────────────────────┐
                                  │ Shopify Theme renders all theme blocks       │
                                  │ + App Embed block (extensions/chat-drawer)   │
                                  │   - loader.js (5–15KB)                       │
                                  │   - loader.css (1–2KB skeleton)              │
                                  │   - <smartdiscovery-app> custom element      │
                                  └────────────┬─────────────────────────────────┘
                                               │ 2. Loader paints FAB
                                               ▼
                                  ┌──────────────────────────────────────────────┐
                                  │ FAB visible bottom-right (or -left)          │
                                  │ Drawer NOT mounted yet                       │
                                  └────────────┬─────────────────────────────────┘
                                               │ 3. First FAB click
                                               │ (check Shopify.designMode → if true, skip)
                                               ▼
                                  ┌──────────────────────────────────────────────┐
                                  │ Loader:                                      │
                                  │  (a) slides in skeleton drawer immediately   │
                                  │  (b) fetches /storefront-manifest.json from  │
                                  │      <vercel-host>                            │
                                  │  (c) dynamically import()s the hashed bundle │
                                  └────────────┬─────────────────────────────────┘
                                               │
                                               ▼
                                  ┌──────────────────────────────────────────────┐
                                  │ React hydrates inside skeleton container.    │
                                  │ Mount order:                                 │
                                  │   <StorefrontDrawer> (extension code)        │
                                  │   └─ <ChatPane> (lib/chat-ui)                │
                                  │       └─ adapter: StorefrontAdapter           │
                                  │           reads localStorage.visitor_id      │
                                  │           reads window.Shopify?.customer?.id │
                                  └────────────┬─────────────────────────────────┘
                                               │ 4. User sends first message
                                               ▼
   Storefront browser ─── fetch via App Proxy ──▶ Shopify ─── proxies to ──▶ Next.js app
   (origin: <merchant>.myshopify.com)             (adds signature)            (Vercel)
                                                                                  │
                                                                                  ▼
                                                                     /api/proxy/chat (POST)
                                                                            │
                                                                            ▼
                                                          withAppProxyHmac wrapper
                                                          ├─ validateHmac({ signator: 'appProxy' })
                                                          │  → derives shop from signed query
                                                          ├─ rateLimit(visitor_id, 'chat')
                                                          │  → 30/5min sliding window
                                                          └─ handler:
                                                              ├─ parse body { visitor_id, customer_id?, conversation_id?, messages }
                                                              ├─ if first message of session: INSERT Conversation
                                                              ├─ if customer_id && !merged: D-11 merge in same tx
                                                              ├─ resolve model via getActiveChatModel(shop)
                                                              ├─ streamText({ tools: { searchCatalog }, onFinish })
                                                              │   └─ tool executes hybridSearch(shop, ...)
                                                              └─ onFinish:
                                                                  UPDATE Conversation
                                                                  SET messages = messages || $new
                                                                      lastMessageAt = NOW()
                                                              └─ return result.toUIMessageStreamResponse()

   For non-chat routes (conversations/saved-products GET/POST/PATCH/DELETE):
   same pipeline but skip streamText; respond with JSON.

   Background:
   Inngest cron weekly ──▶ retentionSweep function ──▶ paginated DELETE Conversation
                                                      WHERE lastMessageAt < now() - 180 days
                                                      (1000 rows per step.run)
```

### Recommended Project Structure

```
extensions/
└── chat-drawer/                              # STR-01 new package
    ├── shopify.extension.toml                # type = "theme"
    ├── blocks/
    │   └── app_embed.liquid                  # App Embed block + {% schema %} (D-16)
    ├── assets/
    │   ├── loader.js                         # FAB + lazy-load shim
    │   ├── loader.css                        # FAB + skeleton inline CSS
    │   └── (storefront-bundle assets injected via <script src> from app domain)
    ├── locales/                              # not used in V1 (no i18n)
    └── src/                                  # esbuild input — NOT served by Shopify
        ├── entry.tsx                         # mount point for <smartdiscovery-app>
        └── components/
            ├── StorefrontDrawer.tsx          # FAB + drawer shell (UI-SPEC locked)
            └── PromptChips.tsx               # 4 suggested prompts (UI-SPEC locked)

app/api/proxy/
├── chat/route.ts                             # D-21 — replace existing 501 stub
├── conversations/
│   ├── route.ts                              # GET list / POST create / DELETE bulk
│   └── [id]/route.ts                         # GET / PATCH append
└── saved-products/
    ├── route.ts                              # GET / POST
    └── [productId]/route.ts                  # DELETE

lib/chat-ui/stores/
├── types.ts                                  # existing (Phase 5)
├── local-storage.ts                          # existing (admin uses)
├── db-backed.ts                              # NEW — DbBackedHistoryStore + DbBackedSavedProductsStore
└── hooks.ts                                  # existing — extend with useDbBackedHistoryStore

lib/shopify/
├── auth.ts                                   # existing — withShopifySession
└── app-proxy-auth.ts                         # NEW — withAppProxyHmac wrapper

lib/rate-limit/
└── memory.ts                                 # NEW — sliding-window Map<visitorId, timestamps[]>

inngest/functions/
├── sync-products.ts                          # existing
└── retention-sweep.ts                        # NEW — weekly Conversation cleanup

scripts/
├── apply-manual-indexes.ts                   # existing
└── cleanup-conversations.ts                  # NEW fallback per D-07

db/
└── manual-indexes.sql                        # extend with two partial unique indexes (D-20)

prisma/
├── schema.prisma                             # add Conversation / SavedProduct / VisitorCustomerLink
└── migrations/<new>/                          # base table migration via prisma migrate dev

public/
├── storefront-bundle.<hash>.js               # built by esbuild prebuild
└── storefront-manifest.json                  # { bundle: '/storefront-bundle.X.js', version: '<git-sha>' }
```

### Pattern 1: `withAppProxyHmac` Wrapper

**What:** A handler-decorator that pulls `signature` + other query params from the request URL, runs `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })`, extracts `shop` from the signed query (NEVER from raw query), and invokes the inner handler with `{ shop, req }`. Mirrors `withShopifySession` exactly so storefront-vs-admin auth boundaries are visually parallel.

**When to use:** Every route under `app/api/proxy/`. No exceptions. Forgetting it = CR-01 redux.

**Example signature:**
```typescript
// lib/shopify/app-proxy-auth.ts
// Source: derived from withShopifySession pattern (lib/shopify/auth.ts:70-84)
// + validateHmac({ signator: 'appProxy' }) [CITED: github.com/Shopify/shopify-app-js docs/reference/utils/validateHmac.md]
import { NextResponse } from 'next/server';
import { shopifyClient } from '@/lib/shopify/client';

export type AppProxyAuthErrorCode =
  | 'missing_signature'
  | 'invalid_signature'
  | 'missing_shop'
  | 'invalid_shop_domain';

export class AppProxyAuthError extends Error {
  public readonly status: 401 = 401;
  constructor(public readonly code: AppProxyAuthErrorCode) {
    super(`App Proxy auth error: ${code}`);
    this.name = 'AppProxyAuthError';
  }
}

export async function verifyAppProxyHmac(
  req: Request
): Promise<{ shop: string; query: Record<string, string> }> {
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => { query[key] = value; });

  if (!query.signature) throw new AppProxyAuthError('missing_signature');

  const isValid = await shopifyClient.utils.validateHmac(query, {
    signator: 'appProxy',
  });
  if (!isValid) throw new AppProxyAuthError('invalid_signature');

  const shop = query.shop;
  if (!shop) throw new AppProxyAuthError('missing_shop');
  if (!shop.endsWith('.myshopify.com')) {
    throw new AppProxyAuthError('invalid_shop_domain');
  }

  return { shop, query };
}

export function withAppProxyHmac(
  handler: (ctx: { shop: string; query: Record<string, string>; req: Request }) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const { shop, query } = await verifyAppProxyHmac(req);
      return await handler({ shop, query, req });
    } catch (err) {
      if (err instanceof AppProxyAuthError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      throw err;
    }
  };
}
```

**Usage:**
```typescript
// app/api/proxy/chat/route.ts (Phase 6 D-21)
import { withAppProxyHmac } from '@/lib/shopify/app-proxy-auth';
import { rateLimit } from '@/lib/rate-limit/memory';
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { hybridSearch } from '@/services/search/SearchService';
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

export const POST = withAppProxyHmac(async ({ shop, req }) => {
  const body = (await req.json()) as {
    messages: UIMessage[];
    visitor_id: string;
    customer_id?: string;
    conversation_id?: string;
  };

  if (!body.visitor_id) {
    return Response.json({ error: 'missing_visitor_id' }, { status: 400 });
  }

  const rl = rateLimit(body.visitor_id, 'chat');
  if (!rl.ok) {
    return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  // D-21 step 4: hard-cap stub (Phase 8 fills in)
  // void await checkHardCap(shop);

  // D-21 step 6/7: ensure Conversation row + merge if needed
  // ... (planner specifies exact tx ordering)

  const model = await getActiveChatModel(shop);

  const result = streamText({
    model: model.id,
    system: /* same system prompt as admin */,
    messages: await convertToModelMessages(body.messages),
    tools: {
      searchCatalog: tool({
        description: '...same as admin...',
        inputSchema: z.object({
          query: z.string().min(1).max(500),
          priceMin: z.number().optional(),
          priceMax: z.number().optional(),
        }),
        execute: async ({ query, priceMin, priceMax }) => {
          return hybridSearch(shop, query, { priceMin, priceMax });
        },
      }),
    },
    stopWhen: stepCountIs(3),
    onFinish: async (finishResult) => {
      // D-19: atomic append on stream complete
      // Push the user's last UIMessage and the assistant's response into the JSONB column
      await prisma.conversation.update({
        where: { id: conversationId, shop },
        data: {
          messages: { /* JSONB concat */ },
          lastMessageAt: new Date(),
        },
      });
    },
  });

  return result.toUIMessageStreamResponse();
});
```

### Pattern 2: `rateLimit` Sliding Window

**What:** Pure in-memory sliding-window limiter. Module-scope `Map<string, number[]>` (key = `${visitorId}:${bucket}`, value = unix-ms timestamps of recent hits). Each call (a) prunes timestamps older than the window, (b) checks length against limit, (c) pushes new timestamp.

**When to use:** Every `/api/proxy/*` handler. Two bucket types: `'chat'` (30/5min) and `'rest'` (60/min).

**Example:**
```typescript
// lib/rate-limit/memory.ts
//
// Acknowledged limitation: Map is per-instance. Vercel cold starts reset the
// Map; cross-instance enforcement is impossible without a shared store
// (Phase 8 supersedes with DB-backed RequestCounter).
//
// Eviction strategy: lazy. Map entries are pruned on access (window-expired
// timestamps shift out of array). No background sweep needed in V1; an
// adversary cannot keep memory growing because the timestamp array is
// O(limit-per-window) bounded.

interface Bucket {
  limitPerWindow: number;
  windowMs: number;
  retryAfterSeconds: number;
}

const BUCKETS: Record<string, Bucket> = {
  chat: { limitPerWindow: 30, windowMs: 5 * 60_000, retryAfterSeconds: 60 },
  rest: { limitPerWindow: 60, windowMs: 60_000, retryAfterSeconds: 30 },
};

const hits = new Map<string, number[]>();

export function rateLimit(
  visitorId: string,
  bucket: keyof typeof BUCKETS,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const cfg = BUCKETS[bucket];
  const now = Date.now();
  const key = `${visitorId}:${bucket}`;
  const arr = hits.get(key) ?? [];
  // Sliding window: drop anything older than now - windowMs
  const fresh = arr.filter((t) => now - t < cfg.windowMs);
  if (fresh.length >= cfg.limitPerWindow) {
    hits.set(key, fresh); // persist pruned array
    return { ok: false, retryAfterSeconds: cfg.retryAfterSeconds };
  }
  fresh.push(now);
  hits.set(key, fresh);
  return { ok: true };
}
```

### Pattern 3: Inngest Retention Sweep

**What:** A weekly cron-triggered Inngest function that paginates deletion of `Conversation` rows where `lastMessageAt < now() - INTERVAL '180 days'`. Each `step.run` batch deletes 1000 rows and re-checks. Idempotent.

**Example:**
```typescript
// inngest/functions/retention-sweep.ts
// Cron syntax via [CITED: inngest.com/docs/guides/scheduled-functions]
// Pagination via step.run() established pattern from inngest/functions/sync-products.ts
import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db/client';

export const retentionSweep = inngest.createFunction(
  {
    id: 'conversation-retention-sweep',
    triggers: [{ cron: '0 3 * * 0' }], // every Sunday 03:00 UTC
    retries: 2,
  },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - 180 * 24 * 3600 * 1000);
    let totalDeleted = 0;

    // Iterate until step finds <1000 rows in a batch (drained).
    for (let i = 0; i < 100; i++) {
      const batch = await step.run(`delete-batch-${i}`, async () => {
        const rows = await prisma.conversation.findMany({
          where: { lastMessageAt: { lt: cutoff } },
          select: { id: true },
          take: 1000,
        });
        if (rows.length === 0) return 0;
        const ids = rows.map((r) => r.id);
        const result = await prisma.conversation.deleteMany({
          where: { id: { in: ids } },
        });
        return result.count;
      });
      totalDeleted += batch;
      if (batch < 1000) break;
    }
    return { totalDeleted, cutoff: cutoff.toISOString() };
  },
);
```

**Wire into `app/api/inngest/route.ts`:** add `retentionSweep` to the `functions` array.

### Pattern 4: App Embed Liquid Block

**What:** A single `.liquid` file in `extensions/chat-drawer/blocks/app_embed.liquid` with `{% schema %}` declaring settings (per D-16) and asset injection. Loader is referenced via `{{ 'loader.js' | asset_url | script_tag }}` — Shopify CDN-hosts the asset.

**Example skeleton:**
```liquid
{% comment %}
  SmartDiscovery AI — App Embed (chat-drawer)
  Renders the loader script + CSS into <body>.
  Loader paints FAB and lazy-loads the main bundle from the app domain.
{% endcomment %}

{% if block.settings.enabled %}
  <smartdiscovery-app
    data-accent="{{ block.settings.accent_color }}"
    data-fab-position="{{ block.settings.fab_position }}"
    data-shop="{{ shop.permanent_domain }}"
    data-app-url="{{ block.shopify_attributes }}"
    {% if customer %}data-customer-id="{{ customer.id }}"{% endif %}
  ></smartdiscovery-app>
  {{ 'loader.js' | asset_url | script_tag }}
  {{ 'loader.css' | asset_url | stylesheet_tag }}
{% endif %}

{% schema %}
{
  "name": "SmartDiscovery AI",
  "target": "body",
  "settings": [
    {
      "type": "checkbox",
      "id": "enabled",
      "label": "Enable SmartDiscovery AI chat",
      "default": true
    },
    {
      "type": "color",
      "id": "accent_color",
      "label": "Chat accent color",
      "default": "#008060"
    },
    {
      "type": "select",
      "id": "fab_position",
      "label": "Button position",
      "options": [
        { "value": "bottom_right", "label": "Bottom right" },
        { "value": "bottom_left",  "label": "Bottom left" }
      ],
      "default": "bottom_right"
    }
  ]
}
{% endschema %}
```

**Customer id in data attribute:** the liquid `customer` object renders `customer.id` (numeric) only when logged in. The loader reads `dataset.customerId` — this is more reliable than `window.Shopify.customer.id` because the liquid render is synchronous at HTML emission and avoids the [FLAG-6 in UI-SPEC] timing risk.

**Sources:** [CITED: shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration], [CITED: shopify.dev/docs/api/liquid/objects/customer]

### Pattern 5: Loader (Asset)

**What:** Tiny vanilla-JS script that hydrates the custom element on first FAB click and dynamically imports the main bundle.

**Example skeleton:**
```javascript
// extensions/chat-drawer/assets/loader.js
(function () {
  const root = document.querySelector('smartdiscovery-app');
  if (!root) return;
  if (window.Shopify?.designMode) {
    // STR-07 / UI-SPEC: paint FAB only; drawer stays closed.
    // Loader still renders FAB so merchants can preview it in the editor.
  }

  const accent = root.dataset.accent || '#008060';
  const position = root.dataset.fabPosition || 'bottom_right';
  const shop = root.dataset.shop;
  const customerId = root.dataset.customerId || null;
  const appUrl = '<%= APP_URL %>'; // template-replaced at extension build time

  // Paint FAB skeleton via DOM injection
  const fab = document.createElement('button');
  fab.className = 'sd-fab sd-fab--' + position;
  fab.style.setProperty('--sd-accent', accent);
  fab.setAttribute('aria-label', 'Open SmartDiscovery AI chat');
  fab.innerHTML = /* Sparkles SVG inline */;
  root.appendChild(fab);

  let loaded = false;
  fab.addEventListener('click', async () => {
    if (window.Shopify?.designMode) return; // STR-07 guard at click time
    if (loaded) {
      // bundle already in memory; toggle drawer
      window.smartdiscovery.toggle();
      return;
    }
    loaded = true;
    // Show skeleton drawer
    document.body.classList.add('sd-skeleton-open');
    // Fetch manifest, then bundle
    const manifest = await fetch(appUrl + '/storefront-manifest.json').then((r) => r.json());
    await import(appUrl + manifest.bundle);
    window.smartdiscovery.mount({ shop, customerId, accent, position });
  });
})();
```

### Pattern 6: Partial Unique Indexes (D-20)

**What:** Append to `db/manual-indexes.sql` two `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE ...` statements. Run via existing `bun db:indexes`.

**Example addition to `db/manual-indexes.sql`:**
```sql
-- ============================================================
-- 4. SavedProduct anon-only uniqueness (D-20)
-- ============================================================
-- Anon rows: a given (shop, visitorId, productId) tuple may appear at most
-- once when customerId IS NULL. Different visitors can save the same product.

CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_anon_unique"
  ON saved_products (shop, "visitorId", "productId")
  WHERE "customerId" IS NULL;

-- ============================================================
-- 5. SavedProduct customer-linked uniqueness (D-20)
-- ============================================================
-- Customer-linked rows: a given (shop, customerId, productId) tuple may
-- appear at most once. Required for D-11 merge ON CONFLICT DO NOTHING.

CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_customer_unique"
  ON saved_products (shop, "customerId", "productId")
  WHERE "customerId" IS NOT NULL;
```

The existing `scripts/apply-manual-indexes.ts` already reads `db/manual-indexes.sql` and runs the whole file — no script changes needed. After `prisma migrate reset`, devs run `bun db:indexes` to restore all indexes (HNSW + GIN + the two new partials), keeping with CLAUDE.md's note: *"REQUIRED after every `prisma migrate reset`"*.

### Anti-Patterns to Avoid

- **Reading `shop` from raw `?shop=` before HMAC verification** — this is CR-01 from Phase 4 review. ALWAYS derive `shop` from the validated query inside `withAppProxyHmac`.
- **Sending `Set-Cookie` from `/api/proxy/*` routes** — Shopify strips them server-side. The browser will not see the cookie. Use localStorage for identity (per IDN-01).
- **Calling `streamText` without `onFinish`** — D-19 makes `onFinish` the single write site. Without it, conversation rows never get persisted.
- **Calling Prisma inside the `streamText` execute closure** — `searchCatalog` already does this (`hybridSearch`). Fine. But do NOT also write conversation rows inside `execute` — only inside `onFinish`. Otherwise a mid-stream abort leaves half-written rows.
- **`Cookie` reads in `/api/proxy/*`** — Shopify strips outbound `Cookie` headers too. Don't try to read browser cookies; identity must come from request body (`visitor_id`, `customer_id`).
- **Importing `next/image` in the extension bundle** — flagged in UI-SPEC §Risks #1. Use `<img>` with explicit `width`/`height` in `ProductCard` when consumed from the storefront bundle. Plan must determine whether to (a) image-adapt at the component level or (b) ship a separate `StorefrontProductCard` wrapper.
- **Forgetting `bun db:indexes` in CI / fresh-clone setup** — already documented in CLAUDE.md but worth re-flagging because Phase 6 grows the script's responsibility surface.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| App Proxy HMAC verification | Custom SHA-256 + sort + concat | `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })` | The library exists, knows the no-delimiter quirk, and is the locked decision per STR-04. **Hand-rolling is the historical workaround for a v7 bug that is fixed in v12.** |
| Cron scheduling | `setInterval` in a Next.js route | `inngest.createFunction({ triggers: [{ cron: '...' }] })` | Inngest already wired. Vercel functions don't keep timers alive. |
| Bundle hashing + manifest | Manually compute MD5 + write JSON | esbuild `entryNames: '[name]-[hash]'` + `metafile` output | esbuild emits both atomically. |
| Sliding-window rate limit | Custom token bucket + worker thread | Map-based sliding window (this phase) → DB-backed RequestCounter (Phase 8) | D-08 already locks this — don't expand scope. |
| App Embed schema settings | Custom JSON parser | Shopify CLI `{% schema %}` block with `type: checkbox`/`color`/`select` | Native; merchant-facing localization handled by `locales/schema.json` |
| Lazy bundle loading | Custom XHR + eval | Native dynamic `import()` from the app's hashed URL | Works in every storefront-supported browser (ES modules everywhere). |
| Partial unique indexes | Trigger functions | Postgres native `CREATE UNIQUE INDEX ... WHERE ...` | Postgres has had partial indexes since 1998. |
| Focus trap inside drawer | Manual `keydown Tab` loop | `focus-trap` (~3KB) OR rely on UI-SPEC: dialogs with `aria-modal="true"` + Radix Dialog | UI-SPEC line "Implement with `focus-trap` or manual `keydown Tab`" — defer to planner; Radix is preferred since `radix-ui` is already a dep. |

**Key insight:** Almost everything in this phase is glue between locked components. The big risk is over-engineering rate-limiting or HMAC verification — both are placeholders for Phase 8 / library calls respectively. Planning must resist the urge to "harden" beyond the scope D-08 and D-21 explicitly authorize.

## Bundle Build Pipeline (D-14 Resolution)

**Decision:** **esbuild** prebuild script, run as part of `bun build` via `package.json` `prebuild` script.

**Rationale:**
1. **Single-output design fits.** The storefront bundle is one ESM file with one entry — esbuild's flat output model is ideal. Vite's library mode would also work but ships Rollup + plugin machinery the project doesn't need.
2. **Content-hash naming is native.** esbuild's `entryNames: 'storefront-bundle-[hash]'` writes a content-hashed filename in one step.
3. **Manifest emission is trivial.** esbuild's `metafile: true` returns an output map; a 5-line post-build script writes `public/storefront-manifest.json`.
4. **Vercel deploys it transparently.** Anything in `public/` becomes a CDN-cached static asset on Vercel with `immutable` cache headers when the path is hashed. No special config needed.
5. **No new framework deps.** Adding Vite would introduce a second bundler alongside Turbopack — operationally confusing.

**Plausible alternative — Bun's built-in bundler:** `bun build extensions/chat-drawer/src/entry.tsx --target browser --outdir public --entry-naming '[name]-[hash].js'` does the same job with zero new dependencies. Researcher recommendation: **try Bun first, fall back to esbuild if manifest emission proves clumsy.** Both routes are HIGH confidence.

**Concrete build script outline:**
```javascript
// scripts/build-storefront-bundle.mjs (esbuild route)
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const sha = execSync('git rev-parse --short HEAD').toString().trim();

const result = await esbuild.build({
  entryPoints: ['extensions/chat-drawer/src/entry.tsx'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  metafile: true,
  outdir: 'public',
  entryNames: 'storefront-bundle-[hash]',
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.css': 'css' },
  // Important: NEXT_PUBLIC_* env vars baked at build time
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

// Find the emitted file
const outputs = Object.keys(result.metafile.outputs);
const jsFile = outputs.find((p) => p.endsWith('.js'));
const bundlePath = '/' + path.basename(jsFile);

fs.writeFileSync(
  'public/storefront-manifest.json',
  JSON.stringify({ bundle: bundlePath, version: sha }, null, 2),
);
```

**Hook into `package.json`:**
```json
{
  "scripts": {
    "prebuild": "node scripts/build-storefront-bundle.mjs",
    "build": "next build"
  }
}
```

This runs `prebuild` automatically before `bun build` (and before `vercel build`). For local dev iteration, `bun run prebuild` is sufficient.

**Source-level CORS / origin notes:** Vercel serves `public/*` with the deployment's origin. The script tag in the loader will be `<script src="https://<vercel-host>/storefront-bundle-XYZ.js">` — a cross-origin load from the merchant's storefront domain. This is FINE because (a) the bundle is delivered as a JS module not an XHR, and (b) the bundle's subsequent requests all go to `/apps/smartdiscovery/*` (same-origin to the merchant's domain) per STR-08.

## Runtime State Inventory

> Phase 6 is greenfield additive (new tables, new routes, new extension). No rename/refactor across stored state. **Section included for completeness; all items "Nothing found".**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no existing Conversation / SavedProduct rows | Schema migration creates fresh tables; D-20 partial indexes seed the unique constraints. |
| Live service config | App Proxy block does not exist in `shopify.app.toml` today (verified) — **adding it requires `shopify app deploy`** to push the TOML to Shopify so the proxy actually exists | This IS the runtime state change — planner must list "shopify app deploy" as an explicit task, not an implementation detail. |
| OS-registered state | None | — |
| Secrets/env vars | `SHOPIFY_API_SECRET` already env-set (consumed by `shopifyClient`). No new secrets this phase. `SHOPIFY_API_KEY` etc. already wired. **Confirm:** `HOST` env var must remain accurate for the App Proxy `url` resolution. | Verify `HOST` reflects the Vercel deployment URL before `shopify app deploy`. |
| Build artifacts | `public/storefront-bundle-*.js` and `public/storefront-manifest.json` will be NEW build outputs. Stale hashes from earlier builds in `public/` accumulate. | Add `public/storefront-bundle-*.js` to a cleanup step in the prebuild script OR add to `.gitignore` (these are build artifacts, NOT source). Recommend `.gitignore` + Vercel rebuilds on deploy. |

## Common Pitfalls

### Pitfall 1: validateHmac historical bug (v7 → v12)

**What goes wrong:** Developer copies an old StackOverflow snippet that hand-rolls App Proxy HMAC verification (because the v7.0 `validateHmac` was broken for proxy requests). They duplicate this logic alongside `shopifyClient.utils.validateHmac` — now two HMAC paths exist, one of which probably has a bug.

**Why it happens:** The v7 bug is heavily Googleable. Issue #878 was never marked resolved in the archived repo. Devs assume it's still broken.

**How to avoid:** Use ONLY `shopifyClient.utils.validateHmac(query, { signator: 'appProxy' })`. The function works correctly in 12.x (the current installed version). Add an integration test that POSTs to `/api/proxy/conversations` with a hand-computed valid signature to confirm the verification round-trips in this codebase before completing the wave.

**Warning signs:** Code reviewer sees `crypto.createHmac('sha256', ...)` anywhere in `app/api/proxy/*` — should never exist there.

**Sources:** [CITED: github.com/Shopify/shopify-api-js/issues/878], [CITED: github.com/Shopify/shopify-app-js/.../validateHmac.md]

### Pitfall 2: HMAC param ordering — no delimiter

**What goes wrong:** Developer hand-rolls a fallback HMAC verifier (against advice in Pitfall 1) and uses `&` to join sorted query params. The signature never matches.

**Why it happens:** OAuth HMAC uses `&` separators. App Proxy HMAC uses NO separator. The two algorithms look similar but are not identical.

**How to avoid:** Defer to `signator: 'appProxy'` per Pitfall 1. If you MUST hand-roll, the canonical format is alphabetically sorted `key=value` pairs concatenated with no delimiter, then SHA-256 HMAC with `SHOPIFY_API_SECRET`.

**Warning signs:** All HMAC tests fail with valid signatures.

**Sources:** [VERIFIED: shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies]

### Pitfall 3: Mid-stream onFinish abort behavior

**What goes wrong:** Network drops mid-stream. The client sees no message persisted. User thinks they sent the message; on retry, sends it again. Now a duplicate is written.

**Why it happens:** D-19 explicitly accepts this tradeoff — onFinish only fires on success. A mid-stream abort means no DB write at all.

**How to avoid:**
1. Document the behavior in JSDoc on `/api/proxy/chat/route.ts` (mirroring the admin route's comment style).
2. The client's `useChat` hook must keep the prompt input populated on stream error so the user can retry without losing their text. Confirmed: the Vercel AI SDK's React hooks preserve input on error by default.
3. Idempotency: writing user_message + assistant_message in a SINGLE UPDATE means there's no half-state to recover from.

**Warning signs:** Conversations have user messages without assistant responses. (Should never happen; if it does, onFinish wasn't called correctly.)

**Sources:** [VERIFIED: ai-sdk.dev/docs/reference/ai-sdk-core/stream-text] — onFinish fires after stream completes, "supports async DB writes via `Promise<void>` return."

### Pitfall 4: Partial unique index syntax (D-20)

**What goes wrong:** Prisma's `@@unique([shop, customerId, productId])` does NOT model the `WHERE customerId IS NOT NULL` clause. Without partial indexes, the SavedProduct table allows duplicate rows after merge OR rejects legitimate inserts.

**Why it happens:** Prisma's `@@unique` only models full unique constraints. Partial indexes are a Postgres feature not exposed by Prisma's schema language.

**How to avoid:**
1. Do NOT add `@@unique([shop, customerId, productId])` to the SavedProduct model in `schema.prisma`. Add only the columns + base indexes Prisma can model.
2. Add the two partial unique indexes ONLY in `db/manual-indexes.sql` (per the existing pgvector/GIN pattern).
3. The D-11 merge SQL relies on these indexes existing — if `bun db:indexes` wasn't run, the merge's `ON CONFLICT` clause fails with a runtime error.

**Warning signs:** `prisma migrate dev` after this phase succeeds but `bun db:indexes` was forgotten; merge runs throw `there is no unique or exclusion constraint matching the ON CONFLICT specification`.

### Pitfall 5: Shopify.designMode timing

**What goes wrong:** Loader checks `window.Shopify?.designMode` at script-load time; it's `undefined`. Loader assumes "not in editor mode" and drawer auto-opens for the merchant. UI-SPEC fails STR-07.

**Why it happens:** Theme Editor sets `Shopify.designMode = true` but the timing of this assignment is not guaranteed relative to script load.

**How to avoid:** Check `Shopify?.designMode` ONLY at FAB-click time, not at script load. UI-SPEC §FLAG #6 already locks this — surface for planner.

**Warning signs:** Theme Editor preview auto-opens the drawer on every page load.

### Pitfall 6: Inngest cron without idempotency lock

**What goes wrong:** Two Inngest invocations of `retentionSweep` race (rare but possible on infrastructure retries). Both try to delete the same 1000 rows.

**Why it happens:** Inngest is at-least-once delivery. The `retries: 2` config in the function declaration means a failure can re-fire.

**How to avoid:** `DELETE ... WHERE id IN (...)` is naturally idempotent — already-deleted rows just delete 0. No explicit lock needed. The pattern in the example above is safe.

**Warning signs:** Sweep logs show 0 rows deleted despite obvious aged data — suggests race already won by another invocation, which is the desired state.

### Pitfall 7: customer_id is BigInt — not a UUID

**What goes wrong:** Developer types `customerId: String` in the Prisma schema; backend code does string comparison. Numbers come through serialized as JSON numbers (which can lose precision >2^53).

**Why it happens:** Shopify customer IDs are BigInts (`customer.id` in liquid is numeric — common values like `5570080145486`). `window.Shopify.customer.id` returns the same numeric ID.

**How to avoid:**
1. Schema: `customerId String?` is correct — but the storefront adapter must serialize the numeric `customer.id` to string explicitly (`String(window.Shopify.customer.id)`) to preserve precision.
2. The liquid `data-customer-id="{{ customer.id }}"` emits the numeric ID as a string in HTML — safe.
3. Backend treats `customerId` as opaque string throughout — no math operations.

**Warning signs:** Customer IDs in the DB look truncated or have decimal points.

### Pitfall 8: Theme app extension asset 10MB / 100KB cap

**What goes wrong:** Loader bloats to >100KB total liquid + JS, gets rejected by `shopify app deploy`.

**Why it happens:** Theme app extension total asset cap is 10MB; per-liquid cap is 100KB. Loader JS that grows uncontrolled (e.g., bundles React into the loader by mistake) trips this.

**How to avoid:** Loader is **vanilla JS only** — no React, no TypeScript runtime, no library imports. React lives in the dynamically-imported main bundle (which is hosted on the APP's domain, NOT in the extension). Document loader's "no imports" rule in a code comment.

**Warning signs:** `shopify app deploy` fails with extension-size error.

**Sources:** [VERIFIED: shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration] — "total theme app extension is limited to 10 MB, with a 100 KB Liquid size limit"

### Pitfall 9: Vercel cold-start rate-limit reset

**What goes wrong:** Attacker spam-clicks during Vercel cold start; in-memory Map is brand new each container; limits do not enforce across instances or after a cold start. Per-visitor 30/5min effectively becomes 30/5min/container.

**Why it happens:** D-08 explicitly accepts this. Phase 8's DB-backed `RequestCounter` supersedes.

**How to avoid:** Document the limitation in code (`lib/rate-limit/memory.ts` JSDoc). Don't add cross-instance coordination — that's Phase 8. The fundamental defense is the AI Gateway's own per-key rate limit + the Phase 8 hard cap.

**Warning signs:** Adversarial integration test fires 100 chat messages in parallel; some succeed. Expected for this phase.

## Code Examples

### `withAppProxyHmac` integration test (one of Wave 0's RED scaffolds)

```typescript
// app/api/proxy/conversations/__tests__/route.test.ts
// Source pattern: derived from app/api/chat/__tests__ existing structure
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

function signQuery(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  // No delimiter — App Proxy quirk per CITED docs
  const msg = sorted.map((k) => `${k}=${params[k]}`).join('');
  return crypto.createHmac('sha256', secret).update(msg).digest('hex');
}

describe('POST /api/proxy/conversations — HMAC verification', () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = 'test-secret';
  });

  it('rejects requests with missing signature', async () => {
    const res = await POST(new Request('https://app.example/api/proxy/conversations'));
    expect(res.status).toBe(401);
  });

  it('accepts a valid signature derived from the no-delimiter algorithm', async () => {
    const query = {
      shop: 'test-store.myshopify.com',
      path_prefix: '/apps/smartdiscovery',
      timestamp: String(Math.floor(Date.now() / 1000)),
      logged_in_customer_id: '',
    };
    const signature = signQuery(query, 'test-secret');
    const url = new URL('https://app.example/api/proxy/conversations');
    Object.entries({ ...query, signature }).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await POST(new Request(url, {
      method: 'POST',
      body: JSON.stringify({ visitor_id: 'v-1', first_message_text: 'hi' }),
    }));
    expect(res.status).toBe(201);
  });

  it('rejects a request with tampered shop param', async () => {
    /* sign with shop=A, then mutate URL to shop=B; expect 401 */
  });
});
```

### Storefront adapter customer_id edit

```typescript
// lib/chat-ui/adapters/storefront.ts (Phase 6 edit — additive only)
// Source: extends existing file, adds customer_id read from window.Shopify.customer.id
import type { ChatIdentityAdapter } from './types';

const STORAGE_KEY = 'smartdiscovery.visitor_id';

export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/proxy/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') return {};
    let visitorId = window.localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, visitorId);
    }
    const body: Record<string, unknown> = { visitor_id: visitorId };
    // Phase 6 D-12: include customer_id when shopper is logged into the storefront.
    // Shopify.customer is set by theme liquid; .id is a numeric BigInt — coerce to string.
    const shopifyCustomer = (window as any).Shopify?.customer;
    if (shopifyCustomer && shopifyCustomer.id != null) {
      body.customer_id = String(shopifyCustomer.id);
    }
    return body;
  }
}
```

### Prisma model additions

```prisma
// Phase 6 additions to prisma/schema.prisma

model Conversation {
  id            String   @id @default(cuid())
  shop          String
  visitorId     String
  customerId    String?
  title         String   @db.VarChar(60)
  messages      Json     @default("[]")        // UIMessage[] per D-17
  createdAt     DateTime @default(now())
  lastMessageAt DateTime @default(now())

  @@index([shop])
  @@index([shop, visitorId, lastMessageAt(sort: Desc)])
  @@index([shop, customerId, lastMessageAt(sort: Desc)])
  @@index([lastMessageAt])  // retention sweep
  @@map("conversations")
}

model SavedProduct {
  id          String   @id @default(cuid())
  shop        String
  visitorId   String
  customerId  String?
  productId   String                          // ChatProduct.id (Shopify product GID or numeric ID)
  savedAt     DateTime @default(now())

  // Partial unique indexes live in db/manual-indexes.sql (D-20):
  //   (shop, visitorId, productId) WHERE customerId IS NULL
  //   (shop, customerId, productId) WHERE customerId IS NOT NULL

  @@index([shop])
  @@index([shop, visitorId])
  @@index([shop, customerId])
  @@map("saved_products")
}

model VisitorCustomerLink {
  shop        String
  visitorId   String
  customerId  String
  mergedAt    DateTime @default(now())

  @@id([shop, visitorId, customerId])
  @@index([shop, visitorId])
  @@index([shop, customerId])
  @@map("visitor_customer_links")
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled SHA-256 App Proxy verification | `shopifyClient.utils.validateHmac(q, { signator: 'appProxy' })` | @shopify/shopify-api 8.x onwards | Phase 6 should use the library; avoid the v7-era workarounds |
| `toAIStreamResponse()` (Vercel AI SDK v5) | `toUIMessageStreamResponse()` (v6) | ai@6.0.0 | Phase 4 already migrated `/api/chat`; Phase 6 mirrors |
| `parameters:` on tool definitions (v5) | `inputSchema:` (v6) | ai@6.0.0 | Phase 4 D-05 locked; Phase 6 follows |
| Shopify CLI < 3.50 extensions config | `shopify app generate extension --type theme_app_extension` | Shopify CLI 3.x | Use latest CLI |

**Deprecated / outdated:**
- App Proxy validation via raw `crypto.createHmac` — only needed as a fallback; library handles it
- Vercel AI SDK v5 patterns (`parameters`, `toAIStreamResponse`) — not in this codebase (verified by Phase 4 lock)
- "Theme app extension" old type names — must use `--type theme_app_extension` not legacy `--type theme_extension`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `signator: 'appProxy'` is fully working in @shopify/shopify-api 12.3.0 (not just documented as supported) | Pattern 1: withAppProxyHmac | If still buggy: HMAC validation fails for all proxy requests. **Mitigation:** Wave 0 includes an integration test with hand-computed signature; if test fails, fall back to hand-rolled SHA-256 path. |
| A2 | Vercel serves `public/*` with `immutable` headers when filename is content-hashed | Bundle Build Pipeline | If wrong: bundle re-downloads on every page load. **Mitigation:** Vercel's default behavior for unique-named static assets in `public/` is documented; if not seeing immutable caching, add `vercel.json` headers rule. |
| A3 | `Shopify.designMode` is reliably `undefined` outside the Theme Editor | Pitfall 5 | If wrong: drawer never auto-opens in production. **Mitigation:** UI-SPEC #FLAG-6 already locked the check-at-click-time pattern; no impact even if assumption wrong. |
| A4 | Bun's `bun build` (alternative to esbuild) can output content-hashed bundles + write a manifest | Bundle Build Pipeline | If awkward: fall back to esbuild (primary recommendation). HIGH confidence both work. |
| A5 | Liquid `customer.id` emits as a JS-safe numeric string in `data-customer-id` attribute | Pattern 4: App Embed Liquid Block | If wrong: BigInt precision loss. **Mitigation:** stringify on read in loader.js via `dataset.customerId` (a DOMString); never parse to Number. |
| A6 | Storefront pages reliably load asset `https://<vercel-host>/storefront-bundle-X.js` cross-origin via `import()` (no CORS preflight needed for ES module) | Bundle Build Pipeline | If wrong: bundle won't load on first FAB click. **Mitigation:** ES module `import()` does not require CORS preflight; servers like Vercel serve with `cross-origin-resource-policy` defaults that support cross-origin script loads. If issues: add `<link rel="modulepreload">` in liquid + ensure Vercel `vercel.json` adds CORS header for `/storefront-*` paths. |

## Open Questions

1. **Should the planner ship a dedicated `StorefrontProductCard` wrapper or image-adapt `ProductCard` in-place?**
   - What we know: UI-SPEC §Risk #1 flags this. `next/image` won't work in the extension bundle.
   - What's unclear: which option is cheaper to maintain long-term.
   - Recommendation: **image-adapter prop** on `ProductCard` (e.g., `imageRenderer?: (props) => ReactNode`) — keeps single source of truth in `lib/chat-ui/`. Wave 0 should include a test that the extension bundle does NOT import `next/image`.

2. **History tab "open to resume" — does opening a past conversation REPLACE the active drawer session, or open in a new session?**
   - What we know: D-04 says "loads the row's messages JSONB into the active drawer session, making subsequent messages append to that row."
   - What's unclear: UX detail — if the user is mid-conversation and clicks a history row, the in-flight messages are discarded?
   - Recommendation: per D-04 wording, replacement is fine. Planner clarifies UI-SPEC supplement.

3. **Skeleton state visual spec (D-15) — what exactly does the skeleton drawer look like?**
   - What we know: UI-SPEC explicitly calls this a Phase 6 supplement that the plan must generate.
   - What's unclear: exact pixel spec.
   - Recommendation: planner ships a small UI-SPEC patch with: gray rectangle drawer panel + 3 stacked gray message bubble placeholders + greyed-out prompt input + grayed tab strip. Match `bg-muted` token.

4. **Will Bun built-in bundler or esbuild win in practice?**
   - What we know: Both can emit the required output.
   - What's unclear: Bun's content-hash + manifest emission ergonomics relative to esbuild's `metafile`.
   - Recommendation: planner tries Bun first as a 30-minute spike; if blocks on manifest emission, switch to esbuild. Both are equally valid.

5. **Should the planner emit a Wave 0 verification gate for the bundle build pipeline?**
   - What we know: This is the riskiest "new tooling" surface in the phase.
   - Recommendation: Yes — Wave 0 should include a `tests/storefront-bundle-build.test.ts` that runs `bun run prebuild` and asserts `public/storefront-manifest.json` parses + `public/storefront-bundle-*.js` exists + bundle size is < some sane cap (e.g., 250KB minified).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Shopify CLI | `shopify app generate extension --type theme_app_extension` + `shopify app deploy` | Unverified at research time | ≥ 3.50 expected | Document `npm install -g @shopify/cli @shopify/theme` as a manual prereq in the plan's setup task |
| PostgreSQL | New Conversation / SavedProduct / VisitorCustomerLink tables | ✓ (already running) | ≥ 15 with pgvector ≥ 0.8.0 | — |
| Inngest dev server | Local testing of `retentionSweep` cron | Probably ✓ (Phase 2 used it) | — | Manual `bun script:cleanup-conversations` per D-07 |
| Vercel AI Gateway key | `streamText` in `/api/proxy/chat` | ✓ env var documented | — | Same as admin route; chat falls back gracefully if missing |
| esbuild | Bundle build pipeline | ✗ (not installed) | latest ~0.25.x | Bun built-in bundler (zero new deps) |
| `bun build` | Alternative bundle build path | ✓ (bun is the package manager) | bun 1.x | esbuild |
| `git rev-parse --short HEAD` | Inject version into `storefront-manifest.json` | ✓ | — | Fall back to `Date.now()` if not in a git checkout |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- esbuild — fallback is `bun build`; both are HIGH confidence.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (jsdom env) — existing |
| Config file | `vitest.config.ts` |
| Quick run command | `bunx vitest run <path>` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| STR-01 | Extension package generates valid `extensions/chat-drawer/` with App Embed block | structural (file-exists assertion) | `bunx vitest run __tests__/extension-structure.test.ts` | ❌ Wave 0 |
| STR-02 | App Embed schema declares enabled, accent_color, fab_position settings | structural (parse liquid schema, assert keys) | `bunx vitest run __tests__/app-embed-schema.test.ts` | ❌ Wave 0 |
| STR-03 | `shopify.app.toml` contains `[app_proxy]` with url/subpath/prefix | structural | `bunx vitest run __tests__/shopify-toml.test.ts` | ❌ Wave 0 |
| STR-04 | Every `/api/proxy/*` route rejects requests without valid HMAC | unit + integration | `bunx vitest run app/api/proxy` | ❌ Wave 0 |
| STR-04 | `withAppProxyHmac` derives `shop` from signed query, not raw param | unit | `bunx vitest run lib/shopify/__tests__/app-proxy-auth.test.ts` | ❌ Wave 0 |
| STR-05 | FAB renders 56px, drawer renders 400px desktop / full-width mobile | manual UAT (storefront preview) | manual — Theme Editor preview | manual |
| STR-06 | Drawer empty state shows 4 chips matching UI-SPEC strings | unit (render-and-assert) | `bunx vitest run extensions/chat-drawer/src/components/__tests__/PromptChips.test.tsx` | ❌ Wave 0 |
| STR-07 | `Shopify.designMode === true` prevents drawer auto-open on FAB click | unit | `bunx vitest run extensions/chat-drawer/__tests__/loader.test.ts` | ❌ Wave 0 |
| STR-07 | Z-index 2000+ on drawer/scrim/FAB resolved | structural CSS audit | unit + manual on Dawn/Sense/Craft | manual |
| STR-08 | StorefrontAdapter only hits `/apps/smartdiscovery/*` (no cross-origin) | unit (mock fetch, assert URLs) | `bunx vitest run lib/chat-ui/adapters/__tests__/storefront.test.ts` (extend existing) | ⚠️ partial — extend existing |
| IDN-01 | `visitor_id` UUID generated + persisted in localStorage on first call | unit | existing in Phase 5 | ✅ |
| IDN-02 | `customer_id` included in request body when `window.Shopify.customer` present | unit | extend existing storefront.test.ts | ⚠️ partial — extend |
| IDN-03 | Conversation model migration applies cleanly | structural (`prisma migrate dev` success) | manual + `bun db:indexes` | manual |
| IDN-04 | `GET /api/proxy/conversations/:id` returns full messages JSONB | unit | `bunx vitest run app/api/proxy/conversations/[id]/__tests__/route.test.ts` | ❌ Wave 0 |
| IDN-05 | SavedProduct model migration + partial unique indexes apply | structural | manual + `bun db:indexes` + EXPLAIN | manual |
| IDN-06 | Merge transaction unions anon data into customer rows; second merge is no-op | integration (real DB) | `bunx vitest run __tests__/merge-integration.test.ts` (uses test DB) | ❌ Wave 0 |
| IDN-06 | After merge: `VisitorCustomerLink` row exists; next request finds it and short-circuits | integration | same as above | ❌ Wave 0 |
| D-08 | Rate limit returns 429 after 30 chat messages in 5 min | unit | `bunx vitest run lib/rate-limit/__tests__/memory.test.ts` | ❌ Wave 0 |
| D-07 | `retentionSweep` deletes Conversations with lastMessageAt < 180 days ago | integration (use @inngest/test) | `bunx vitest run inngest/functions/__tests__/retention-sweep.test.ts` | ❌ Wave 0 |
| D-13/D-14 | `bun run prebuild` produces `public/storefront-bundle-*.js` + valid manifest | build-pipeline | `bunx vitest run __tests__/bundle-build.test.ts` (calls prebuild via execSync) | ❌ Wave 0 |
| HMAC fuzz | Tampered query parameter values reject; replayed timestamps still accept (no replay protection in V1) | unit | `bunx vitest run lib/shopify/__tests__/app-proxy-auth.fuzz.test.ts` | ❌ Wave 0 |
| Manual smoke | End-to-end against a real dev store: install extension → FAB renders → click → drawer mounts → query "warm winter clothes" → see synced products → reload → history visible | manual UAT | Phase 6 verification gate checklist | manual |

### Sampling Rate

- **Per task commit:** `bunx vitest run <touched-paths>` (sub-second)
- **Per wave merge:** `bun test` full suite
- **Phase gate:** Full suite green + `bun build` + manual smoke against dev store before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `lib/shopify/__tests__/app-proxy-auth.test.ts` — covers STR-04 HMAC verification
- [ ] `lib/shopify/__tests__/app-proxy-auth.fuzz.test.ts` — HMAC tamper + replay test cases
- [ ] `lib/rate-limit/__tests__/memory.test.ts` — covers D-08 sliding-window math
- [ ] `app/api/proxy/conversations/__tests__/route.test.ts` — covers IDN-03/04 list+create
- [ ] `app/api/proxy/conversations/[id]/__tests__/route.test.ts` — covers GET resume + PATCH append
- [ ] `app/api/proxy/saved-products/__tests__/route.test.ts` — covers IDN-05
- [ ] `app/api/proxy/chat/__tests__/route.test.ts` — extends existing 501-stub test; covers HMAC + streamText onFinish write
- [ ] `__tests__/merge-integration.test.ts` — covers IDN-06 merge transaction + VisitorCustomerLink idempotency
- [ ] `inngest/functions/__tests__/retention-sweep.test.ts` — uses @inngest/test, covers D-07
- [ ] `lib/chat-ui/stores/__tests__/db-backed.test.ts` — covers D-02 DbBacked* store interfaces
- [ ] `lib/chat-ui/adapters/__tests__/storefront.test.ts` — EXTEND existing to cover customer_id reading
- [ ] `extensions/chat-drawer/__tests__/loader.test.ts` — covers STR-07 designMode guard at click time
- [ ] `extensions/chat-drawer/src/components/__tests__/StorefrontDrawer.test.tsx` — covers drawer shell composition
- [ ] `extensions/chat-drawer/src/components/__tests__/PromptChips.test.tsx` — covers STR-06 4 chips with UI-SPEC strings
- [ ] `__tests__/app-embed-schema.test.ts` — parses `app_embed.liquid` `{% schema %}` JSON; asserts D-16 settings
- [ ] `__tests__/shopify-toml.test.ts` — asserts STR-03 app_proxy block present
- [ ] `__tests__/extension-structure.test.ts` — asserts STR-01 file scaffold exists
- [ ] `__tests__/bundle-build.test.ts` — runs `bun run prebuild`, asserts manifest+bundle outputs

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | App Proxy HMAC via Shopify-signed query; visitor_id is **NOT** an auth — it's a pseudonymous identifier and the rate limiter prevents enumeration |
| V3 Session Management | partial | `visitor_id` is a session-like identifier in localStorage; rotation is implicit (cleared by user wiping storage). No server-side session for storefront. |
| V4 Access Control | yes | Every Prisma query filters by `shop` (from validated HMAC, never client-supplied). Cross-tenant access prevented by `WHERE shop = $signedShop` |
| V5 Input Validation | yes | Zod schemas on all `/api/proxy/*` request bodies. `searchCatalog` Zod schema caps `query` at 500 chars (carries from Phase 4) |
| V6 Cryptography | yes | SHA-256 HMAC via Shopify library; `SHOPIFY_API_SECRET` env-stored; never logged |
| V7 Error Handling & Logging | yes | No secrets in logs — `withAppProxyHmac` does NOT log signatures or shop names on error. CLAUDE.md hard constraint |
| V8 Data Protection | yes | Conversation messages may contain visitor-typed PII; 180-day retention sweep limits exposure window. No PII in customer.id (numeric) |
| V11 Business Logic | partial | Per-visitor rate limit + Phase 8 hard cap = layered defense against AI Gateway abuse |
| V13 API & Web Service | yes | App Proxy is the SOLE network boundary (STR-08). No CORS-permissive endpoints. |

### Known Threat Patterns for {Next.js App Router + App Proxy + Postgres}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leak via spoofed shop param | Spoofing / Information Disclosure | `withAppProxyHmac` derives shop ONLY from signed query — never from raw URL or request body. **Already a locked decision in CONTEXT.md D-21 step 1.** |
| HMAC replay attack within timestamp window | Tampering | Phase 6 ships WITHOUT replay protection; documented limitation. Shopify's `timestamp` field provides forensics. Phase 8 may add a short-window replay cache. |
| Visitor_id enumeration to dump someone else's conversations | Information Disclosure | UUIDs are 128-bit; not enumerable. Rate limiter is the secondary guard. `shop` scoping is the primary guard. |
| Customer_id spoofing to bind another customer's history to attacker visitor | Spoofing | **CRITICAL.** Without verification, an attacker could send `customer_id: <victim>` and harvest the victim's saved products. Mitigation: Shopify App Proxy sends `logged_in_customer_id` in signed query. The handler MUST verify body's `customer_id` matches the signed `logged_in_customer_id` (or empty for anon) before any merge. [VERIFIED: shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies — "The app must also verify that the `logged_in_customer_id` query parameter matches the customer that's associated with the requested data."] |
| SQL injection via JSONB messages field | Tampering | Prisma's tagged-template/parameterized binding handles JSON safely. Messages content is never interpolated into raw SQL. |
| Prompt injection through user messages | Tampering | Phase 4 already designed the system prompt to constrain LLM behavior. Not a Phase 6-specific concern. |
| Bundle tampering via stale hash | Tampering | Vercel `immutable` headers on hashed paths; manifest fetched fresh each cold load. Bundle integrity not guarded by SRI in V1 (acknowledged limitation). |
| `Set-Cookie` leak via misconfigured handler | Information Disclosure | App Proxy strips them. Even if accidentally set, they don't reach the browser. |

**CRITICAL new requirement surfaced by this section:**
The `logged_in_customer_id` cross-check is NOT explicitly called out in CONTEXT.md but is a documented Shopify security requirement. Plan must add a step in `/api/proxy/chat` and `POST /api/proxy/saved-products` that verifies:
```typescript
const signedCustomerId = query.logged_in_customer_id || null;
if (body.customer_id && body.customer_id !== signedCustomerId) {
  return Response.json({ error: 'customer_id_mismatch' }, { status: 403 });
}
```
This is a security gate the planner MUST include — flag for plan-checker review.

### Project Constraints (from CLAUDE.md)

- **bun only** — no npm/pnpm/yarn commands anywhere in Phase 6 tasks.
- **Vercel AI Gateway is sole AI runtime entry point** — `/api/proxy/chat` uses model id strings routed via the `ai` package's bundled gateway provider, identical to admin.
- **Tailwind 4 + shadcn primitives** — UI-SPEC locks all visual tokens; no theme.config changes.
- **No secrets, no session tokens, no auth headers in logs anywhere** — `withAppProxyHmac` error path must NOT log signatures, raw query, or shop names.
- **Hard cap per-shop monthly** — Phase 6 ships a no-op stub for the cap check (D-21 step 4); Phase 8 fills it in.
- **No multi-tenant data leaks** — Every Prisma query in `/api/proxy/*` MUST filter by the HMAC-derived `shop` field. Defense-in-depth: every model (Conversation, SavedProduct, VisitorCustomerLink) carries `shop` and is indexed on it.
- **Catalog scale ~5k products** — Conversation messages JSONB writes are O(messages-in-conversation) ≤ ~20 messages × ~1KB each = 20KB max; bounded.
- **Vercel-first, Node-deployable** — esbuild and Bun's bundler both produce ESM that runs in any modern browser; no Vercel-specific build hooks.
- **prisma + pgvector + raw-SQL migrations for indexes** — D-20 partial unique indexes follow the existing `db/manual-indexes.sql` + `bun db:indexes` pattern; do NOT add to Prisma's `@@unique`.

## Sources

### Primary (HIGH confidence)

- **CITED:** [shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies) — App Proxy HMAC algorithm (no-delimiter, alphabetical, SHA-256, signature param name), `logged_in_customer_id` verification requirement
- **CITED:** [github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/docs/reference/utils/validateHmac.md](https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/docs/reference/utils/validateHmac.md) — validateHmac signature, signator option, current v12 status
- **CITED:** [shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration) — directory structure, schema target body, asset limits (10MB / 100KB)
- **CITED:** [ai-sdk.dev/docs/reference/ai-sdk-core/stream-text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — onFinish callback signature, toUIMessageStreamResponse, inputSchema tool registration
- **CITED:** [inngest.com/docs/guides/scheduled-functions](https://www.inngest.com/docs/guides/scheduled-functions) — cron trigger syntax with TZ and jitter
- **CITED:** Codebase (`app/api/chat/route.ts`, `lib/shopify/auth.ts`, `inngest/functions/sync-products.ts`, `db/manual-indexes.sql`, `scripts/apply-manual-indexes.ts`, `lib/chat-ui/adapters/storefront.ts`) — reference implementations
- **CITED:** [shopify.dev/docs/api/liquid/objects/customer](https://shopify.dev/docs/api/liquid/objects/customer) — liquid `customer.id` shape and lifecycle

### Secondary (MEDIUM confidence)

- **VERIFIED via official docs:** Bun bundler content-hashed output [bun.sh/docs/bundler](https://bun.sh/docs/bundler)
- **VERIFIED via webfetch:** App Proxy `[app_proxy]` block format with `url`/`subpath`/`prefix` from `display-dynamic-data` Shopify docs
- **VERIFIED via codebase:** Inngest cron + step.run pagination pattern in `inngest/functions/sync-products.ts`
- **VERIFIED via codebase:** Partial unique index pattern from existing `db/manual-indexes.sql`

### Tertiary (LOW confidence)

- **WebSearch only:** specific version cut-off for validateHmac fix (8.x suspected). Mitigation: Wave 0 integration test asserts validation works in 12.3.0.
- **WebSearch only:** Vercel `immutable` cache header default behavior for content-hashed `public/*` assets. Mitigation: A2 fallback documented (add explicit `vercel.json` headers rule).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package is already installed except esbuild (which is the most-downloaded bundler on npm)
- Architecture: HIGH — pattern lifted from existing Phase 4 admin route + existing Inngest pattern + existing manual-indexes pattern; almost no new shapes
- Pitfalls: HIGH for HMAC (canonical Shopify gotcha, multiple sources confirm), HIGH for partial indexes (Postgres native + existing pattern), MEDIUM for Vercel cold-start rate-limit (D-08 already accepts this)
- Security domain: HIGH — `logged_in_customer_id` mismatch check is a Shopify-documented requirement; rest follows established Phase 1/4 patterns
- Validation: HIGH — testing surface is large but each test pattern is established (Phase 4 has the admin parallels)

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days for stable; revisit if @shopify/shopify-api or `ai` ships a major version)
