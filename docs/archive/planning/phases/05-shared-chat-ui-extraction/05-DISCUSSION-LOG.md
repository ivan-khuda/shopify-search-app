---
phase: 05-shared-chat-ui-extraction
date: 2026-05-26
---

# Phase 5 Discussion Log

## Scoping

User selected all four gray areas for discussion: ChatPane boundary, ChatIdentityAdapter shape, persistence models, ai-elements + import paths.

Prior decisions carried forward without re-asking:
- Phase 4 D-09 — `getActiveChatModel(shop)` signature locked
- Phase 4 D-11 — `/chat` is RSC, banner above tabs
- PROJECT.md — storefront identity via localStorage `visitor_id`, NOT cookies
- AI Gateway as sole runtime entry point (locked at PROJECT.md)
- Tailwind 4 + shadcn primitives (locked at CLAUDE.md)

## Area A — ChatPane boundary

**Q1: What's exported as `ChatPane`?**
- Options presented: (1) inner conversation only [recommended] | (2) configurable shell with props | (3) two exports ChatPane + ChatShell
- Selected: (1) inner conversation only
- Notes: `HistoryPanel`/`SavedProductsPanel` exported as siblings. Admin keeps its `ChatShell` surface-specific; storefront builds its own drawer shell in Phase 6.

**Q2: State ownership for savedProducts + history?**
- Options presented: (1) surface shells own it; ChatPane stays prop-driven [recommended] | (2) ChatPane provides internal state via hook | (3) move state into adapter
- Selected: (1) prop-driven ChatPane
- Notes: ChatPane keeps `savedProductIds`, `onToggleSave`, `onHistoryAdd` props. Pure leaf component.

## Area B — ChatIdentityAdapter shape

**Q1: How does the adapter inject auth/identity?**
- Options presented: (1) two async methods getAuthHeaders + getRequestBody [recommended] | (2) single prepareRequest(init) | (3) React Context provider
- Selected: (1) two async methods
- Notes: `endpoint`, `getAuthHeaders()`, `getRequestBody()`. ChatPane wires `useChat({ api, headers, body })`.

**Q2: Where do concrete adapters live?**
- Options presented: (1) all in lib/chat-ui/adapters/ [recommended] | (2) interface in lib, concretes in surface dirs | (3) both in lib with full impls now
- Selected: (1) `lib/chat-ui/adapters/`
- Notes: Both concrete impls ship in Phase 5; Phase 6 just imports StorefrontAdapter.

**Q3: How are adapters exported to avoid App Bridge bundling on storefront?**
- Options presented: (1) sub-path imports per adapter [recommended] | (2) both in barrel, rely on tree-shaking | (3) EmbeddedAdapter as factory with injected getSessionToken
- Selected: (1) sub-path imports
- Notes: Barrel exports interface + components only; adapters via `@/lib/chat-ui/adapters/{embedded,storefront}`.

## Area C — Persistence models

**Q1: How much persistence work does Phase 5 deliver?**
- Options presented: (1) TS interfaces + localStorage default [recommended] | (2) interfaces only, in-memory impls | (3) no interfaces, defer entirely | (4) localStorage only for storefront, admin stays in-memory
- Selected: (1) interfaces + localStorage default
- Notes: `HistoryStore` and `SavedProductsStore` interfaces in `lib/chat-ui/stores/`. Default `LocalStorage*Store` impls. Namespaced keys: `smartdiscovery.history.{scope}` / `smartdiscovery.saved.{scope}` — scope = shop for admin, visitor_id for storefront. Phase 8 swaps to DB impls via the interface.

**Q2: How does ChatPane consume the stores?**
- Options presented: (1) stores stay in surface shells; ChatPane keeps callback props [recommended] | (2) ChatPane accepts store instances directly | (3) adapter holds stores (ties B + C)
- Selected: (1) callback props
- Notes: Surface shells use `useHistoryStore`/`useSavedProductsStore` hooks. ChatPane stays pure leaf.

## Area D — ai-elements + import paths

**Q1: Where do `components/ai-elements/` primitives end up?**
- Options presented: (1) keep where they are, lib/chat-ui imports across [recommended] | (2) move into lib/chat-ui/primitives/ | (3) move only the ones chat uses
- Selected: (1) keep at current path
- Notes: ai-elements is generic React primitives, potentially reusable by non-chat AI features. No churn.

**Q2: Backward-compat strategy for old import paths?**
- Options presented: (1) hard cut, update all importers in one pass [recommended] | (2) re-export shim at old paths for one phase | (3) lib/chat-ui re-exports from components/chat (fails SC #3)
- Selected: (1) hard cut
- Notes: All `@/components/chat/*` importers update to `@/lib/chat-ui/*` in the same commit set. Greppable end-state: zero matches for old paths.

## Scope creep redirected

- None this session — user stayed on the four selected areas. Future-phase ideas (DB-backed stores, cross-device sync, visitor→customer upgrade, storybook coverage, etc.) captured in CONTEXT.md "Deferred Ideas".

## Claude's discretion (not user decisions)

- Internal file layout of `lib/chat-ui/` (flat vs grouped subdirs)
- Exact `useChat` async-config wiring approach (researcher confirms v6 capability via context7)
- Adapter instantiation site (server vs client-side in admin RSC + client shell)
- Test coverage approach (lift existing tests; add adapter + store unit tests)
- Hex-literal → Tailwind token mapping for chat-shell.tsx cleanup

## Open assumptions surfaced for researcher

- A-01: Vercel AI SDK v6 `useChat` accepts function-returning headers/body config
- A-02: Phase 6 `/api/proxy/chat` will accept `visitor_id` in request body per the agreed contract
- A-03: localStorage-only visitor identity is acceptable for V1 storefront (no GDPR consent UI)
- A-04: Hex literals from chat-shell.tsx map cleanly to existing Tailwind tokens, or planner extends config
