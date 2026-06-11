# Chat Redesign (Design-Handoff) — Design

**Date:** 2026-06-11
**Status:** Approved (empty-state-in-settings + density "Both" confirmed by user)
**Source:** Claude Design handoff bundle, `project/src/screens/chat.jsx`
(extracted to /tmp/design-handoff/smart-discovery-ai-high-fidelity/)

## Goal

Re-skin the chat experience (Chat / History / Saved) to match the
high-fidelity prototype, on both surfaces that share `lib/chat-ui` —
the embedded admin playground and the storefront drawer. Add two
merchant-facing appearance settings:

1. **Empty-state variant** — `cards` (default) | `minimal` | `hero`.
   Edited on the Settings page. Affects admin chat AND storefront drawer.
2. **Product card density** — `compact` | `standard` (default) | `hero`.
   Edited BOTH on the Settings page and via a segmented control in the
   admin chat header. One persisted value drives chat result grids, the
   Saved tab, and the storefront drawer.

## Visual contract (from prototype)

- Accent: indigo `#5B4FE9` (matches landing). Delivered via `--sd-accent`.
- Header: "Playground" title, accent pill "● Preview mode — using your real
  catalog", "· Model: <name>", pill tabs Chat/History/Saved with count
  badges, outlined "+ New chat" button.
- Chat area: `#fafbfb` background, 780px column. User bubbles: accent bg,
  white text, radius 14/14/4/14. Assistant: 28px compass-spark logo avatar;
  states — "Searching your catalog…" spinner pill → product grid →
  streaming text bubble (radius 14/14/14/4) with blinking accent cursor →
  action row (Helpful/👎/Copy + "● N grounded results"). Thinking bubble =
  three bouncing accent dots. Auto-scroll to bottom on message change.
- Composer: white card, 1.5px `#c9ccd0` border, radius 14; textarea;
  "Attach" and "Hybrid search" chip buttons; "Press ↵ to send" kbd hint;
  30×30 accent send button (disabled grey).
- Product cards: `standard` = image square, type kicker, title, 2-line
  description, price + "VIEW →"; `compact` = smaller paddings/radius 8, no
  kicker/description; `hero` = horizontal 200px-image layout with vendor ·
  type kicker and accent "View product →" button. Save = white circular
  heart button overlaid top-right.
- Grids: chat results 3-col (1-col for hero density); Saved 4-col standard /
  5-col compact / hero renders as standard cards.
- Empty states: `cards` (greeting + indexed-count + 2-col "TRY IT" prompt
  cards + RRF tip box), `minimal` (centered logo + single-col prompt list),
  `hero` (accent gradient banner + "Try one" 2-col prompts). Suggested
  prompts: ☕ / 🌿 / 🍽️ / 🎁 set from the prototype.
- History: rows (search icon, query, "timestamp · N results", chevron);
  clicking a row resumes that query in the chat tab; "Clear all" button;
  dashed-border empty state.
- Saved: count header, density-driven grid, dashed-border empty state.

## Architecture

- **Persistence:** two new `ShopSettings` columns with DB defaults;
  `activeChatModelId` becomes nullable so an appearance-only save can
  create the row. `getActiveChatModel` treats a null id as "no override".
- **Read path:** new `getShopAppearance(shop)` service (defaults when no
  row / invalid values). Admin: `/chat` and `/settings` Server Components
  load it. Storefront: new HMAC-verified `GET /api/proxy/_meta/appearance`
  returns it; DrawerBody fetches once on mount with defaults while loading.
- **Write path:** new `PATCH /api/settings/appearance` (Bearer session
  token, zod enums, shop from session only) used by both the Settings page
  Appearance section and the chat-header density control (optimistic).
- **Components:** redesign lives in `lib/chat-ui` so both surfaces update:
  `sd-logo.tsx` (new), `appearance.ts` (types/defaults/accent — new),
  `empty-chat.tsx` (new, replaces PromptChips usage), `product-card.tsx`
  (density variants), `chat-message.tsx` + `message-parts.tsx` (restyle +
  density), `chat-pane.tsx` (layout, composer restyle, auto-scroll,
  `autoSubmitQuery` for history-resume), `history-panel.tsx` (+`onResume`),
  `saved-products-panel.tsx` (+density grid). Admin shell header redesign in
  `chat-shell.tsx`; `/chat/page.tsx` passes model/appearance/product-count
  and drops its old banner (it moves into the header pill).

## Out of scope

- Storefront drawer FAB style / drawer position tweaks (separate settings).
- Message feedback persistence (Helpful/👎/Copy act locally: copy uses
  clipboard; thumbs are visual no-ops in V1).
- Conversation resume from history beyond re-running the query.
