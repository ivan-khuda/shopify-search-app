# Phase 7: Admin Settings + Model Picker - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Merchants get a `/settings` admin page that lists Vercel AI Gateway chat models with name, provider, context window, per-token pricing, and a "best for" descriptor; selecting one persists per-shop in a new `ShopSettings` table; the existing `getActiveChatModel(shop)` resolver (Phase 4 D-09 contract anchor) is the single read path so the admin playground and storefront chat both reflect the active choice on the next request.

This phase is a **body-only swap** of the resolver plus a new settings UI — no signature changes, no call-site rewrites in `/api/chat` or `/api/proxy/chat`.

**In scope:** `/settings` page (list + radio + Save), `ShopSettings` Prisma model, resolver DB read, model-catalog fetch from AI Gateway with fallback, curated "best for" copy map.

**Out of scope:** Email + hard-cap settings (Phase 8), billing settings, multi-environment model overrides, per-conversation model picker, admin user permission system beyond the existing Bearer session auth.

</domain>

<decisions>
## Implementation Decisions

### Model Catalog Source

- **D-01:** **Model list fetched at runtime from Vercel AI Gateway.** Researcher MUST verify the exact endpoint and response shape — current candidate is `https://api.gateway.ai.cloudflare.com/v1/models` style but Vercel AI Gateway has its own. If no list endpoint exists, fall back to D-03's hybrid approach (static curated list + Decision Log entry noting the deviation).
- **D-02:** **Curated `BEST_FOR` map keyed by model id** lives in the repo (e.g., `services/chat/model-catalog.ts`). Shape: `Record<string, string>` mapping model id → short marketing-grade descriptor ("Fastest, low cost — great default", "Best reasoning", etc.). Models without a curated entry fall back to the literal string `"General purpose"`. We control the language; researcher can propose initial copy for the top ~10 expected models.
- **D-03:** **Caching + failure fallback.** AI Gateway responses cached in-memory for 15 minutes per process. On fetch failure (HTTP error, timeout, malformed JSON): serve the last-known-good cached list AND surface a "Showing cached models" banner above the table. If there is no last-known-good (cold start failure): serve a tiny hardcoded fallback containing only the DEFAULT_MODEL row + a "Model catalog unavailable — showing default only" inline message, and disable the Save button until refresh.

### Settings Page UX

- **D-04:** **Table layout, one row per model, native HTML radio per row.** Columns in order: `Model name` · `Provider` · `Context window` · `$ / M input tokens` · `$ / M output tokens` · `Best for` · `Active` (radio). Sortable on Context and the two pricing columns. Dense, scannable, matches Polaris admin convention. Card grid / dropdown layouts rejected as worse for side-by-side pricing comparison (the primary user task).
- **D-05:** **Route is the top-level `/settings`** (singular noun, no nested path). Adds a "Settings" entry to the embedded admin nav alongside Chat/Onboarding. Future settings categories (email cap in Phase 8, billing) will eventually nest under `/settings/*` — for V1 the model picker IS `/settings`, no intermediate index page.
- **D-06:** **Active row pre-selected on page load** by calling `getActiveChatModel(shop)` server-side and matching its `.id` against the rendered rows. If the active id is not in the rendered catalog (e.g., the merchant's previously-saved model was removed from AI Gateway's offering), select nothing and surface an inline warning "Your previously-selected model is no longer available — pick a replacement."

### Save Semantics

- **D-07:** **Explicit Save button with toast confirmation.** Save is disabled when no radio change has occurred relative to the currently-active model. Click → PATCH `/api/settings/model` (or equivalent) → on 200, toast "Model updated to <Display Name>"; on error, inline error banner above the table with the API error code. Polaris convention — matches the merchant's mental model from other Shopify settings pages.
- **D-08:** **Playground reflects new model on the next chat request, not via shared client state.** `getActiveChatModel(shop)` is already called per-request from `/api/chat` and `/api/proxy/chat`. After Save persists the new row, the very next streamed chat request reads it. The admin playground's "Active model: <Name>" banner (Phase 4 plan 04-06) re-renders on the next stream. No zustand/SWR/context plumbing required.

### Default Seeding Strategy

- **D-09:** **Never explicitly seed `ShopSettings`.** Rely on `getActiveChatModel(shop)`'s existing Phase 4 fallback: when no row exists for the shop, return `DEFAULT_MODEL` (`google/gemini-2.5-flash` / Gemini 2.5 Flash). First explicit Save from `/settings` is what writes the row. This satisfies SC2 (refresh shows persisted choice — true once the user has saved at least once), SC3 (sensible default pre-selected — true because the resolver returns the default for absent rows, and `/settings` pre-selects whatever the resolver returns), and SC4 (playground reflects active model — true because every read goes through the resolver).
- **D-10:** **`ShopSettings` Prisma model.** Minimal V1 shape:
  - `shop String @id` (one row per shop; the shop hostname is the PK)
  - `activeChatModelId String` (the AI Gateway model id, e.g., `google/gemini-2.5-flash`)
  - `updatedAt DateTime @updatedAt`
  - `@@map("shop_settings")`
  - No `customerId`, no `createdAt` — `updatedAt` doubles as the audit signal.

### Claude's Discretion

- API endpoint shape (`/api/settings/model` GET + PATCH vs `/api/settings` GET + PATCH with a `{ activeChatModelId }` body) — researcher/planner picks based on Phase 8 scope expectations.
- `model-catalog.ts` exact module location (under `services/chat/` next to the resolver vs `lib/ai/`).
- AI Gateway client implementation (`fetch` directly vs a tiny `ai-gateway-client.ts` helper) — planner decides based on what cleans up best.
- Server-side rendering vs client-side fetching of the model list inside the settings page — Next.js App Router idioms apply; planner picks.
- Sort defaults (provider alphabetical vs price ascending) — planner picks based on what's most useful for a merchant scanning the list.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 source-of-truth
- `.planning/ROADMAP.md` — Phase 7 section: goal + 4 success criteria
- `.planning/REQUIREMENTS.md` — ADM-03 + ADM-04 definitions

### Phase 4 contract anchor (locks resolver signature; Phase 7 swaps body only)
- `services/chat/getActiveChatModel.ts` — current resolver. Phase 7 replaces the body with a DB read; signature `(shop: string) => Promise<ActiveChatModel>` stays as-is.
- `.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md` — D-09 contract
- `app/api/chat/route.ts` — admin caller (line 64); reads `.id` only
- `app/api/proxy/chat/route.ts` — storefront caller (Phase 6); reads `.id` only

### Project-level constraints
- `CLAUDE.md` § Constraints — Vercel AI Gateway is the SOLE runtime entry point for chat completions; no direct provider SDKs
- `CLAUDE.md` § Constraints — TypeScript strict; bun-only; no `next/image` in extension bundle
- `.planning/PROJECT.md` § Hosting — Vercel-first; deployable to Node

### Patterns to mirror
- `lib/shopify/auth.ts` — `withShopifySession` wrapper for embedded admin routes (Bearer session token + offline session load)
- `app/(embedded)/chat/page.tsx` + `app/(embedded)/chat/chat-shell.tsx` — admin shell pattern (tabs, header, layout) for the new `/settings` page to follow visually
- `app/(embedded)/onboarding/page.tsx` — alternative admin-page reference (uses Polaris s-* web components)
- `prisma/schema.prisma` — `ShopifySession` model is the reference for shop-keyed singleton tables

### AI Gateway
- `https://vercel.com/docs/ai-gateway` (researcher must fetch fresh): endpoint for listing available chat models — confirm existence, response shape, auth requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getActiveChatModel(shop)` (services/chat/getActiveChatModel.ts):** Phase 4 contract anchor. Body-only swap target. Already imported by both `/api/chat` and `/api/proxy/chat`.
- **`withShopifySession` (lib/shopify/auth.ts):** Bearer session-token wrapper for admin routes. The `/api/settings/model` PATCH endpoint wraps with this.
- **Admin shell pattern (`app/(embedded)/chat/`):** Tabs + header + Polaris layout. Mirror for `/settings`.
- **`prisma` singleton (lib/db/client.ts):** Standard DB access. `ShopSettings` queries route through this.
- **Polaris s-* web components / shadcn-style primitives:** Both are available; the existing chat shell uses shadcn primitives, onboarding uses s-* web components. Planner picks per page.

### Established Patterns
- **Multi-tenancy lock:** Every Prisma query filters by `shop`. ShopSettings has `shop` as PK — the filter is implicit.
- **Bearer session auth:** Admin routes use `withShopifySession`; never raw query.shop, never body-supplied shop.
- **No console.log in production paths:** CLAUDE.md hard constraint; settings route + catalog client must respect this.
- **Hardcoded model id literal lives in ONE place (`DEFAULT_MODEL` in `getActiveChatModel.ts`).** Phase 7 keeps this — DB-absent fallback returns `DEFAULT_MODEL`. Other modules read via the resolver, never inlining ids.

### Integration Points
- **Resolver swap:** Body of `getActiveChatModel` reads `prisma.shopSettings.findUnique({ where: { shop } })`; if found, maps `activeChatModelId` → the in-catalog `ActiveChatModel` (the catalog is the source of truth for `displayName`); else returns `DEFAULT_MODEL`.
- **Catalog client:** New module `services/chat/model-catalog.ts` (or similar) — exposes `fetchCatalog(): Promise<ActiveChatModel[]>` with the 15-min cache + fallback behavior from D-03. Imported by both the settings page (to render the table) and the resolver (to hydrate the resolved row's `displayName`).
- **Settings page entry:** New `app/(embedded)/settings/page.tsx`. SSR pulls catalog + active model; client-side form for radio + Save. Mirrors the chat shell's layout primitives.
- **Settings API endpoint:** New `app/api/settings/model/route.ts` (or `/api/settings/route.ts`) wrapped with `withShopifySession`; PATCH body `{ activeChatModelId: string }` validates against the catalog before upserting.

</code_context>

<specifics>
## Specific Ideas

- The 4 success criteria from ROADMAP are the test contract. SC1 dictates the table columns; SC2 + SC3 + SC4 are validated by the resolver's existing per-request read pattern + the "never seed" decision.
- Phase 4's `getActiveChatModel.ts` JSDoc already says "Phase 7 is a BODY-ONLY swap" — this CONTEXT.md confirms that contract.

</specifics>

<deferred>
## Deferred Ideas

- **Per-conversation model override** — letting a merchant or visitor pick a model per chat thread. Not in V1; out of phase scope.
- **Model usage analytics** — "X requests this month against model Y." Belongs alongside Phase 8's hard-cap counter.
- **A/B comparison playground** — side-by-side response from two models for the same prompt. Future enhancement.
- **Per-environment overrides** — different active model for staging vs production. Not in V1.
- **Model search/filter on /settings** — only matters if catalog grows past ~30 models. Static sort is enough today.
- **Admin user permission system** — currently any user with a valid Bearer session token can change settings. Granular permissions (e.g., "only shop owner can change model") belongs in its own phase.
- **Audit log of model changes** — a `ShopSettingsHistory` table. Future compliance / debugging feature.

</deferred>

---

*Phase: 7-admin-settings-model-picker*
*Context gathered: 2026-05-27*
