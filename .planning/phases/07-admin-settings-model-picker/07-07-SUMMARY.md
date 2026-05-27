---
phase: 07-admin-settings-model-picker
plan: 07
subsystem: admin-settings
tags: [api-route, patch, zod, multi-tenancy, defense-in-depth]
requires:
  - lib/shopify/auth.ts (withShopifySession — Plan 07-03)
  - services/chat/model-catalog.ts (fetchModelCatalog — Plan 07-04)
  - lib/db/repositories/ShopSettingsRepository.ts (shopSettingsRepository.upsert — Plan 07-05)
provides:
  - PATCH /api/settings/model — the single write path for ShopSettings.activeChatModelId
affects:
  - Plan 07-08 (settings-form.tsx posts here on Save)
  - Plan 07-09 (page-level test asserts Save → 200 round-trip)
tech-stack:
  added: []
  patterns:
    - "withShopifySession wrapper composition (Phase 7 admin route pattern)"
    - "Defense-in-depth catalog membership check before upsert (RESEARCH §Pattern 4)"
    - "Response.json idiom (App Router) — no NextResponse"
key-files:
  created:
    - app/api/settings/model/route.ts
  modified: []
decisions:
  - "Endpoint shape: /api/settings/model (Open Question 2 resolution from CONTEXT.md) — leaves /api/settings/cap, /api/settings/email available for Phase 8 sibling routes without renaming"
  - "PATCH-only surface in V1 — no GET; Settings page reads active model via getActiveChatModel(shop) server-side, not via this route"
  - "Multi-tenancy lock: Zod schema deliberately omits `shop` so any tampered body.shop is silently dropped — only ctx.shop reaches the repository"
metrics:
  duration_seconds: 66
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  tests_passed: 7
  completed: 2026-05-27T16:32:11Z
---

# Phase 7 Plan 07: PATCH /api/settings/model Summary

PATCH endpoint that persists the merchant's chosen chat model id to `ShopSettings`, wrapped with `withShopifySession` for Bearer-token auth, validated by Zod, defense-in-depth-validated against the live AI Gateway catalog, then upserted via `shopSettingsRepository.upsert`.

## Endpoint Contract

**Signature:**
```ts
export const PATCH = withShopifySession(async ({ shop, req }) => { ... });
```

**Request:**
- Method: `PATCH`
- URL: `/api/settings/model`
- Headers: `Authorization: Bearer <session-token>`, `Content-Type: application/json`
- Body: `{ activeChatModelId: string }` (length 1..200)

**Response shapes:**

| Status | Body | Source |
|--------|------|--------|
| 200 | `{ ok: true, displayName: string }` | Route handler (catalog-hydrated name) |
| 400 | `{ error: 'invalid_body' }` | Route handler (JSON parse OR Zod safeParse fail) |
| 400 | `{ error: 'unknown_model_id' }` | Route handler (catalog membership miss) |
| 401 | `{ error: 'missing_token' \| 'invalid_token' \| 'invalid_dest' \| 'invalid_shop_domain' \| 'no_offline_session' }` | `withShopifySession` wrapper |

**Error codes authored in this route (the 4 the executor owns):**

1. `invalid_body` (400) — body is not valid JSON.
2. `invalid_body` (400) — body fails Zod shape (`activeChatModelId` missing, empty, or > 200 chars).
3. `unknown_model_id` (400) — id is well-formed but not present in `fetchModelCatalog().models`.
4. (200 happy path — not an error code, but the fourth handler-authored response shape.)

The five 401 codes are emitted by `withShopifySession` before the handler runs.

## Algorithm

```
1. try { raw = await req.json() } catch { return 400 invalid_body }
2. parsed = Body.safeParse(raw)  // Zod: { activeChatModelId: string().min(1).max(200) }
   if !parsed.success → return 400 invalid_body
3. catalog = await fetchModelCatalog()   // 15-min cache hits ~99% of the time
   match = catalog.models.find(m => m.id === parsed.data.activeChatModelId)
   if !match → return 400 unknown_model_id  (NO upsert)
4. await shopSettingsRepository.upsert(shop, parsed.data.activeChatModelId)
5. return Response.json({ ok: true, displayName: match.displayName }, { status: 200 })
```

## Multi-Tenancy Lock — Verified

- `shop` is derived **exclusively** from `withShopifySession` ctx, never from the request body.
- The Zod `Body` schema deliberately does NOT declare a `shop` field, so any tampered `{ shop: 'evil-shop' }` is silently dropped during parse — never reaches the repository.
- Route test `derives shop from session ctx, NOT from request body (multi-tenancy lock)` asserts this: it posts `{ activeChatModelId, shop: 'evil-shop.myshopify.com' }` and asserts `upsert` was called with `'test-shop.myshopify.com'` (the session ctx shop).

## Test Results — Plan 01 Wave 0 RED → GREEN

**7/7 it() blocks PASSING** in `app/api/settings/model/__tests__/route.test.ts`:

| # | Describe block | Test | Status |
|---|---|---|---|
| 1 | body validation | returns 400 invalid_body when JSON body is not parseable | GREEN |
| 2 | body validation | returns 400 invalid_body when activeChatModelId is missing | GREEN |
| 3 | body validation | returns 400 invalid_body when activeChatModelId is > 200 chars | GREEN |
| 4 | catalog membership | returns 400 unknown_model_id when id is not in the catalog | GREEN |
| 5 | happy path | upserts ShopSettings and returns 200 with displayName on valid request | GREEN |
| 6 | happy path | derives shop from session ctx, NOT from request body (multi-tenancy lock) | GREEN |
| 7 | no-secret-logging | NEVER logs Authorization headers or session tokens across any branch | GREEN |

## Verification Commands

```bash
bunx vitest run app/api/settings/model/__tests__/route.test.ts
# → Tests: 7 passed (7), Test Files: 1 passed (1)

bunx tsc --noEmit 2>&1 | grep "app/api/settings/model/route"
# → (empty — no type errors introduced)

grep -c "console\." app/api/settings/model/route.ts
# → 0

grep -c "withShopifySession" app/api/settings/model/route.ts
# → 4 (1 import, 1 wrapper call, 2 JSDoc refs)

grep -c "fetchModelCatalog" app/api/settings/model/route.ts
# → 3 (1 import, 1 call, 1 JSDoc ref)

grep -c "NextResponse" app/api/settings/model/route.ts
# → 0 (uses Response.json App Router idiom)

grep -cE "export.*GET" app/api/settings/model/route.ts
# → 0 (PATCH-only surface)
```

## Open Question Resolutions Confirmed

- **OQ-2 (route shape):** `/api/settings/model` — leaves room for `/api/settings/cap` and `/api/settings/email` in Phase 8 without breaking the PATCH client.
- **OQ-1 (catalog membership defense-in-depth):** Implemented via `fetchModelCatalog()` lookup before upsert. Cold-start state (only `google/gemini-2.5-flash` present) correctly rejects any other id as `unknown_model_id` — Plan 08's UI also disables Save in this state as a belt-and-suspenders measure.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Handoff to Plan 07-08 (settings-form.tsx)

The form posts to this endpoint on Save with the following request:

```ts
const res = await fetch('/api/settings/model', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getSessionToken(app)}`,
  },
  body: JSON.stringify({ activeChatModelId }),
});
```

The form can rely on:
- **200 path:** parse `{ ok: true, displayName }` to update the optimistic UI with the canonical catalog name.
- **400 invalid_body:** show a generic "Invalid request — please retry" toast (this only fires if the form is broken).
- **400 unknown_model_id:** show "That model is no longer available — refresh the page to pick another." This can happen only if the catalog rotated between page load and Save.
- **401 (any code):** App Bridge has lost auth — re-mint the session token and retry once before surfacing an error.

## Self-Check: PASSED

- [x] FOUND: app/api/settings/model/route.ts (69 lines, exceeds min_lines=35)
- [x] FOUND: commit f792892 (`feat(07-07-01): add PATCH /api/settings/model with Zod + catalog validation + upsert`)
- [x] Test suite: 7/7 GREEN
- [x] All success criteria from PLAN.md `<success_criteria>` met
