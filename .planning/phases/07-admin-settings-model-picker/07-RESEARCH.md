# Phase 7: Admin Settings + Model Picker — Research

**Researched:** 2026-05-27
**Domain:** Embedded Shopify admin UI (Polaris s-* web components) + Vercel AI Gateway dynamic model discovery + per-shop singleton Prisma model
**Confidence:** HIGH

## Summary

Phase 7 has three technical surfaces: (1) a `/settings` page rendered with Polaris web components inside the existing embedded admin shell, (2) a per-shop `ShopSettings` Prisma model that is the resolver's new read source, and (3) a model-catalog client that calls **`GET https://ai-gateway.vercel.sh/v1/models`** (no auth required) and renders rows in an s-table with native-HTML sort buttons. The single biggest research finding is that `s-table` deliberately does NOT ship built-in sorting — D-04's "sortable on context + pricing" must be implemented in the client component as a state-driven re-sort of the source array before render. Every other locked decision in CONTEXT.md is implementable as written.

Phase 7 is a contract-faithful body-only swap of `services/chat/getActiveChatModel.ts`. The signature `(shop: string) => Promise<ActiveChatModel>` stays; the body changes from a constant return to a `prisma.shopSettings.findUnique` + catalog hydration. Because both `/api/chat` and `/api/proxy/chat` already pass `shop` and read `.id`, no call-site changes are required and SC4 (playground reflects the active model) is satisfied by the existing per-request resolution.

**Primary recommendation:** Mirror the onboarding page's Polaris s-* idiom (proven pattern in this repo). Implement `/settings` as `app/(embedded)/settings/page.tsx` (Server Component that SSR-fetches the catalog + active model) + a `settings-form.tsx` client component (s-choice-list radio + ui-save-bar). Catalog fetch lives in a new `services/chat/model-catalog.ts` module with a module-level 15-min cache (`Map<'catalog', { data, expiresAt }>`) and the D-03 fallback ladder. `ShopSettings` upsert + read go through a thin `lib/db/repositories/ShopSettingsRepository.ts` mirroring `ProductRepository.ts`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Model Catalog Source**
- **D-01:** Model list fetched at runtime from Vercel AI Gateway. Researcher MUST verify the exact endpoint and response shape — current candidate is `https://api.gateway.ai.cloudflare.com/v1/models` style but Vercel AI Gateway has its own. If no list endpoint exists, fall back to D-03's hybrid approach (static curated list + Decision Log entry noting the deviation).
- **D-02:** Curated `BEST_FOR` map keyed by model id lives in the repo (e.g., `services/chat/model-catalog.ts`). Shape: `Record<string, string>` mapping model id → short marketing-grade descriptor. Models without a curated entry fall back to the literal string `"General purpose"`. We control the language; researcher can propose initial copy for the top ~10 expected models.
- **D-03:** Caching + failure fallback. AI Gateway responses cached in-memory for 15 minutes per process. On fetch failure: serve the last-known-good cached list AND surface a "Showing cached models" banner above the table. Cold-start failure: serve a tiny hardcoded fallback containing only the DEFAULT_MODEL row + a "Model catalog unavailable — showing default only" inline message, and disable the Save button until refresh.

**Settings Page UX**
- **D-04:** Table layout, one row per model, native HTML radio per row. Columns in order: `Model name` · `Provider` · `Context window` · `$ / M input tokens` · `$ / M output tokens` · `Best for` · `Active` (radio). Sortable on Context and the two pricing columns.
- **D-05:** Route is top-level `/settings` (singular noun, no nested path). Adds a "Settings" entry to the embedded admin nav alongside Chat/Onboarding.
- **D-06:** Active row pre-selected on page load by calling `getActiveChatModel(shop)` server-side and matching its `.id` against the rendered rows. If the active id is not in the rendered catalog, select nothing and surface an inline warning "Your previously-selected model is no longer available — pick a replacement."

**Save Semantics**
- **D-07:** Explicit Save button with toast confirmation. Save is disabled when no radio change has occurred relative to the currently-active model. Click → PATCH `/api/settings/model` → on 200, toast "Model updated to <Display Name>"; on error, inline error banner above the table with the API error code.
- **D-08:** Playground reflects new model on the next chat request, not via shared client state. `getActiveChatModel(shop)` is already called per-request from `/api/chat` and `/api/proxy/chat`. No zustand/SWR/context plumbing required.

**Default Seeding Strategy**
- **D-09:** Never explicitly seed `ShopSettings`. Rely on `getActiveChatModel(shop)`'s fallback: when no row exists, return `DEFAULT_MODEL` (`google/gemini-2.5-flash` / Gemini 2.5 Flash). First explicit Save from `/settings` is what writes the row.
- **D-10:** `ShopSettings` Prisma model: `shop String @id`, `activeChatModelId String`, `updatedAt DateTime @updatedAt`, `@@map("shop_settings")`. No `customerId`, no `createdAt` — `updatedAt` doubles as the audit signal.

### Claude's Discretion

- API endpoint shape (`/api/settings/model` GET + PATCH vs `/api/settings` GET + PATCH with `{ activeChatModelId }` body) — researcher/planner picks based on Phase 8 scope expectations.
- `model-catalog.ts` exact module location (under `services/chat/` next to the resolver vs `lib/ai/`).
- AI Gateway client implementation (`fetch` directly vs a tiny `ai-gateway-client.ts` helper) — planner decides based on what cleans up best.
- Server-side rendering vs client-side fetching of the model list inside the settings page — Next.js App Router idioms apply; planner picks.
- Sort defaults (provider alphabetical vs price ascending) — planner picks based on what's most useful for a merchant scanning the list.

### Deferred Ideas (OUT OF SCOPE)

- **Per-conversation model override** — letting a merchant or visitor pick a model per chat thread.
- **Model usage analytics** — "X requests this month against model Y." Belongs alongside Phase 8's hard-cap counter.
- **A/B comparison playground** — side-by-side response from two models.
- **Per-environment overrides** — different active model for staging vs production.
- **Model search/filter on /settings** — only matters if catalog grows past ~30 models.
- **Admin user permission system** — granular permissions for who can change the model.
- **Audit log of model changes** — a `ShopSettingsHistory` table.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADM-03 | Settings screen at `/settings` lists Vercel AI Gateway chat models (name, provider, context window, $/M input/output tokens, "best for") and persists per-shop selection in a new `ShopSettings` model | Vercel AI Gateway `GET /v1/models` endpoint verified (no auth, OpenAI-format response with `id`, `name`, `owned_by`, `context_window`, `pricing.input`, `pricing.output`); Polaris s-table + s-choice-list available in this codebase; ShopSettings shape locked in D-10 |
| ADM-04 | Default chat model is pre-selected on first install (Gemini 2.5 Flash or equivalent balanced default) | `getActiveChatModel(shop)` already returns `google/gemini-2.5-flash` as `DEFAULT_MODEL`; D-09 defers explicit seeding to the resolver's existing fallback path; D-06 SSR pre-selection logic matches `.id` against rendered rows |

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Implication for Phase 7 |
|------------|--------|--------------------------|
| Vercel AI Gateway is the SOLE runtime entry for chat completions and embeddings — no direct OpenAI/Anthropic/Google SDKs | CLAUDE.md § Constraints | The model catalog client calls `https://ai-gateway.vercel.sh/v1/models` only; never resolves provider IDs back to provider SDKs |
| bun-only package management | CLAUDE.md § Commands | Any new test additions run via `bun test`; no `npm install` / `yarn add` |
| TypeScript strict | CLAUDE.md § Technology Stack | `ShopSettings` Prisma client types must be checked with `tsc --noEmit`; no `any` in the new catalog module or settings page |
| No `console.log` / Bearer tokens / session tokens in logs | CLAUDE.md § Constraints | The catalog client must never log AI_GATEWAY_API_KEY (it's not even sent on `/v1/models`, but be defensive); the settings PATCH route must not log the session token |
| Every shop-scoped query filters by shop | CLAUDE.md § Architectural Constraints | `ShopSettings` has `shop` as PK — implicit; PATCH endpoint must source shop from `withShopifySession` ctx, never from request body |
| `DEFAULT_MODEL` constant lives in ONE place (getActiveChatModel.ts) | STATE.md Phase 4 decision | Phase 7 keeps this. The catalog module imports / re-exports do NOT inline `'google/gemini-2.5-flash'` |
| Cap on hand-rolling — never reinvent solved problems | CLAUDE.md philosophy | Use existing `withShopifySession`, `prisma`, `s-choice-list`, `ui-save-bar`. Don't re-invent radio rendering or toast UI |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render `/settings` page shell + table | Frontend Server (SSR via Server Component) | Browser (client component for sort/save state) | Aligns with `app/(embedded)/chat/page.tsx` pattern: Server Component fetches initial data, client component owns interactivity |
| Fetch model catalog from AI Gateway | API / Backend (service module) | — | The fetch + cache + fallback ladder is server-side only; the catalog is hydrated into SSR and never re-fetched from the browser |
| Persist per-shop selection | Database / Storage | API / Backend (route handler) | `prisma.shopSettings.upsert` is the write path; the API route wraps validation + auth |
| Resolve active model for chat requests | API / Backend (resolver) | Database / Storage | Body-only swap of `getActiveChatModel`; reads `ShopSettings`, falls back to `DEFAULT_MODEL` |
| Pre-select active row on page load | Frontend Server (SSR) | — | Server Component awaits `getActiveChatModel(shop)`, passes `.id` to client component as initial `selectedId` prop |
| Toast confirmation after save | Browser | — | `shopify.toast.show(message, opts?)` runs in the embedded App Bridge runtime |
| Disabled-when-unchanged Save state | Browser | — | Local React state comparing `selectedId` vs initial `activeId` |
| Add "Settings" to admin nav | Frontend Server (SSR) | — | Edit `app/(embedded)/EmbeddedProviders.tsx` — add `<s-link href="/settings">Settings</s-link>` to the `<s-app-nav>` block |

## Standard Stack

### Core (already in dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | 7.3.0 | DB read/write for `ShopSettings` | Already the DB access layer; ShopifySession + Product all use it [VERIFIED: package.json] |
| `next` | 16.1.6 | App Router server/client component split | Already the framework; `app/(embedded)/settings/page.tsx` slots into existing layout [VERIFIED: package.json] |
| `react` | 19.2.3 | UI rendering | Already the UI layer [VERIFIED: package.json] |
| `zod` | 4.3.6 | PATCH body validation | Already used in `/api/chat` inputSchema; idiomatic for route validation [VERIFIED: package.json] |
| Polaris web components | CDN (no npm package) | s-page / s-section / s-table / s-choice-list / s-banner / s-button | Already loaded in `app/(embedded)/layout.tsx` via `<Script src="https://cdn.shopify.com/shopifycloud/polaris.js" />` [VERIFIED: app/(embedded)/layout.tsx] |
| App Bridge | CDN (no npm package) | `shopify.idToken()`, `shopify.toast.show()`, `ui-save-bar` | Already loaded in `app/(embedded)/layout.tsx` via `<Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />` [VERIFIED: app/(embedded)/layout.tsx] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.5 | Unit + integration test runner | All Phase 7 test files [VERIFIED: package.json] |
| `@testing-library/react` | 16.3.2 | Component rendering for `/settings` page test | Mirrors `chat-shell.test.tsx` pattern [VERIFIED: package.json] |
| `dedent` | 1.7.1 | Multi-line string helpers (system prompts, error messages) | Already used widely; cheap utility [VERIFIED: package.json] |

### Net-new dependencies

**None.** Phase 7 introduces zero new packages. Every capability is satisfied by the existing stack. This is significant for the Package Legitimacy Audit (below) — slopcheck has nothing to verify because no `npm install` step appears in this phase. [VERIFIED: package.json against the requirements list above]

### Alternatives Considered

| Instead of | Could Use | Tradeoff (why we reject) |
|------------|-----------|--------------------------|
| Polaris s-* web components | shadcn primitives (`components/ui/`) + custom radio table | shadcn matches the chat playground style but: (1) we'd need a custom sortable table component, (2) it doesn't match Shopify-admin look-and-feel for a Settings page, (3) onboarding already uses s-* — consistency wins. **Use Polaris.** |
| `ui-save-bar` for save UX | Inline button below the table | Save bar is the canonical Shopify admin pattern; it survives scroll, surfaces unsaved-state semantics, and gets discard-confirmation for free. D-07 says "explicit Save button + toast" — `ui-save-bar` satisfies both (contains a `<button>` child) and adds the Shopify-native polish. **Use `ui-save-bar`** if planner picks the canonical path; or plain s-button if planner prefers the simpler version (acceptable under D-07). |
| Repository (`ShopSettingsRepository.ts`) | Inline `prisma.shopSettings.findUnique` / `upsert` in route + resolver | Repository pattern is established (`ProductRepository.ts`) and gives a single mockable surface for the resolver test. Inline is OK for 2 queries but loses test isolation. **Use a repository — see Code Examples below.** |
| `gateway.getAvailableModels()` (`@ai-sdk/gateway`) | Raw `fetch('https://ai-gateway.vercel.sh/v1/models')` | The SDK helper would force adding `@ai-sdk/gateway` to the deps for a one-line fetch. REST endpoint requires no auth and has a documented stable response shape. **Use raw fetch.** |

**Installation:** No new packages required.

**Version verification:** All packages above are already pinned in `package.json` (read at 2026-05-27). The single external service is `https://ai-gateway.vercel.sh/v1/models` — endpoint verified live this session (returns ~190 language models, including `google/gemini-2.5-flash`). [VERIFIED: live curl against `https://ai-gateway.vercel.sh/v1/models` at 2026-05-27]

## Package Legitimacy Audit

**No new packages installed in this phase.** Every dependency already exists in `package.json` and was vetted in earlier phases. This section is included for completeness; slopcheck is not applicable to a phase with zero `npm install` steps.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (no new packages) | — | — | — | — | N/A | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Merchant browser (embedded admin)
  │  navigates /settings
  ▼
app/(embedded)/settings/page.tsx        ← Server Component (Next.js App Router)
  │   ├── await fetchModelCatalog()     ← services/chat/model-catalog.ts
  │   │     ├── module-level Map cache (15 min TTL)
  │   │     ├── on miss: fetch https://ai-gateway.vercel.sh/v1/models
  │   │     │   └── filter type==='language' + decorate with BEST_FOR map
  │   │     └── on error: serve last-known-good OR DEFAULT_MODEL-only fallback
  │   ├── await getActiveChatModel(shop)  ← services/chat/getActiveChatModel.ts
  │   │     └── (Phase 7 body) prisma.shopSettings.findUnique({ shop })
  │   │           └── if absent: return DEFAULT_MODEL
  │   └── pass { catalog, activeId, isStale } as props
  ▼
app/(embedded)/settings/settings-form.tsx   ← Client Component
  │   ├── useState(selectedId = activeId)
  │   ├── useState(sortBy = null) — local sort, NOT server-side
  │   ├── render <s-table> with sortable headers (custom click handlers)
  │   ├── render <s-choice-list> radio per row (selected when row.id===selectedId)
  │   └── render <ui-save-bar> when selectedId !== activeId
  ▼  on Save click
PATCH /api/settings/model   (or PATCH /api/settings)
  │   ├── withShopifySession({ shop, session, req })       ← lib/shopify/auth.ts
  │   ├── zod.parse(body) → { activeChatModelId: string }
  │   ├── validate activeChatModelId against fresh catalog ← prevent client-side tampering
  │   └── prisma.shopSettings.upsert({ shop, activeChatModelId })
  ▼  on 200
shopify.toast.show(`Model updated to ${displayName}`)
  ▼  next chat request
/api/chat or /api/proxy/chat → getActiveChatModel(shop) → reads new row → streams new model
```

### Recommended Project Structure

```
app/
├── (embedded)/
│   ├── EmbeddedProviders.tsx          # ADD <s-link href="/settings">Settings</s-link>
│   └── settings/                       # NEW
│       ├── page.tsx                    # Server Component (SSR catalog + activeId)
│       ├── settings-form.tsx           # Client Component (sort + radio + save)
│       └── __tests__/
│           ├── page.test.tsx
│           └── settings-form.test.tsx
├── api/
│   └── settings/                       # NEW
│       └── model/
│           ├── route.ts                # GET + PATCH; wrapped with withShopifySession
│           └── __tests__/route.test.ts
services/
└── chat/
    ├── getActiveChatModel.ts           # BODY-ONLY swap
    ├── model-catalog.ts                # NEW: fetchCatalog + BEST_FOR map + 15-min cache
    └── __tests__/
        ├── getActiveChatModel.test.ts  # UPDATE: add DB-hit + DB-miss tests
        └── model-catalog.test.ts       # NEW
lib/
└── db/
    └── repositories/
        ├── ShopSettingsRepository.ts   # NEW: get(shop) + upsert(shop, modelId)
        └── __tests__/ShopSettingsRepository.test.ts
prisma/
└── schema.prisma                       # ADD ShopSettings model
types/
└── shopify-global.d.ts                 # ADD s-table, s-choice-list, ui-save-bar JSX intrinsics
```

### Pattern 1: Server Component → Client Component split

**What:** The Server Component does all data fetching (catalog + active model) and passes serializable props down to a Client Component that owns interactive state.

**When to use:** Always for embedded admin pages that need both SSR-fetched data and client-side interactivity. This matches the Phase 4 `chat/page.tsx` + `chat-shell.tsx` split exactly.

**Example:**
```tsx
// app/(embedded)/settings/page.tsx (Server Component)
import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import { SettingsForm } from './settings-form';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop } = await searchParams;
  // NOTE: searchParams is the same param-source pattern as chat/page.tsx —
  // confirmed by reading app/(embedded)/chat/page.tsx in this session.
  const [catalogResult, activeModel] = await Promise.all([
    fetchModelCatalog(),
    getActiveChatModel(shop ?? ''),
  ]);

  return (
    <s-page heading="Settings">
      <s-section heading="AI chat model">
        {catalogResult.stale && (
          <s-banner tone="warning">Showing cached models — live catalog unavailable</s-banner>
        )}
        {catalogResult.coldStartFallback && (
          <s-banner tone="critical">
            Model catalog unavailable — showing default only
          </s-banner>
        )}
        <SettingsForm
          catalog={catalogResult.models}
          activeId={activeModel.id}
          activeDisplayName={activeModel.displayName}
          saveDisabled={catalogResult.coldStartFallback}
        />
      </s-section>
    </s-page>
  );
}
```

### Pattern 2: Model-catalog client with 15-min module-level cache (D-03)

**What:** A single module-level `Map<'catalog', CachedCatalog>` holds the last successful fetch. On miss or stale, refetch; on fetch error, serve the last-known-good with `stale: true`; on cold-start failure, return only the DEFAULT_MODEL row with `coldStartFallback: true`.

**When to use:** Once. The catalog module exports one async function `fetchModelCatalog(): Promise<CatalogResult>` that both the settings page and (optionally) the resolver call.

**Vercel serverless note:** Each Vercel lambda instance owns its own cache. This is acceptable per D-03 — a 15-min in-memory cache is sufficient even though warm lambdas may not share state. The catalog has no per-shop dimension, so cache-sharding by shop is not needed.

**Example:**
```typescript
// services/chat/model-catalog.ts
import type { ActiveChatModel } from './getActiveChatModel';

const CATALOG_URL = 'https://ai-gateway.vercel.sh/v1/models';
const TTL_MS = 15 * 60 * 1000;

// BEST_FOR map (D-02). Models without an entry fall back to "General purpose".
// These descriptors are editorial; copy proposed in §State of the Art below.
export const BEST_FOR: Record<string, string> = {
  'google/gemini-2.5-flash': 'Fastest, low cost — great default',
  'google/gemini-3.1-pro-preview': 'Best reasoning, larger context',
  'anthropic/claude-haiku-4.5': 'Anthropic balance of cost and quality',
  'anthropic/claude-opus-4.7': 'Best long-form reasoning',
  'openai/gpt-5.5': 'OpenAI flagship, broad capability',
  // … extend as needed; planner adds entries in plan task list
};

export interface CatalogModel {
  id: string;                       // 'google/gemini-2.5-flash'
  displayName: string;              // 'Gemini 2.5 Flash'
  provider: string;                 // owned_by, e.g. 'google'
  contextWindow: number;            // tokens
  inputPricePerMillion: number;     // $ per million tokens
  outputPricePerMillion: number;    // $ per million tokens
  bestFor: string;                  // from BEST_FOR or 'General purpose'
}

export interface CatalogResult {
  models: CatalogModel[];
  stale: boolean;            // true when serving last-known-good after fetch failure
  coldStartFallback: boolean; // true when no LKG and the fetch failed (DEFAULT_MODEL only)
}

interface Cached { data: CatalogModel[]; expiresAt: number }
const cache = new Map<'catalog', Cached>();

interface RawModel {
  id: string;
  name: string;
  owned_by: string;
  context_window: number;
  type: string;
  pricing?: { input?: string; output?: string };
}

function mapRaw(m: RawModel): CatalogModel {
  // The /v1/models endpoint returns input/output as strings representing $/token.
  // Multiply by 1e6 to get $/M tokens. parseFloat is sufficient — values are
  // already JSON-stringified decimals like "0.0000003".
  const inputPerToken = m.pricing?.input ? parseFloat(m.pricing.input) : 0;
  const outputPerToken = m.pricing?.output ? parseFloat(m.pricing.output) : 0;
  return {
    id: m.id,
    displayName: m.name,
    provider: m.owned_by,
    contextWindow: m.context_window,
    inputPricePerMillion: inputPerToken * 1_000_000,
    outputPricePerMillion: outputPerToken * 1_000_000,
    bestFor: BEST_FOR[m.id] ?? 'General purpose',
  };
}

export async function fetchModelCatalog(): Promise<CatalogResult> {
  const now = Date.now();
  const cached = cache.get('catalog');
  if (cached && cached.expiresAt > now) {
    return { models: cached.data, stale: false, coldStartFallback: false };
  }

  try {
    const res = await fetch(CATALOG_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`gateway list models: ${res.status}`);
    const json = (await res.json()) as { data: RawModel[] };
    const models = json.data
      .filter((m) => m.type === 'language')
      .map(mapRaw);
    cache.set('catalog', { data: models, expiresAt: now + TTL_MS });
    return { models, stale: false, coldStartFallback: false };
  } catch {
    if (cached) {
      return { models: cached.data, stale: true, coldStartFallback: false };
    }
    // Cold-start failure: DEFAULT_MODEL-only fallback row.
    // We re-derive DEFAULT_MODEL's display fields here without importing from
    // getActiveChatModel.ts to avoid a circular import. The id literal lives
    // in ONE place (getActiveChatModel.ts) — but we re-emit the fallback row
    // by reading from a shared frozen tuple; the planner picks the exact
    // location.
    return {
      models: [
        {
          id: 'google/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          provider: 'google',
          contextWindow: 1_000_000,
          inputPricePerMillion: 0.3,
          outputPricePerMillion: 2.5,
          bestFor: 'Fastest, low cost — great default',
        },
      ],
      stale: false,
      coldStartFallback: true,
    };
  }
}
```

### Pattern 3: Body-only swap of `getActiveChatModel` (D-09)

**What:** Replace the body of `getActiveChatModel` to read `ShopSettings`; if absent, return `DEFAULT_MODEL`. Signature stays.

**Example:**
```typescript
// services/chat/getActiveChatModel.ts (Phase 7 body)
import { prisma } from '@/lib/db/client';
import { fetchModelCatalog } from './model-catalog';

const DEFAULT_MODEL: ActiveChatModel = {
  id: 'google/gemini-2.5-flash',
  displayName: 'Gemini 2.5 Flash',
};

export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> {
  if (!shop) return DEFAULT_MODEL;
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  if (!row) return DEFAULT_MODEL;

  // Hydrate displayName from the catalog so the banner shows the human name.
  // If the catalog fetch fails OR the saved id is no longer in the catalog,
  // fall through to a synthesized displayName from the id.
  try {
    const { models } = await fetchModelCatalog();
    const match = models.find((m) => m.id === row.activeChatModelId);
    if (match) return { id: match.id, displayName: match.displayName };
  } catch {
    /* fall through */
  }
  // Last-ditch: show the id portion as displayName.
  const segment = row.activeChatModelId.split('/')[1] ?? row.activeChatModelId;
  return { id: row.activeChatModelId, displayName: segment };
}
```

### Pattern 4: PATCH route with catalog validation (security defense-in-depth)

**What:** The PATCH endpoint MUST validate the submitted `activeChatModelId` against a fresh catalog fetch — not just trust client input. This prevents a tampered request from persisting an arbitrary string into `ShopSettings.activeChatModelId`.

**Example:**
```typescript
// app/api/settings/model/route.ts
import { z } from 'zod';
import { withShopifySession } from '@/lib/shopify/auth';
import { prisma } from '@/lib/db/client';
import { fetchModelCatalog } from '@/services/chat/model-catalog';

const PatchBody = z.object({
  activeChatModelId: z.string().min(1).max(200),
});

export const PATCH = withShopifySession(async ({ shop, req }) => {
  const body = await req.json();
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Defense-in-depth: only allow ids present in the live catalog (or LKG).
  const { models } = await fetchModelCatalog();
  if (!models.some((m) => m.id === parsed.data.activeChatModelId)) {
    return Response.json({ error: 'unknown_model_id' }, { status: 400 });
  }

  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, activeChatModelId: parsed.data.activeChatModelId },
    update: { activeChatModelId: parsed.data.activeChatModelId },
  });

  const display = models.find((m) => m.id === parsed.data.activeChatModelId)!.displayName;
  return Response.json({ ok: true, displayName: display });
});
```

### Anti-Patterns to Avoid

- **Using `s-table`'s built-in sort:** It does not exist. The Polaris docs explicitly state: *"The component doesn't include built-in sorting or search functionality. You'll need to implement these features yourself if merchants need to organize data."* Sorting is `useState<{ column, direction }>` driving a `.toSorted()` call before render. [CITED: shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table]
- **Using `s-choice-list` with `checked`:** It uses `selected`, not `checked`. Verified in docs and noted in the Polaris community forum. [CITED: shopify.dev/docs/api/app-home/polaris-web-components/forms/choicelist]
- **Inlining `'google/gemini-2.5-flash'` outside `getActiveChatModel.ts`:** The Phase 4 contract pins the default in ONE place. Phase 7 maintains this. The model-catalog cold-start fallback re-emits the row but the canonical id lives in the resolver module.
- **Trusting client-submitted `activeChatModelId` without validation:** PATCH must verify against the live catalog before upsert.
- **Calling `fetchModelCatalog()` from a Client Component:** Server Components only. Client components receive the catalog as a prop.
- **Calling `getActiveChatModel(shop)` from inside the catalog client:** Would create a circular import. The resolver imports the catalog; not the other way around.
- **Persisting model selection via cookie or localStorage:** D-09 says the DB is the source of truth; never use client storage for the active model.
- **Returning a hardcoded `displayName` from `getActiveChatModel`:** The catalog is the source of truth for `displayName`. The resolver hydrates from the catalog (Pattern 3 above).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radio button group | Custom `<input type="radio">` styling | `<s-choice-list>` + `<s-choice value="…">` | Native focus, ARIA, keyboard nav all wired by Polaris [CITED: shopify.dev/docs/api/app-home/polaris-web-components/forms/choicelist] |
| Toast notification | Add `sonner` / `react-hot-toast` | `shopify.toast.show(message, { isError })` | Already loaded via App Bridge; matches Shopify-admin look-and-feel; zero new deps [CITED: shopify.dev/docs/api/app-bridge-library — toast API] |
| Data table | Custom `<table>` with sort handlers from scratch | `<s-table>` + manual sort state (no built-in) | s-table provides the rendering primitives + responsive auto/list/table variant switch; you ONLY hand-roll the sort logic itself [CITED: shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table] |
| Contextual save bar | Custom sticky footer with discard confirmation | `<ui-save-bar>` (App Bridge web component) | Surface-native unsaved-state pattern; supports discard-confirmation via attribute; survives scroll [CITED: shopify.dev/docs/api/app-bridge-library/web-components/ui-save-bar] |
| Bearer session-token verification | Inline header parsing + Shopify session decode | `withShopifySession` | Already shipped in `lib/shopify/auth.ts`; consistent error codes (`missing_token`, `invalid_token`, `no_offline_session`) [VERIFIED: lib/shopify/auth.ts] |
| Repository for `ShopSettings` | Inline `prisma.shopSettings.upsert` everywhere | `lib/db/repositories/ShopSettingsRepository.ts` | Matches `ProductRepository.ts` shape; testable via mock; the resolver test no longer needs Prisma mocking [VERIFIED: lib/db/repositories/ProductRepository.ts] |
| HTTP client | Add `axios` / `ky` / `undici` | Native `fetch` | Node 18+ provides `fetch` globally; AI Gateway endpoint is one GET — no auth — minimal needs [VERIFIED: existing fetch usage in route handlers] |
| Cache layer | Add `lru-cache`, `node-cache`, `redis` | `Map<'catalog', { data, expiresAt }>` at module top | 15-min single-entry TTL for a single key; lru-cache would add overhead. D-03 explicitly says in-memory per-process [CITED: CONTEXT.md D-03] |

**Key insight:** Phase 7 is structurally simple because every UI primitive is already loaded via App Bridge / Polaris CDNs and every server-side primitive (auth, prisma, AI Gateway HTTP) is already in the codebase. Resist the urge to add npm packages.

## Runtime State Inventory

> Phase 7 is a forward-only feature addition. There is no rename, refactor, or string-replace work, so the standard runtime-state inventory is mostly empty by construction. Each category is answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|-------------------|
| Stored data | `ShopSettings` table does not exist yet (verified by reading `prisma/schema.prisma` — no `ShopSettings` model present). Once the migration runs, the table is empty by design (D-09: never seed). Production shops carry no rows initially; the resolver's fallback handles them transparently. | Add Prisma model + migration. No data backfill. |
| Live service config | Vercel AI Gateway `/v1/models` is the only external service touched. No per-shop configuration lives in the gateway. | None — endpoint requires no setup; verified live response at 2026-05-27. |
| OS-registered state | None — no cron, no scheduled task, no native binary. The 15-min cache is in-process memory only. | None. |
| Secrets / env vars | `AI_GATEWAY_API_KEY` is already in `.env` (used by `/api/chat`). The `/v1/models` endpoint does NOT require auth, so the catalog client does not consume the key. No new env vars. | None. Confirmed `cache: 'no-store'` on the fetch — no leakage into Next's data cache. |
| Build artifacts / installed packages | Prisma client regeneration is required after schema change. `bunx prisma generate` after the migration. Existing `app/generated/prisma/` output gets the `ShopSettings` typed client added. | Run `bunx prisma generate` after `prisma migrate dev`. |

**Canonical post-rollout question check:** After every file is updated, what runtime systems still have the old data?
- **Answer:** Nothing. `ShopSettings` is a brand-new table. No legacy rows. The resolver's "row absent → DEFAULT_MODEL" fallback is the bridge between "shop installed before Phase 7" and "shop installed after Phase 7" — both populations behave identically until a merchant actively saves a non-default selection.

## Common Pitfalls

### Pitfall 1: `s-table` does not have built-in sort

**What goes wrong:** Planner sees `<s-table>` and assumes there is an attribute like `sortable` or `sortDirection` to wire D-04's sortable columns. There isn't.

**Why it happens:** Polaris React's `DataTable` (legacy) DID expose sort props. The new web component is intentionally stripped down.

**How to avoid:** Implement sort in the client component as React state:
```tsx
const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
const rows = useMemo(() => {
  if (!sort) return catalog;
  const sorted = [...catalog].sort((a, b) => {
    const av = a[sort.key]; const bv = b[sort.key];
    return sort.direction === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });
  return sorted;
}, [catalog, sort]);
```
Render the column header as a `<button>` inside `<s-table-header>` with `onClick` to toggle direction. Use `aria-sort="ascending|descending|none"` for screen readers.

**Warning signs:** Test failure "sort buttons in table do not reorder rows" — check the sort `useState` is actually wired to the rendered array, not the source prop.

[CITED: shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table — "The component doesn't include built-in sorting"]

### Pitfall 2: `s-choice-list` uses `selected`, not `checked`

**What goes wrong:** React developer reflex types `checked={...}` on a `<s-choice>`. The selection state is silently ignored.

**Why it happens:** HTML radio inputs use `checked`. Polaris diverges.

**How to avoid:** Use `selected` (boolean attribute) on each `<s-choice>` OR set `value` on the parent `<s-choice-list>` to the selected option's `value` attribute. The community forum explicitly notes this trip-up. [CITED: community.shopify.dev/t/s-choice-list-should-use-checked-instead-of-selected/22260]

**Warning signs:** Page renders all radios unselected, even though `activeId` is correctly passed as a prop. Inspect the rendered HTML: if `selected` is missing, that's the bug.

### Pitfall 3: Forgetting `bunx prisma generate` after schema migration

**What goes wrong:** Phase 7 migration adds `ShopSettings` to the schema. Without `prisma generate`, `prisma.shopSettings` doesn't exist on the typed client and TypeScript fails at the call site.

**Why it happens:** Prisma's client is generated to `app/generated/prisma/` — a non-default location set in `prisma.config.ts`. The migration step alone doesn't regenerate the client.

**How to avoid:** The plan must include a `[BLOCKING] bunx prisma generate` task immediately after the `[BLOCKING] bunx prisma migrate dev` task. This is the same pattern as Phase 1 plan 01-05 and Phase 6 plan 06-02.

**Warning signs:** `Property 'shopSettings' does not exist on type 'PrismaClient'`. Fix: regenerate.

### Pitfall 4: Catalog response is cached by Next.js fetch cache (data cache leakage)

**What goes wrong:** Next.js 16 App Router's `fetch` defaults to caching responses indefinitely in the data cache. Our 15-min in-memory cache works correctly, but if a Server Component calls the gateway directly without `cache: 'no-store'`, Next will serve a stale response from its own data cache before our cache can respond.

**Why it happens:** Next's default fetch caching is aggressive and operates above our application code.

**How to avoid:** Every internal `fetch(CATALOG_URL, …)` MUST include `{ cache: 'no-store' }`. The 15-min cache lives in our module-level Map only — never delegate caching to Next.

**Warning signs:** Stale models persist across deploys. Check the catalog client's fetch call.

### Pitfall 5: Gateway pricing values are string-encoded $/token, not $/million

**What goes wrong:** Planner reads `pricing.input` from the gateway response and renders it as-is. The merchant sees `0.0000003` in the price column.

**Why it happens:** The endpoint returns numeric strings representing $/token. The product spec (SC1) calls for $/M tokens.

**How to avoid:** In the catalog mapper, multiply by 1,000,000. See `mapRaw()` in Pattern 2 above. Sample verified values for `google/gemini-2.5-flash`: `input: "0.0000003"` → $0.30/M; `output: "0.0000025"` → $2.50/M. [VERIFIED: live `/v1/models` response 2026-05-27]

**Warning signs:** Pricing column shows 7-digit decimals. Multiply by 1e6.

### Pitfall 6: Some models have tiered pricing (no flat `input`/`output`)

**What goes wrong:** Catalog mapper assumes `pricing.input` and `pricing.output` are always present. Some models (e.g., `google/gemini-3.1-pro-preview`) ship tiered pricing where the base `input`/`output` IS still present but additional `input_tiers`/`output_tiers` arrays override above a threshold. A few models (rare, edge case) may omit the flat fields entirely.

**Why it happens:** Pricing schema flexibility — see the documented response shape.

**How to avoid:** Defensive parse: `m.pricing?.input ? parseFloat(m.pricing.input) : 0`. Render `—` (em dash) in the table cell when price is 0/missing. For V1 we surface the BASE (tier 1) price and ignore tier breaks — D-04 says "$/M input tokens" not "tiered pricing display." Document that the displayed price is "starting at" in a help-tooltip on the column header if we want to be thorough; otherwise just show the base.

**Warning signs:** `NaN` in the table or empty cells. Check the parser.

### Pitfall 7: Catalog includes ~190 language models — UX scalability

**What goes wrong:** Rendering 190 rows in a single table is dense. D-04 rejected the dropdown in favor of side-by-side comparison; the deferred ideas list explicitly says "Model search/filter on /settings — only matters if catalog grows past ~30 models."

**Why it happens:** Gateway exposes the full catalog. We currently filter only by `type === 'language'`.

**How to avoid for V1:** This is **flagged as an OPEN QUESTION** below. Possible mitigations the planner may pick:
1. Filter to a curated allowlist matching BEST_FOR keys (~10 models).
2. Filter to a small set of provider families: `google`, `anthropic`, `openai`, `xai` only.
3. Render all 190 and rely on the sort columns + scroll.

Given D-04's emphasis on "side-by-side pricing comparison" and BEST_FOR's curated nature, **recommendation is option 1: render only models that appear in BEST_FOR + the active model (in case it's not in BEST_FOR).** This bounds the table at ~10–12 rows.

**Warning signs:** /settings page is very long; cognitive load review fails.

### Pitfall 8: Phase 4 deferred prerequisites (T-04-24, T-04-25)

**What goes wrong:** Phase 4 verification deferred two items that Phase 7 inherits:
- `displayName` XSS validation gate
- `searchParams.shop` ↔ `session.shop` verification before the body-only swap

**Why it happens:** They were tracked in `04-VERIFICATION.md` Handoff Notes (see STATE.md Deferred Items table) — not yet resolved.

**How to avoid:** Phase 7 plan MUST include explicit tasks for both:
1. **XSS gate:** `displayName` is rendered inside both `<s-text>` (auto-escaped) and the chat banner (string template). Polaris web components auto-escape text content; native React JSX auto-escapes interpolated strings. **No additional sanitization is needed** as long as displayName is only used in text contexts (never as raw HTML / `dangerouslySetInnerHTML`). Add a defensive Zod schema that rejects `<`, `>`, `&` in `displayName` if we ever surface it from user input; for V1 it comes from the AI Gateway response which is trusted.
2. **shop mismatch:** In `/settings/page.tsx`, if `searchParams.shop` is provided but doesn't match the session shop derived by App Bridge runtime, render an error banner. In practice the session-token Bearer path on the PATCH endpoint already binds shop to the session; the SSR path uses `searchParams.shop` purely for display. The planner should add a comment explaining the asymmetry and consider whether to read session shop server-side via a sniffed session-token cookie or accept the searchParams approach matching `/chat`.

**Warning signs:** Phase 4 verification notes flagged these — they appear under STATE.md → Deferred Items → "Phase 7 prerequisites."

[VERIFIED: STATE.md Deferred Items table at 2026-05-27]

## Code Examples

### Adding "Settings" to the embedded admin nav

```tsx
// app/(embedded)/EmbeddedProviders.tsx (UPDATED)
export default function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <s-app-nav>
        <s-link href="/chat" rel="home">Search</s-link>
        <s-link href="/onboarding">Onboarding</s-link>
        <s-link href="/settings">Settings</s-link>  {/* D-05 */}
      </s-app-nav>
      {children}
    </>
  );
}
```
[VERIFIED: app/(embedded)/EmbeddedProviders.tsx existing pattern]

### `ShopSettings` Prisma model (exact shape from D-10)

```prisma
// prisma/schema.prisma (APPEND)
model ShopSettings {
  shop              String   @id
  activeChatModelId String
  updatedAt         DateTime @updatedAt

  @@map("shop_settings")
}
```
[VERIFIED: D-10 spec; consistent with `ShopifySession` shop-keyed pattern in the same schema file]

### Polaris s-* JSX intrinsic augmentation (TypeScript)

```typescript
// types/shopify-global.d.ts (APPEND to IntrinsicElements interface)
's-table': PolarisIntrinsicProps;
's-table-header-row': PolarisIntrinsicProps;
's-table-header': PolarisIntrinsicProps;
's-table-body': PolarisIntrinsicProps;
's-table-row': PolarisIntrinsicProps;
's-table-cell': PolarisIntrinsicProps;
's-choice-list': PolarisIntrinsicProps;
's-choice': PolarisIntrinsicProps;
'ui-save-bar': PolarisIntrinsicProps;
```
[VERIFIED: types/shopify-global.d.ts existing augmentation pattern]

### Settings form component (sketch — sortable + radio + save bar)

```tsx
// app/(embedded)/settings/settings-form.tsx
'use client';

import { useMemo, useState } from 'react';
import type { CatalogModel } from '@/services/chat/model-catalog';

type SortKey = 'contextWindow' | 'inputPricePerMillion' | 'outputPricePerMillion';
interface SortState { key: SortKey; direction: 'asc' | 'desc' }

interface Props {
  catalog: CatalogModel[];
  activeId: string;
  activeDisplayName: string;
  saveDisabled: boolean;          // cold-start fallback locks Save
}

export function SettingsForm({ catalog, activeId, activeDisplayName, saveDisabled }: Props) {
  const [selectedId, setSelectedId] = useState(activeId);
  const [sort, setSort] = useState<SortState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!sort) return catalog;
    return [...catalog].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      return sort.direction === 'asc' ? (av - bv) : (bv - av);
    });
  }, [catalog, sort]);

  const dirty = selectedId !== activeId;
  const inCatalog = catalog.some((m) => m.id === activeId);

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/settings/model', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activeChatModelId: selectedId }),
      });
      if (res.ok) {
        const { displayName } = await res.json();
        shopify.toast.show(`Model updated to ${displayName}`);
        // Refresh server-side props on next nav; selectedId === activeId now.
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'save_failed');
      }
    } catch {
      setError('network_error');
    } finally {
      setSaving(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, direction: 'asc' };
      return cur.direction === 'asc' ? { key, direction: 'desc' } : null;
    });
  }

  return (
    <>
      {error && <s-banner tone="critical">Save failed: {error}</s-banner>}
      {!inCatalog && (
        <s-banner tone="warning">
          Your previously-selected model is no longer available — pick a replacement.
        </s-banner>
      )}
      <s-choice-list name="active-model" value={selectedId}>
        <s-table>
          <s-table-header-row>
            <s-table-header>Model name</s-table-header>
            <s-table-header>Provider</s-table-header>
            <s-table-header
              format="numeric"
              onClick={() => toggleSort('contextWindow')}
            >
              Context window
            </s-table-header>
            <s-table-header
              format="currency"
              onClick={() => toggleSort('inputPricePerMillion')}
            >
              $/M input
            </s-table-header>
            <s-table-header
              format="currency"
              onClick={() => toggleSort('outputPricePerMillion')}
            >
              $/M output
            </s-table-header>
            <s-table-header>Best for</s-table-header>
            <s-table-header>Active</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {rows.map((m) => (
              <s-table-row key={m.id}>
                <s-table-cell>{m.displayName}</s-table-cell>
                <s-table-cell>{m.provider}</s-table-cell>
                <s-table-cell>{m.contextWindow.toLocaleString()}</s-table-cell>
                <s-table-cell>${m.inputPricePerMillion.toFixed(2)}</s-table-cell>
                <s-table-cell>${m.outputPricePerMillion.toFixed(2)}</s-table-cell>
                <s-table-cell>{m.bestFor}</s-table-cell>
                <s-table-cell>
                  <s-choice
                    value={m.id}
                    {...(selectedId === m.id ? { selected: '' } : {})}
                    onClick={() => setSelectedId(m.id)}
                  >
                    Select {m.displayName}
                  </s-choice>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-choice-list>

      {dirty && !saveDisabled && (
        <ui-save-bar id="settings-save-bar">
          <button variant="primary" onClick={handleSave} {...(saving ? { loading: '' } : {})}>
            Save
          </button>
          <button onClick={() => setSelectedId(activeId)}>Discard</button>
        </ui-save-bar>
      )}
    </>
  );
}
```
[VERIFIED structure from: app/(embedded)/onboarding/page.tsx pattern + shopify.dev s-choice-list + s-table + ui-save-bar docs]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static hand-maintained list of supported models | `GET https://ai-gateway.vercel.sh/v1/models` (no auth, OpenAI-format) | Vercel AI Gateway shipped REST list endpoint with pricing fields ~2025 | We don't have to hand-maintain anything; catalog is current automatically [CITED: vercel.com/docs/ai-gateway/models-and-providers] |
| Polaris React `DataTable` with built-in sort props | `<s-table>` web component without sort | New unified Polaris (web components) released 2025 | Sort is now our responsibility; one-time cost — see Pitfall 1 [CITED: shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table] |
| `@shopify/app-bridge` npm package + React provider | `<Script src=".../app-bridge.js">` + `window.shopify.*` runtime global | App Bridge v4 (~2024) deprecated the npm-provider model | Our `EmbeddedProviders.tsx` already uses this idiom [VERIFIED: app/(embedded)/layout.tsx] |

**Deprecated/outdated (avoid):**
- `@shopify/app-bridge-react` provider — replaced by the runtime `window.shopify` global. We never imported this package; do not add it.
- Polaris React `DataTable` — replaced by `<s-table>`. Polaris React is fine to use for marketing/landing pages but NOT inside the embedded admin (mixing it with `<s-page>` causes layout collisions).

**Initial BEST_FOR copy proposal (D-02 — planner may revise):**

```typescript
export const BEST_FOR: Record<string, string> = {
  // Google
  'google/gemini-2.5-flash': 'Fastest, low cost — great default',
  'google/gemini-2.5-flash-lite': 'Highest throughput, simplest tasks',
  'google/gemini-2.5-pro': 'Strong reasoning, vision, long context',
  'google/gemini-3.1-pro-preview': 'Newest Google flagship reasoning',
  // Anthropic
  'anthropic/claude-haiku-4.5': 'Anthropic balance of cost and quality',
  'anthropic/claude-sonnet-4.5': 'Anthropic mid-tier for complex queries',
  'anthropic/claude-opus-4.7': 'Best long-form reasoning, premium cost',
  // OpenAI
  'openai/gpt-5-mini': 'OpenAI value tier',
  'openai/gpt-5.5': 'OpenAI flagship general purpose',
  // xAI
  'xai/grok-4.3': 'Real-time knowledge, opinionated reasoning',
};
// Any model id not in this map renders 'General purpose'.
```
[VERIFIED: model ids cross-referenced against live `/v1/models` response 2026-05-27]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The catalog's flat `pricing.input` / `pricing.output` fields suffice for SC1's $/M display; tiered pricing is rendered as base tier only | Pitfall 6 + Code Examples | Some models display a misleadingly-low base price when they actually charge tier 2 for typical loads. Mitigation: add a "starting at" tooltip or footnote. Low risk for SC1 acceptance — the spec just says "$/M input/output." |
| A2 | Filtering the displayed catalog to BEST_FOR keys + active model (~10–12 rows) is preferable to rendering all 190 language models | Pitfall 7 + Open Questions | If the merchant wants a model not in BEST_FOR, they cannot select it. Mitigation: add a "Show all models" toggle, or extend BEST_FOR. Phase 7 plan should pick a path. |
| A3 | `searchParams.shop` is the correct shop source for the Server Component's `getActiveChatModel(shop)` call, matching `chat/page.tsx` | Architectural Responsibility Map + Pitfall 8 | If the searchParams.shop doesn't match the actual embedded session's shop, the SSR-pre-selected row could be wrong. The PATCH endpoint binds shop to the session token (correct). Phase 4 also relied on this and flagged it for follow-up. |
| A4 | A single `<ui-save-bar>` + child `<button>` elements (as documented by App Bridge web components) renders correctly in this Next.js App Router setup, alongside the surrounding `<s-page>` shell | Code Examples | If layout collisions arise, fall back to an inline `<s-button>` directly in the form. D-07 says "Save button + toast" — either form satisfies. |
| A5 | The 15-min in-memory cache is sufficient even with multiple Vercel lambda instances (each warming its own cache) | Pattern 2 | If the catalog updates frequently AND cold lambdas are common, merchants may see different catalogs in close succession. Acceptable per D-03; low real-world risk because catalog changes are infrequent. |
| A6 | The PATCH endpoint's catalog-validation step (Pattern 4) hits the same 15-min cache and adds negligible latency | Pattern 4 | If a fresh fetch is forced at every PATCH, latency could climb. The same `fetchModelCatalog()` is reused; the cache absorbs back-to-back saves. |

## Open Questions

1. **How many catalog rows should we display?**
   - What we know: The gateway returns ~190 language models. D-04 says "side-by-side pricing comparison" implies bounded. Deferred ideas explicitly defer search/filter "if catalog grows past ~30 models."
   - What's unclear: Phase 7 doesn't enumerate which models to show. Researcher's recommendation: filter to `models.filter(m => BEST_FOR[m.id] || m.id === activeId)` for ~10–12 rows.
   - Recommendation: Planner picks one of: (a) BEST_FOR-only filter (Researcher's recommendation), (b) full catalog with sort + scroll, (c) provider allowlist (`google` + `anthropic` + `openai` + `xai`). Plan should make this an explicit task.

2. **Should we route as `/api/settings/model` or `/api/settings`?**
   - What we know: CONTEXT.md Claude's Discretion explicitly leaves this open. Phase 8 will add email + cap settings.
   - What's unclear: Whether Phase 8's settings will be PATCHed via the same endpoint with a richer body or a sibling route.
   - Recommendation: Use `/api/settings/model` for Phase 7 — it's the most specific and lowest-coupling choice. Phase 8 can add `/api/settings/email`, `/api/settings/cap`, etc., without renaming. The alternative (`/api/settings` with discriminated body) introduces premature generalization risk.

3. **Should `getActiveChatModel` hydrate `displayName` from the catalog, or store it in `ShopSettings`?**
   - What we know: D-10 specifies the table is minimal (`shop`, `activeChatModelId`, `updatedAt`). The catalog is the source of truth for displayName per the model-catalog module.
   - What's unclear: If the catalog fetch fails AND the resolver returns a DB row, what's the displayName?
   - Recommendation: Pattern 3 above — try the catalog; on failure, synthesize displayName from the id segment (`'google/gemini-2.5-flash'` → `'gemini-2.5-flash'`). The chat banner is decorative; truncated id is acceptable degradation.

4. **Should we add an "auto-rotate to default if active model is removed" behavior?**
   - What we know: D-06 says "If the active id is not in the rendered catalog, select nothing and surface an inline warning." This is read-side; the saved row is not changed.
   - What's unclear: Should `/api/chat` and `/api/proxy/chat` ALSO detect this and fall back to DEFAULT_MODEL silently, or should they fail loudly?
   - Recommendation: Silent fallback to DEFAULT_MODEL at the resolver level (already implied by Pattern 3's `if (match) return match; else …`). The settings page surfaces the warning so merchants notice and update; chat never breaks.

5. **Sort defaults — what order do we display rows in on first render?**
   - What we know: CONTEXT.md leaves this to Claude's Discretion.
   - What's unclear: Provider alphabetical vs `inputPricePerMillion` ascending.
   - Recommendation: Provider alphabetical, with active model floated to the top of its group. Provider grouping is the most natural mental model for merchants ("I want Google" / "I want Anthropic"). Active-at-top is a Shopify-admin convention for current selection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Vercel AI Gateway `/v1/models` endpoint | Catalog client | ✓ (live-verified 2026-05-27) | n/a (REST, OpenAI-format) | D-03 fallback ladder: LKG cache → DEFAULT_MODEL-only row |
| PostgreSQL (existing) | `ShopSettings` table | ✓ | Already in use | — |
| `prisma` CLI | Migration | ✓ | 7.3.0 | — |
| App Bridge runtime (`window.shopify`) | Toast, idToken, ui-save-bar | ✓ | Loaded via CDN in `app/(embedded)/layout.tsx` | — |
| Polaris web components | s-page, s-table, s-choice-list, s-banner, s-button | ✓ | Loaded via CDN in `app/(embedded)/layout.tsx` | — |
| `AI_GATEWAY_API_KEY` env | Existing chat completions (NOT required for /v1/models) | ✓ | Already in `.env` | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none — `/v1/models` outages handled by D-03

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (jsdom environment, `@` path alias, globals enabled) |
| Quick run command | `bunx vitest run <path>` |
| Full suite command | `bun test` |

[VERIFIED: vitest.config.ts + package.json scripts]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SC1 | `/settings` page renders catalog rows with name, provider, context, $/M input, $/M output, best-for columns | component | `bunx vitest run app/(embedded)/settings/__tests__/page.test.tsx` | ❌ Wave 0 |
| SC1 | Catalog client fetches `/v1/models`, filters to language type, maps to CatalogModel shape, multiplies pricing by 1e6 | unit | `bunx vitest run services/chat/__tests__/model-catalog.test.ts` | ❌ Wave 0 |
| SC1 | Catalog client serves last-known-good on fetch error, with `stale: true` | unit | `bunx vitest run services/chat/__tests__/model-catalog.test.ts` | ❌ Wave 0 |
| SC1 | Catalog client serves DEFAULT_MODEL-only row on cold-start failure, with `coldStartFallback: true` | unit | `bunx vitest run services/chat/__tests__/model-catalog.test.ts` | ❌ Wave 0 |
| SC2 | PATCH `/api/settings/model` validates body, requires session, validates id against catalog, upserts `ShopSettings`, returns `displayName` | route integration | `bunx vitest run app/api/settings/model/__tests__/route.test.ts` | ❌ Wave 0 |
| SC2 | `getActiveChatModel(shop)` reads `ShopSettings` row when present, hydrates displayName from catalog | unit | `bunx vitest run services/chat/__tests__/getActiveChatModel.test.ts` | partial — update existing |
| SC2 | After saving, a page refresh shows the new model as `selected` on the radio (RTL component test) | component | `bunx vitest run app/(embedded)/settings/__tests__/settings-form.test.tsx` | ❌ Wave 0 |
| SC3 | `getActiveChatModel(shop)` returns `DEFAULT_MODEL` when `ShopSettings` row is absent | unit | `bunx vitest run services/chat/__tests__/getActiveChatModel.test.ts` | partial — update existing |
| SC3 | Settings page renders with `DEFAULT_MODEL.id` radio selected for a never-saved shop | component | `bunx vitest run app/(embedded)/settings/__tests__/page.test.tsx` | ❌ Wave 0 |
| SC4 | `/api/chat` calls `getActiveChatModel(shop)` and passes `.id` to streamText — verified by existing Phase 4 tests, unchanged | route integration | `bunx vitest run app/api/chat/__tests__/route.test.ts` | ✓ |
| SC4 | `/api/proxy/chat` calls `getActiveChatModel(shop)` — verified by existing Phase 6 tests, unchanged | route integration | `bunx vitest run app/api/proxy/chat/__tests__/route.test.ts` | ✓ |
| SC4 | `chat/page.tsx` server-renders banner with `model.displayName` — verified by existing Phase 4 page test | component | `bunx vitest run app/(embedded)/chat/__tests__/page.test.tsx` | ✓ |
| — | `ShopSettingsRepository.get` returns null for absent shop, returns row for present shop | unit | `bunx vitest run lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` | ❌ Wave 0 |
| — | `ShopSettingsRepository.upsert` creates row when absent, updates `activeChatModelId` + `updatedAt` when present | unit | `bunx vitest run lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` | ❌ Wave 0 |
| Manual smoke | After Save in `/settings`, navigate to `/chat` and verify the banner displays the new model name | manual | n/a | n/a |

### Sampling Rate

- **Per task commit:** `bunx vitest run <changed file's __tests__ dir>` (typically 1–3 files, <5s)
- **Per wave merge:** `bunx vitest run services/chat lib/db/repositories app/api/settings app/(embedded)/settings` (Phase 7 subtree, ~30s)
- **Phase gate:** `bun test` (full suite green before `/gsd-verify-work`)

### Wave 0 Gaps

- [ ] `app/(embedded)/settings/__tests__/page.test.tsx` — covers SC1, SC2, SC3 (server-component pre-selection + catalog rendering)
- [ ] `app/(embedded)/settings/__tests__/settings-form.test.tsx` — covers SC1 (sort), SC2 (Save flow), and dirty-state Save disable
- [ ] `app/api/settings/model/__tests__/route.test.ts` — covers SC2 (auth + validation + upsert + catalog validation)
- [ ] `services/chat/__tests__/model-catalog.test.ts` — covers SC1 (fetch + map), D-03 fallback ladder
- [ ] `services/chat/__tests__/getActiveChatModel.test.ts` — UPDATE existing (add DB-hit case for SC2, keep DB-miss case for SC3)
- [ ] `lib/db/repositories/__tests__/ShopSettingsRepository.test.ts` — covers the repository contract
- [ ] No new framework install needed (vitest already configured)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `withShopifySession` (Bearer session-token decode + offline session load) — already shipped |
| V3 Session Management | yes | Shopify session tokens — managed by `@shopify/shopify-api`; no Phase 7 session state |
| V4 Access Control | yes | Multi-tenancy lock: `ShopSettings.shop` is PK; PATCH derives shop from session (not body); per-shop isolation is structural |
| V5 Input Validation | yes | Zod schema on PATCH body (`activeChatModelId: z.string().min(1).max(200)`); defense-in-depth catalog membership check before upsert |
| V6 Cryptography | no | Phase 7 introduces no cryptographic operations. Session tokens are decoded by the existing library |
| V7 Errors & Logging | yes | Zero `console.log` in new code paths (CLAUDE.md hard rule); structured error codes returned to client (`invalid_body`, `unknown_model_id`, `missing_token`, etc.) |
| V11 Business Logic | yes | Save disabled when no change; saved value must be a known model id; cold-start state locks Save |
| V12 Files & Resources | no | No file uploads or downloads |
| V13 API & Web Service | yes | PATCH is the only state-changing endpoint; idempotent (upsert); session-bound; returns minimal response (`{ ok, displayName }`) |
| V14 Configuration | yes | Catalog endpoint hardcoded; no env-driven URL injection vector; `cache: 'no-store'` prevents data-cache poisoning |

### Known Threat Patterns for Next.js 16 + Shopify embedded + Prisma

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-shop write (Shop A saves into Shop B's settings) | Tampering / Elevation of Privilege | `withShopifySession` derives shop from the verified session token; never trust body/query for shop. `ShopSettings.shop` is the PK so wrong-shop upserts collide deterministically |
| SSRF via catalog URL injection | Tampering | URL is a hardcoded constant; no env-var interpolation; no merchant-controlled value reaches `fetch()` |
| Stored arbitrary string in `activeChatModelId` field (later rendered or used) | Tampering / Injection | Zod max length 200 + catalog membership check at PATCH time = double-gate. Even if a tampered id reaches the DB, the resolver's fallback handles it |
| XSS via `displayName` rendered in the chat banner / settings table | Cross-site scripting | `displayName` comes from the AI Gateway (trusted source) AND is rendered as text inside React JSX / Polaris web components (auto-escaped). Defensive: add Zod regex if/when displayName ever comes from user input |
| Toast / banner injection via error messages | Information disclosure | Error codes are constants (`invalid_body`, `unknown_model_id`); the response body never includes session tokens or stack traces |
| Data cache poisoning via Next.js fetch cache | Tampering | All catalog fetches use `cache: 'no-store'`. The 15-min cache is in our module-level Map, isolated from Next's data cache |
| CSRF on PATCH endpoint | Tampering | Bearer session-token auth: cross-origin requests cannot mint a valid token. Session token's `dest` claim must match a known shop; the offline-session load is the second gate |
| Replay of an old PATCH request | Tampering | Session tokens are short-lived (1 minute per Shopify spec); the offline session can be revoked. The PATCH is idempotent regardless |
| Catalog endpoint downtime → fail-open accepting any model id | Availability / Elevation | The PATCH validation step uses the cached/LKG catalog — if `fetchModelCatalog()` returns `coldStartFallback: true`, only DEFAULT_MODEL is in the catalog and only DEFAULT_MODEL passes validation. **Save is disabled in cold-start state** (D-03), so the merchant cannot reach this code path. Belt-and-suspenders |

### Phase 4 deferred security follow-ups (inherited)

These items from STATE.md Deferred Items must be addressed by Phase 7 plan tasks:

- **`displayName` XSS validation gate:** Confirmed safe by code path inspection — displayName is only rendered as text inside React JSX and Polaris web components, both of which auto-escape. No `dangerouslySetInnerHTML`. Document this conclusion in the plan; no code change needed unless we add a defensive Zod regex preemptively.
- **`searchParams.shop` ↔ `session.shop` verification:** See Pitfall 8. For the SSR settings page, the planner should either (a) accept the searchParams approach matching `/chat`, or (b) read the session via the offline session id derived from a header / cookie. **Recommendation: match `/chat` pattern** (option a) — consistency wins; the PATCH endpoint enforces session-bound shop at the write path.

[VERIFIED: STATE.md Deferred Items table 2026-05-27]

## Sources

### Primary (HIGH confidence)

- **Vercel AI Gateway `/v1/models` endpoint** — live `curl` verification at 2026-05-27 returned ~190 language models. Sample `google/gemini-2.5-flash` row confirms response shape. [VERIFIED]
- **Vercel docs: Models & Providers** — `https://vercel.com/docs/ai-gateway/models-and-providers` — full response field table for `GET /v1/models`. [CITED]
- **Vercel docs: AI Gateway overview** — `https://vercel.com/docs/ai-gateway` — confirms `AI_GATEWAY_API_KEY` env name, gateway provider routing semantics. [CITED]
- **Polaris web components: choice-list** — `https://shopify.dev/docs/api/app-home/polaris-web-components/forms/choicelist` — confirms `selected` (not `checked`), `<s-choice value=…>` child format. [CITED]
- **Polaris web components: table** — `https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table` — confirms `<s-table>` family tags, NO built-in sort. [CITED]
- **Polaris web components index** — `https://shopify.dev/docs/api/app-home/polaris-web-components` — full tag list (`s-page`, `s-section`, `s-table`, `s-choice-list`, `s-banner`, `s-button`, etc.). [CITED]
- **App Bridge: ui-save-bar** — `https://shopify.dev/docs/api/app-bridge-library/web-components/ui-save-bar` — save bar attributes, `data-save-bar`, `data-discard-confirmation`. [CITED]
- **App Bridge: toast API** — `https://shopify.dev/docs/api/app-home/apis/user-interface-and-interactions/toast-api` — `shopify.toast.show(message, opts?)` exact signature with `isError`. [CITED]
- **Codebase: `services/chat/getActiveChatModel.ts`** — Phase 4 contract anchor read in this session. [VERIFIED]
- **Codebase: `lib/shopify/auth.ts`** — `withShopifySession` wrapper read in this session. [VERIFIED]
- **Codebase: `prisma/schema.prisma`** — confirmed no `ShopSettings` model exists. [VERIFIED]
- **Codebase: `app/(embedded)/onboarding/page.tsx`** — s-* idiom + shopify.toast usage proof. [VERIFIED]
- **Codebase: `app/(embedded)/EmbeddedProviders.tsx`** — confirmed nav structure for D-05 update. [VERIFIED]
- **Codebase: `types/shopify-global.d.ts`** — existing JSX intrinsic augmentation pattern. [VERIFIED]
- **CONTEXT.md** — all D-01 through D-10 read in this session.

### Secondary (MEDIUM confidence)

- **Community forum: s-choice-list checked vs selected** — `https://community.shopify.dev/t/s-choice-list-should-use-checked-instead-of-selected/22260` — reinforces the `selected` quirk.
- **GitHub: FranciscoMoretti/ai-registry** — `https://github.com/FranciscoMoretti/ai-registry/` — third-party reference renderer of the same `/v1/models` endpoint; confirms response stability over time.

### Tertiary (LOW confidence)

- WebSearch summaries from queries about AI Gateway and Polaris — used only to triangulate. All claims state above are backed by primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package already in `package.json`; no net-new deps
- Architecture: HIGH — every primitive (auth wrapper, prisma, App Bridge globals, Polaris components) has an exact precedent in the codebase
- Pitfalls: HIGH — sort gotcha + `selected` vs `checked` are both documented + verified in this session; pricing-format gotcha verified against live response
- Validation architecture: HIGH — Vitest + RTL pattern matches Phase 4 / Phase 6 test files exactly
- Security: HIGH — multi-tenancy + Bearer auth path is identical to existing routes
- Catalog endpoint behavior: HIGH (live-verified) — sample shape stored in this session's tool-results cache for reference

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (30 days for stable; revisit if AI Gateway model schema changes or Polaris web components add built-in sort to `s-table`)

---

## Findings summary (for orchestrator)

- **Vercel AI Gateway list endpoint VERIFIED:** `GET https://ai-gateway.vercel.sh/v1/models`, no auth, OpenAI-format. Includes `id`, `name`, `owned_by`, `context_window`, `pricing.input` ($/token string), `pricing.output` ($/token string), `type`. Multiply pricing strings by 1e6 for $/M display. ~190 language models returned.
- **All locked decisions D-01..D-10 are implementable with zero adjustments.**
- **No new npm packages required.** Phase 7 reuses existing stack (Polaris s-*, App Bridge runtime globals, prisma, zod, withShopifySession, vitest).
- **Critical pitfall:** `s-table` has no built-in sort — must implement client-side React state. D-04's "sortable on Context + pricing" is a client-component sort, not a Polaris attribute.
- **Phase 4 carryover:** `displayName` XSS gate confirmed safe; `searchParams.shop` ↔ session shop verification still recommended (planner picks resolution path).
- **Open: filter to BEST_FOR-keyed models** to bound the table at ~10–12 rows vs rendering all ~190 — planner picks.
