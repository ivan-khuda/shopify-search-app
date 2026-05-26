import { useSyncExternalStore, useMemo } from 'react';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { HistoryStore, SavedProductsStore } from './types';
import {
  LocalStorageHistoryStore,
  LocalStorageSavedProductsStore,
} from './local-storage';

export function useHistoryStore(scope: string) {
  const store: HistoryStore = useMemo(
    () => new LocalStorageHistoryStore(scope),
    [scope],
  );
  const items = useSyncExternalStore(
    store.subscribe.bind(store),
    () => store.list(),
    () => [],
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
