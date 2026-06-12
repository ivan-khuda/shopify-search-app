# Storefront Drawer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the storefront drawer to the design handoff — three FAB variants and three drawer positions as merchant settings, drawer-specific compact UI consuming a new headless `useChatController` hook, product rows that link to product pages.

**Architecture:** Chat logic (transport/useChat/submit/auto-submit/grounded-count/auto-scroll) extracts from admin `ChatPane` into `lib/chat-ui/use-chat-controller.ts`; admin keeps its visuals, drawer gets its own components in `extensions-src/chat-drawer/components/`. Two new `ShopSettings` columns flow through the existing contract → PATCH → settings UI → proxy meta → loader/bundle chain built in the settings redesign.

**Tech Stack:** Next.js 16, Tailwind 4 (admin) / inline-style-free Tailwind in drawer components (the storefront bundle already carries the chat-ui Tailwind classes — KEEP using Tailwind arbitrary values, they compile via the bundle build), Prisma 7, zod, Vitest + RTL. Spec: `docs/superpowers/specs/2026-06-12-drawer-redesign-design.md`. Prototype: `/tmp/design-handoff3/smart-discovery-ai-high-fidelity/project/src/screens/storefront.jsx` (FAB 275–345, ChatDrawer 349–416, DrawerInner 418–506, DrawerChat 508–569, DrawerEmpty 571–616, DrawerMessage 618–676, DrawerProduct 678–727, DrawerThinking 729–746, DrawerHistory 748–800, DrawerSaved 802–826).

**Conventions:** bun; `bunx vitest run <path>`; NEVER `bun test`. Accent: `var(--sd-accent,#5B4FE9)` (the drawer wrapper sets the var from merchant `drawerAccent`). Zero `console.*` in new code. Commits per task, Conventional Commits, bodies end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Verified seams:**
- `services/search/SearchService.ts` — hydration SQL already selects `p.handle` (lines 168/219, row type line 78); `toChatProduct` (line ~246) just doesn't map it.
- `lib/chat-ui/components/chat-pane.tsx` — extraction targets: `useChat` wiring (line 177), `submitText` (179), `handleSubmit` (~201), auto-submit effect (210–218), `scrollRef` effect (221+), `groundedCountFor` (99).
- Loader meta fetch already exists (`extensions/chat-drawer/assets/loader.js`, added in settings redesign — kill-switch block). Entry removes the loader FAB at mount (`entry.tsx:69`).
- Settings chain to extend: `lib/settings/contract.ts`, `app/api/settings/shop/route.ts`, `app/(embedded)/settings/sections/drawer-section.tsx`, `app/api/proxy/_meta/appearance/route.ts` (already returns the parsed bundle — new fields flow automatically once in contract; verify response test).

---

### Task 1: Contract + schema — fabStyle, drawerPosition

**Files:**
- Modify: `prisma/schema.prisma` (ShopSettings), `lib/settings/contract.ts`
- Test: `lib/settings/__tests__/contract.test.ts` (extend)

- [ ] **Step 1: Failing tests** — extend the contract test:

```ts
it('exposes fab and position unions with defaults', () => {
  expect(FAB_STYLES).toEqual(['circle', 'pill', 'labeled']);
  expect(DRAWER_POSITIONS).toEqual(['side', 'bottom-sheet', 'center-modal']);
  expect(DEFAULT_SHOP_SETTINGS).toMatchObject({ fabStyle: 'circle', drawerPosition: 'side' });
});

it('sanitises unknown fab/position values', () => {
  expect(parseShopSettings({ fabStyle: 'pill', drawerPosition: 'center-modal' }))
    .toMatchObject({ fabStyle: 'pill', drawerPosition: 'center-modal' });
  expect(parseShopSettings({ fabStyle: 'blob', drawerPosition: 'left' }))
    .toMatchObject({ fabStyle: 'circle', drawerPosition: 'side' });
});
```

- [ ] **Step 2: FAIL. Step 3: Implement** — contract.ts:

```ts
export const FAB_STYLES = ['circle', 'pill', 'labeled'] as const;
export type FabStyle = (typeof FAB_STYLES)[number];
export const DRAWER_POSITIONS = ['side', 'bottom-sheet', 'center-modal'] as const;
export type DrawerPosition = (typeof DRAWER_POSITIONS)[number];
```

Add `fabStyle: FabStyle; drawerPosition: DrawerPosition;` to `ShopSettingsBundle` + defaults (`'circle'`, `'side'`) + parse clauses (includes-check like drawerAccent). Schema: `fabStyle String @default("circle")`, `drawerPosition String @default("side")`. Migration: hand-written `ADD COLUMN IF NOT EXISTS` per the `20260612000001_shop_settings_page` precedent (one-off apply script via `prisma.$executeRawUnsafe`, insert `_prisma_migrations` row, DELETE the script before committing — do NOT commit it). `bunx prisma generate`.

- [ ] **Step 4: PASS + suite green. Commit** `feat(db): fabStyle and drawerPosition settings`

---

### Task 2: PATCH + settings UI pickers + meta passthrough

**Files:**
- Modify: `app/api/settings/shop/route.ts` (+2 zod enums), `app/(embedded)/settings/sections/drawer-section.tsx`, `app/api/proxy/_meta/appearance/route.ts` (response object +2 fields)
- Tests: extend `app/api/settings/shop/__tests__/route.test.ts`, `app/(embedded)/settings/__tests__/drawer-section.test.tsx`, `app/api/proxy/_meta/appearance/__tests__/route.test.ts`

- [ ] **Step 1: Failing tests** — route accepts `{ fabStyle: 'pill' }` / `{ drawerPosition: 'bottom-sheet' }`, rejects unknown values; drawer-section renders "FAB style" + "Drawer position" option groups (labels Circle/Pill/Labeled, Side/Bottom sheet/Center modal) prefilled from settings, selections join the changed-fields-only `/api/settings/shop` save; meta response includes both fields.
- [ ] **Step 2: FAIL. Step 3: Implement** — zod: `fabStyle: z.enum(FAB_STYLES).optional()`, `drawerPosition: z.enum(DRAWER_POSITIONS).optional()`. Drawer-section: two `SettingsCard`s ("FAB style" — "How the launcher button appears on your storefront."; "Drawer position" — "Where the chat opens for desktop shoppers. Mobile always uses the bottom sheet.") with `aria-pressed` segmented buttons styled like the accent swatch row's interaction pattern. Meta route: add the two fields to the explicit response object.
- [ ] **Step 4: PASS. Commit** `feat(settings): FAB style and drawer position knobs`

---

### Task 3: ChatProduct.handle end-to-end

**Files:**
- Modify: `types/product.ts` (+`handle?: string`), `services/search/SearchService.ts` (`toChatProduct` maps `handle: row.handle`), `lib/chat-ui/components/product-card.tsx` (VIEW affordances become real links)
- Tests: extend SearchService test (find it: `grep -rl toChatProduct services/search`), `lib/chat-ui/__tests__/product-card.test.tsx`

- [ ] **Step 1: Failing tests** — SearchService row→ChatProduct includes handle; ProductCard "VIEW →" (standard) and "View product →" (hero) render as links when `product.handle` is set, old non-link/disabled state otherwise. Link URL = `{productUrlBase}/products/{handle}`. ProductCard gains `productUrlBase?: string` (default `''` — same-origin, correct for the storefront drawer) and `linkTarget?: '_blank' | '_self'` (default `'_self'`); the embedded admin passes `productUrlBase={`https://${shop}`}` and `linkTarget="_blank"` with `rel="noopener noreferrer"` (iframe escape). Admin threading: chat-shell → ChatPane → MessageParts → ProductCard, and chat-shell → SavedProductsPanel → ProductCard (extend prop signatures; defaults keep drawer call sites unchanged).
- [ ] **Step 2: FAIL. Step 3: Implement per Step 1's contract.**
- [ ] **Step 4: PASS + suite green. Commit** `feat(chat-ui): product cards link to product pages`

---

### Task 4: useChatController extraction

**Files:**
- Create: `lib/chat-ui/use-chat-controller.ts`
- Modify: `lib/chat-ui/components/chat-pane.tsx` (consume hook; visuals unchanged), `lib/chat-ui/index.ts` (export hook + its types)
- Test: `lib/chat-ui/__tests__/use-chat-controller.test.tsx` (new, renderHook), existing `chat-pane.integration-test.tsx` MUST pass unchanged (the regression gate)

- [ ] **Step 1: Failing hook test** (renderHook from @testing-library/react; mock `@ai-sdk/react` like the integration test):

```ts
const { result } = renderHook(() => useChatController({
  adapter: mockAdapter, onHistoryAdd,
  autoSubmitQuery: null, onAutoSubmitConsumed,
}));
// exposes: messages, status, submitText, handleSubmit, scrollRef, groundedCountFor
act(() => result.current.submitText('red mug'));
expect(sendMessage).toHaveBeenCalledWith({ text: 'red mug' });
expect(onHistoryAdd).toHaveBeenCalledTimes(1);
// auto-submit once per id; consumption callback — port the assertions from
// the existing ChatPane integration test cases verbatim at hook level.
```

- [ ] **Step 2: FAIL. Step 3: Implement** — move lines ~99–110 (`groundedCountFor`), 177–218 (useChat/transport/submitText/handleSubmit/auto-submit), scrollRef + effect, OUT of chat-pane.tsx into the hook:

```ts
export interface ChatControllerOptions {
  adapter: ChatIdentityAdapter;
  onHistoryAdd: (entry: ChatHistoryItem) => void;
  autoSubmitQuery?: { id: number; query: string } | null;
  onAutoSubmitConsumed?: () => void;
}
export function useChatController(opts: ChatControllerOptions) {
  // …moved code…
  return { messages, status, submitText, handleSubmit, scrollRef, groundedCountFor };
}
```

`handleSubmit` keeps its `PromptInputMessage` signature (admin-only concern; drawer uses `submitText` directly). ChatPane becomes visuals-only over the hook.

- [ ] **Step 4: Hook tests PASS; chat-pane integration test passes UNCHANGED; full suite green. Commit** `refactor(chat-ui): extract headless useChatController`

---

### Task 5: Drawer building blocks — Fab + DrawerShell

**Files:**
- Create: `extensions-src/chat-drawer/components/Fab.tsx`, `extensions-src/chat-drawer/components/DrawerShell.tsx`
- Test: `extensions-src/chat-drawer/__tests__/fab.test.tsx`, `drawer-shell.test.tsx`

- [ ] **Step 1: Failing tests** — Fab: `style="circle"` renders 56px round button with search-spark svg; `pill` renders dark pill with "Ask {shopName}"; `labeled` renders "Powered by AI"/"Find anything" two-liner; all carry the open/close aria-label prop. DrawerShell: `position="side"` renders right-aligned 420px panel inside a scrim that calls onClose on scrim click but NOT on panel click; `bottom-sheet` renders bottom panel (88% + grab-handle when `isMobile`); `center-modal` renders centered modal; `isMobile` forces bottom-sheet regardless of position prop.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype FAB (275–345) + ChatDrawer (349–416). Tailwind arbitrary values; animations via small inline `<style>` keyframes or existing loader.css classes — check `extensions/chat-drawer/assets/loader.css` for `sd-slide-*`/`sd-pop` keyframes; if absent define a tiny CSS string injected once by DrawerShell (matchMedia for mobile: `window.matchMedia('(max-width: 640px)')` with change listener → `useIsMobile` mini-hook inside DrawerShell file).
- [ ] **Step 4: PASS. Commit** `feat(drawer): FAB variants and positionable shell`

---

### Task 6: Drawer chat pieces — ProductRow, Message, Thinking, Empty

**Files:**
- Create: `extensions-src/chat-drawer/components/DrawerProductRow.tsx`, `DrawerMessage.tsx`, `DrawerThinking.tsx`, `DrawerEmpty.tsx`
- Test: one test file per component in `extensions-src/chat-drawer/__tests__/`

- [ ] **Step 1: Failing tests** — ProductRow: 64px image grid, kicker/title/price, heart toggles (aria-label save/unsave, red fill when saved), arrow link `/products/{handle}` (disabled button when no handle). Message: user accent bubble right; assistant searching-state spinner pill (derive from the same `tool-searchCatalog` part states as message-parts.tsx — read it first); product rows from tool output; text with blink cursor while status streaming. Empty: gradient tile + "Hi there 👋" + merchant greeting/builtin + TRY ASKING list from merchant prompts/builtins firing onPick. Thinking: three dots.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype 571–746. DrawerMessage consumes `UIMessage` parts directly (mirror the part-state discriminator narrowing documented in `lib/chat-ui/components/message-parts.tsx` — copy that comment's approach, don't import the admin component). Reuse `BUILTIN_GREETING` from empty-chat? NO — drawer built-in copy differs ("Tell me what you're looking for. I'll find it in the catalog."); define `DRAWER_BUILTIN_GREETING` locally. Prompts builtins: import `SUGGESTED_PROMPTS` from `@/lib/chat-ui` (shared).
- [ ] **Step 4: PASS. Commit** `feat(drawer): chat presentation components`

---

### Task 7: DrawerChat + DrawerHistory + DrawerSaved + composer

**Files:**
- Create: `extensions-src/chat-drawer/components/DrawerChat.tsx`, `DrawerHistory.tsx`, `DrawerSaved.tsx`
- Test: per-component tests

- [ ] **Step 1: Failing tests** — DrawerChat: consumes `useChatController`; empty → DrawerEmpty; messages map → DrawerMessage; thinking bubble on submitted+last-user; composer input Enter-sends, send button disabled empty/streaming, footer copy "Powered by SmartDiscovery AI · Conversations stay on your store"; auto-scroll. History: kicker + Clear (only when items) + rows + empty copy + onResume(query). Saved: kicker + rows (isSaved=true) + empty copy.
- [ ] **Step 2: FAIL. Step 3: Implement** per prototype 508–569, 748–826. DrawerChat props: `{ adapter, savedProductIds, onToggleSave, onHistoryAdd, autoSubmitQuery, onAutoSubmitConsumed, greeting, prompts }`.
- [ ] **Step 4: PASS. Commit** `feat(drawer): chat, history, and saved panes`

---

### Task 8: Rewire DrawerBody + StorefrontDrawer + header/tabs

**Files:**
- Modify: `extensions-src/chat-drawer/components/DrawerBody.tsx` (render drawer components instead of ChatPane/HistoryPanel/SavedProductsPanel), `StorefrontDrawer.tsx` (DrawerShell positions, prototype header + underline tabs with badges, Fab component, shopName prop)
- Modify: `extensions-src/chat-drawer/entry.tsx` (read `data-shop-name`, pass down; pass settings-driven fabStyle/position from DrawerBody's fetched bundle — NOTE: the meta fetch lives in DrawerBody but Fab/Shell live in StorefrontDrawer; LIFT the settings fetch from DrawerBody into StorefrontDrawer (single fetch on mount, before first open is fine — it's ~1KB JSON; keep the cancelled-flag + parseShopSettings + fail-open pattern; DrawerBody receives `settings` as a prop and drops its own fetch). Update kill-switch wiring accordingly (StorefrontDrawer hides itself directly — `onDisabled` prop chain dies).
- Tests: rework `extensions-src/chat-drawer/__tests__/drawer-body.test.tsx`, `tests/extensions/chat-drawer/components/StorefrontDrawer.test.tsx`

- [ ] **Step 1: Failing tests** — StorefrontDrawer: fetches meta once on mount; Fab gets fabStyle + accent; DrawerShell gets drawerPosition; header shows "Ask {shopName}" (fallback "Ask us" when no name) + green-dot subline; underline tabs with badges (history/saved counts from the db-backed stores — those live in DrawerBody… tab badges need counts: lift `activeTab` state stays in StorefrontDrawer, DrawerBody exposes counts via `onCountsChange?: (c: {history: number; saved: number}) => void` callback — assert badges update); kill-switch: drawerEnabled false → renders null (no FAB) without needing open; designMode matrix preserved. DrawerBody: renders DrawerChat/DrawerHistory/DrawerSaved per tab with settings-driven greeting/prompts/accent wrapper; resume switches tab via existing onSwitchToChat.
- [ ] **Step 2: FAIL. Step 3: Implement.** Keep `React.lazy(DrawerBody)` split. The drawer wrapper keeps `--sd-accent` from settings.drawerAccent.
- [ ] **Step 4: PASS; `bun run build:storefront-bundle` exit 0; verify admin-only modules dropped: `grep -L "prompt-input" public/storefront-bundle*` (the PromptInput compound should no longer be in any chunk — record chunk sizes before/after in the commit body). Commit** `feat(drawer): redesigned drawer shell wired to merchant settings`

---

### Task 9: Loader FAB restyle + liquid shop-name

**Files:**
- Modify: `extensions/chat-drawer/assets/loader.js`, `extensions/chat-drawer/blocks/app_embed.liquid` (+`data-shop-name="{{ shop.name | escape }}"`), `extensions/chat-drawer/assets/loader.css` (pill/labeled FAB classes)
- Tests: extend `tests/extensions/chat-drawer/loader.test.ts` (string-level), `__tests__/app-embed-schema.test.ts` if it pins the liquid attrs

- [ ] **Step 1: Failing tests** — loader source contains a `restyleFab` path applying `data.fabStyle` ('pill' → dark pill markup with shop name from `root.dataset.shopName`; 'labeled' → accent block markup; 'circle' → no-op), reachable from the existing meta `.then`; liquid contains `data-shop-name`.
- [ ] **Step 2: FAIL. Step 3: Implement** — vanilla JS: in the existing meta-fetch `.then` (after the kill-switch checks), rebuild `fab.innerHTML`/classes per style using template strings; CSS classes in loader.css (`.sd-fab--pill`, `.sd-fab--labeled`) mirroring prototype values; accent from `data.drawerAccent` (override the dataset accent). Keep <100KB asset cap (check `wc -c`).
- [ ] **Step 4: PASS. Commit** `feat(drawer): loader restyles FAB per merchant settings`

---

### Task 10: Verification sweep + final review

- [ ] `bun run test` green; `bunx eslint` clean on changed files; `bunx tsc --noEmit` no NEW errors; `bun run build` + `bun run build:storefront-bundle` succeed; entry chunk ≤ previous size (record numbers).
- [ ] Settings copy check: density label says admin-only (spec deviation) — update `drawer-section.tsx` description if not done.
- [ ] Manual (needs `shopify app dev` + theme with app embed): FAB variants switch from Settings; drawer positions incl. mobile bottom-sheet; product row arrow opens product page; greeting/prompts reflect settings; kill-switch hides FAB.
- [ ] Final integration review subagent: settings chain end-to-end for the two new fields; bundle content audit (no admin components, no secrets); a11y of new drawer (dialog semantics, focus trap expectations vs current Escape/focus-return behavior — must not regress); loader size cap; useChatController parity (admin chat regression).
