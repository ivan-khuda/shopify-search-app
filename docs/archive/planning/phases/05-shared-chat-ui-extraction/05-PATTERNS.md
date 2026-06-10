# Phase 5: Shared Chat-UI Extraction — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 22 (7 component lifts, 5 component-test lifts, 1 integration-test lift, 1 new surface shell, 3 new adapters, 3 new store files, 1 new barrel, 4 new tests, 2 importer-updates)
**Analogs found:** 18 / 22 (4 are net-new with no exact analog — adapter pattern + store hook pattern + static-grep guard test; see "No Analog Found" section)

This phase is a **mechanical extraction refactor**. For every lifted file the "closest analog" is the **current file itself at the legacy `components/chat/` path** — the planner's job is to instruct the executor to copy that file verbatim (byte-for-byte) into `lib/chat-ui/components/`, applying only the two UI-SPEC-locked changes (D-12 hex literals + `max-w-md` widening). Net-new files (adapters, stores, barrel) have analogs in the wider codebase (App Bridge onboarding pattern, lib/db repository pattern, lib/inngest interface pattern) and the verified AI SDK v6 typings.

---

## File Classification

### Wave 0 — Test scaffolds (red phase; new tests only)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/chat-ui/__tests__/barrel-isolation.test.ts` | test (static-grep guard) | filesystem-read → assertion | `lib/db/__tests__/hnsw.test.ts` (vitest convention only) | partial — no existing static-grep test |
| `lib/chat-ui/__tests__/embedded-adapter.test.ts` | test (unit, mock global) | mocked global → assertion | `components/chat/__tests__/product-card.test.tsx` (vitest patterns) | partial — no existing global-mock unit test |
| `lib/chat-ui/__tests__/storefront-adapter.test.ts` | test (unit, mock localStorage + crypto) | mocked browser API → assertion | none — net-new pattern | no analog |
| `lib/chat-ui/__tests__/local-storage-stores.test.ts` | test (unit, store round-trip) | localStorage mock → store mutation → assertion | none — net-new pattern | no analog |

### Wave 1 — `lib/chat-ui/adapters/` + `lib/chat-ui/stores/` (new code)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/chat-ui/adapters/types.ts` | type-only interface | none (declaration) | `lib/db/repositories/ProductRepository.ts` (interface-style class export) | role-match |
| `lib/chat-ui/adapters/embedded.ts` | adapter (class) | runtime global (`shopify.idToken()`) → Bearer header | `app/(embedded)/onboarding/page.tsx:36,68` (handleStartSync) | exact (App Bridge call pattern) |
| `lib/chat-ui/adapters/storefront.ts` | adapter (class) | localStorage R/W + `crypto.randomUUID` → body field | none — net-new (no existing localStorage adapter) | no analog (interface from CONTEXT D-05) |
| `lib/chat-ui/stores/types.ts` | type-only interfaces | none (declaration) | `lib/db/repositories/ProductRepository.ts` (interface boundary) | role-match |
| `lib/chat-ui/stores/local-storage.ts` | store (class) | localStorage R/W + observer notify | none — net-new | partial (LocalStorageHistoryStore sketch in RESEARCH §"LocalStorage history store") |
| `lib/chat-ui/stores/hooks.ts` | React hook (useSyncExternalStore wrapper) | store.subscribe → hook re-render | RESEARCH §"Pattern 4" (`useSyncExternalStore`) | exact (verified pattern in research) |

### Wave 2 — Component lifts (byte-for-byte copy + 2 locked changes)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/chat-ui/components/chat-pane.tsx` | component (transport wiring) | adapter → transport → `useChat` → UI | `components/chat/chat.tsx` (renamed + transport-wired + named export) | exact (90% of the file is copy-paste; transport wiring per RESEARCH §"Pattern 1") |
| `lib/chat-ui/components/chat-message.tsx` | component (pure) | props → MessageParts | `components/chat/chat-message.tsx` | exact (byte-for-byte) |
| `lib/chat-ui/components/product-card.tsx` | component (pure) | props → next/image + button | `components/chat/product-card.tsx` | exact (byte-for-byte) |
| `lib/chat-ui/components/history-panel.tsx` | component (pure) | props → list + EmptyState | `components/chat/history-panel.tsx` | exact (byte-for-byte; intra-tree import path updates only) |
| `lib/chat-ui/components/saved-products-panel.tsx` | component (pure) | props → grid + EmptyState | `components/chat/saved-products-panel.tsx` | exact (byte-for-byte; intra-tree import path updates only) |
| `lib/chat-ui/components/empty-state.tsx` | component (pure) | props → static layout | `components/chat/empty-state.tsx` | exact (byte-for-byte) |
| `lib/chat-ui/components/message-parts.tsx` | component (discriminated-union render) | UIMessage parts → ProductCard / status / error | `components/chat/message-parts.tsx` | exact (byte-for-byte; intra-tree import path updates only) |
| `lib/chat-ui/index.ts` | barrel (re-exports) | named exports of components + interfaces + hooks | none (no existing barrel in `lib/`) | no analog (mechanical re-export list per RESEARCH §"Recommended Project Structure") |

### Wave 3 — Importer hard cut + surface shell rebuild

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/(embedded)/chat/chat-shell.tsx` | surface shell (client) | EmbeddedAdapter + store hooks → ChatPane props | `components/chat/chat-shell.tsx` (current; lift + adapter wiring + D-12 hex cleanup) | exact (90% copy; replace `useState` with store hooks, instantiate `EmbeddedAdapter`, swap hex literals) |
| `app/(embedded)/chat/page.tsx` | RSC (existing, modified) | banner + ChatShell | `app/(embedded)/chat/page.tsx` (current) | exact (import path update only: `@/components/chat/chat-shell` → `./chat-shell`) |
| `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` | integration test (relocated) | mocked `useChat` → render Chat | `components/chat/chat.integration-test.tsx` (relocate + rename + import update) | exact (relocate + update `Chat` → `ChatPane` named-import) |
| `lib/chat-ui/__tests__/chat-message.test.tsx` | (does not exist today — no current test) | — | — | — (skip; chat-message has no test today) |
| `lib/chat-ui/__tests__/product-card.test.tsx` | unit test (relocated) | render + click → onSave assertion | `components/chat/__tests__/product-card.test.tsx` | exact (relocate; update import to `@/lib/chat-ui/components/product-card`) |
| `lib/chat-ui/__tests__/history-panel.test.tsx` | unit test (relocated) | render → assertion | `components/chat/__tests__/history-panel.test.tsx` | exact (relocate + import update) |
| `lib/chat-ui/__tests__/saved-products-panel.test.tsx` | unit test (relocated) | render + click → onToggleSave assertion | `components/chat/__tests__/saved-products-panel.test.tsx` | exact (relocate + import update) |
| `lib/chat-ui/__tests__/message-parts.test.tsx` | unit test (relocated) | render parts → role/aria assertions | `components/chat/__tests__/message-parts.test.tsx` | exact (relocate + import update) |
| `app/(embedded)/chat/__tests__/chat-shell.test.tsx` | unit test (relocated) | mocked Chat → tab state assertion | `components/chat/__tests__/chat-shell.test.tsx` (relocate + update `vi.mock` path) | exact (relocate + update `vi.mock('@/components/chat/chat')` → `vi.mock('@/lib/chat-ui')` keyed on `ChatPane` named export) |
| `app/(embedded)/chat/__tests__/page.test.tsx` | unit test (modified) | already exists | `app/(embedded)/chat/__tests__/page.test.tsx:26` (existing) | exact (single-line edit: `vi.mock('@/components/chat/chat-shell', ...)` → `vi.mock('./chat-shell', ...)` or stay `@/...` with new path) |
| `app/prototype/prototype-data.ts` | comment cleanup | n/a | `app/prototype/prototype-data.ts:1` | exact (delete the dead `// import { MOCK_PRODUCTS } from '@/components/chat/mock-products';` comment — Phase 4 already deleted the module) |

---

## Pattern Assignments

### `lib/chat-ui/adapters/types.ts` (interface)

**Analog:** none in codebase. Source-of-truth is CONTEXT.md D-03 + RESEARCH §"Adapter interface".

**Copy verbatim:**
```typescript
// lib/chat-ui/adapters/types.ts
export interface ChatIdentityAdapter {
  endpoint: string;
  getAuthHeaders(): Promise<Record<string, string>>;
  getRequestBody(): Promise<Record<string, unknown>>;
}
```

**Rules:**
- No `any`. No `as` casts. (SC #4)
- File must contain **only** the interface declaration — no implementations, no helpers. This keeps the type-only re-export from the barrel clean.

---

### `lib/chat-ui/adapters/embedded.ts` (adapter, request-response)

**Analog:** `app/(embedded)/onboarding/page.tsx` (App Bridge `shopify.idToken()` pattern)

**Auth pattern** (`app/(embedded)/onboarding/page.tsx:36-40`):
```typescript
const token = await shopify.idToken();
const res = await fetch('/api/shopify/sync', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
```

**Apply to EmbeddedAdapter** (synthesized — copy the runtime-global usage, drop the fetch since adapter only returns headers):
```typescript
// lib/chat-ui/adapters/embedded.ts
// MUST contain ZERO `import ... from '@shopify/*'` statements.
// The `shopify` runtime global is loaded by app/(embedded)/layout.tsx's
// <Script src=".../app-bridge.js" strategy="beforeInteractive">, typed by
// @shopify/app-bridge-types (type-only — surfaced via types/shopify-global.d.ts).
import type { ChatIdentityAdapter } from './types';

export class EmbeddedAdapter implements ChatIdentityAdapter {
  readonly endpoint = '/api/chat';

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await shopify.idToken();
    return { Authorization: `Bearer ${token}` };
  }

  async getRequestBody(): Promise<Record<string, unknown>> {
    return {};
  }
}
```

**Critical rules** (security review §V7, §V14):
- Zero `console.log`/`console.warn`/`console.error` — never log the token.
- If `shopify.idToken()` throws, do NOT include the token, headers, or any other auth detail in the rethrown error message. The adapter may let the original error propagate (callers handle it), but MUST NOT wrap it with token-leaking context.
- Never cache the resolved header across invocations — `getAuthHeaders()` is called by `DefaultChatTransport` on every `sendMessage`; the JWT is short-lived (~1 min TTL).

---

### `lib/chat-ui/adapters/storefront.ts` (adapter, request-response)

**Analog:** none — net-new pattern. Source-of-truth is CONTEXT.md D-05 + RESEARCH §"Pattern 3".

**Copy verbatim from RESEARCH §"Pattern 3"** (the file body is exactly this — no other code):
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

**Critical rules:**
- `STORAGE_KEY` is **NOT** scope-prefixed (visitor_id is global — one visitor across all shops they browse on this hosting). This is different from history/saved storage keys (D-07) which DO carry scope.
- SSR-safe via `typeof window === 'undefined'` guard.
- `crypto.randomUUID()` is the only acceptable RNG (security review §V6).

---

### `lib/chat-ui/stores/types.ts` (interfaces)

**Analog:** none in codebase. Source-of-truth is CONTEXT.md D-06 + RESEARCH §"Store interfaces".

**Copy verbatim:**
```typescript
// lib/chat-ui/stores/types.ts
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

**Rules:**
- `subscribe` signature is locked — matches `useSyncExternalStore`'s subscribe contract.
- `ChatHistoryItem` / `ChatProduct` MUST be imported from `@/types/product` (not relocated — see RESEARCH "Supporting" table).

---

### `lib/chat-ui/stores/local-storage.ts` (LocalStorageHistoryStore + LocalStorageSavedProductsStore)

**Analog:** RESEARCH §"LocalStorage history store (sketch)" — verbatim sketch covers `LocalStorageHistoryStore`. `LocalStorageSavedProductsStore` follows the identical shape with `toggle` + `has` replacing `add`.

**Core pattern (copy from RESEARCH lines 558-606):**
```typescript
// lib/chat-ui/stores/local-storage.ts
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { HistoryStore, SavedProductsStore } from './types';

const HISTORY_CAP = 10;

export class LocalStorageHistoryStore implements HistoryStore {
  private listeners = new Set<() => void>();
  private cache: ChatHistoryItem[] | null = null;

  constructor(private readonly scope: string) {
    // SECURITY: §V13 — empty scope would create a shop-less storage key
    // collision across tenants. Treat empty string as a programming error.
    if (!scope) throw new Error('LocalStorageHistoryStore requires a non-empty scope');
  }

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
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

// LocalStorageSavedProductsStore follows the same structure with:
//  - key: `smartdiscovery.saved.${scope}`
//  - no cap (D-07)
//  - toggle(product): adds if not present (matched by .id), removes if present
//  - has(productId): cached list `.some(p => p.id === productId)`
export class LocalStorageSavedProductsStore implements SavedProductsStore { /* ... */ }
```

**Critical rules** (security review §V13):
- Empty scope MUST throw (planner adds the constructor guard above — explicit per "Phase 5 security checklist").
- History cap = 10; saved-products cap = none (matches `chat-shell.tsx:27` today).
- Subscribe-return cleanup must use `{ ... }` block, not implicit-return arrow (`.delete()` returns `boolean` which would type-check the wrong return).
- `subscribe.bind(this)` is NOT used here; React's `useSyncExternalStore` calls subscribe with the listener as argument — the bound `this` matters only when the hook calls `.subscribe.bind(store)` (see `hooks.ts` pattern below).

---

### `lib/chat-ui/stores/hooks.ts` (useSyncExternalStore-backed hooks)

**Analog:** RESEARCH §"Pattern 4" (lines 400-419) — verbatim.

**Copy from RESEARCH:**
```typescript
// lib/chat-ui/stores/hooks.ts
import { useSyncExternalStore, useMemo } from 'react';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { HistoryStore, SavedProductsStore } from './types';
import { LocalStorageHistoryStore, LocalStorageSavedProductsStore } from './local-storage';

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

export function useSavedProductsStore(scope: string) {
  const store: SavedProductsStore = useMemo(
    () => new LocalStorageSavedProductsStore(scope),
    [scope],
  );
  const items = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.list(),
    () => [],
  );
  return {
    items,
    toggle: (product: ChatProduct) => store.toggle(product),
    clear: () => store.clear(),
    has: (id: string) => store.has(id),
  };
}
```

**Rules:**
- Third arg `() => []` is the SSR snapshot — REQUIRED. Without it, RSC parents (`app/(embedded)/chat/page.tsx`) will crash on first render.
- `.bind(store)` is required because `useSyncExternalStore` calls subscribe without `this`.
- No `any`. No `as` casts.

---

### `lib/chat-ui/components/chat-pane.tsx` (component, transport-wired)

**Analog:** `components/chat/chat.tsx` (legacy).

**Imports pattern** (legacy `chat.tsx:1-16` — copy verbatim, change two import paths + ADD `DefaultChatTransport`):
```typescript
'use client';

import { PromptInputProvider, PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputActionMenu, PromptInputActionMenuTrigger, PromptInputActionMenuContent, PromptInputActionAddAttachments, PromptInputButton, PromptInputSubmit, usePromptInputAttachments } from '@/components/ai-elements/prompt-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';     // NEW
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai-elements/attachments";
import { GlobeIcon } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { ChatMessage } from './chat-message';   // CHANGED — intra-tree relative import
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { ChatIdentityAdapter } from '../adapters/types';   // NEW
```

**Props change** (legacy `chat.tsx:69-75`):
```typescript
// BEFORE:
interface ChatProps {
    savedProducts: ChatProduct[];
    onToggleSave: (product: ChatProduct) => void;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
}
export default function Chat({ savedProducts, onToggleSave, onHistoryAdd }: ChatProps) {

// AFTER (CONTEXT D-02 + RESEARCH §"Pattern 1"):
interface ChatPaneProps {
    adapter: ChatIdentityAdapter;
    savedProductIds: Set<string>;            // changed from savedProducts[]
    onToggleSave: (product: ChatProduct) => void;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
}
export function ChatPane({ adapter, savedProductIds, onToggleSave, onHistoryAdd }: ChatPaneProps) {
    // savedProductIds is now passed in — the Set<string> conversion moves to ChatShell
```

**Transport wiring** (REPLACES legacy `chat.tsx:76` `const { messages, sendMessage, status, } = useChat();`):
```typescript
const transport = useMemo(
  () => new DefaultChatTransport({
    api: adapter.endpoint,
    headers: () => adapter.getAuthHeaders(),   // Resolvable<Record<string, string>>
    body:    () => adapter.getRequestBody(),   // Resolvable<object>
  }),
  [adapter],
);
const { messages, sendMessage, status } = useChat({ transport });
```

**UI-SPEC parity changes** (locked changes — UI-SPEC §"File Move Parity Rules"):
1. **Remove surface-specific heights from the outer div** (legacy `chat.tsx:106`):
   - BEFORE: `<div className="flex flex-col w-full max-w-3xl h-[calc(100vh-100px)] mx-auto stretch gap-6 pt-3">`
   - AFTER: `<div className="flex flex-col w-full max-w-3xl mx-auto stretch gap-6 pt-3">`
2. **Remove surface-specific heights from the message list** (legacy `chat.tsx:107`):
   - BEFORE: `<div className='h-[calc(100%-180px)] flex flex-col flex-1 gap-4 overflow-auto pr-4'>`
   - AFTER: `<div className='flex flex-col flex-1 gap-4 overflow-auto pr-4'>`
   - These heights move to `app/(embedded)/chat/chat-shell.tsx` (the surface shell).

**savedProductIds derivation removed** (legacy `chat.tsx:77-80`): DELETE this block since prop is now the Set directly:
```typescript
// DELETE:
const savedProductIds = useMemo(
    () => new Set(savedProducts.map((product) => product.id)),
    [savedProducts],
);
```

**Everything else byte-identical:** `handleSubmit`, the empty-state inline paragraph (`<p>Hello! I&apos;m...`), the message-rendering `messages.map`, the `<PromptInputProvider>` block — all unchanged.

---

### `lib/chat-ui/components/chat-message.tsx` (component, pure)

**Analog:** `components/chat/chat-message.tsx` (legacy).

**Imports update** (legacy line 5):
- BEFORE: `import { MessageParts } from './message-parts';`
- AFTER: `import { MessageParts } from './message-parts';` — **no change** (relative path stays valid)

**UI-SPEC parity change** (UI-SPEC §"File Move Parity Rules" rule #5 — user message bubble width):
- Legacy `chat-message.tsx:81`:
  ```typescript
  isAiMessage ? "max-w-[calc(100%-40px)]" : "max-w-md",
  ```
- AFTER:
  ```typescript
  isAiMessage ? "max-w-[calc(100%-40px)]" : "max-w-[min(448px,100%)]",
  ```

**Everything else byte-identical.** No other change permitted.

---

### `lib/chat-ui/components/product-card.tsx` (component, pure)

**Analog:** `components/chat/product-card.tsx` (legacy).

**Copy:** byte-identical. No imports change (already uses `@/types/product` + `next/image` + `lucide-react`).

**Rules:** UI-SPEC §"Color" — `bg-[#f6f6f7]`, `border-[#e1e3e5]`, `text-[#202223]`, `text-[#008060]` are all already arbitrary-value classes — keep them. The hex-cleanup D-12 only applies to `chat-shell.tsx`, not product-card.

---

### `lib/chat-ui/components/history-panel.tsx` (component, pure)

**Analog:** `components/chat/history-panel.tsx` (legacy).

**Imports update** (line 5):
- BEFORE: `import { EmptyState } from '@/components/chat/empty-state';`
- AFTER: `import { EmptyState } from './empty-state';`

**Everything else byte-identical.**

---

### `lib/chat-ui/components/saved-products-panel.tsx` (component, pure)

**Analog:** `components/chat/saved-products-panel.tsx` (legacy).

**Imports update** (lines 5-6):
- BEFORE:
  ```typescript
  import { EmptyState } from '@/components/chat/empty-state';
  import { ProductCard } from '@/components/chat/product-card';
  ```
- AFTER:
  ```typescript
  import { EmptyState } from './empty-state';
  import { ProductCard } from './product-card';
  ```

**Everything else byte-identical.**

---

### `lib/chat-ui/components/empty-state.tsx` (component, pure)

**Analog:** `components/chat/empty-state.tsx` (legacy).

**Copy:** byte-identical. Zero imports change.

---

### `lib/chat-ui/components/message-parts.tsx` (component, discriminated render)

**Analog:** `components/chat/message-parts.tsx` (legacy).

**Imports update** (lines 6-8):
- BEFORE:
  ```typescript
  import { TextShimmer } from "../ui/text-shimmer";
  import { Response } from "../ai-elements/response";
  import { ProductCard } from "@/components/chat/product-card";
  ```
- AFTER:
  ```typescript
  import { TextShimmer } from "@/components/ui/text-shimmer";
  import { Response } from "@/components/ai-elements/response";
  import { ProductCard } from "./product-card";
  ```
  - Note: the legacy uses `../ui/` relative paths because the file lived at `components/chat/`. After the move, the relative depth changes — use `@/components/ui/*` for cross-tree (matches UI-SPEC §"Permitted cross-tree dependency") and a sibling `./product-card` for intra-tree.

**Everything else byte-identical** — the entire discriminated-union switch (`tool-searchCatalog` `input-streaming` / `input-available` / `output-available` / `output-error`), the `Thinking...` shimmer branch, the markdown `Response` branch.

---

### `lib/chat-ui/index.ts` (barrel — re-exports only)

**Analog:** none. New file. Pattern from RESEARCH §"Recommended Project Structure".

**Exact content:**
```typescript
// lib/chat-ui/index.ts — barrel.
// CONTRACT (D-04 + barrel-isolation.test.ts):
//   - Re-exports components + interfaces + store hooks.
//   - DOES NOT re-export adapters. Consumers import them via sub-paths
//     (`@/lib/chat-ui/adapters/embedded` / `@/lib/chat-ui/adapters/storefront`).

export { ChatPane } from './components/chat-pane';
export { ChatMessage } from './components/chat-message';
export { ProductCard } from './components/product-card';
export { HistoryPanel } from './components/history-panel';
export { SavedProductsPanel } from './components/saved-products-panel';
export { EmptyState } from './components/empty-state';
// NOTE: MessageParts is intentionally NOT exported — internal implementation
// detail of ChatMessage (RESEARCH §"Open Questions" item 1).

export type { ChatIdentityAdapter } from './adapters/types';
export type { HistoryStore, SavedProductsStore } from './stores/types';
export { useHistoryStore, useSavedProductsStore } from './stores/hooks';
```

**Critical rules** (barrel-isolation.test.ts asserts these):
- ZERO `from '@shopify/*'` imports.
- ZERO `from './adapters/'` re-exports (the static-grep test fails if this regex matches).
- ZERO `window.shopify` / `window.Shopify` / `shopify.idToken` references.

---

### `app/(embedded)/chat/chat-shell.tsx` (surface shell, client)

**Analog:** `components/chat/chat-shell.tsx` (legacy — relocate + extensively modify).

**Imports** — full rewrite (compare to legacy lines 1-11):
```typescript
'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bookmark, HistoryIcon, MessageSquare, PlusIcon, Sparkles } from 'lucide-react';
import { ChatPane, HistoryPanel, SavedProductsPanel } from '@/lib/chat-ui';
import { EmbeddedAdapter } from '@/lib/chat-ui/adapters/embedded';
import { useHistoryStore, useSavedProductsStore } from '@/lib/chat-ui/stores/hooks';
```

**Adapter instantiation + store hooks** (replaces legacy lines 13-28 — the local `useState` blocks):
```typescript
export function ChatShell({ shop }: { shop: string }) {
    const [selectedTab, setSelectedTab] = useState<string>('chat');
    const adapter = useMemo(() => new EmbeddedAdapter(), []);
    const history = useHistoryStore(shop);
    const saved = useSavedProductsStore(shop);

    const savedProductIds = useMemo(
        () => new Set(saved.items.map((p) => p.id)),
        [saved.items],
    );

    const handleNewChat = () => setSelectedTab('chat');
    // No handleToggleSave / handleHistoryAdd — wire saved.toggle / history.add directly to ChatPane.
    // ...
}
```

**JSX changes from legacy:**
- The `<header>`, the three `<TabsTrigger>` blocks, and the `<Button>` keep their structure byte-identical.
- D-12 hex cleanup: the hex literals are ALREADY `bg-[#008060]`, `text-[#008060]`, `border-[#e1e3e5]`, `text-[#6d7175]`, `text-[#202223]` arbitrary-value classes in `chat-shell.tsx` lines 39, 41, 54, 64, 74 — **these stay as-is per UI-SPEC §"Polaris hex-literal → Tailwind mapping"** (the D-12 cleanup was misnamed in CONTEXT — the values are arbitrary-value classes, NOT bare CSS literals needing replacement). Verify with `grep` before declaring D-12 done.
- The TabsContents block (legacy lines 90-104) becomes:
  ```typescript
  <TabsContents>
      <TabsContent value="chat">
          <ChatPane
              adapter={adapter}
              savedProductIds={savedProductIds}
              onToggleSave={saved.toggle}
              onHistoryAdd={history.add}
          />
      </TabsContent>
      <TabsContent value="history">
          <HistoryPanel items={history.items} onClear={history.clear} />
      </TabsContent>
      <TabsContent value="saved">
          <SavedProductsPanel products={saved.items} onToggleSave={saved.toggle} />
      </TabsContent>
  </TabsContents>
  ```
- **Surface-specific heights** (lifted out of ChatPane per UI-SPEC parity rule #4): the shell's outer `<div className='mx-auto w-full'>` must add the `h-[calc(100vh-100px)]` constraint here, and the TabsContent value="chat" wrapper adds `h-[calc(100%-180px)]`. Planner picks the exact insertion point; the test that asserts ChatPane doesn't carry these classes will catch a regression.

**`shop` prop wiring:** RSC `page.tsx` must pass `shop` from `searchParams` into `<ChatShell shop={shop} />`. Today `page.tsx:32` calls `<ChatShell />` with no props — planner updates this in the same commit.

---

### `app/(embedded)/chat/page.tsx` (RSC, modified)

**Analog:** `app/(embedded)/chat/page.tsx` (current).

**Single change** — import path + pass `shop`:
- BEFORE (line 2): `import { ChatShell } from '@/components/chat/chat-shell';`
- AFTER:          `import { ChatShell } from './chat-shell';`
- BEFORE (line 32): `<ChatShell />`
- AFTER:           `<ChatShell shop={shop ?? ''} />`

The banner block (lines 22-31) is unchanged — Phase 4 D-11 contract preserved.

---

### `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` (integration test, relocated)

**Analog:** `components/chat/chat.integration-test.tsx`.

**Changes:**
1. Move file to new path + rename `chat.integration-test.tsx` → `chat-pane.integration-test.tsx`.
2. Update import (legacy line 3): `import Chat from '@/components/chat/chat';` → `import { ChatPane } from '@/lib/chat-ui';`
3. Update render call sites (lines 53-58, 103-108):
   - BEFORE: `<Chat savedProducts={[TEST_PRODUCT]} onToggleSave={...} onHistoryAdd={...} />`
   - AFTER:  `<ChatPane adapter={mockAdapter} savedProductIds={new Set([TEST_PRODUCT.id])} onToggleSave={...} onHistoryAdd={...} />`
4. Add a stub adapter at the top of the file:
   ```typescript
   const mockAdapter: ChatIdentityAdapter = {
     endpoint: '/api/chat',
     getAuthHeaders: async () => ({}),
     getRequestBody: async () => ({}),
   };
   ```
5. The `vi.mock('@ai-sdk/react', ...)` block at lines 31-37 is **unchanged** — `useChat`'s mocked return shape is independent of the transport-prop change.

**The `as never` cast at line 98 is permitted** (test-file exception per CLAUDE.md, RESEARCH §"Wave 4 verification gate").

---

### `lib/chat-ui/__tests__/product-card.test.tsx` (unit test, relocated)

**Analog:** `components/chat/__tests__/product-card.test.tsx`.

**Single change** (line 4): `import { ProductCard } from '@/components/chat/product-card';` → `import { ProductCard } from '@/lib/chat-ui';` (use the barrel — ProductCard is a named export).

---

### `lib/chat-ui/__tests__/history-panel.test.tsx` (unit test, relocated)

**Analog:** `components/chat/__tests__/history-panel.test.tsx`.

**Single change** (line 3): `import { HistoryPanel } from '@/components/chat/history-panel';` → `import { HistoryPanel } from '@/lib/chat-ui';`

---

### `lib/chat-ui/__tests__/saved-products-panel.test.tsx` (unit test, relocated)

**Analog:** `components/chat/__tests__/saved-products-panel.test.tsx`.

**Single change** (line 3): `import { SavedProductsPanel } from '@/components/chat/saved-products-panel';` → `import { SavedProductsPanel } from '@/lib/chat-ui';`

---

### `lib/chat-ui/__tests__/message-parts.test.tsx` (unit test, relocated)

**Analog:** `components/chat/__tests__/message-parts.test.tsx`.

**Single change** (line 5): `import { MessageParts } from '@/components/chat/message-parts';` → `import { MessageParts } from '@/lib/chat-ui/components/message-parts';`
- `MessageParts` is NOT in the barrel (RESEARCH §"Open Questions" 1). Use the deep-path import. This is the only deep-path test import — flagged for the planner.

---

### `app/(embedded)/chat/__tests__/chat-shell.test.tsx` (unit test, relocated + mock-path update)

**Analog:** `components/chat/__tests__/chat-shell.test.tsx`.

**Changes:**
1. Move file from `components/chat/__tests__/` to `app/(embedded)/chat/__tests__/` (alongside `page.test.tsx`).
2. Update mock target (line 31):
   - BEFORE:
     ```typescript
     vi.mock('@/components/chat/chat', () => ({
         default: ({ onHistoryAdd, onToggleSave }: {...}) => (...),
     }));
     ```
   - AFTER:
     ```typescript
     vi.mock('@/lib/chat-ui', () => ({
         ChatPane: ({ onHistoryAdd, onToggleSave }: {...}) => (...),
         // Also mock HistoryPanel + SavedProductsPanel as identity passthroughs,
         // since chat-shell.tsx imports those from the same barrel.
         HistoryPanel: (props: {...}) => (...),
         SavedProductsPanel: (props: {...}) => (...),
     }));
     ```
   - Note: the legacy uses `default:` (Chat was a default export); the new mock uses the `ChatPane:` named export key.
3. Update import (line 51): `import { ChatShell } from '@/components/chat/chat-shell';` → `import { ChatShell } from '@/app/(embedded)/chat/chat-shell';` (or `'../chat-shell'` if planner prefers relative).
4. The `render(<ChatShell />)` call (line 55) becomes `render(<ChatShell shop="example.myshopify.com" />)` — shop prop is now required.

---

### `app/(embedded)/chat/__tests__/page.test.tsx` (existing — single-line edit)

**Analog:** `app/(embedded)/chat/__tests__/page.test.tsx` (already exists at this path).

**Single change** (line 26):
- BEFORE: `vi.mock('@/components/chat/chat-shell', () => ({`
- AFTER:  `vi.mock('@/app/(embedded)/chat/chat-shell', () => ({` (or `'../chat-shell'`)

Test body unchanged.

---

### `app/prototype/prototype-data.ts` (dead-comment cleanup)

**Analog:** `app/prototype/prototype-data.ts` (current — line 1 has a stale comment).

**Single change:** delete line 1 (`// import { MOCK_PRODUCTS } from '@/components/chat/mock-products';`). `MOCK_PRODUCTS` was already deleted in Phase 4 (RESEARCH §"State of the Art"); the dead comment would survive the grep gate (it's a comment, not an import) but should still be removed for hygiene.

---

## Shared Patterns

### Pattern A — Adapter-driven `useChat` transport (RESEARCH §"Pattern 1")

**Source:** `node_modules/ai/dist/index.d.ts:3513-3577` (HttpChatTransportInitOptions + DefaultChatTransport typings).
**Apply to:** `lib/chat-ui/components/chat-pane.tsx` ONLY.

```typescript
const transport = useMemo(
  () => new DefaultChatTransport({
    api: adapter.endpoint,
    headers: () => adapter.getAuthHeaders(),
    body:    () => adapter.getRequestBody(),
  }),
  [adapter],
);
const { messages, sendMessage, status } = useChat({ transport });
```

**Why:** AI SDK v6 dropped `useChat({ api, headers, body })` direct fields. The transport class with `Resolvable<T>` functions is the only supported path. Pitfall §1 (RESEARCH) warns that direct fields silently fail.

### Pattern B — `useSyncExternalStore` binding (RESEARCH §"Pattern 4")

**Source:** React 18+ docs + RESEARCH §"Pattern 4".
**Apply to:** `lib/chat-ui/stores/hooks.ts` (both `useHistoryStore` and `useSavedProductsStore`).

```typescript
const items = useSyncExternalStore(
  store.subscribe.bind(store),
  () => store.list(),
  () => [],   // SSR snapshot
);
```

**Why:** Surface shells render under an RSC parent (`app/(embedded)/chat/page.tsx`). Without the 3rd-arg SSR snapshot the first render crashes with "useSyncExternalStore must be called in a Client Component". The 3rd arg is REQUIRED, not optional.

### Pattern C — Runtime-global App Bridge access (no `@shopify/*` imports)

**Source:** `app/(embedded)/onboarding/page.tsx:36,68` (`shopify.idToken()`).
**Apply to:** `lib/chat-ui/adapters/embedded.ts`.

```typescript
const token = await shopify.idToken();
return { Authorization: `Bearer ${token}` };
```

**Why:** The `shopify` global is loaded by `app/(embedded)/layout.tsx`'s `<Script src=".../app-bridge.js" strategy="beforeInteractive" />` and typed via `@shopify/app-bridge-types` (type-only). Adapter file contains ZERO runtime `import ... from '@shopify/*'` statements — verified by the barrel-isolation static-grep test (Pattern E).

### Pattern D — SSR-safe localStorage access

**Source:** None in this codebase (net-new). Apply to `lib/chat-ui/adapters/storefront.ts` and `lib/chat-ui/stores/local-storage.ts`.

```typescript
if (typeof window === 'undefined') {
  return /* empty default */;
}
// safe to touch window.localStorage here
```

**Why:** Both files MAY be imported during SSR (e.g., the barrel exports the store hooks, which import `LocalStorageHistoryStore`; if a server component imports the barrel, the module evaluates server-side). Guard prevents `ReferenceError: window is not defined`.

### Pattern E — Static-grep guard test (RESEARCH §"Static-grep guard test")

**Source:** None in this codebase. New test pattern.
**Apply to:** `lib/chat-ui/__tests__/barrel-isolation.test.ts` ONLY.

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BARREL_ROOT = join(process.cwd(), 'lib/chat-ui');
const FORBIDDEN_IN_BARREL = [
  /from\s+['"]@shopify\//,
  /window\.shopify/,
  /window\.Shopify/,
  /\bshopify\.idToken\b/,
];

function* walkTs(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (full.endsWith('/adapters')) continue;        // D-04 exemption
      if (full.endsWith('/__tests__')) continue;       // tests don't ship
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

**Why:** SHR-01 enforcement. Cheaper than a custom ESLint rule and runs in the existing vitest suite.

### Pattern F — Vitest mock for `@ai-sdk/react` (legacy `chat.integration-test.tsx` pattern)

**Source:** `components/chat/chat.integration-test.tsx:13-37` (the `vi.hoisted` + `vi.mock` block).
**Apply to:** `lib/chat-ui/__tests__/chat-pane.integration-test.tsx` ONLY.

The legacy pattern is copy-pasted into the new location with no changes — `useChat`'s mock return shape (`{ messages, sendMessage, status }`) is independent of whether `useChat` is called with `()` (legacy) or `({ transport })` (new) — the mock fully shadows the hook.

### Pattern G — Scope-or-throw constructor guard (security review §V13)

**Source:** None — new defensive pattern.
**Apply to:** `LocalStorageHistoryStore`, `LocalStorageSavedProductsStore` constructors.

```typescript
constructor(private readonly scope: string) {
  if (!scope) throw new Error('LocalStorage*Store requires a non-empty scope');
}
```

**Why:** Empty-string scope would produce a key like `smartdiscovery.history.` which is shared across all tenants — a multi-tenant data leak. Security checklist line 3 ("LocalStorage keys ALWAYS include the scope arg"). The throw guarantees the leak is impossible.

---

## Cross-Cutting Conventions (apply to ALL Phase 5 files)

| Convention | Source | Applies to |
|------------|--------|-----------|
| `'use client'` directive preserved on all lifted components that have it today | UI-SPEC §"File Move Parity Rules" rule #6 | `chat-pane.tsx`, `product-card.tsx`, `history-panel.tsx`, `saved-products-panel.tsx`, `empty-state.tsx`, `message-parts.tsx`. **NOT** `chat-message.tsx` (no `'use client'` today — verified by `head -1`). |
| Named exports only (no default) | CONTEXT D-04 / RESEARCH §"TypeScript barrel export shape" | Every file in `lib/chat-ui/`. The rename `export default function Chat` → `export function ChatPane` is the only default→named conversion. |
| No `any` casts, no `as unknown as`, no `as any` | SC #4 + CLAUDE.md TS strict | Every file in `lib/chat-ui/` source (test files MAY use `as never` like the existing `chat.integration-test.tsx:98`). |
| No `console.*` in adapters | Security review §V14 + CLAUDE.md "no secrets in logs" | `lib/chat-ui/adapters/embedded.ts`, `lib/chat-ui/adapters/storefront.ts`. |
| Imports use `@/` for cross-tree (`@/components/ai-elements/*`, `@/components/ui/*`, `@/types/product`, `@/lib/utils`) and relative paths for intra-tree (`./empty-state`, `./product-card`, `../adapters/types`) | RESEARCH §"Pattern Assignments" | Every file in `lib/chat-ui/`. |
| `import type` for type-only imports | CLAUDE.md conventions | All adapter + store interface re-imports, `ChatProduct` / `ChatHistoryItem` re-imports. |

---

## No Analog Found

These files have NO direct precedent in the codebase. Planner should reference RESEARCH.md §"Code Examples" and the verified AI SDK / React typings as the source of truth:

| File | Role | Data Flow | Source of Truth |
|------|------|-----------|-----------------|
| `lib/chat-ui/adapters/storefront.ts` | adapter | localStorage R/W → body field | RESEARCH §"Pattern 3" (verbatim) |
| `lib/chat-ui/stores/local-storage.ts` | store (class) | localStorage R/W + observer notify | RESEARCH §"LocalStorage history store (sketch)" |
| `lib/chat-ui/stores/hooks.ts` | React hook | `useSyncExternalStore` binding | RESEARCH §"Pattern 4" (verbatim) |
| `lib/chat-ui/__tests__/barrel-isolation.test.ts` | static-grep guard | filesystem-read → assertion | RESEARCH §"Static-grep guard test" (verbatim) |
| `lib/chat-ui/__tests__/embedded-adapter.test.ts` | unit test (global mock) | mocked `globalThis.shopify.idToken` → header assertion | planner writes from scratch; see security review §V7 (token-leak guard) |
| `lib/chat-ui/__tests__/storefront-adapter.test.ts` | unit test | mocked `localStorage` + `crypto.randomUUID` → body assertion | planner writes from scratch |
| `lib/chat-ui/__tests__/local-storage-stores.test.ts` | unit test | localStorage mock → add/clear/subscribe assertions | planner writes from scratch; assert empty-scope throw (Pattern G) |
| `lib/chat-ui/index.ts` | barrel | re-exports | RESEARCH §"Recommended Project Structure" |

---

## Metadata

**Analog search scope:** `components/chat/`, `components/ai-elements/`, `app/(embedded)/`, `lib/db/`, `lib/shopify/`, `lib/inngest/`, `types/`.
**Files scanned:** 22 source files + 6 test files + 1 RSC entry point.
**Pattern extraction date:** 2026-05-26.
**Confidence:** HIGH for all lift patterns (legacy files are the analog — byte-for-byte copy). HIGH for adapter pattern (verified against AI SDK v6 typings + `onboarding/page.tsx` precedent). HIGH for store hooks (verified pattern in RESEARCH).
