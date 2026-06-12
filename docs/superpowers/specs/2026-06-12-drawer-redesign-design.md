# Storefront Drawer Redesign (Design-Handoff) — Design

**Date:** 2026-06-12
**Status:** Approved (FAB style + drawer position as merchant settings)
**Source:** Claude Design handoff bundle, `project/src/screens/storefront.jsx`
(extracted to /tmp/design-handoff3/smart-discovery-ai-high-fidelity/)

## Goal

Rebuild the storefront chat drawer to the prototype's design: three FAB
variants, three drawer positions (mobile always bottom-sheet), and a
drawer-specific compact UI (header, underline tabs, horizontal product
rows, single-line composer) that no longer reuses the admin-styled
`ChatPane` visuals. FAB style and drawer position become merchant
settings in Settings → Drawer styling.

## Architecture decision

The admin playground and the drawer now have deliberately different
visual languages. Sharing one parameterized `ChatPane` would fork styles
at every node. Instead:

- **Extract a headless `useChatController` hook** into `lib/chat-ui`
  (transport wiring, `useChat`, `submitText` + history-add, auto-submit
  with consumption callback, grounded-count derivation, auto-scroll ref).
  Admin `ChatPane` keeps its visuals and consumes the hook; behavior
  identical, its tests stay green.
- **Drawer visuals live in `extensions-src/chat-drawer/components/`**:
  `DrawerChat`, `DrawerEmpty`, `DrawerMessage`, `DrawerProductRow`,
  `DrawerThinking`, `DrawerHistory`, `DrawerSaved`, `DrawerShell`
  (position variants), `Fab` (style variants). They consume the same
  hook, adapters, and db-backed stores. The drawer stops importing
  `ChatPane`/`HistoryPanel`/`SavedProductsPanel` — admin-only code drops
  out of the storefront bundle.

## Settings

Two new `ShopSettings` columns + contract fields + Drawer-styling pickers
+ meta exposure:

| Column | Values | Default |
|---|---|---|
| `fabStyle` | `circle` \| `pill` \| `labeled` | `circle` |
| `drawerPosition` | `side` \| `bottom-sheet` \| `center-modal` | `side` |

`PATCH /api/settings/shop` accepts both (zod enums). Settings → Drawer
styling gains two option groups rendered as labeled radio rows.
`/api/proxy/_meta/appearance` returns both.

## Visual contract (from prototype)

- **FAB** (bottom-right, 24px offset / 16px mobile):
  - `circle`: 56px accent circle, compass-spark search icon.
  - `pill`: dark `#1a1a1a` pill, 22px accent circle with spark + label
    "Ask {shop name}".
  - `labeled`: accent rounded-16 block, white/16 icon tile + "POWERED BY
    AI / Find anything" two-line label.
- **Drawer positions** (overlay scrim closes on click; panel stops
  propagation): `side` — right panel 420px full-height, slide-left;
  `bottom-sheet` — bottom panel 78% height (88% + grab-handle on
  mobile), rounded top 18, slide-up; `center-modal` — 540×680 max modal,
  blur scrim, pop animation. Mobile (≤640px) always bottom-sheet.
- **Header**: SDLogo 28, "Ask {shop name}" 13.5/650, green-dot subline
  "AI-powered · usually replies instantly", 30px close button.
- **Tabs**: full-width thirds, 12.5px, active = dark text + 2px accent
  underline (15% inset), count badges (accent-tinted).
- **Chat**: `#fafafa` scroll area; user bubbles accent 13.5px radius
  14/14/4/14 max-width 85%; assistant = SDLogo 26 + "Searching…" spinner
  pill → product rows → 13px text bubble (radius 10/10/10/2) with
  blinking cursor; thinking dots.
- **Product row** (`DrawerProductRow`): grid `64px 1fr auto`, 64px image,
  type kicker 9.5px uppercase, truncated 13px title, 12px price, right
  column = 28px heart button (red when saved) + 28px accent arrow button
  linking to the product page.
- **Composer**: single-line input in 1.5px `#d4d4d4` rounded-12 card,
  placeholder "Ask anything…", 30px accent send; footer line "Powered by
  SmartDiscovery AI · Conversations stay on your store".
- **Empty state**: 60px accent gradient tile with search-spark, headline
  "Hi there 👋", paragraph = merchant `greetingMessage` or built-in
  "Tell me what you're looking for. I'll find it in the catalog.";
  "TRY ASKING" kicker + single-column prompt list (merchant
  `suggestedPrompts` or built-ins) with trailing →.
- **History**: "PAST CONVERSATIONS" kicker + red "Clear"; rows = 28px
  search tile, truncated query, "timestamp · N results"; empty copy
  "Your conversations show up here." Click resumes in chat tab.
- **Saved**: "YOUR SAVED ITEMS" kicker; product rows; empty copy "Tap
  the heart on a product to save it here."

## Product links

`ChatProduct` gains optional `handle`; SearchService hydration selects
the product handle; the drawer arrow button and the admin card's VIEW
affordance link to `/products/{handle}` (drawer: same-origin storefront
path, new tab not needed; admin: `https://{shop}/products/{handle}` in a
new tab). Products without a handle render the button disabled.

## Loader / theme embed

- `app_embed.liquid` adds `data-shop-name="{{ shop.name | escape }}"`.
- The loader keeps painting the circle FAB synchronously; when its
  existing meta fetch resolves it now also restyles the FAB to the
  merchant's `fabStyle` (vanilla templates for pill/labeled using
  data-shop-name and the meta accent). Brief style flash accepted —
  same eventual-consistency pattern as the kill-switch.
- The bundle `Fab` component mirrors the same three variants (it owns
  the FAB after first open).

## Deviations / decisions

- `cardDensity` no longer affects the drawer (prototype's drawer ignores
  it); it remains an admin-playground setting. Settings copy updated
  accordingly ("admin playground card density").
- Drawer keeps db-backed history/saved stores and the existing resume
  (`autoSubmitQuery`) wiring; only presentation changes.
- The drawer-position scrim behavior (click-outside closes) replaces the
  current always-side panel; Escape-to-close and focus return stay.
- The prototype's Dawn-theme mock, viewport switcher, and tweaks panel
  are design chrome — not implemented.

## Out of scope

- Conversation transcripts in DB (separate parked design).
- FAB style/position preview inside the settings page.
- Admin chat visual changes beyond the VIEW link gaining a real href.

## Testing

Contract/schema/PATCH/meta extensions mirror the settings-redesign test
patterns. `useChatController` unit tests + admin ChatPane regression
suite must stay green. Drawer component tests per piece (FAB variants,
position variants incl. mobile matchMedia, product row link/disabled,
empty-state merchant overrides, history resume, composer send). Loader
string-level tests for the restyle logic. Bundle builds; entry chunk
budget unchanged or smaller.
