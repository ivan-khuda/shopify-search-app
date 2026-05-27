---
phase: 05
slug: shared-chat-ui-extraction
status: approved
shadcn_initialized: true
preset: new-york / neutral / css-variables
created: 2026-05-26
reviewed_at: 2026-05-26
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for Phase 5: Shared Chat-UI Extraction.
> This is a CODE EXTRACTION / REFACTOR phase. No new visual designs are
> introduced. The contract below locks the SHIPPED visual state of
> `components/chat/*` so that executors cannot silently drift styling
> during the file move to `lib/chat-ui/`. The only intentional change
> is the D-12 hex-literal cleanup described in the Color section.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (new-york style) |
| Preset | new-york · base-color: neutral · css-variables: true |
| Component library | Radix UI (via shadcn primitives) |
| Icon library | lucide-react 0.563.0 |
| Font | Geist Sans (`--font-geist-sans`) / Geist Mono (`--font-geist-mono`) |

_Source: `components.json` + `app/globals.css`_

---

## Spacing Scale

Tailwind 4 default scale applies. Values actually used in the lifted components:

| Token | px Value | Tailwind Class | Usage in Phase 5 Components |
|-------|----------|---------------|------------------------------|
| xs | 4px | `p-1` / `gap-1` | Standard icon padding baseline |
| sm | 8px | `p-2` / `gap-2` | Button/icon padding, header gaps |
| md | 16px | `p-4` / `gap-4` | Message bubble padding, history row padding |
| lg | 24px | `p-6` / `gap-6` | Panel container padding (HistoryPanel, SavedProductsPanel) |
| xl | 32px | `gap-8` | Not used in these components |
| 2xl | 48px | — | Not used in these components |
| 3xl | 64px | — | Not used in these components |

### Spacing Exceptions

The following values deviate from the 4-point grid and are deliberate carried-forward values from the shipped source. Do NOT change them during the lift — altering them would silently re-style the component and violate the visual parity contract.

| Value | Tailwind Class | Location | Justification |
|-------|---------------|----------|---------------|
| 6px | `p-1.5` | `components/chat/chat-shell.tsx:41` — Sparkles icon background badge | A 20px lucide icon (`w-5 h-5`) inside a `rounded-lg` badge. `p-1` (4px) is too tight and clips the icon visually; `p-2` (8px) makes the badge square and visually heavy. 6px is the shipped value that produces the correct proportioned badge, and it ships as-is. |

Other spacing exceptions (fixed heights / aspect ratios):
- ChatPane message list: `h-[calc(100%-180px)]` / `h-[calc(100vh-100px)]` — fixed computed heights for the embedded-admin viewport. These heights are surface-specific. The Phase 6 storefront drawer shell will use its own height constraints. The shared `ChatPane` component MUST NOT hardcode these values; they belong in the surface-specific shell wrapper.
- Product image: `aspect-square` — preserves square crop regardless of source image.
- Empty state container: `h-64` (256px) fixed height.
- Chat message avatar: `w-8 h-8 min-w-8 min-h-8` (32px fixed).

---

## Typography

All sizes are from Tailwind's default scale. Weights are the only two in use.

| Role | Size | Tailwind | Weight | Line Height | Component |
|------|------|----------|--------|-------------|-----------|
| Display (app name) | 18px | `text-lg` | 600 (semibold) | leading-none | ChatShell header h1 |
| Heading | 18px | `text-lg` | 700 (bold) | default (1.75rem) | HistoryPanel h2, SavedProductsPanel h2 |
| Body | 14px | `text-sm` | 400 (regular) | default (1.25rem) | History query text, panel descriptions, ProductCard title |
| Label / Caption | 12px | `text-xs` | 400 (regular) | default | Subtitle "Shopify Assistant", timestamps, product description |
| Micro | 10px | `text-[10px]` | 700 (bold) | default | ProductCard "View" CTA link (`tracking-wider uppercase`) |

Rules:
- Exactly 2 font weights in use: **400 (regular)** and **600–700 (semibold/bold)**. No medium (500) used.
- `line-clamp-1` applied to ProductCard title; `line-clamp-2` applied to ProductCard description.
- No custom font sizes beyond Tailwind defaults, except `text-[10px]` on ProductCard "View" link.

---

## Color

### Semantic token map (shadcn / globals.css)

All shadcn design tokens use oklch in `app/globals.css`. Components consume them via Tailwind utility classes:

| Token | Light mode value | Tailwind class | Usage |
|-------|-----------------|----------------|-------|
| `--background` | oklch(1 0 0) = white | `bg-background` | Page/surface background |
| `--foreground` | oklch(0.145 0 0) ≈ near-black | `text-foreground` | Default body text |
| `--muted` | oklch(0.97 0 0) ≈ gray-50 | `bg-muted` | Tool-call status pill background |
| `--muted-foreground` | oklch(0.556 0 0) ≈ gray-500 | `text-muted-foreground` | Tool-call status text, "no results" copy |
| `--border` | oklch(0.922 0 0) ≈ gray-200 | `border-border` | Default border |
| `--destructive` | oklch(0.577 0.245 27.325) ≈ red-600 | `text-destructive` | Error icon (AlertCircle in MessageParts) |

### 60/30/10 surface breakdown (shipped state)

| Role | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Dominant (60%) | white (#ffffff) | `bg-white` | Chat area background, message bubbles (assistant), product cards, header |
| Secondary (30%) | near-white (#f9fafb / gray-50) | `bg-gray-50` | Assistant message bubble (`bg-gray-50`), message list area |
| Accent (10%) | Shopify green (#008060) | `bg-[#008060]` / `text-[#008060]` | See "Accent reserved for" below |

Accent reserved for (explicit list — D-12 defines these as the ONLY elements):
1. Sparkles icon background badge in ChatShell header (`bg-[#008060]`)
2. Active tab trigger text color (`data-[state=active]:text-[#008060]`)
3. ProductCard "View" link text (`text-[#008060]`)

No other element may use the Shopify green accent.

### Polaris hex-literal → Tailwind mapping (D-12 cleanup)

This is the only intentional visual change in Phase 5. Each inline hex is
replaced with its Tailwind equivalent during the lift. The table below is
the authoritative mapping; executors MUST use exactly these classes.

| Hex literal | Where used (pre-lift) | Target Tailwind class | Rationale |
|-------------|----------------------|----------------------|-----------|
| `#008060` | ChatShell header Sparkles bg, tab active text; ProductCard "View" text | `bg-[#008060]` / `text-[#008060]` | No standard Tailwind token matches Shopify brand green exactly. Arbitrary value class preserves exact Polaris brand color and is the established pattern in this codebase. |
| `#e1e3e5` | ChatShell header border-b; ProductCard card border; HistoryPanel row border | `border-[#e1e3e5]` | Polaris "border subdued" (#e1e3e5) is 2 steps lighter than Tailwind `border-gray-200` (#e5e7eb). Pixel-exact parity requires the arbitrary value. |
| `#6d7175` | Tab trigger inactive text; EmptyState description text | `text-[#6d7175]` | Polaris "subdued text" is within 1 hex step of `text-gray-500` (#6b7280) but not identical. Use arbitrary value to preserve exact Polaris tone. |
| `#202223` | Tab trigger hover text; ProductCard price text; EmptyState heading | `text-[#202223]` | Polaris body text. `text-gray-900` (#111827) is too dark. Arbitrary value preserves exact Polaris near-black. |
| `#f6f6f7` | ProductCard image placeholder background | `bg-[#f6f6f7]` | Polaris "surface subdued". `bg-gray-50` (#f9fafb) is visibly lighter. Arbitrary value preserves exact Polaris surface. |
| `#f1f2f4` | HistoryPanel search icon container background | `bg-[#f1f2f4]` | Polaris "surface" variant. No Tailwind match. Arbitrary value. |

Decision: The Polaris colors are brand-specific identifiers (not generic neutrals),
so all six use arbitrary-value classes rather than approximated Tailwind tokens.
This is consistent with how `app/prototype/` already uses these values and
avoids introducing visible color drift during the refactor.

### Additional colors in shipped components (non-Polaris, keep as-is)

| Class | Value | Usage | Action |
|-------|-------|-------|--------|
| `bg-blue-500` | #3b82f6 | User message bubble background | Keep |
| `bg-blue-100` / `text-blue-400` | #dbeafe / #60a5fa | AI avatar circle | Keep |
| `bg-gray-50` | #f9fafb | Assistant message bubble background | Keep |
| `border-gray-200` | #e5e7eb | Assistant message bubble border | Keep |
| `text-gray-400` | #9ca3af | ProductCard no-image placeholder text | Keep |
| `text-gray-500` | #6b7280 | Product description, history timestamp, subtitle | Keep |
| `text-red-600` / `hover:bg-red-50` | #dc2626 / #fef2f2 | HistoryPanel "Clear All" destructive button | Keep |
| `fill-red-500 text-red-500` | #ef4444 | ProductCard heart icon when saved | Keep |
| `text-gray-300` → `text-gray-600` | group-hover transition | HistoryPanel chevron | Keep |
| `text-gray-200` | #e5e7eb | EmptyState icon color | Keep |

---

## Visuals

Primary visual anchor: the Sparkles icon badge in the header (Shopify green `#008060` background, white `w-5 h-5` lucide Sparkles icon, `p-1.5 rounded-lg`). On any chat surface this is the brand-identification element and must remain visible above the message stream and tabs.

Visual hierarchy flows: Sparkles badge + app name (header) → active message stream (center) → tab navigation (bottom). Product cards surface below the message stream; their "View" link in Shopify green ties back to the header accent, reinforcing brand coherence.

---

## Surface-Neutrality Contract

The shared barrel (`lib/chat-ui/`) must render correctly without Shopify chrome.
These are the rules enforced during the lift:

### Forbidden in `lib/chat-ui/` barrel

- No `import ... from '@shopify/*'` anywhere in the barrel or its sub-paths (`lib/chat-ui/adapters/` are exempt since they are sub-paths NOT re-exported from the barrel, per D-04).
- No `window.shopify`, `window.Shopify` (capital S), or `shopify.idToken()` references.
- No Polaris CSS class names (`Polaris-*`).
- No `app/globals.css`-external CSS imports — components rely exclusively on Tailwind utility classes and shadcn CSS variables already loaded by the host page.
- No hardcoded viewport-height values (`h-[calc(100vh-100px)]`). Surface-specific height must live in the surface shell, not in `ChatPane`.
- No `next/image` `fill` with `sizes` attributes that assume an embedded-admin layout. `ProductCard` uses `next/image` — this is acceptable since Next.js Image is available in both admin and storefront (storefront will use the App Proxy Next.js host).

### Permitted cross-tree dependency

- `@/components/ai-elements/*` — stays at current path, imported as cross-tree dependency per D-10. These primitives have zero Shopify imports.
- `@/components/ui/*` — shadcn/Radix primitives. Acceptable.
- `@/lib/utils` (cn helper) — acceptable.
- `@/types/product` — `ChatProduct`, `ChatHistoryItem` types. Acceptable (cross-cutting types, not surface-specific).

### Width / overflow constraint (Phase 6 readiness)

Today's embedded admin renders at desktop widths (~1200px+). The same
`lib/chat-ui/` components must not overflow or clip at 360–420px (storefront
drawer width, Phase 6). Executor must verify:

- `ChatPane` outer div: `w-full max-w-3xl` is safe (max-width only; width collapses at 360px).
- `ProductCard` grid: `grid-cols-1` at base, `sm:grid-cols-2` at 640px, `lg:grid-cols-3` at 1024px. At 360–420px, single-column renders — no overflow.
- `ChatMessage` max-width: `max-w-md` (448px) for user bubble. At 360px viewport this truncates; executor should add `max-w-full` fallback or clamp to parent width during lift. Lock: add `max-w-[min(448px,100%)]` in place of bare `max-w-md`.
- `MessageParts` product grid: `grid-cols-1` at base (360px single column) — safe.
- `EmptyState` `max-w-[200px]` description — safe inside any container.
- HistoryPanel/SavedProductsPanel `p-6` padding at 360px: 24px per side leaves 312px content width — acceptable.

---

## Interaction Contracts

### ChatPane

- Prop-driven (D-02). Accepts: `savedProductIds: Set<string>`, `onToggleSave: (product: ChatProduct) => void`, `onHistoryAdd: (entry: ChatHistoryItem) => void`.
- On submit: calls `onHistoryAdd` immediately with `productCount: 0` (async tool-result arrives later; `productCount` re-derivation via `useEffect` watching messages is a deferred Phase 5/6 item per STATE.md).
- Empty state (no messages): renders inline paragraph — "Hello! I'm your AI Shopping Assistant. Try a search like "warm winter clothes" or "running shoes under $80"." — inside the message list area with no icon (this is the existing inline paragraph, not the `EmptyState` component).
- Streaming indicator: when `status === 'streaming'` and no parts yet, `ChatMessage` renders a `TextShimmer` "Thinking..." pulse.

### ProductCard save affordance

- Heart icon (lucide `Heart`, size 16) in absolute top-right overlay (white/90 background circle, `p-2`).
- Unsaved state: `text-gray-400`, outline heart.
- Saved state: `fill-red-500 text-red-500`, filled heart.
- Toggle: calls `onToggleSave(product)` on click. No confirmation required.
- Aria label: `"Save product"` (unsaved) / `"Remove saved product"` (saved). These exact strings are locked.
- "View" link: `text-[10px] font-bold tracking-wider text-[#008060] uppercase hover:underline`. No href in Phase 5 (external link deferred). Executor must keep the visual affordance; `href` wiring is Phase 6.

### MessageParts tool states

All three search-catalog tool states render inline in the message bubble:

| State | Visual | Copy |
|-------|--------|------|
| `input-streaming` or `input-available` | `Loader2` spinning icon + text | "Searching your catalog…" (exact, including ellipsis) |
| `output-available`, products > 0 | Product grid (`ul[role=list]`) | Aria label: `"{N} matching products"` |
| `output-available`, products === 0 | `SearchX` icon + heading + body | Heading: "No matching products" / Body: "Try a broader description or remove the price filter." |
| `output-error` | `AlertCircle` icon + heading + body | Heading: "Couldn't fetch results" / Body: "Please try that search again." |

All tool-state containers: `role="status" aria-live="polite"`.

### Tab navigation (ChatShell — surface-specific)

ChatShell stays surface-specific (embedded admin), but its interaction contract is locked to prevent drift:
- Three tabs: Chat, History, Saved. Uses lucide icons: `MessageSquare`, `HistoryIcon`, `Bookmark`.
- "New Chat" button in tab bar: `PlusIcon` + "New Chat" label. Action: sets active tab to 'chat'. No conversation data is cleared (tab switch only).
- Tab active color: `data-[state=active]:text-[#008060]`.
- Tab inactive color: `text-[#6d7175] hover:text-[#202223]`.
- History cap: 10 entries (LIFO, `.slice(0, 10)`). Oldest entries are silently dropped; no user notification.

### HistoryPanel

- Empty state: `EmptyState` component with `History` icon (size 48), title "No search history", description "Your previous AI searches will appear here."
- Populated: reverse-chrono list of `{ query, timestamp, productCount }`. Row shows quoted query + `"{timestamp} - {productCount} results"` subtitle.
- "Clear All" button: `Trash2` icon (size 14), `text-red-600 hover:bg-red-50`. No confirmation dialog (destructive but low-stakes; data is local-only).

### SavedProductsPanel

- Empty state: `EmptyState` component with `Heart` icon (size 48), title "No saved products", description "Heart items in the chat to save them for later."
- Populated: responsive product grid (1/2/3 cols at sm/lg breakpoints). Each `ProductCard` renders with `isSaved={true}`.

---

## Copywriting Contract

| Element | Copy | Rationale / Source |
|---------|------|-------------------|
| Chat empty state (inline) | "Hello! I'm your AI Shopping Assistant. Try a search like \"warm winter clothes\" or \"running shoes under $80\"." | chat.tsx shipped |
| Prompt placeholder | "Search for something (e.g. 'comfortable shoes for running')" | chat.tsx shipped |
| Streaming indicator | "Thinking..." | chat.tsx / message-parts.tsx shipped |
| Tool searching | "Searching your catalog…" | message-parts.tsx shipped (ellipsis = U+2026) |
| Tool no-results heading | "No matching products" | message-parts.tsx shipped |
| Tool no-results body | "Try a broader description or remove the price filter." | message-parts.tsx shipped |
| Tool error heading | "Couldn't fetch results" | message-parts.tsx shipped (smart apostrophe U+2019) |
| Tool error body | "Please try that search again." | message-parts.tsx shipped |
| History empty title | "No search history" | history-panel.tsx shipped |
| History empty description | "Your previous AI searches will appear here." | history-panel.tsx shipped |
| Saved empty title | "No saved products" | saved-products-panel.tsx shipped |
| Saved empty description | "Heart items in the chat to save them for later." | saved-products-panel.tsx shipped |
| Save affordance (unsaved) | "Save product" (aria-label) | product-card.tsx shipped |
| Save affordance (saved) | "Remove saved product" (aria-label) | product-card.tsx shipped |
| "Clear All" history | "Clear All" | history-panel.tsx shipped |
| "New Chat" button | "New Chat" | chat-shell.tsx shipped |
| App name in header | "SmartDiscovery AI" | chat-shell.tsx shipped |
| App subtitle in header | "Shopify Assistant" | chat-shell.tsx shipped |
| ProductCard "View" CTA | "View" + `<ExternalLink size={12} />` icon | Verb-only label; the adjacent `ExternalLink` icon (lucide, 12px) supplies the noun affordance — "View [external link]" reads as a complete verb-noun pair. See `components/chat/product-card.tsx:54`. |

No copy changes are permitted in Phase 5. All strings above are locked as-is.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (new-york) | Tabs, Button, Command, DropdownMenu, HoverCard, InputGroup, Select, Spinner, Tooltip, Dialog, TextShimmer, MotionHighlight | not required — official registry |
| Third-party | none | not applicable |

No third-party registry blocks are declared for Phase 5. Registry vetting gate: not applicable.

---

## Phase 5 Specific: File Move Parity Rules

Executors MUST treat the following as hard constraints during the lift:

1. **Zero visual delta on embedded admin after lift.** The `/chat` page must render pixel-identically to pre-lift state on the embedded admin surface.
2. **Component APIs unchanged.** Props signatures for `ChatPane`, `ChatMessage`, `ProductCard`, `HistoryPanel`, `SavedProductsPanel`, `EmptyState`, `MessageParts` are locked to what is documented in this spec. No new required props may be added without a separate spec amendment.
3. **D-12 hex cleanup is the ONLY permitted CSS change.** Every other Tailwind class in the lifted files must be byte-identical to the source files.
4. **Surface-specific heights removed from ChatPane.** `h-[calc(100vh-100px)]` and `h-[calc(100%-180px)]` are extracted to the surface shell (not deleted — moved to `app/(embedded)/chat/` shell component).
5. **UserMessage width guard.** Replace `max-w-md` on the user message container with `max-w-[min(448px,100%)]` to prevent overflow at storefront drawer widths. This is the single layout-safety fix permitted under the "surface-neutrality" contract.
6. **`'use client'` directives preserved.** All lifted components that currently carry `'use client'` keep it after the move.
7. **Test imports updated.** All test files in `components/chat/__tests__/` that import `@/components/chat/*` are relocated to `lib/chat-ui/__tests__/` and updated to import from `@/lib/chat-ui/*`.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
