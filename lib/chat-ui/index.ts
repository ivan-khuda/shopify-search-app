// lib/chat-ui/index.ts — barrel.
// CONTRACT (D-04 + barrel-isolation.test.ts):
//   - Re-exports components + interfaces + store hooks.
//   - DOES NOT re-export concrete adapter modules. The type-only re-export from
//     `./adapters/types` is permitted because TypeScript erases type-only imports
//     at compile time — no runtime adapter code reaches the storefront bundle.
//   - Consumers import concrete adapters via sub-paths
//     (`@/lib/chat-ui/adapters/embedded` / `@/lib/chat-ui/adapters/storefront`).

export { ChatPane } from './components/chat-pane';
export { ChatMessage } from './components/chat-message';
export { ProductCard } from './components/product-card';
export { HistoryPanel } from './components/history-panel';
export { SavedProductsPanel } from './components/saved-products-panel';
export { EmptyState } from './components/empty-state';
// NOTE: message-parts is intentionally NOT exported — internal implementation
// detail of ChatMessage (RESEARCH §"Open Questions" item 1).

export type { ChatIdentityAdapter } from './adapters/types';
export type { HistoryStore, SavedProductsStore } from './stores/types';
export { useHistoryStore, useSavedProductsStore } from './stores/hooks';
