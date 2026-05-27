import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LocalStorageHistoryStore,
  LocalStorageSavedProductsStore,
} from '@/lib/chat-ui/stores/local-storage';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

const TEST_ENTRY: ChatHistoryItem = {
  id: 'h1',
  query: 'shoes',
  timestamp: '2026-05-26T12:00:00Z',
  productCount: 3,
};

const TEST_PRODUCT: ChatProduct = {
  id: 'p1',
  title: 'Test Product',
  description: 'A product for testing',
  price: '$10.00',
  image: 'https://example.com/p1.jpg',
  category: 'test',
  tags: ['tag-a'],
};

describe('LocalStorageHistoryStore / LocalStorageSavedProductsStore (D-07 + T-5-01)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('LocalStorageHistoryStore constructor throws when scope is empty (T-5-01)', () => {
    expect(() => new LocalStorageHistoryStore('')).toThrow(/non-empty scope/);
  });

  it('LocalStorageSavedProductsStore constructor throws when scope is empty (T-5-01)', () => {
    expect(() => new LocalStorageSavedProductsStore('')).toThrow(/non-empty scope/);
  });

  it('LocalStorageHistoryStore.add writes to scoped key smartdiscovery.history.<scope>', () => {
    const store = new LocalStorageHistoryStore('test-shop.myshopify.com');
    store.add(TEST_ENTRY);
    expect(
      window.localStorage.getItem('smartdiscovery.history.test-shop.myshopify.com'),
    ).not.toBeNull();
    const items = store.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(TEST_ENTRY);
  });

  it('LocalStorageHistoryStore enforces HISTORY_CAP = 10 (newest first, oldest dropped)', () => {
    const store = new LocalStorageHistoryStore('test-shop.myshopify.com');
    for (let i = 1; i <= 11; i++) {
      store.add({
        id: `h${i}`,
        query: `query-${i}`,
        timestamp: `2026-05-26T12:00:${String(i).padStart(2, '0')}Z`,
        productCount: i,
      });
    }
    const items = store.list();
    expect(items).toHaveLength(10);
    expect(items[0].id).toBe('h11'); // newest first
    expect(items[9].id).toBe('h2'); // oldest retained (h1 dropped)
  });

  it('LocalStorageHistoryStore.subscribe listener fires on add() and clear()', () => {
    const store = new LocalStorageHistoryStore('test-shop.myshopify.com');
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.add(TEST_ENTRY);
    expect(listener).toHaveBeenCalledTimes(1);

    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('LocalStorageSavedProductsStore.toggle adds when absent and removes when present (idempotent by product.id)', () => {
    const store = new LocalStorageSavedProductsStore('test-shop');
    expect(store.has(TEST_PRODUCT.id)).toBe(false);

    store.toggle(TEST_PRODUCT);
    expect(store.has(TEST_PRODUCT.id)).toBe(true);
    expect(store.list()).toHaveLength(1);
    expect(
      window.localStorage.getItem('smartdiscovery.saved.test-shop'),
    ).not.toBeNull();

    store.toggle(TEST_PRODUCT);
    expect(store.has(TEST_PRODUCT.id)).toBe(false);
    expect(store.list()).toHaveLength(0);
  });

  it('LocalStorageSavedProductsStore.has returns true after toggle, false after second toggle', () => {
    const store = new LocalStorageSavedProductsStore('test-shop');
    store.toggle(TEST_PRODUCT);
    expect(store.has(TEST_PRODUCT.id)).toBe(true);
    store.toggle(TEST_PRODUCT);
    expect(store.has(TEST_PRODUCT.id)).toBe(false);
  });

  it('LocalStorageSavedProductsStore is uncapped (adds 100 products, keeps all)', () => {
    const store = new LocalStorageSavedProductsStore('test-shop');
    for (let i = 0; i < 100; i++) {
      store.toggle({
        id: `p${i}`,
        title: `Product ${i}`,
        description: 'desc',
        price: '$1.00',
      });
    }
    expect(store.list()).toHaveLength(100);
  });
});
