---
phase: 07-admin-settings-model-picker
plan: 06
subsystem: services/chat
tags: [resolver, contract-anchor, body-only-swap, D-06, D-08, D-09]
dependency_graph:
  requires:
    - 07-01 (resolver test suite RED)
    - 07-03 (shop_settings migration applied)
    - 07-04 (services/chat/model-catalog.ts shipped)
  provides:
    - getActiveChatModel(shop) reads ShopSettings + hydrates from catalog
    - Phase 4 D-09 contract anchor honored (signature unchanged)
    - T-04-24 + T-04-25 deferred items closed at the JSDoc layer
  affects:
    - app/api/chat/route.ts (consumer — UNCHANGED, picks up new behavior on next request)
    - app/api/proxy/chat/route.ts (consumer — UNCHANGED, picks up new behavior on next request)
tech_stack:
  added: []
  patterns:
    - Pattern 3 (per-request DB read + best-effort catalog hydration with id-segment fallback)
    - D-08 stateless playback (no caching at the resolver layer)
key_files:
  modified:
    - services/chat/getActiveChatModel.ts
  created: []
decisions:
  - "Direct prisma.shopSettings.findUnique rather than shopSettingsRepository.get — resolver is the read-path, repository is the write-path tool (CONTEXT.md Claude's-Discretion resolution)"
  - "Silent fall-through on catalog miss / throw — D-06's user-facing warning lives at the settings page, NOT the chat hot path"
  - "Open Q3 resolution: id-segment fallback via .split('/')[1] when catalog doesn't contain the saved id"
  - "Open Q4 resolution: never mutate the DB from the resolver — read-only, silent"
metrics:
  duration_min: 4
  tasks_completed: 1
  files_modified: 1
  completed_date: 2026-05-27
---

# Phase 7 Plan 6: getActiveChatModel Body Swap Summary

Swapped the body of `services/chat/getActiveChatModel.ts` to read `ShopSettings.activeChatModelId` from Postgres and hydrate `displayName` from the AI Gateway catalog, with id-segment synthesis as the silent fallback. The function signature is unchanged — `/api/chat` and `/api/proxy/chat` consume the new behavior on the very next request with zero call-site edits (Phase 4 D-09 contract anchor honored).

## Signature Confirmation (UNCHANGED)

```ts
export interface ActiveChatModel {
  id: string;
  displayName: string;
}

export async function getActiveChatModel(shop: string): Promise<ActiveChatModel>
```

Verified via `git diff app/api/chat/route.ts app/api/proxy/chat/route.ts` → empty.

## Body Diff

### Before (Phase 4)

```ts
const DEFAULT_MODEL: ActiveChatModel = {
  id: 'google/gemini-2.5-flash',
  displayName: 'Gemini 2.5 Flash',
};

export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> {
  void shop;
  return DEFAULT_MODEL;
}
```

### After (Phase 7)

```ts
import { prisma } from '@/lib/db/client';
import { fetchModelCatalog } from './model-catalog';

const DEFAULT_MODEL: ActiveChatModel = {
  id: 'google/gemini-2.5-flash',
  displayName: 'Gemini 2.5 Flash',
};

export async function getActiveChatModel(shop: string): Promise<ActiveChatModel> {
  // Empty-shop guard: installing / never-saved state. Skip the DB call.
  if (!shop) return DEFAULT_MODEL;

  const row = await prisma.shopSettings.findUnique({ where: { shop } });

  // D-09: never explicitly seed — absence of a row IS the fallback signal.
  if (!row) return DEFAULT_MODEL;

  // Best-effort catalog hydration. Catalog failures (network, gateway down,
  // unknown id) fall through to id-segment synthesis. Silent by design —
  // the warning banner per D-06 lives on the settings page.
  try {
    const { models } = await fetchModelCatalog();
    const match = models.find((m) => m.id === row.activeChatModelId);
    if (match) return { id: match.id, displayName: match.displayName };
  } catch {
    // fall through to synthesized displayName below
  }

  const segment = row.activeChatModelId.split('/')[1] ?? row.activeChatModelId;
  return { id: row.activeChatModelId, displayName: segment };
}
```

## Fallback Ladder

| Branch | Trigger | Output | DB Hit? | Catalog Hit? |
|--------|---------|--------|---------|--------------|
| 1 | `!shop` (empty string) | `DEFAULT_MODEL` | No | No |
| 2 | `findUnique` returns `null` | `DEFAULT_MODEL` | Yes | No |
| 3 | Row exists + catalog contains saved id | `{ id, displayName from catalog }` | Yes | Yes |
| 4 | Row exists + catalog miss (curated list / cold-start) | `{ id: row.activeChatModelId, displayName: id-segment }` | Yes | Yes (but no match) |
| 5 | Row exists + `fetchModelCatalog` throws | `{ id: row.activeChatModelId, displayName: id-segment }` | Yes | Threw |

## T-04-24 + T-04-25 Closure

Both Phase 4 deferred threat-register items are now documented in the resolver's JSDoc header (lines ~30–60).

**T-04-24 (XSS gate on `displayName`) — RESOLVED safe by code-path inspection:**

`displayName` flows only into text contexts in V1:
- Admin chat banner — React JSX text node (auto-escaped)
- Settings table cell — Polaris `<s-text>` web component (auto-escaped)
- "Model updated to ${displayName}" toast — App Bridge text-only render

No `dangerouslySetInnerHTML` exists anywhere downstream. Source is either AI Gateway catalog response (trusted) or id-segment synthesis, and AI Gateway ids match `^[a-z-]+/[a-z0-9.-]+$` per RESEARCH §State of the Art — always alphanumeric + dashes + dots. No sanitization needed.

**T-04-25 (`searchParams.shop` ↔ `session.shop`) — OUT OF SCOPE for the resolver:**

Resolver takes `shop: string` on trust. Trust boundary is enforced at consumers:
- `/api/chat`, `/api/proxy/chat` — shop from session token / App Proxy HMAC
- `/api/settings/model` PATCH (Plan 07) — shop strictly from `withShopifySession`, never body/query
- `/settings` SSR page (Plan 08) — shop from searchParams for read-only display only; documented asymmetry

## Tests

| Suite | Count | Status |
|-------|-------|--------|
| `services/chat/__tests__/getActiveChatModel.test.ts` (Phase 7 contract) | 5 | GREEN |
| `services/chat/__tests__/getActiveChatModel.test.ts` (Phase 4 historical) | 3 | SKIPPED (preserved) |
| `app/api/chat/__tests__/route.test.ts` | — | GREEN (signature contract preserved) |
| `app/api/proxy/chat/__tests__/route.test.ts` | — | GREEN (signature contract preserved) |
| `app/(embedded)/chat/__tests__/` | 9 | GREEN (no regressions) |
| Combined admin + proxy + page | 30 | GREEN |

## Verification Checks

| Check | Result |
|-------|--------|
| `git diff app/api/chat/route.ts app/api/proxy/chat/route.ts` | empty (no accidental edits) |
| `grep -c 'console\.' services/chat/getActiveChatModel.ts` | 1 (JSDoc mention of the no-console rule — no actual call) |
| `grep -c 'google/gemini-2.5-flash' services/chat/getActiveChatModel.ts` | 2 (DEFAULT_MODEL id + JSDoc reference to the "exactly once" rule) |
| `grep -c 'prisma\.shopSettings\.findUnique' services/chat/getActiveChatModel.ts` | 3 (1 call + 2 JSDoc references) |
| `grep -c 'void shop' services/chat/getActiveChatModel.ts` | 0 (placeholder removed) |
| Function signature verbatim unchanged | confirmed |

## Deviations from Plan

None — plan executed exactly as written. The "action" note in PLAN.md (use `prisma.shopSettings.findUnique` directly rather than the repository) is the implemented behavior; the test file mocks `@/lib/db/client` and that mock is what the resolver hits.

## Known Stubs

None — the resolver is fully wired.

## Handoff

- **Plan 07 (PATCH `/api/settings/model`):** Can rely on the resolver picking up writes immediately. The PATCH route uses `shopSettingsRepository.upsert` (write-path); the next call to `getActiveChatModel(shop)` from any chat route sees the new value within the catalog cache TTL (15 min for displayName freshness) and instantly for the model id.
- **Plan 08 (settings page SSR):** Can call `getActiveChatModel(shop)` to render the "Currently active: X" line; pair with `fetchModelCatalog()` for the picker table. Same fallback semantics — never throws, never returns null.

## Self-Check: PASSED

Verified:
- `services/chat/getActiveChatModel.ts` exists and contains the new body (FOUND)
- Commit `be0c221` exists in `git log` (FOUND)
- `/api/chat` and `/api/proxy/chat` route files unchanged (FOUND via empty `git diff`)
- All 5 new resolver tests + 3 historical skipped tests run as expected (FOUND in `bunx vitest run` output)
