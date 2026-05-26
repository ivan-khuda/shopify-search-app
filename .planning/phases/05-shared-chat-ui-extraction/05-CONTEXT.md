---
phase: 05-shared-chat-ui-extraction
created: 2026-05-26
status: discussed
requirements: [SHR-01, SHR-02, SHR-03, SHR-04]
---

# Phase 5 — Context

<domain>
## Domain

Lift the existing chat components into a `lib/chat-ui/` barrel that is runtime-neutral (no Shopify SDK imports) and consumed identically by the embedded admin and the Phase 6 storefront drawer. The only surface-specific seam is `ChatIdentityAdapter`, which injects auth headers (embedded → session-token Bearer) or visitor identity body fields (storefront → `visitor_id` from localStorage). Phase 5 also defines a thin persistence-store interface so history + saved-products survive reloads on both surfaces.

Phase 5 does NOT touch: the storefront drawer UI itself (Phase 6), the model-picker / `ShopSettings` admin UI (Phase 7), DB-backed persistence (Phase 8), or any new chat features beyond what already exists in `components/chat/*`.

</domain>

<canonical_refs>
## Canonical References

Downstream agents (researcher, planner, executor) MUST read these before acting on Phase 5:

### Project-level
- `.planning/PROJECT.md` — Core value, "no multi-tenant data leaks" constraint, storefront identity via localStorage `visitor_id` (NOT cookies — App Proxy strips Set-Cookie)
- `.planning/REQUIREMENTS.md` — SHR-01..SHR-04 are this phase's contract
- `.planning/ROADMAP.md` Phase 5 section — locked success criteria (zero Shopify imports in barrel; ChatPane/ChatMessage/ProductCard/HistoryPanel/SavedProductsPanel exports; EmbeddedAdapter + StorefrontAdapter; TS strict; no `any` casts)
- `CLAUDE.md` — bun only; AI Gateway only; Tailwind 4 + shadcn primitives; no secrets in logs

### Prior phase decisions (still load-bearing)
- `.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md` §D-09 — `getActiveChatModel(shop)` signature is locked
- `.planning/phases/04-searchservice-wire-chat/04-CONTEXT.md` §D-11 — `/chat` page is a server component, banner above tabs (must keep working after the lift)
- `.planning/phases/04-searchservice-wire-chat/04-VERIFICATION.md` Phase 5+ Handoff Notes — chat-shell.tsx flagged as hoist candidate; `/api/proxy/chat` is a 501 stub until Phase 6 lands HMAC
- `.planning/phases/04-searchservice-wire-chat/04-REVIEW.md` IN-01 (deferred) — inline hex literals in `chat-shell.tsx` to clean up during the lift

### Existing code (source of truth, not docs)
- `components/chat/chat.tsx` — current `Chat` component; `useChat()` called with no args at line 76 (this is THE single coupling point the adapter must fill)
- `components/chat/chat-shell.tsx` — admin tab layout (Chat / History / Saved); owns `useState` for history + savedProducts today
- `components/chat/{chat-message,product-card,history-panel,saved-products-panel,message-parts}.tsx` — shared components to lift
- `components/chat/empty-state.tsx` — small affordance; lift with chat
- `components/ai-elements/{prompt-input,response,attachments,reasoning}.tsx` — primitives chat depends on; STAY at current path (D-04 below)
- `app/(embedded)/chat/page.tsx` — current admin entry; imports `ChatShell`; will be updated to import from `lib/chat-ui` (or keep its surface-specific `ChatShell` as a thin wrapper around `ChatPane`)
- `app/api/chat/route.ts` — admin endpoint (POST `/api/chat`); accepts session-token Bearer via `withShopifySession`
- `app/api/proxy/chat/route.ts` — storefront endpoint (currently 501 stub, Phase 6 implements HMAC + streamText)
- `lib/db/`, `lib/shopify/`, `lib/sync/`, `lib/inngest/` — existing `lib/` layout that `lib/chat-ui/` joins
- `types/product.ts` — `ChatProduct`, `ChatHistoryItem` types (probably stay in `types/` since they're cross-cutting; planner decides)

</canonical_refs>

<code_context>
## Code Context (scouting findings)

- **components/chat/*.tsx has ZERO `window.shopify` / App Bridge / `@shopify/*` imports today.** The lift is mostly mechanical: move files, update import paths, no JSX rewrites.
- **Single Shopify coupling point**: `useChat()` in `chat.tsx:76` is called with no args. It defaults to POST `/api/chat` with no custom headers. Adapter wraps `useChat({ api, headers, body })`.
- **Bearer-token retrieval pattern already exists** in `app/(embedded)/onboarding/page.tsx:39,70` — uses App Bridge's `getSessionToken()` and sets `Authorization: Bearer ${token}`. EmbeddedAdapter follows this pattern.
- **`useChat` default request body** is `{ messages, ...rest }` where `rest` comes from the `body` config option. `getRequestBody()` async result is merged into that.
- **Test files** in `components/chat/__tests__/` (`product-card`, `history-panel`, `saved-products-panel`, `message-parts`, `chat-shell`, plus `chat.integration-test.tsx`) all import via `@/components/chat/*`. Hard cut means these imports update in lockstep.
- **`lib/` layout already established** (`db/`, `shopify/`, `sync/`, `inngest/`) — `lib/chat-ui/` fits the existing convention.

</code_context>

<decisions>
## Implementation Decisions

### A. ChatPane boundary
- **D-01:** `ChatPane` (the new `lib/chat-ui/` export) is **the inner conversation only** — messages list, empty state, PromptInput, attached-product cards. Each surface composes its own shell on top: the embedded admin keeps a `ChatShell` (tabbed Chat / History / Saved layout) in `app/(embedded)/chat/` or a surface-specific dir; the Phase 6 storefront drawer builds its own `DrawerShell` separately. `HistoryPanel` and `SavedProductsPanel` are exported as **siblings** in the `lib/chat-ui/` barrel so any surface can opt into them.
- **D-02:** State ownership: the surface-specific shell owns `savedProducts` + `history` (via `useState` or the new store hooks from D-06/D-07). `ChatPane` stays **prop-driven** — accepts `savedProductIds: Set<string>`, `onToggleSave: (product) => void`, `onHistoryAdd: (entry) => void`. ChatPane is a pure leaf component; easy to test, no surprise behavior.

### B. ChatIdentityAdapter shape
- **D-03:** Adapter interface in `lib/chat-ui/types.ts` (or `lib/chat-ui/adapter.ts`):
  ```ts
  export interface ChatIdentityAdapter {
    endpoint: string;
    getAuthHeaders(): Promise<Record<string, string>>;
    getRequestBody(): Promise<Record<string, unknown>>;
  }
  ```
  - `endpoint` is admin = `/api/chat`, storefront = `/api/proxy/chat`.
  - `getAuthHeaders()` returns headers to merge into the fetch (embedded fills `Authorization: Bearer ...`; storefront returns `{}`).
  - `getRequestBody()` returns body fields to merge with `useChat`'s default `{ messages }` (embedded returns `{}`; storefront returns `{ visitor_id: '...' }`).
  - Both are async so `getSessionToken()` from App Bridge fits naturally; storefront's localStorage read is sync but the async signature keeps both implementations symmetric.
  - ChatPane wires `useChat({ api: adapter.endpoint, headers: <await getAuthHeaders()>, body: <await getRequestBody()> })`. Research/planner will decide the exact wiring point (likely a thin internal hook, since `useChat` doesn't accept async config out of the box — planner verifies with Vercel AI SDK v6 docs).
- **D-04:** Adapter implementations live at `lib/chat-ui/adapters/embedded.ts` and `lib/chat-ui/adapters/storefront.ts`. The main barrel `lib/chat-ui/index.ts` **does NOT** re-export adapters — they are imported via sub-paths (`@/lib/chat-ui/adapters/embedded` / `@/lib/chat-ui/adapters/storefront`) to guarantee tree-shaking and prevent the storefront bundle from pulling in App Bridge transitively. The barrel exports only the `ChatIdentityAdapter` interface, the components, and the store interfaces (D-06).
- **D-05:** `EmbeddedAdapter`:
  - `endpoint: '/api/chat'`
  - `getAuthHeaders()`: calls App Bridge `getSessionToken()` (the same pattern `app/(embedded)/onboarding/page.tsx` uses) and returns `{ Authorization: 'Bearer <token>' }`.
  - `getRequestBody()`: returns `{}` (no extra body fields for embedded; the API route already gets shop from the validated session token).

  `StorefrontAdapter`:
  - `endpoint: '/api/proxy/chat'`
  - `getAuthHeaders()`: returns `{}`.
  - `getRequestBody()`: reads `localStorage.getItem('smartdiscovery.visitor_id')`; if absent, generates a `crypto.randomUUID()`, persists it, returns `{ visitor_id: '<uuid>' }`. **Note:** Phase 6 (which actually wires the drawer) will verify this contract matches `/api/proxy/chat`'s HMAC + visitor expectations; Phase 5 ships the adapter to the agreed shape and a unit test that round-trips localStorage.

### C. Persistence models
- **D-06:** Store interfaces in `lib/chat-ui/stores/types.ts`:
  ```ts
  export interface HistoryStore {
    list(): ChatHistoryItem[];
    add(entry: ChatHistoryItem): void;
    clear(): void;
    subscribe(listener: () => void): () => void; // for React useSyncExternalStore
  }
  export interface SavedProductsStore {
    list(): ChatProduct[];
    has(productId: string): boolean;
    toggle(product: ChatProduct): void;
    clear(): void;
    subscribe(listener: () => void): () => void;
  }
  ```
  - The `subscribe(listener)` shape is intentional so React's `useSyncExternalStore` can drive re-renders without forcing a Context provider on consumers.
- **D-07:** Default implementations: `LocalStorageHistoryStore` + `LocalStorageSavedProductsStore` in `lib/chat-ui/stores/local-storage.ts`. Storage keys are **namespaced by scope**:
  - Admin scope: `smartdiscovery.history.{shop}` and `smartdiscovery.saved.{shop}` — the surface shell instantiates the store with the shop name from the page-level session (already available server-side in Phase 4's RSC).
  - Storefront scope: `smartdiscovery.history.{visitor_id}` and `smartdiscovery.saved.{visitor_id}` — same `visitor_id` the StorefrontAdapter uses, so identity and persistence stay aligned.
  - Both stores cap history at 10 entries (today's behavior in `chat-shell.tsx`) and saved-products at no cap (today's behavior).
  - SSR-safe: stores check `typeof window` before touching `localStorage` and return empty state during SSR.
- **D-08:** Store wiring: `ChatPane` stays **prop-driven** (no change from D-02). Surface shells consume stores via convenience hooks `useHistoryStore(scope: string)` and `useSavedProductsStore(scope: string)` exported from `lib/chat-ui/stores/`. The hooks instantiate the LocalStorage default and return `{ items, addOrToggle, clear }` plus the callbacks `ChatPane` expects. Stores are usable independently of `ChatPane` (e.g., a future settings page that lets the merchant clear saved products).
- **D-09:** Phase 8 DB-backed swap: the `HistoryStore` / `SavedProductsStore` interfaces are the swap point. Phase 8 implements `DbBackedHistoryStore` etc. without touching `ChatPane` or surface shells beyond the store-instantiation call. Today's LocalStorage default stays as a fallback for the storefront (storefront persistence is per-visitor, not per-user account — DB-backed only when visitor identity is upgraded, e.g., on customer login).

### D. ai-elements + import paths
- **D-10:** `components/ai-elements/` **stays at its current path**. `lib/chat-ui/` imports from `@/components/ai-elements/*` as a cross-tree dependency. Rationale: ai-elements is a generic React primitive library (PromptInput, Response, Attachments) potentially reusable by non-chat AI features; it's already cleanly factored and Phase 4 already cleaned up the dead `reasoning` import path. No churn for primitives that don't need to move.
- **D-11:** **Hard cut** for import path migration. Every importer of `@/components/chat/*` is updated to `@/lib/chat-ui/*` in the same commit set as the file move. Test files relocate to `lib/chat-ui/__tests__/` (or `lib/chat-ui/{component}/{component}.test.tsx` — planner picks the layout) alongside their components. No backward-compat shims; no half-migrated state. Greppable end-state: `grep -rn '@/components/chat' app/ lib/ components/` returns ZERO matches by end of Phase 5.

### E. Cleanups landing in this phase (carried from Phase 4)
- **D-12:** Phase 4 IN-01 (deferred) — inline hex literals `#008060`, `#e1e3e5`, `#6d7175`, `#202223` in `chat-shell.tsx` are replaced with Tailwind tokens during the lift. Planner picks the exact token mapping (or extends `tailwind.config` if needed); whichever surface-specific shell owns the lifted tabbed layout gets the cleanup.

</decisions>

<deferred>
## Deferred Ideas

- **DB-backed `HistoryStore` / `SavedProductsStore` implementations** — Phase 8. Interface is the swap point per D-09.
- **Cross-device history sync for admin users** — would require user-account identity (not shop-account). Out of V1.
- **Visitor → customer identity upgrade on storefront login** — promote `visitor_id` history into a customer-scoped record on login. Phase 6 or later.
- **`ChatPane` storybook / visual regression coverage** — useful once both surfaces consume the same component. Defer; can land alongside Phase 6's drawer UX QA pass.
- **Tag-based `HistoryPanel` filtering / search** — today HistoryPanel is a flat reverse-chrono list. New capability; future phase.
- **Saved-products bulk export (CSV / JSON)** — admin nice-to-have; not in roadmap.
- **`extracting ai-elements` into its own package** — only worthwhile if you ever want to reuse it externally. Defer indefinitely.
- **`useChat` config — async wiring helper** — D-03 notes that `useChat` doesn't natively take async config. If the planner discovers v6 needs a custom hook to bridge async adapter calls into `useChat`'s sync config, that helper is in-scope for Phase 5; if the AI SDK already supports it cleanly, this footnote is moot.

</deferred>

<claude_discretion>
## Claude's Discretion (planner/researcher decide)

- **Exact internal file layout of `lib/chat-ui/`** — flat (`lib/chat-ui/{chat-pane,chat-message,product-card,history-panel,saved-products-panel,empty-state,message-parts}.tsx`) vs grouped (`lib/chat-ui/components/`, `lib/chat-ui/adapters/`, `lib/chat-ui/stores/`). Planner picks consistent with the codebase's `lib/` convention. The barrel `index.ts` is mandatory either way.
- **`useChat` async-config wiring** — Vercel AI SDK v6 may or may not support `headers: () => Promise<...>` / `body: () => Promise<...>` natively. Researcher confirms with context7; if not native, planner adds a thin internal hook (e.g., `useChatWithAdapter(adapter)`) that resolves the async values once and feeds them to `useChat`.
- **TypeScript barrel export shape** — named exports throughout (no default exports). Planner ensures no `any` casts (locked by SC #4).
- **Test coverage threshold** — at minimum, each lifted component keeps its existing test passing. Adapter unit tests for both `EmbeddedAdapter` (mock `getSessionToken`) and `StorefrontAdapter` (mock `localStorage` + `crypto.randomUUID`). Store unit tests for `LocalStorage*Store` (round-trip via mocked `localStorage`). Integration test that `ChatPane` calls `adapter.getAuthHeaders()` and `adapter.getRequestBody()` on first message send.
- **Updating `app/(embedded)/chat/page.tsx`** — keep it a server component (Phase 4 D-11); it now passes `EmbeddedAdapter` (or a factory that creates one client-side) into the shell. Planner decides whether the adapter is instantiated server-side (then passed serializably) or client-side (inside the shell using `'use client'`). The `getSessionToken()` call is necessarily client-side, so adapter instantiation likely happens in the client shell.

</claude_discretion>

<assumptions>
## Open Assumptions (researcher to verify)

- **A-01:** Vercel AI SDK v6's `useChat({ api, headers, body })` accepts function-returning config (sync or async) for `headers` and `body`. If not, a custom wrapper hook is needed (deferred footnote above).
- **A-02:** Storefront drawer (Phase 6) confirms `/api/proxy/chat` will accept `visitor_id` in the request body as designed. Phase 4's stub returns 501; the contract is on paper, not in code yet. Phase 5 adapter ships to the documented contract; Phase 6 verifies end-to-end.
- **A-03:** `localStorage.getItem('smartdiscovery.visitor_id')` is acceptable for storefront identity at this scope. PROJECT.md confirms localStorage (not cookies). No additional consent / GDPR mechanics for V1.
- **A-04:** Hex-literal cleanup (D-12) maps to existing Tailwind tokens (e.g., `bg-emerald-600` for `#008060`). If a literal has no matching token, planner extends `tailwind.config` or accepts an `arbitrary value` class like `bg-[#008060]` — researcher checks Polaris-equivalence vs. Tailwind defaults.

</assumptions>

<success_criteria_check>
## Success Criteria (from ROADMAP)

1. ✓ `lib/chat-ui/` exports `ChatPane`, `ChatMessage`, `ProductCard`, `HistoryPanel`, `SavedProductsPanel` with zero `window.shopify`/App Bridge/Shopify-SDK imports — D-01, D-04 (sub-path adapters keep App Bridge off the barrel)
2. ✓ `ChatIdentityAdapter` is the sole surface-specific seam; `EmbeddedAdapter` provides session-token Bearer; `StorefrontAdapter` provides visitor_id from localStorage — D-03, D-05
3. ✓ Embedded admin chat page imports exclusively from `lib/chat-ui/`; zero `@/components/chat/*` imports remain — D-11
4. ✓ TS strict-mode build with no `any` casts in shared barrel or adapters — locked, planner enforces

</success_criteria_check>
