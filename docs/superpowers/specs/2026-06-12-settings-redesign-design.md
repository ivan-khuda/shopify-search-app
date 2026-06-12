# Settings Page Redesign (Design-Handoff) — Design

**Date:** 2026-06-12
**Status:** Approved (all five sections; Appearance moves into Drawer styling;
cap editable downward only)
**Source:** Claude Design handoff bundle, `project/src/screens/settings.jsx`
(extracted to /tmp/design-handoff2/smart-discovery-ai-high-fidelity/)

## Goal

Rebuild `/settings` to the prototype's side-nav layout with five functional
sections — AI model, Drawer styling, Usage & limits, Sync & webhooks,
General — wired to real data, replacing the Polaris `s-*` page. Add the
backend the new controls need (drawer presentation settings, per-shop cap
override, notification email, drawer kill-switch).

## Schema (one migration)

`ShopSettings` gains six columns:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `drawerAccent` | String | `"#5B4FE9"` | Drawer/chat accent color (5-swatch palette) |
| `greetingMessage` | VarChar(200)? | null | Drawer empty-state greeting; null = built-in copy |
| `suggestedPrompts` | Json | `"[]"` | Array of `{icon, text}` (max 6); empty = built-in 4 |
| `monthlyCapRequests` | Int? | null | Per-shop cap override; null = built-in constant |
| `notificationEmail` | String? | null | Sync summary/incident recipient override |
| `drawerEnabled` | Boolean | true | Storefront drawer kill-switch |
| `editorPreviewVisible` | Boolean | true | FAB visibility in Theme Editor preview |

`RequestCounter` gains `adminRequestCount Int @default(0)` — `tryConsume`
takes a `surface: 'storefront' | 'admin'` arg; admin requests increment both
counters. Storefront count = `requestCount − adminRequestCount`.

## Read/write paths

- `getShopAppearance` generalises to **`getShopSettings(shop)`** returning the
  full settings bundle with defaults, never throwing. The appearance subset
  (`emptyStateVariant`, `cardDensity`) remains available for existing callers.
- **`PATCH /api/settings/shop`** (new, `withShopifySession`, zod `.strict()`
  partial of: drawerAccent (hex from the fixed palette), greetingMessage
  (≤200 chars), suggestedPrompts (≤6 items, text ≤120, icon ≤8), monthlyCapRequests
  (int 1..BUILT-IN-DEFAULT — lowering only), notificationEmail (email format),
  drawerEnabled, editorPreviewVisible; at least one field). Serves the Drawer
  styling, Usage & limits, and General saves. Existing `/api/settings/model`
  and `/api/settings/appearance` routes unchanged.
- **`GET /api/settings/usage`** (new, session-token): current period
  `{ used, adminUsed, storefrontUsed, cap, periodLabel, resetsAt }`.
- Webhooks/Sync data SSR-loaded in the settings Server Component: last-fired
  per topic = `MAX(receivedAt) GROUP BY topic` from `WebhookEvent`; last
  successful sync (finishedAt, processedCount, duration) from `SyncRun`.

## Enforcement

- `/api/proxy/_meta/appearance` response grows to the full storefront-relevant
  bundle: `emptyStateVariant`, `cardDensity`, `drawerAccent`,
  `greetingMessage`, `suggestedPrompts`, `drawerEnabled`,
  `editorPreviewVisible`. The drawer applies accent as `--sd-accent`,
  greeting/prompts feed `EmptyChat` (new optional props with built-in
  defaults), `drawerEnabled: false` hides the FAB + drawer after the meta
  fetch resolves; in Theme Editor designMode, `editorPreviewVisible: false`
  does the same.
- Cap: the chat routes resolve the effective cap via
  `getShopSettings(shop).monthlyCapRequests ?? BUILT_IN_CAP` before
  `tryConsume`.
- Notification email: the sync Inngest function resolves recipient via
  settings override, else its current source.

## UI

Replace `app/(embedded)/settings/` page + form with the prototype layout:
1080px container, `grid-cols-[200px_1fr]`, side nav ("Settings" heading +
5 items with icons, active = accent tint). Tailwind arbitrary values,
`--sd-accent` var, same fidelity discipline as the chat redesign. Sections:

1. **AI model** — radio cards per catalog model: 18px custom radio, 36px
   provider tile (Google amber / OpenAI green / Anthropic orange / Meta blue
   / fallback grey), name + "by {provider}" + "Recommended" badge on the
   built-in default model, `bestFor` line, right column "PER 1M TOKENS /
   $in · $out / {context} context". Footer info note (Gateway rate card,
   pinned versions, embeddings note). "Save changes" + "Currently active:
   {name}". Uses existing PATCH `/api/settings/model`.
2. **Drawer styling** — accent swatches (5 fixed: #5B4FE9 #008060 #D4823A
   #1A1A1A #D9457A; selected = dark ring); greeting input; prompts editor
   (rows with icon + text + edit/delete, "+ Add prompt", max 6); **existing
   empty-state + density radio groups move here** (still writing to
   `/api/settings/appearance`). Section-level Save → `/api/settings/shop`.
3. **Usage & limits** — "This month" card: big used count, "of {cap} chat
   requests", percent (accent → `#bf4800` above 80%), progress bar,
   Storefront/Admin stat pair. "Hard cap" card: number input (lowering only,
   helper text explains) + Save.
4. **Sync & webhooks** — topic rows (`products/create|update|delete`,
   `app/uninstalled`) with green dot + real "last fired {relative}" (— if
   never); "Run full resync" button → existing `POST /api/shopify/sync`
   (Bearer) with running state; "Last successful sync: {when} ·
   {count} products · {duration}".
5. **General** — notification email input; "Enable on storefront" toggle;
   "Show in Theme Editor preview" toggle. Save → `/api/settings/shop`.

Toggle, SettingsCard, Stat, side-nav icons ported from the prototype.

## Deviations from prototype

- "Avg latency" stat omitted — nothing measures latency; no fake numbers.
- Custom "+" accent swatch omitted — fixed 5-color palette in V1.
- Cap input clamps to the built-in default as maximum (raising deferred to
  billing).
- Theme-editor FAB visibility is eventually-consistent: the loader paints the
  FAB before any fetch; the bundle hides it once meta arrives.
- Prototype's "last fired 2m ago" placeholder becomes real data or "—".

## Out of scope

- Billing / raising caps.
- Latency measurement.
- Live theme-editor sync of accent (theme embed block setting remains the
  initial FAB paint source; DB accent drives the drawer UI).
- Conversation persistence (separate approved design, parked).

## Testing

Route tests for PATCH `/api/settings/shop` (validation matrix, multi-tenancy)
and GET `/api/settings/usage`; service tests for `getShopSettings` defaults;
cap-resolution test in the chat route; proxy meta response shape; component
tests per section (radio cards reflect catalog + save flow, prompts editor
add/edit/delete/max-6, usage bar math + 80% color, resync button state,
toggles persist); existing settings tests repointed to the new structure.
