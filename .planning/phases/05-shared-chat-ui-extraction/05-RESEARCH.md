# Phase 5: Shared Chat-UI Extraction — Research

**Researched:** 2026-05-26
**Domain:** React component refactor / module boundary design (no new external libraries)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### A. ChatPane boundary
- **D-01:** `ChatPane` (the new `lib/chat-ui/` export) is **the inner conversation only** — messages list, empty state, PromptInput, attached-product cards. Each surface composes its own shell on top: the embedded admin keeps a `ChatShell` (tabbed Chat / History / Saved layout) in `app/(embedded)/chat/` or a surface-specific dir; the Phase 6 storefront drawer builds its own `DrawerShell` separately. `HistoryPanel` and `SavedProductsPanel` are exported as **siblings** in the `lib/chat-ui/` barrel.
- **D-02:** State ownership: the surface-specific shell owns `savedProducts` + `history` (via `useState` or the new store hooks). `ChatPane` is **prop-driven** — accepts `savedProductIds: Set<string>`, `onToggleSave: (product) => void`, `onHistoryAdd: (entry) => void`. Pure leaf component.

#### B. ChatIdentityAdapter shape
- **D-03:** Interface in `lib/chat-ui/types.ts` (or `lib/chat-ui/adapter.ts`):
  ```ts
  export interface ChatIdentityAdapter {
    endpoint: string;
    getAuthHeaders(): Promise<Record<string, string>>;
    getRequestBody(): Promise<Record<string, unknown>>;
  }
  ```
  - `endpoint` is admin = `/api/chat`, storefront = `/api/proxy/chat`.
  - `getAuthHeaders()` returns headers to merge (embedded → `Authorization: Bearer ...`; storefront → `{}`).
  - `getRequestBody()` returns body fields (embedded → `{}`; storefront → `{ visitor_id: '...' }`).
  - Both async so `getSessionToken()` from App Bridge fits naturally.
- **D-04:** Adapter implementations live at `lib/chat-ui/adapters/embedded.ts` and `lib/chat-ui/adapters/storefront.ts`. The main barrel `lib/chat-ui/index.ts` **does NOT** re-export adapters — they are imported via sub-paths (`@/lib/chat-ui/adapters/embedded` / `@/lib/chat-ui/adapters/storefront`) to guarantee tree-shaking. The barrel exports only the `ChatIdentityAdapter` interface, the components, and the store interfaces.
- **D-05:** `EmbeddedAdapter`: endpoint `/api/chat`; `getAuthHeaders()` calls App Bridge `shopify.idToken()` and returns `{ Authorization: 'Bearer <token>' }`; `getRequestBody()` returns `{}`. `StorefrontAdapter`: endpoint `/api/proxy/chat`; `getAuthHeaders()` returns `{}`; `getRequestBody()` reads `localStorage.getItem('smartdiscovery.visitor_id')`, falls back to `crypto.randomUUID()` + persist, returns `{ visitor_id: '<uuid>' }`.

#### C. Persistence models
- **D-06:** Store interfaces in `lib/chat-ui/stores/types.ts`:
  ```ts
  export interface HistoryStore {
    list(): ChatHistoryItem[];
    add(entry: ChatHistoryItem): void;
    clear(): void;
    subscribe(listener: () => void): () => void; // for useSyncExternalStore
  }
  export interface SavedProductsStore {
    list(): ChatProduct[];
    has(productId: string): boolean;
    toggle(product: ChatProduct): void;
    clear(): void;
    subscribe(listener: () => void): () => void;
  }
  ```
- **D-07:** Default implementations: `LocalStorageHistoryStore` + `LocalStorageSavedProductsStore` in `lib/chat-ui/stores/local-storage.ts`. Namespaced keys: `smartdiscovery.history.{scope}` / `smartdiscovery.saved.{scope}` (scope = shop for admin, visitor_id for storefront). History capped at 10 entries; saved-products uncapped. SSR-safe (`typeof window` guard).
- **D-08:** Surface shells consume stores via `useHistoryStore(scope: string)` / `useSavedProductsStore(scope: string)` hooks exported from `lib/chat-ui/stores/`. ChatPane stays prop-driven.
- **D-09:** Phase 8 swap point: `HistoryStore` / `SavedProductsStore` interfaces. Phase 8 implements `DbBackedHistoryStore` etc. without touching ChatPane or surface shells beyond the store-instantiation call.

#### D. ai-elements + import paths
- **D-10:** `components/ai-elements/` **stays at its current path**. `lib/chat-ui/` imports `@/components/ai-elements/*` as a cross-tree dependency.
- **D-11:** **Hard cut** import path migration. Every importer of `@/components/chat/*` updates to `@/lib/chat-ui/*` in the same commit set as the file move. Tests relocate to `lib/chat-ui/__tests__/` and re-import accordingly. End-state: `grep -rn '@/components/chat' app/ lib/ components/` returns ZERO matches.

#### E. Cleanups landing in this phase
- **D-12:** Phase 4 IN-01 — replace inline hex literals (`#008060`, `#e1e3e5`, `#6d7175`, `#202223`, `#f6f6f7`, `#f1f2f4`) in the lifted `chat-shell.tsx` with Tailwind arbitrary-value classes per the UI-SPEC mapping. **D-12 hex cleanup is the ONLY permitted CSS change** during the lift (UI-SPEC §"File Move Parity Rules").

### Claude's Discretion (researcher / planner decide)

- **Exact internal file layout of `lib/chat-ui/`** — flat vs grouped subdirs (recommendation in this research: grouped). The barrel `index.ts` is mandatory.
- **`useChat` async-config wiring approach** — resolved here (see Recommended Implementation Outline §3).
- **TypeScript barrel export shape** — named exports throughout (no default exports). No `any` casts in shared barrel or adapters.
- **Test coverage approach** — adapter unit tests, store unit tests, lift-existing-tests integrity, static-grep guard test (this research recommends one).
- **`/chat` page.tsx wiring** — keep server component (Phase 4 D-11); adapter instantiation in client shell since `shopify.idToken()` is browser-only.

### Deferred Ideas (OUT OF SCOPE)

- DB-backed `HistoryStore` / `SavedProductsStore` implementations — Phase 8.
- Cross-device history sync for admin users — out of V1.
- Visitor → customer identity upgrade on storefront login — Phase 6 or later.
- ChatPane storybook / visual regression coverage — defer; alongside Phase 6 drawer UX QA.
- Tag-based HistoryPanel filtering / search — future phase.
- Saved-products bulk export (CSV / JSON) — not in roadmap.
- Extracting ai-elements into its own package — defer indefinitely.
- `useChat` async-config wiring helper — only if v6 needs a bridge. Research confirms it does NOT (see §A-01 resolution).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHR-01 | Chat components extracted to `lib/chat-ui/` runtime-neutral barrel with no `window.shopify` / App Bridge imports | Verified: `components/chat/*.tsx` and `components/ai-elements/*.tsx` already contain ZERO `@shopify/*`, `window.shopify`, or App Bridge imports (grep evidence below). The lift is mechanical. Barrel safety enforced via §"Static-Grep Guard Test". |
| SHR-02 | `ChatIdentityAdapter` interface allows embedded and storefront callers to provide token/identity differently | Interface design locked in D-03. Implementation pattern verified against AI SDK v6 `DefaultChatTransport` (§Recommended Implementation Outline §3). |
| SHR-03 | Embedded admin uses `EmbeddedAdapter` (session-token Bearer); storefront drawer uses `StorefrontAdapter` (visitor_id from localStorage) | EmbeddedAdapter pattern matches the existing `app/(embedded)/onboarding/page.tsx:36,68` `shopify.idToken()` call. StorefrontAdapter pattern matches PROJECT.md "Storefront identity" decision (localStorage NOT cookies). |
| SHR-04 | Both surfaces import the same `ChatPane`, `ChatMessage`, `ProductCard`, `HistoryPanel`, `SavedProductsPanel` components | Component shapes locked in UI-SPEC §"File Move Parity Rules". Identical imports verified by the static-grep guard test. |

</phase_requirements>

## Summary

Phase 5 is a **mechanical extraction refactor**, not new feature work. The five components that need to ship out of `lib/chat-ui/` (`ChatPane`, `ChatMessage`, `ProductCard`, `HistoryPanel`, `SavedProductsPanel`) already exist in `components/chat/` and **already contain zero Shopify SDK references**. The single coupling point is `useChat()` in `chat.tsx:76`, which is called with no args today — the adapter pattern wraps it with a transport that resolves identity asynchronously.

The most material research finding is **AI SDK v6's transport-based `useChat` architecture**. The hook no longer accepts `api / headers / body` directly; the canonical pattern is `useChat({ transport: new DefaultChatTransport({ api, headers, body }) })`, and the bundled `HttpChatTransport` typings declare `headers` and `body` as `Resolvable<T>` which expands to `T | Promise<T> | (() => T | Promise<T>)`. **This resolves Assumption A-01 (TRUE — native async-function config support), eliminating the need for a custom wrapper hook.** The adapter contract maps cleanly: `endpoint → api`, `getAuthHeaders → headers`, `getRequestBody → body`.

The second-most material finding is the **App Bridge `shopify` global typing**. The embedded surface already uses `shopify.idToken()` (typed via `@shopify/app-bridge-types` and surfaced through `types/shopify-global.d.ts`). The EmbeddedAdapter imports nothing — it consumes the runtime global — which keeps `@/lib/chat-ui/adapters/embedded.ts` free of `@shopify/*` import statements while still calling App Bridge at runtime. Per D-04, adapters live as sub-paths and are NOT re-exported from the barrel, so the storefront bundle's tree-shaker drops the embedded module entirely.

**Primary recommendation:** Adopt the grouped file layout (`lib/chat-ui/components/`, `lib/chat-ui/adapters/`, `lib/chat-ui/stores/`) and wire ChatPane via `DefaultChatTransport`-with-functions. Use a static `vitest` test that greps `lib/chat-ui/` for forbidden imports as the enforcement mechanism for SHR-01 (cheaper and more durable than an ESLint rule). Execute the lift in three waves: (1) Wave 0 test scaffolds + new test relocation, (2) component move + barrel + adapters + stores, (3) importer hard-cut + delete old paths + verification.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render chat conversation (messages, prompt input, product cards) | Browser / Client | — | Pure React leaf, no server logic. `ChatPane` lives in `lib/chat-ui/` and is `'use client'`. |
| Auth identity resolution (Bearer token for embedded, visitor_id for storefront) | Browser / Client | — | Both `shopify.idToken()` (App Bridge runtime global) and `localStorage` access are browser-only. Adapter MUST run client-side; cannot be serialized from RSC. |
| Persistence (history + saved products) | Browser / Client (LocalStorage default in Phase 5) | Database / Storage (Phase 8 swap) | LocalStorage stores are the Phase 5 default per D-07. The interface is the swap point — Phase 8 replaces the impl without touching ChatPane. |
| Streaming chat API request | API / Backend | — | `/api/chat` (admin) and `/api/proxy/chat` (storefront) own this. Phase 5 does NOT touch these routes. |
| Surface-specific layout (tabbed admin shell, storefront drawer) | Frontend Server (RSC for `/chat` page wrapper) + Browser (interactive shell) | — | `/chat` stays server component per Phase 4 D-11. The interactive `ChatShell` is a client component in the embedded surface dir. Phase 6 will build its own `DrawerShell`. |
| Component tier neutrality enforcement | Tooling / CI | — | Static-grep guard vitest test (recommended §"Validation Architecture"). |

## Standard Stack

> **No new external libraries are introduced in Phase 5.** Every package referenced below already ships in this repo. The "Standard Stack" table documents the libraries the extracted barrel will depend on and the **exact** APIs Phase 5 uses from each.

### Core (already installed — not changed by Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.3 | UI rendering, `useSyncExternalStore` for stores | Project-wide React version. `useSyncExternalStore` is the canonical React 18+ external-store binding. [VERIFIED: package.json] |
| `next` | 16.1.6 | App Router, server/client component boundary, `next/image` in ProductCard | Project-locked per CLAUDE.md. [VERIFIED: package.json] |
| `@ai-sdk/react` | ^3.0.75 | `useChat` hook (the single ChatPane coupling point) | Project-locked; transport-based API in v6. [VERIFIED: package.json + `node_modules/@ai-sdk/react/dist/index.d.ts:39`] |
| `ai` | ^6.0.77 | `DefaultChatTransport`, `HttpChatTransport`, `Resolvable<T>` types | Project-locked. `HttpChatTransportInitOptions.headers/body` accept `Resolvable<T>`. [VERIFIED: `node_modules/ai/dist/index.d.ts:3513-3559`] |
| `typescript` | ^5 | Strict mode (SC #4) | Project-locked per tsconfig.json (strict: true). [VERIFIED: tsconfig.json:7] |
| `tailwindcss` | 4 | Styling (arbitrary-value classes for Polaris hex map per D-12) | Project-locked per CLAUDE.md. [VERIFIED: package.json] |
| `vitest` | ^4.1.5 | Unit + integration tests + static-grep guard test | Project-locked per vitest.config.ts. [VERIFIED: package.json] |
| `@testing-library/react` | ^16.3.2 | Component rendering tests | Already used by lifted tests. [VERIFIED: package.json] |
| `lucide-react` | 0.563.0 | Icons referenced by lifted components (Heart, Sparkles, Search, etc.) | Already used. [VERIFIED: package.json] |

### Supporting (existing internal modules)

| Module | Path | Phase 5 Use |
|--------|------|-------------|
| `@/components/ai-elements/*` | repo path (stays per D-10) | `PromptInput`, `Response`, `Attachments` — cross-tree import from lib/chat-ui. |
| `@/components/ui/*` | shadcn primitives (stays) | Tabs, Button, TextShimmer — also cross-tree imports. |
| `@/lib/utils` (`cn`) | repo path (stays) | Tailwind class merging. |
| `@/types/product` | repo path (stays — cross-cutting) | `ChatProduct`, `ChatHistoryItem`. **DECISION: Keep at `types/product.ts`**; do NOT move into `lib/chat-ui/`. Rationale: `ChatProduct` is consumed by `services/search/SearchService` and the API routes, not just the UI — moving it inside `lib/chat-ui/` couples the API to a UI module. Cross-cutting types belong at `types/`. |
| `@shopify/app-bridge-types` | npm | TYPE-only dep for the `shopify` global (already in package.json). EmbeddedAdapter imports zero `@shopify/*` modules; the runtime global is supplied by `app-bridge.js` script in `app/(embedded)/layout.tsx`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `DefaultChatTransport` with `headers/body: () => Promise<...>` | A custom wrapper hook (`useChatWithAdapter(adapter)`) that pre-resolves async values via `useEffect` then calls `useChat` with the resolved values | Wrapper hook works but adds re-render complexity and a stale-closure trap (the GitHub issues cited in Sources flag exactly this). Native `Resolvable` is simpler and reads from a "fresh" closure on every `sendMessage`. **Use native; skip the wrapper.** |
| `useChat({ transport })` at hook level | `sendMessage(msg, { headers, body })` at call site | Request-level config is "recommended for dynamic state" per AI SDK troubleshooting docs, but for our case the adapter never changes within a session and the values are deterministic functions — hook-level transport is cleaner. **Use hook-level transport.** |
| Static-grep guard via vitest | ESLint custom rule banning `@shopify/*` in `lib/chat-ui/` | Custom ESLint rules add maintenance burden and require AST plumbing. A 20-line vitest test that reads files and asserts no banned imports is simpler, faster, and runs in the same suite as the component tests. **Use vitest.** |
| Flat `lib/chat-ui/*.tsx` layout | Grouped `lib/chat-ui/components/`, `lib/chat-ui/adapters/`, `lib/chat-ui/stores/` | Flat is fine for 7 components; grouped scales better and matches `lib/db/`, `lib/shopify/`, `lib/inngest/`, `lib/sync/` (all grouped). **Use grouped.** |

**Installation:** None. `bun install` is not required for Phase 5.

**Version verification:**

| Package | Verified Version | Source |
|---------|------------------|--------|
| `ai` | 6.0.77 | `node_modules/ai/dist/index.d.ts` line 3513 confirms `HttpChatTransportInitOptions` shape [VERIFIED: source-of-truth typings] |
| `@ai-sdk/react` | 3.0.75 | `node_modules/@ai-sdk/react/dist/index.d.ts` line 26 confirms `UseChatOptions` shape [VERIFIED: source-of-truth typings] |
| `next` | 16.1.6 | `package.json` [VERIFIED] |
| `react` | 19.2.3 | `package.json` [VERIFIED] |

## Package Legitimacy Audit

> **N/A for this phase.** Phase 5 installs **zero** new external packages. All dependencies referenced are already pinned in `package.json` from earlier phases (Phases 1–4). Slopcheck cannot reach the registry from this sandbox (`pip3` is present but `--break-system-packages` is unsupported in this Python build), so the conventional audit table is replaced by the no-new-installs declaration below.

**New packages installed by Phase 5:** none.
**Packages removed by Phase 5:** none.
**Packages whose version is bumped by Phase 5:** none.

The lone external API surface the lift touches (`ai/DefaultChatTransport`) is already used transitively by `@ai-sdk/react`'s `useChat` today — the change is "stop calling `useChat()` with no args" → "call `useChat({ transport: new DefaultChatTransport({ ... }) })`" using a class that already ships in the same `ai` 6.0.77 bundle.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │  app/(embedded)/chat/page.tsx   (RSC, Phase 4 D-11) │
                    │  └─ <Banner /> (model name)                          │
                    │  └─ <ChatShell />     ← surface-specific client     │
                    └─────────────────────────────────────────────────────┘
                                              │
                                              ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │  app/(embedded)/chat/chat-shell.tsx    (surface shell, NOT in    │
        │  lib/chat-ui/)                                                   │
        │  ├─ instantiates EmbeddedAdapter   (client-side)                 │
        │  ├─ useHistoryStore(shop)          ← from @/lib/chat-ui/stores   │
        │  ├─ useSavedProductsStore(shop)    ← from @/lib/chat-ui/stores   │
        │  └─ <Tabs>                                                       │
        │        <TabsContent value="chat">                                │
        │          <ChatPane adapter={...} savedProductIds={...}           │
        │                    onToggleSave={...} onHistoryAdd={...} />      │
        │        <TabsContent value="history">                             │
        │          <HistoryPanel ... />                                    │
        │        <TabsContent value="saved">                               │
        │          <SavedProductsPanel ... />                              │
        └──────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼  (imports from)
        ┌──────────────────────────────────────────────────────────────────┐
        │                       lib/chat-ui/                               │
        │                                                                  │
        │  index.ts                  barrel — NO adapter re-exports        │
        │    ├─ ChatPane                                                   │
        │    ├─ ChatMessage                                                │
        │    ├─ ProductCard                                                │
        │    ├─ HistoryPanel                                               │
        │    ├─ SavedProductsPanel                                         │
        │    ├─ EmptyState                                                 │
        │    ├─ MessageParts                                               │
        │    ├─ ChatIdentityAdapter (interface)                            │
        │    ├─ HistoryStore / SavedProductsStore (interfaces)             │
        │    └─ useHistoryStore / useSavedProductsStore (hooks)            │
        │                                                                  │
        │  components/      adapters/         stores/                      │
        │    chat-pane.tsx    embedded.ts      types.ts                    │
        │    chat-message      storefront.ts   local-storage.ts            │
        │    product-card                       hooks.ts                   │
        │    history-panel                                                 │
        │    saved-products-panel                                          │
        │    empty-state                                                   │
        │    message-parts                                                 │
        └──────────────────────────────────────────────────────────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────┐
              ▼ (sub-path import,             ▼  (sub-path import,        │
              not via barrel)                 not via barrel)             │
        ┌─────────────────────┐         ┌─────────────────────────────┐   │
        │ adapters/embedded   │         │ adapters/storefront         │   │
        │  - reads global     │         │  - reads localStorage       │   │
        │    `shopify.idToken`│         │  - falls back to            │   │
        │  - returns Bearer   │         │    crypto.randomUUID        │   │
        │    header           │         │  - returns                  │   │
        │  endpoint:          │         │    { visitor_id }           │   │
        │  /api/chat          │         │  endpoint:                  │   │
        │                     │         │  /api/proxy/chat            │   │
        └─────────────────────┘         └─────────────────────────────┘   │
                  │                                   │                   │
                  ▼                                   ▼                   │
        DefaultChatTransport({ api: adapter.endpoint,                     │
                               headers: () => adapter.getAuthHeaders(),   │
                               body:    () => adapter.getRequestBody() })◄┘
                                              │
                                              ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  useChat({ transport })   ← inside ChatPane                  │
        └─────────────────────────────────────────────────────────────┘
```

**Surface boundary contract:**
- `lib/chat-ui/index.ts` barrel has ZERO `@shopify/*`, `window.shopify`, App Bridge imports — verified by static-grep guard test.
- `lib/chat-ui/adapters/embedded.ts` reads `shopify.idToken()` via the runtime global (no `import` statements) — verified by grep.
- Surface shells (admin `chat-shell.tsx`, future drawer shell) are the ONLY places where adapter instantiation lives.

### Recommended Project Structure (Claude's discretion — grouped layout chosen)

```
lib/chat-ui/
├── index.ts                          # barrel — components + interfaces only
├── components/
│   ├── chat-pane.tsx                 # (was: components/chat/chat.tsx, renamed + props)
│   ├── chat-message.tsx              # lifted
│   ├── product-card.tsx              # lifted
│   ├── history-panel.tsx             # lifted
│   ├── saved-products-panel.tsx      # lifted
│   ├── empty-state.tsx               # lifted
│   └── message-parts.tsx             # lifted
├── adapters/
│   ├── types.ts                      # ChatIdentityAdapter interface
│   ├── embedded.ts                   # EmbeddedAdapter (uses runtime shopify global)
│   └── storefront.ts                 # StorefrontAdapter (uses localStorage)
├── stores/
│   ├── types.ts                      # HistoryStore + SavedProductsStore interfaces
│   ├── local-storage.ts              # LocalStorageHistoryStore + LocalStorageSavedProductsStore
│   └── hooks.ts                      # useHistoryStore + useSavedProductsStore (useSyncExternalStore)
└── __tests__/
    ├── chat-pane.integration-test.tsx     # adapter wiring, useChat mocking
    ├── chat-message.test.tsx              # lifted
    ├── product-card.test.tsx              # lifted
    ├── history-panel.test.tsx             # lifted
    ├── saved-products-panel.test.tsx      # lifted
    ├── message-parts.test.tsx             # lifted
    ├── embedded-adapter.test.ts           # NEW — mock shopify.idToken
    ├── storefront-adapter.test.ts         # NEW — mock localStorage + crypto
    ├── local-storage-stores.test.ts       # NEW — round-trip via mocked localStorage
    └── barrel-isolation.test.ts           # NEW — static-grep guard for forbidden imports
```

Surface shell (NOT inside `lib/chat-ui/`):
```
app/(embedded)/chat/
├── page.tsx                          # RSC (kept from Phase 4)
├── chat-shell.tsx                    # 'use client' — instantiates EmbeddedAdapter
└── __tests__/
    ├── page.test.tsx                 # lifted from current location
    └── chat-shell.test.tsx           # lifted from components/chat/__tests__/
```

### Pattern 1: Adapter wired via `DefaultChatTransport` with Resolvable functions

**What:** ChatPane builds a transport once per render (or memoized) using async-function `headers`/`body`. The `Resolvable<T>` type lets the transport call the adapter on every `sendMessage` and await the result.

**When to use:** Always, in Phase 5. This is the canonical AI SDK v6 pattern for dynamic auth.

**Example:**
```typescript
// lib/chat-ui/components/chat-pane.tsx
// Source: VERIFIED against node_modules/ai/dist/index.d.ts:3513-3577 (HttpChatTransportInitOptions + DefaultChatTransport)
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';
import type { ChatIdentityAdapter } from '../adapters/types';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

interface ChatPaneProps {
  adapter: ChatIdentityAdapter;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
  onHistoryAdd: (entry: ChatHistoryItem) => void;
}

export function ChatPane({ adapter, savedProductIds, onToggleSave, onHistoryAdd }: ChatPaneProps) {
  const transport = useMemo(
    () => new DefaultChatTransport({
      api: adapter.endpoint,
      headers: () => adapter.getAuthHeaders(),   // Resolvable<Record<string, string> | Headers>
      body:    () => adapter.getRequestBody(),   // Resolvable<object>
    }),
    [adapter],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  // ... unchanged from current chat.tsx body (PromptInput, ChatMessage rendering, handleSubmit) ...
}
```

### Pattern 2: EmbeddedAdapter (no `@shopify/*` import; runtime global only)

**What:** Implements `ChatIdentityAdapter` by reading the App Bridge `shopify` runtime global. The global is supplied by `app/(embedded)/layout.tsx`'s `<Script src="...app-bridge.js" strategy="beforeInteractive" />` and typed via `@shopify/app-bridge-types` (already a transitive dep — surfaced through `types/shopify-global.d.ts`).

**Example:**
```typescript
// lib/chat-ui/adapters/embedded.ts
// Source: pattern mirrors app/(embedded)/onboarding/page.tsx:36 (shopify.idToken())
import type { ChatIdentityAdapter } from './types';

export class EmbeddedAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    // `shopify` is a runtime global supplied by app-bridge.js; typed via @shopify/app-bridge-types.
    // This file contains ZERO `import ... from '@shopify/*'` statements — verified by static-grep guard.
    const token = await shopify.idToken();
    return { Authorization: `Bearer ${token}` };
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    return {};
  }
}
```

### Pattern 3: StorefrontAdapter (localStorage + crypto.randomUUID)

**Example:**
```typescript
// lib/chat-ui/adapters/storefront.ts
import type { ChatIdentityAdapter } from './types';

const STORAGE_KEY = 'smartdiscovery.visitor_id';

export class StorefrontAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/proxy/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    if (typeof window === 'undefined') {
      // SSR-safe: storefront drawer mounts client-side, but the adapter file may be imported during SSR.
      return {};
    }
    let visitorId = window.localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, visitorId);
    }
    return { visitor_id: visitorId };
  }
}
```

### Pattern 4: useSyncExternalStore-backed store hook

**Example:**
```typescript
// lib/chat-ui/stores/hooks.ts
import { useSyncExternalStore, useMemo } from 'react';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { HistoryStore } from './types';
import { LocalStorageHistoryStore } from './local-storage';

export function useHistoryStore(scope: string) {
  const store: HistoryStore = useMemo(() => new LocalStorageHistoryStore(scope), [scope]);
  const items = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.list(),
    () => [],   // SSR snapshot
  );
  return {
    items,
    add: (entry: ChatHistoryItem) => store.add(entry),
    clear: () => store.clear(),
  };
}
```

### Anti-Patterns to Avoid

- **Importing `@shopify/*` anywhere under `lib/chat-ui/`** — violates SHR-01. The runtime global pattern (Pattern 2) sidesteps this entirely.
- **Putting `ChatProduct` / `ChatHistoryItem` inside `lib/chat-ui/`** — these are cross-cutting (used by SearchService and API routes too). Keep them at `types/product.ts`.
- **Re-exporting adapters from the barrel `index.ts`** — would defeat sub-path tree-shaking and pull App Bridge into the storefront bundle. D-04 locks this.
- **`useChat({ api: '/api/chat', headers, body })` direct hook config** — outdated v5 pattern. v6's `useChat` accepts only `transport` (verified against `node_modules/@ai-sdk/react/dist/index.d.ts:26-39` + `node_modules/ai/dist/index.d.ts:3299-3343 ChatInit interface`). The legacy fields do not exist on `ChatInit`.
- **Resolving the adapter's async values inside `useMemo` / `useEffect`** — would create stale closures (cited issue: vercel/ai#7819, #7463). Use the native Resolvable functions instead; AI SDK invokes them on every send.
- **Backward-compat re-export shim at `components/chat/*`** — explicitly forbidden by D-11 (hard cut).
- **`ChatPane` carrying surface-specific heights** (`h-[calc(100vh-100px)]`, `h-[calc(100%-180px)]`) — these belong in the surface shell (UI-SPEC §"Spacing Exceptions" + §"File Move Parity Rules" rule #4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async auth-header injection into chat fetch | Custom `fetch` wrapper around `useChat` | `DefaultChatTransport({ headers: () => adapter.getAuthHeaders() })` | Native v6 support via `Resolvable`. Custom wrappers create stale-closure bugs (vercel/ai#7819, #7463 cited). |
| External store React binding | Hand-rolled subscribe/render loop | React 18+ `useSyncExternalStore` | Designed exactly for this. SSR-safe via 3rd arg. |
| UUID generation for visitor_id | Custom RNG | `crypto.randomUUID()` | Built-in browser API; standardized; cryptographically secure. |
| Barrel file forbidding `@shopify/*` | Custom AST-based ESLint rule | A 20-line vitest test that reads files + asserts no banned regex matches | Simpler, faster, runs in same suite as component tests. See §"Validation Architecture". |
| Tree-shaking adapter bundles | Webpack/Turbopack `sideEffects: false` package boundary | D-04: sub-path imports (`@/lib/chat-ui/adapters/storefront`) instead of barrel re-exports | Sub-path imports are bundler-agnostic and explicit. |
| Async-config wrapper hook (`useChatWithAdapter`) | A custom hook that `useEffect`-resolves headers then passes to `useChat` | Native `Resolvable<T>` in `HttpChatTransportInitOptions` | Verified in typings — AI SDK already does exactly this. Avoid duplicating it. |

**Key insight:** The lift is mostly about MOVING files and ADDING three new artifacts (`adapters/`, `stores/`, barrel `index.ts`). Almost nothing is genuinely new code. The "new" code that exists is thin (adapters are 15 lines; stores are ~40 lines each; the barrel is a re-export list). Resist the urge to introduce abstractions beyond the four locked seams.

## Runtime State Inventory

> Phase 5 is a code refactor with no DB migration, no OS-registered state, and no live external services to reconfigure. The relevant categories below are short.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** Phase 5 introduces LocalStorage keys (`smartdiscovery.history.{scope}` / `smartdiscovery.saved.{scope}` / `smartdiscovery.visitor_id`) but these are NEW. No existing storage to migrate — the current `chat-shell.tsx` keeps history+saved in transient `useState` only. | Document key namespacing in stores/local-storage.ts code comments. No migration. |
| Live service config | **None.** No external services hold "chat-ui" config. | None. |
| OS-registered state | **None.** | None. |
| Secrets / env vars | **None.** `AI_GATEWAY_API_KEY`, `NEXT_PUBLIC_SHOPIFY_API_KEY` already set from earlier phases; Phase 5 doesn't add or rename any env var. | None. |
| Build artifacts | **One:** the static-grep guard test must run against the post-move tree. If a developer runs the move in a worktree and the test reads `lib/chat-ui/` files, ensure the test is run AFTER the move (not against a half-migrated tree). This is a test-ordering concern, not a build-artifact concern. | Verification gate runs `bun test lib/chat-ui/__tests__/barrel-isolation.test.ts` as the final check. |

**The canonical question:** After every file is moved, what runtime systems still have the old import paths cached?
- **Answer:** None at runtime. But the Next.js dev server's incremental compilation MAY hold stale module references — verification step is `rm -rf .next && bun build` to confirm clean compilation. Tests are sufficient under vitest because vitest re-resolves on every run.

## Common Pitfalls

### Pitfall 1: Calling `useChat({ api, headers, body })` directly (v5 pattern)

**What goes wrong:** TypeScript will accept extra properties on the options object loosely in some configurations, but the values will be silently ignored — the chat will hit the default `/api/chat` with no auth headers. The storefront would then call `/api/chat` (admin endpoint, expects Bearer) instead of `/api/proxy/chat`.

**Why it happens:** AI SDK 5.0 migrated to a transport-based architecture. Existing tutorials, blog posts, and even one of the AI SDK doc pages [CITED: ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat] still reference the old pattern. The current `chat.tsx:76` calls `useChat()` with no args, so this regression is only possible during Phase 5's wiring change.

**How to avoid:** Wire via `useChat({ transport: new DefaultChatTransport({ api, headers, body }) })`. The transport-based pattern is documented at [VERIFIED: node_modules/ai/dist/index.d.ts:3299-3343 + ai-sdk.dev/docs/ai-sdk-ui/transport].

**Warning signs:** Network tab shows POST to `/api/chat` without `Authorization` header; storefront drawer (Phase 6) gets 401 from admin endpoint.

### Pitfall 2: Stale-closure body when reading dynamic state inside the transport function

**What goes wrong:** If the StorefrontAdapter's `getRequestBody()` were to read from a React `useState` value through a closure, that value can go stale across renders. Cited by [vercel/ai#7819] and [vercel/ai#7463].

**Why it happens:** `DefaultChatTransport` is instantiated once (via `useMemo`); the functions inside it close over the initial render's state.

**How to avoid:** The Phase 5 adapters read from runtime globals (`shopify` for embedded, `localStorage` + `crypto` for storefront) — NOT from React state. The closure captures the adapter instance, not any React state, so this pitfall is structurally avoided. **Don't refactor the adapter to take React state as constructor args.** If a future need arises (e.g., chat session id from React state), use AI SDK's `prepareSendMessagesRequest` hook instead, which is called fresh on every send.

**Warning signs:** A header or body field appears to "freeze" to the value it had on first render even though the underlying source has changed.

### Pitfall 3: Adapter re-export leaks App Bridge into storefront bundle

**What goes wrong:** Adding `export * from './adapters/embedded'` to `lib/chat-ui/index.ts` would make the EmbeddedAdapter's runtime global reference part of the barrel's module graph. The storefront bundle would pull in `embedded.ts`, which references `shopify` (a runtime global typed by `@shopify/app-bridge-types` — typings are tree-shakable, but if any other transitive dep gets dragged in by the type augmentation, the bundle bloats).

**Why it happens:** "Convenience" instinct to re-export everything from a barrel.

**How to avoid:** D-04 is explicit — barrel exports the INTERFACE (`ChatIdentityAdapter`) and components only. Surface shells import the concrete adapter via sub-path: `import { EmbeddedAdapter } from '@/lib/chat-ui/adapters/embedded'`. Enforce with the static-grep guard test: scan `lib/chat-ui/index.ts` for any `from './adapters/'` and fail if present.

**Warning signs:** Storefront bundle size grows after Phase 5 lift (compare `bun build` output before/after).

### Pitfall 4: Tests not relocated lockstep with components

**What goes wrong:** `components/chat/__tests__/*.test.tsx` still references `@/components/chat/*` after the components move. Result: test imports fail, suite breaks.

**Why it happens:** Hard-cut D-11 requires moving 5 test files + 1 integration-test + lifting + updating imports in the SAME commit set.

**How to avoid:** Use a single migration script or planned multi-file commit. After the move, the importer grep gate (D-11) must return zero matches and the test suite must pass before merging.

**Warning signs:** `Cannot find module '@/components/chat/...'` in vitest output.

### Pitfall 5: SSR crash when localStorage is touched during server render

**What goes wrong:** `StorefrontAdapter.getRequestBody()` calls `window.localStorage`. If the adapter is instantiated server-side, render crashes.

**Why it happens:** Next.js server components can serialize props; if the adapter is constructed in an RSC, the constructor runs server-side.

**How to avoid:** All concrete adapter instantiation happens **client-side only**, inside the `'use client'` surface shell. The locked Phase 4 D-11 keeps `/chat/page.tsx` as RSC, so adapter creation must move into `app/(embedded)/chat/chat-shell.tsx` (which is `'use client'`). For Phase 6's storefront drawer, the drawer is mounted by a Theme App Extension JS bundle which is browser-only by definition.

**Warning signs:** `ReferenceError: window is not defined` during `bun build` or `bun dev` first-load.

### Pitfall 6: `aspect-ratio` / fixed-height regressions at storefront drawer width

**What goes wrong:** UI-SPEC §"Width / overflow constraint" calls out `max-w-md` on the user message bubble truncating at 360px. If executor lifts the file byte-for-byte and forgets the locked layout fix, the storefront drawer (Phase 6) will overflow.

**How to avoid:** UI-SPEC §"File Move Parity Rules" rule #5 explicitly requires replacing `max-w-md` with `max-w-[min(448px,100%)]` during the lift. Plan task explicitly references this fix.

**Warning signs:** A user message bubble extends past the drawer's right edge at the 360–420px viewport.

## Code Examples

### Adapter interface

```typescript
// lib/chat-ui/adapters/types.ts
// Source: D-03 (CONTEXT.md)
export interface ChatIdentityAdapter {
  endpoint: string;
  getAuthHeaders(): Promise<Record<string, string>>;
  getRequestBody(): Promise<Record<string, unknown>>;
}
```

### Store interfaces

```typescript
// lib/chat-ui/stores/types.ts
// Source: D-06 (CONTEXT.md)
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

export interface HistoryStore {
  list(): ChatHistoryItem[];
  add(entry: ChatHistoryItem): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export interface SavedProductsStore {
  list(): ChatProduct[];
  has(productId: string): boolean;
  toggle(product: ChatProduct): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}
```

### LocalStorage history store (sketch)

```typescript
// lib/chat-ui/stores/local-storage.ts
// Source: D-07
import type { ChatHistoryItem } from '@/types/product';
import type { HistoryStore } from './types';

const HISTORY_CAP = 10;

export class LocalStorageHistoryStore implements HistoryStore {
  private listeners = new Set<() => void>();
  private cache: ChatHistoryItem[] | null = null;

  constructor(private readonly scope: string) {}

  private get key() { return `smartdiscovery.history.${this.scope}`; }

  list(): ChatHistoryItem[] {
    if (this.cache) return this.cache;
    if (typeof window === 'undefined') return (this.cache = []);
    const raw = window.localStorage.getItem(this.key);
    this.cache = raw ? (JSON.parse(raw) as ChatHistoryItem[]) : [];
    return this.cache;
  }

  add(entry: ChatHistoryItem): void {
    const next = [entry, ...this.list()].slice(0, HISTORY_CAP);
    this.cache = next;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.key, JSON.stringify(next));
    }
    this.notify();
  }

  clear(): void {
    this.cache = [];
    if (typeof window !== 'undefined') window.localStorage.removeItem(this.key);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}
```

### Surface shell wiring (admin)

```typescript
// app/(embedded)/chat/chat-shell.tsx (NOT inside lib/chat-ui/)
// Source: synthesizes D-02, D-05, D-08, D-12
'use client';
import { useMemo, useState } from 'react';
import { ChatPane, HistoryPanel, SavedProductsPanel } from '@/lib/chat-ui';
import { EmbeddedAdapter } from '@/lib/chat-ui/adapters/embedded';
import { useHistoryStore, useSavedProductsStore } from '@/lib/chat-ui/stores/hooks';
// Tabs/Button/cn imports unchanged from current chat-shell.tsx

export function ChatShell({ shop }: { shop: string }) {
  const adapter = useMemo(() => new EmbeddedAdapter(), []);
  const history = useHistoryStore(shop);
  const saved = useSavedProductsStore(shop);

  const savedProductIds = useMemo(
    () => new Set(saved.items.map((p) => p.id)),
    [saved.items],
  );

  // ... <Tabs> render unchanged in structure; replace hex literals per D-12 ...
  // <ChatPane adapter={adapter} savedProductIds={savedProductIds} onToggleSave={saved.toggle} onHistoryAdd={history.add} />
  // <HistoryPanel items={history.items} onClear={history.clear} />
  // <SavedProductsPanel products={saved.items} onToggleSave={saved.toggle} />
}
```

### Static-grep guard test

```typescript
// lib/chat-ui/__tests__/barrel-isolation.test.ts
// Source: NEW (this research's recommended SHR-01 enforcement)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BARREL_ROOT = join(process.cwd(), 'lib/chat-ui');
const FORBIDDEN_IN_BARREL = [
  /from\s+['"]@shopify\//,
  /window\.shopify/,
  /window\.Shopify/,
  /\bshopify\.idToken\b/,    // permitted ONLY inside adapters/embedded.ts via runtime global
];

function* walkTs(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Adapters are exempt per D-04 (sub-path imports, NOT re-exported from barrel)
      if (full.endsWith('/adapters')) continue;
      // Tests don't ship in the bundle
      if (full.endsWith('/__tests__')) continue;
      yield* walkTs(full);
    } else if (/\.tsx?$/.test(name)) {
      yield full;
    }
  }
}

describe('lib/chat-ui barrel — Shopify SDK isolation (SHR-01)', () => {
  it('contains zero @shopify/* imports outside adapters/', () => {
    const offenders: string[] = [];
    for (const file of walkTs(BARREL_ROOT)) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_IN_BARREL) {
        if (pattern.test(src)) offenders.push(`${file} — matched ${pattern}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('barrel index.ts does NOT re-export adapters', () => {
    const src = readFileSync(join(BARREL_ROOT, 'index.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\/adapters\//);
  });
});
```

### Importer hard-cut guard (CI)

```bash
# Runs in verification gate
# Source: D-11
grep -rn '@/components/chat' app/ lib/ components/ && exit 1 || exit 0
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useChat({ api, headers, body })` direct config | `useChat({ transport: new DefaultChatTransport({ api, headers, body }) })` | AI SDK 5.0 (2025) | Hook-level config moved to transport class. `headers` and `body` accept `Resolvable<T>` — async functions are first-class. [VERIFIED: node_modules/ai/dist/index.d.ts] |
| Hand-rolled subscribe/forceUpdate loops for external stores | React 18 `useSyncExternalStore` | React 18 (2022) | Concurrent-mode safe, SSR-safe with 3rd arg. |
| LocalStorage cookies for browser identity | `localStorage` only (cookies blocked by App Proxy) | PROJECT.md decision | Storefront App Proxy strips `Set-Cookie`; `localStorage` is the only viable client-side identity store. |
| Hex literals inline in className | Tailwind arbitrary-value classes (`bg-[#008060]`) | Tailwind 3+ standard | Discoverable via grep, but still brand-specific. Phase 5 D-12 codifies this for the lifted shell. |

**Deprecated/outdated:**
- `useChat({ api, headers, body })` direct fields — gone in v6 ChatInit; the typings do not declare them.
- `components/chat/` location — moved to `lib/chat-ui/` (hard cut, D-11).
- `MOCK_PRODUCTS` — already removed in Phase 4 (EMB-07 SC #3).

## Assumptions Log

| # | Claim | Section | Risk if Wrong | Resolution Status |
|---|-------|---------|---------------|-------------------|
| A1 | `useChat({ transport: new DefaultChatTransport({ headers: () => Promise<...>, body: () => Promise<...> }) })` works natively in AI SDK 6.0.77 | Patterns §1, Pitfall 1 | If wrong, would need a custom `useChatWithAdapter` wrapper hook | **RESOLVED — VERIFIED.** `Resolvable<T> = MaybePromiseLike<T> \| (() => MaybePromiseLike<T>)` per `node_modules/@ai-sdk/provider-utils/dist/index.d.ts`. `HttpChatTransportInitOptions.headers/body` typed `Resolvable<...>` per `node_modules/ai/dist/index.d.ts:3528, 3541`. |
| A2 | Phase 6's `/api/proxy/chat` will accept `visitor_id` in the request body per the documented contract | StorefrontAdapter pattern, D-05 | If Phase 6 changes the field name, Phase 5's adapter ships to a stale contract | **DEFERRED — confirms in Phase 6.** Phase 5 ships unit-tested round-trip via mocked localStorage; Phase 6 verifies end-to-end. The `/api/proxy/chat` route is currently a 501 stub (verified at `app/api/proxy/chat/route.ts:47-56`). |
| A3 | LocalStorage-only visitor identity is acceptable for V1 storefront (no GDPR consent UI in Phase 5) | StorefrontAdapter | If GDPR consent is required, the adapter cannot persist before opt-in | **RESOLVED — locked by PROJECT.md** (localStorage NOT cookies; no consent UI in V1). |
| A4 | All hex literals in `chat-shell.tsx` map cleanly to Tailwind arbitrary-value classes; no `tailwind.config` extension needed | D-12 cleanup | If a hex has no clean class, planner extends config (one extra task) | **RESOLVED — VERIFIED.** UI-SPEC §"Polaris hex-literal → Tailwind mapping" provides the authoritative table. All 6 hex values use arbitrary-value classes (`bg-[#...]`/`text-[#...]`/`border-[#...]`); no config extension. |
| A5 | `Chat` is currently a default export (`export default function Chat`); the planner is free to rename + switch to named export `ChatPane` | Migration order, Recommended Outline | Rename ripple-effect risk: integration test, chat-shell.tsx, page.tsx all reference the default export | **RESOLVED — VERIFIED.** `components/chat/chat.tsx:75` is `export default function Chat(...)`. Three importers: `chat-shell.tsx:4` (default), `chat.integration-test.tsx:3` (default), `__tests__/chat-shell.test.tsx:31` (mocks the module's default). All updated lockstep in the hard cut. |
| A6 | `shopify` runtime global is available wherever `EmbeddedAdapter.getAuthHeaders()` is called | EmbeddedAdapter pattern | If called server-side or outside the embedded surface, throws ReferenceError | **RESOLVED.** EmbeddedAdapter is instantiated in `'use client'` surface shell only; the embedded layout (`app/(embedded)/layout.tsx:13-22`) loads `app-bridge.js` with `strategy="beforeInteractive"`, so the global is present before any client component renders. |

**Items that need user confirmation:** A2 is the only deferred item; it's locked by Phase 6 scope, not Phase 5.

## Open Questions

1. **Should `MessageParts` and `EmptyState` be in the barrel `index.ts` exports?**
   - **What we know:** UI-SPEC and CONTEXT.md list both as lifted components. `EmptyState` is consumed externally by `HistoryPanel` and `SavedProductsPanel`. `MessageParts` is consumed only by `ChatMessage` internally.
   - **What's unclear:** Whether external consumers will want to import either directly. Surface shells need `EmptyState` for any custom panels they build (e.g., a future "Compare" tab). `MessageParts` is more of an implementation detail.
   - **Recommendation:** Export `EmptyState` from the barrel (so future surface shells can reuse it). Do NOT export `MessageParts` from the barrel — keep it as an internal implementation of `ChatMessage`. The ROADMAP success criteria mention 5 named exports + `EmptyState` falls under the same category. (Plan can revisit.)

2. **Should `useHistoryStore` / `useSavedProductsStore` accept a `store` instance instead of just a `scope` string, to enable Phase 8 DB-backed swap?**
   - **What we know:** D-09 says the swap point is the store interface; Phase 8 will introduce `DbBackedHistoryStore`.
   - **What's unclear:** Whether the hook should pick the impl internally (env-driven? prop-driven?) or be replaced wholesale in Phase 8.
   - **Recommendation:** Phase 5 ships the hooks hard-coded to `LocalStorage*Store`. Phase 8 either (a) adds a `store?: HistoryStore` override param, or (b) introduces a new hook variant. Both are non-breaking. **Do not over-engineer Phase 5.**

3. **Does the integration test `chat.integration-test.tsx` need to be relocated to `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` or kept at the import site?**
   - **What we know:** D-11 says tests relocate to `lib/chat-ui/__tests__/`. The integration test verifies prop-driven behavior of the inner conversation component.
   - **Recommendation:** Relocate per D-11. Rename to `chat-pane.integration-test.tsx` and update the mocked import to `@/lib/chat-ui` (or whatever path the new ChatPane lives at). The existing `vi.mock('@ai-sdk/react', ...)` pattern is preserved as-is.

## Environment Availability

> Phase 5 is a refactor with no new external dependencies. The audit is trivial — included for completeness.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | All commands per CLAUDE.md | ✓ | 1.2.4 | — |
| `node` | dev runtime | ✓ | 25.9.0 | — |
| `vitest` | test runs | ✓ | 4.1.5 (via package.json) | — |
| `crypto.randomUUID` (browser) | StorefrontAdapter visitor_id generation | ✓ (all evergreen browsers + jsdom 29 in tests) | — | None needed |
| `localStorage` (browser) | StorefrontAdapter + LocalStorage*Store | ✓ (jsdom in tests; SSR guard in code) | — | SSR returns empty/no-op |
| `shopify` runtime global (App Bridge) | EmbeddedAdapter | ✓ (loaded by `app/(embedded)/layout.tsx` `beforeInteractive`) | App Bridge JS (CDN) | None — embedded surface only |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 (jsdom environment, globals enabled) |
| Config file | `vitest.config.ts` (resolves `@/` to repo root, includes `**/*.{test,spec}.?(c\|m)[jt]s?(x)` and `**/*.integration-test.?(c\|m)[jt]s?(x)`) |
| Quick run command | `bunx vitest run lib/chat-ui/__tests__/` (after the move) |
| Full suite command | `bun test` |
| Phase gate | Full suite green + `grep -rn '@/components/chat' app/ lib/ components/` returns zero matches + `bun lint` clean + `bun build` succeeds |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHR-01 | Barrel has zero `@shopify/*`, `window.shopify`, App Bridge imports | static-grep guard | `bunx vitest run lib/chat-ui/__tests__/barrel-isolation.test.ts` | ❌ Wave 0 (NEW) |
| SHR-01 | Barrel `index.ts` does NOT re-export adapters | static-grep guard | (same file as above) | ❌ Wave 0 (NEW) |
| SHR-01 | `MessageParts`, `ChatMessage`, `ProductCard` render without Shopify chrome | rendering test | `bunx vitest run lib/chat-ui/__tests__/{message-parts,chat-message,product-card}.test.tsx` | ✅ lifted + relocated from `components/chat/__tests__/` |
| SHR-02 | `ChatIdentityAdapter` interface satisfied by both concrete adapters | type-check + unit | `bunx vitest run lib/chat-ui/__tests__/embedded-adapter.test.ts lib/chat-ui/__tests__/storefront-adapter.test.ts` | ❌ Wave 0 (NEW) |
| SHR-02 | `ChatPane` constructs `DefaultChatTransport` with adapter values; passes them to `useChat` | integration test | `bunx vitest run lib/chat-ui/__tests__/chat-pane.integration-test.tsx` | ✅ relocated from `components/chat/chat.integration-test.tsx` + updated |
| SHR-03 | `EmbeddedAdapter` reads `shopify.idToken()` and returns Bearer header | unit (mock global) | `bunx vitest run lib/chat-ui/__tests__/embedded-adapter.test.ts` | ❌ Wave 0 (NEW) |
| SHR-03 | `StorefrontAdapter` reads/persists `visitor_id` via `localStorage`+ `crypto.randomUUID` | unit (mock localStorage + crypto) | `bunx vitest run lib/chat-ui/__tests__/storefront-adapter.test.ts` | ❌ Wave 0 (NEW) |
| SHR-04 | Admin `chat-shell.tsx` imports `ChatPane`, `HistoryPanel`, `SavedProductsPanel` from `@/lib/chat-ui` and nothing from `@/components/chat/*` | integration + grep | `bunx vitest run app/(embedded)/chat/__tests__/chat-shell.test.tsx` + grep gate | ✅ relocated (chat-shell.test.tsx lives under app dir now) |
| All | TS strict-mode build passes, no `any` in barrel or adapters | type-check | `bun build` + `grep -rn "\\bany\\b\|as any" lib/chat-ui/` (manual review of grep output) | ❌ Wave 0 (NEW grep script) |
| All | LocalStorage round-trip for history + saved stores | unit | `bunx vitest run lib/chat-ui/__tests__/local-storage-stores.test.ts` | ❌ Wave 0 (NEW) |
| UI parity | Hex-literal map applied to `chat-shell.tsx` | visual / grep | `grep -E '#(008060\|e1e3e5\|6d7175\|202223\|f6f6f7\|f1f2f4)' app/\(embedded\)/chat/chat-shell.tsx` returns only Tailwind-class hits (no bare CSS values outside class names) | manual verification |

### Sampling Rate

- **Per task commit:** `bunx vitest run lib/chat-ui/__tests__/` (the lift's test subtree)
- **Per wave merge:** `bun test` (full vitest suite)
- **Phase gate:** Full suite green + `bun build` clean + `bun lint` clean + the importer grep gate returns zero matches

### Wave 0 Gaps

- [ ] `lib/chat-ui/__tests__/barrel-isolation.test.ts` — static-grep guard for SHR-01 (NEW)
- [ ] `lib/chat-ui/__tests__/embedded-adapter.test.ts` — covers SHR-02, SHR-03 (NEW; mocks `shopify` global)
- [ ] `lib/chat-ui/__tests__/storefront-adapter.test.ts` — covers SHR-02, SHR-03 (NEW; mocks `localStorage` + `crypto.randomUUID`)
- [ ] `lib/chat-ui/__tests__/local-storage-stores.test.ts` — covers D-07 store round-trip (NEW)
- [ ] `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` — relocated + updated from `components/chat/chat.integration-test.tsx`; covers adapter→transport→useChat plumbing
- [ ] All 5 existing component tests relocated under `lib/chat-ui/__tests__/` with imports updated to `@/lib/chat-ui/components/*`

*(Framework install: none — vitest already configured.)*

## Security Domain

> `security_enforcement: true` and `security_asvs_level: 1` per `.planning/config.json`. Phase 5 is a UI refactor with no new server endpoints, but the adapter contract touches identity and auth, so security review is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (Bearer token handling in EmbeddedAdapter) | Token sourced from App Bridge's `shopify.idToken()` — already trusted in Phase 1 D-09; Bearer header construction is mechanical concatenation, no manual JWT signing. |
| V3 Session Management | yes (visitor_id lifecycle in StorefrontAdapter) | UUID v4 from `crypto.randomUUID()` (CSPRNG, RFC 4122). Stored in `localStorage` per PROJECT.md decision (App Proxy strips cookies). Visitor_id rotates only on storage clear — acceptable for anonymous bookmark use case. |
| V4 Access Control | no (Phase 5 does not change route auth) | Existing `withShopifySession` wrapper on `/api/chat` (Phase 1 D-09) and Phase 6's planned HMAC validation on `/api/proxy/chat` remain unchanged. |
| V5 Input Validation | no (Phase 5 does not change request schemas) | `/api/chat` already validates the tool's `inputSchema` via zod (Phase 4 D-05). Phase 5 only injects body fields; their server-side validation is owned by the route. |
| V6 Cryptography | yes (visitor_id generation) | `crypto.randomUUID()` — Web Crypto API, never hand-rolled. |
| V7 Error Handling | yes (token retrieval failure path) | EmbeddedAdapter must not throw a token-leaking error. The `shopify.idToken()` API can throw; wrap as a generic error that does NOT include the token in any message. |
| V8 Data Protection | yes (no PII in localStorage beyond visitor_id) | `smartdiscovery.history.{scope}` stores query strings (low-sensitivity); `smartdiscovery.saved.{scope}` stores product IDs (public catalog data). No PII. Visitor_id is opaque UUID. |
| V10 Configuration | no | No env var changes. |
| V13 API and Web Service | partially (header injection contract) | The adapter is a CLIENT-side header injection point. Server-side trust boundary remains the existing `verifyShopSessionToken` (admin) and Phase 6 HMAC validation (storefront). |
| V14 Build and Deploy | yes (CLAUDE.md "no secrets in logs" lock) | All chat-ui code must remain log-free for auth/tokens. EmbeddedAdapter MUST NOT log the Bearer token or the resolved header object. |

### Known Threat Patterns for {React + Vercel AI SDK + App Bridge}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bearer token leak in browser console / error message | Information Disclosure | Zero `console.log` in adapters (CLAUDE.md "no secrets in logs"). Wrap `shopify.idToken()` errors as `new Error('Could not authenticate request')` with no token in message. |
| Cross-tenant data bleed via shared LocalStorage when shop switches in embedded admin | Information Disclosure | Storage key namespacing `smartdiscovery.history.{shop}` per D-07 — different shops get different keys; UI-spec lock prevents shop-less keys. **Action: planner adds an "explicit scope arg, never default" test for `useHistoryStore` / `useSavedProductsStore` (constructing with empty-string scope must throw or be defended against).** |
| XSS via product description / query in history panel | Tampering | Product fields rendered via React text interpolation (auto-escapes). No `dangerouslySetInnerHTML` in lifted code (verified by grep). |
| visitor_id forgery (storefront user crafts arbitrary visitor_id to hijack another visitor's history) | Spoofing | Phase 5: out-of-scope (StorefrontAdapter sends visitor_id but Phase 5's `/api/proxy/chat` is a 501 stub). Phase 6 owns the HMAC validation that proves the request came through the storefront, BUT visitor_id itself is unforgeable only as a function of "shop + visitor_id" — Phase 6's persistence layer must lock to (shop, visitor_id) compound key. **Note for Phase 6:** No multi-tenant guarantee here at the adapter layer — that's a server-side concern. |
| Adapter caching auth header beyond its TTL | Repudiation | `shopify.idToken()` returns a short-lived JWT (~1 min TTL per App Bridge spec). EmbeddedAdapter calls it fresh on EVERY `getAuthHeaders()` invocation (no caching) — verified by code pattern (no module-level cache). |
| LocalStorage tampering by hostile theme code on storefront | Tampering | Phase 5 acknowledges this is a known V1 limitation (PROJECT.md). Mitigation is server-side: `/api/proxy/chat` validates HMAC, so a forged visitor_id can only see THAT visitor's history. Phase 6 enforces. |

**Phase 5 security checklist (for plan-checker):**

- [ ] No `console.log` / `console.warn` / `console.error` in `lib/chat-ui/adapters/*.ts`
- [ ] Token never appears in error messages thrown from `getAuthHeaders()`
- [ ] LocalStorage keys ALWAYS include the scope arg (never bare keys like `smartdiscovery.history`)
- [ ] No `dangerouslySetInnerHTML` introduced in lifted components
- [ ] Static-grep guard test catches accidental Shopify SDK imports
- [ ] `Resolvable` async functions in `DefaultChatTransport` MUST not cache auth headers across calls

## Project Constraints (from CLAUDE.md)

| Constraint | Enforcement in Phase 5 |
|------------|------------------------|
| **bun only** — never npm/pnpm/yarn | All commands in plan use `bun` / `bunx`. No `npm install`, `npm test`, etc. |
| **Next.js 16 App Router + TS strict** | Locked in tsconfig. `lib/chat-ui/` builds under strict; no `any` casts permitted in barrel or adapters per SC #4. |
| **Vercel AI Gateway sole runtime entry for chat/embeddings** | No change — `lib/chat-ui/` does not touch the API layer. The transport just hits the existing `/api/chat` or `/api/proxy/chat` route. |
| **Tailwind 4 + shadcn primitives** | All styling stays Tailwind. D-12 cleanup uses arbitrary-value classes per UI-SPEC. |
| **No secrets in logs** | EmbeddedAdapter has zero `console.*` calls. Static review during code review. |
| **No multi-tenant data leaks** | LocalStorage key namespacing (D-07) is the Phase 5 contribution; server-side enforcement remains in API routes. |
| **Anonymous visitor identity via localStorage `visitor_id` (NOT cookies)** | StorefrontAdapter complies (D-05). |
| **Re-enable middleware before drawer launch** | Out of scope for Phase 5 (middleware is owned by `proxy.ts`, completed in Phase 1). |
| **No theme-file edits required from merchant** | Out of scope — storefront drawer is Phase 6. |

## Recommended Implementation Outline

The lift is mechanical. Sequence chosen to minimize "half-migrated" intermediate states.

### Wave 0 — Test scaffolds + relocation prep (red)

1. Create `lib/chat-ui/__tests__/` directory with 4 NEW test files (failing):
   - `barrel-isolation.test.ts` (fails: barrel does not exist yet)
   - `embedded-adapter.test.ts` (fails: adapter does not exist)
   - `storefront-adapter.test.ts` (fails: adapter does not exist)
   - `local-storage-stores.test.ts` (fails: stores do not exist)
2. **Do NOT move existing component tests yet.** They stay green at their current paths through Wave 0.

### Wave 1 — Create `lib/chat-ui/` structure (greenfield)

1. Create `lib/chat-ui/adapters/types.ts` — `ChatIdentityAdapter` interface.
2. Create `lib/chat-ui/adapters/embedded.ts` — `EmbeddedAdapter` class (uses runtime global; no `@shopify/*` import statements).
3. Create `lib/chat-ui/adapters/storefront.ts` — `StorefrontAdapter` class.
4. Create `lib/chat-ui/stores/types.ts` — store interfaces.
5. Create `lib/chat-ui/stores/local-storage.ts` — LocalStorage implementations.
6. Create `lib/chat-ui/stores/hooks.ts` — `useSyncExternalStore`-backed hooks.
7. Wave 0 tests for adapters + stores go green. Static-grep guard still fails (barrel index.ts doesn't exist yet).

### Wave 2 — Move components + create barrel

1. Move 7 component files: `chat.tsx → components/chat-pane.tsx` (renamed + named export + wires transport per Pattern 1) + the 6 others (`chat-message`, `product-card`, `history-panel`, `saved-products-panel`, `empty-state`, `message-parts`) to `lib/chat-ui/components/`.
2. Apply UI-SPEC "File Move Parity Rules": `max-w-md` → `max-w-[min(448px,100%)]` on user message bubble; remove `h-[calc(100vh-100px)]` / `h-[calc(100%-180px)]` from ChatPane (they move to the surface shell).
3. Create `lib/chat-ui/index.ts` barrel — exports components + `EmptyState` + interfaces + store hooks. **Does NOT re-export adapters.**
4. Update intra-tree imports inside `lib/chat-ui/components/*.tsx` (e.g., `@/components/chat/empty-state` → `../components/empty-state` or via the barrel).
5. Static-grep guard goes green.

### Wave 3 — Importer hard cut

1. Move `components/chat/__tests__/*.tsx` to `lib/chat-ui/__tests__/` and update imports.
2. Move `components/chat/chat.integration-test.tsx` to `lib/chat-ui/__tests__/chat-pane.integration-test.tsx`, update imports + the `vi.mock('@ai-sdk/react', ...)` test still works.
3. Move `components/chat/__tests__/chat-shell.test.tsx` to `app/(embedded)/chat/__tests__/chat-shell.test.tsx` and update imports.
4. Create new `app/(embedded)/chat/chat-shell.tsx` (the surface shell with EmbeddedAdapter, store hooks, D-12 hex cleanup, surface-specific height classes).
5. Delete the old `components/chat/chat-shell.tsx`.
6. Update `app/(embedded)/chat/page.tsx` to import the new shell location.
7. Update `app/prototype/prototype-data.ts` comment (uncomment is irrelevant — it's a dead comment referring to `MOCK_PRODUCTS` which was deleted in Phase 4).
8. Delete the now-empty `components/chat/` directory and `components/chat/__tests__/`.
9. **Run grep gate:** `grep -rn '@/components/chat' app/ lib/ components/` returns zero.

### Wave 4 — Verification gate

1. `bun test` — full suite green.
2. `bun lint` — clean.
3. `bun build` — clean (proves TS strict + no `any` casts blow the build).
4. Manual review: `grep -rn '\bany\b\|as any' lib/chat-ui/ | grep -v '\.test\.\|integration-test'` — should return zero hits in barrel/adapters (test files MAY contain controlled `as never` casts as in current `chat.integration-test.tsx:98`).
5. Manual smoke (best-effort behind Phase 4's OAuth blocker): `bun dev` → `/chat` renders pixel-identically to pre-lift.
6. Update STATE.md + ROADMAP.md SHR-01..04 markers.

### Risk Map (low / medium / high)

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| `useChat` transport wiring fails type-check | LOW | LOW | Typings verified against `node_modules/ai/dist/index.d.ts`. |
| Integration test's mocked `useChat` becomes incompatible with transport-prop signature | LOW | MEDIUM | Test mocks `@ai-sdk/react` module wholesale — transport details are irrelevant inside the mock. Update mock if needed but no API rewrite. |
| `chat-shell.test.tsx` mock path breaks (currently `vi.mock('@/components/chat/chat')`) | LOW | HIGH | Plan task explicitly relocates this test and updates the mock path to the new ChatPane location. |
| Pixel drift on embedded `/chat` after lift | LOW | LOW | UI-SPEC "File Move Parity Rules" enumerates the ONE permitted change (hex map); everything else is byte-identical lift. |
| Storefront-bundle leak (App Bridge transitively pulled in) | LOW | LOW | D-04 sub-path imports + static-grep guard verifies no `from './adapters/'` in barrel. |
| Stale-closure bug in transport body (Pitfall 2) | LOW | LOW | Adapters read from runtime globals, not React state. Structurally avoided. |
| Half-migrated state (some importers still on `@/components/chat/*`) | MEDIUM | MEDIUM | Hard-cut sequence + grep gate enforces. Wave 3 is "all importers in one commit." |
| TS strict catches an `any` in `chat.tsx` that wasn't surfaced before | LOW | LOW | grep confirmed zero `any` in current `components/chat/*.tsx` (only the test file uses `as never`, which is acceptable in tests). |

## Sources

### Primary (HIGH confidence)

- **`node_modules/ai/dist/index.d.ts:3299-3577`** — `ChatInit`, `HttpChatTransportInitOptions`, `DefaultChatTransport` source-of-truth typings [VERIFIED via direct file read]
- **`node_modules/@ai-sdk/react/dist/index.d.ts:26-39`** — `UseChatOptions`, `useChat` signature [VERIFIED via direct file read]
- **`node_modules/@ai-sdk/provider-utils/dist/index.d.ts`** — `Resolvable<T>` type definition [VERIFIED via direct file read]
- **`components/chat/*.tsx` + `components/ai-elements/*.tsx`** — grep evidence that ZERO `@shopify/*` imports exist today [VERIFIED via grep]
- **`.planning/phases/05-shared-chat-ui-extraction/05-CONTEXT.md`** — All D-01..D-12 locked decisions
- **`.planning/phases/05-shared-chat-ui-extraction/05-UI-SPEC.md`** — Visual parity contract + hex-literal map
- **`.planning/REQUIREMENTS.md`** — SHR-01..04 IDs
- **`CLAUDE.md`** — Project-locked tech stack and bun-only convention

### Secondary (MEDIUM confidence)

- [AI SDK UI: Transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport) — `DefaultChatTransport` usage examples (resolvable functions, `prepareSendMessagesRequest`) — verified against `node_modules` typings
- [AI SDK UI: useChat reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) — note: this page also lists `api/headers/body` as direct options, which the typings DO NOT confirm. Treat the typings as authoritative.
- [Troubleshooting: Custom headers, body, and credentials not working with useChat](https://ai-sdk.dev/docs/troubleshooting/use-chat-custom-request-options) — confirms request-level vs hook-level patterns

### Tertiary (LOW confidence — flagged for awareness, not used as primary evidence)

- [vercel/ai#7819](https://github.com/vercel/ai/issues/7819) — known stale-state issue with transport `body`
- [vercel/ai#7463](https://github.com/vercel/ai/issues/7463) — useChat not reacting to transport changes after initialization
- [vercel/ai#7109](https://github.com/vercel/ai/issues/7109) — body does not update before sendMessage

(These open issues do not affect Phase 5 because adapters read runtime globals, not React state — the closure capture problem doesn't apply.)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — typings directly verified in `node_modules`, no new packages installed
- Architecture: HIGH — patterns mechanically derived from CONTEXT.md D-01..D-12 locks
- Pitfalls: HIGH — pitfalls 1+2 backed by AI SDK GitHub issues + typings; the rest are well-known React/Next patterns
- Adapter shape resolved: HIGH — `Resolvable<T>` typing closes Assumption A-01 definitively
- Security: HIGH — no new server endpoints; client-side identity controls match PROJECT.md + CLAUDE.md
- UI parity: HIGH — UI-SPEC §"File Move Parity Rules" is the locked contract

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days; the AI SDK is moving fast, but `HttpChatTransportInitOptions` is a stable API across 6.0.x patches)
