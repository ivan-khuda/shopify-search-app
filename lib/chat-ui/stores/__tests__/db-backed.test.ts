/**
 * RED scaffold for D-02 — DbBackedHistoryStore + DbBackedSavedProductsStore.
 * Tests fail with "Cannot find module '@/lib/chat-ui/stores/db-backed'" until
 * Wave 2 ships implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

import {
  DbBackedHistoryStore,
  DbBackedSavedProductsStore,
} from '@/lib/chat-ui/stores/db-backed';

const SHOP = 'mystore.myshopify.com';
const VISITOR_ID = 'visitor-uuid-001';

const mockHistoryItem: ChatHistoryItem = {
  id: 'conv-001',
  title: 'Test conversation',
  productCount: 2,
  timestamp: Date.now(),
};

const mockProduct: ChatProduct = {
  id: 'gid://shopify/Product/42',
  title: 'Blue Running Shoes',
  handle: 'blue-running-shoes',
  vendor: 'Nike',
  price: '89.99',
  compareAtPrice: null,
  imageUrl: null,
  productUrl: null,
  description: 'Great running shoes',
  availableForSale: true,
  tags: ['shoes', 'running'],
  productType: 'Footwear',
};

beforeEach(() => {
  // Mock global fetch for store API calls
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── DbBackedHistoryStore ─────────────────────────────────────────────────────

describe('DbBackedHistoryStore', () => {
  it('throws on construction when shop is missing', () => {
    expect(() => new DbBackedHistoryStore({ shop: '', visitorId: VISITOR_ID })).toThrow();
  });

  it('throws on construction when visitorId is missing (D-02)', () => {
    expect(() => new DbBackedHistoryStore({ shop: SHOP, visitorId: '' })).toThrow();
  });

  it('list() returns synchronous cache (useSyncExternalStore contract — no await required)', () => {
    const store = new DbBackedHistoryStore({ shop: SHOP, visitorId: VISITOR_ID });
    // Must return synchronously
    const result = store.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it('refresh() fetches /apps/smartdiscovery/conversations?visitor_id=... and notifies subscribers', async () => {
    const mockItems = [mockHistoryItem];
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: mockItems }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const store = new DbBackedHistoryStore({ shop: SHOP, visitorId: VISITOR_ID });
    const listener = vi.fn();
    store.subscribe(listener);

    await store.refresh();

    // Should have fetched the conversations endpoint
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/apps/smartdiscovery/conversations'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`visitor_id=${VISITOR_ID}`),
      expect.anything()
    );

    // Should have notified subscribers
    expect(listener).toHaveBeenCalled();

    // list() should now return the fetched items
    const items = store.list();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('conv-001');
  });

  it('add() POSTs to /apps/smartdiscovery/conversations and optimistically updates cache', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ conversation_id: 'conv-new' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const store = new DbBackedHistoryStore({ shop: SHOP, visitorId: VISITOR_ID });
    const listener = vi.fn();
    store.subscribe(listener);

    store.add(mockHistoryItem);

    // Optimistic update: cache should already contain the item
    expect(store.list()).toContainEqual(mockHistoryItem);
    // Subscribers notified
    expect(listener).toHaveBeenCalled();
  });

  it('clear() issues DELETE bulk and resets cache to []', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ deleted: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const store = new DbBackedHistoryStore({ shop: SHOP, visitorId: VISITOR_ID });
    // Pre-populate cache via add
    store.add(mockHistoryItem);
    const listener = vi.fn();
    store.subscribe(listener);

    store.clear();

    // Cache should be empty after clear
    expect(store.list()).toHaveLength(0);
    // Subscriber notified after clear
    expect(listener).toHaveBeenCalled();
  });

  it('subscribe/unsubscribe pattern matches LocalStorage analog', () => {
    const store = new DbBackedHistoryStore({ shop: SHOP, visitorId: VISITOR_ID });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);

    // Trigger a notification by adding an item
    store.add(mockHistoryItem);
    expect(listener).toHaveBeenCalledTimes(1);

    // After unsubscribe, listener should not be called again
    unsubscribe();
    store.add({ ...mockHistoryItem, id: 'conv-002' });
    expect(listener).toHaveBeenCalledTimes(1); // still 1
  });
});

// ── DbBackedSavedProductsStore ───────────────────────────────────────────────

describe('DbBackedSavedProductsStore', () => {
  it('throws on construction when shop is missing (D-02)', () => {
    expect(() => new DbBackedSavedProductsStore({ shop: '', visitorId: VISITOR_ID })).toThrow();
  });

  it('throws on construction when visitorId is missing (D-02)', () => {
    expect(() => new DbBackedSavedProductsStore({ shop: SHOP, visitorId: '' })).toThrow();
  });

  it('list() returns synchronous cache (useSyncExternalStore contract)', () => {
    const store = new DbBackedSavedProductsStore({ shop: SHOP, visitorId: VISITOR_ID });
    const result = store.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it('toggle() POSTs to /apps/smartdiscovery/saved-products (idempotent insert)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const store = new DbBackedSavedProductsStore({ shop: SHOP, visitorId: VISITOR_ID });
    const listener = vi.fn();
    store.subscribe(listener);

    store.toggle(mockProduct);

    expect(store.list()).toContainEqual(mockProduct);
    expect(listener).toHaveBeenCalled();
  });

  it('clear() resets saved products cache to []', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ deleted: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const store = new DbBackedSavedProductsStore({ shop: SHOP, visitorId: VISITOR_ID });
    store.toggle(mockProduct);

    expect(store.list()).toHaveLength(1);

    store.clear();
    expect(store.list()).toHaveLength(0);
  });

  it('subscribe/unsubscribe mirrors HistoryStore pattern', () => {
    const store = new DbBackedSavedProductsStore({ shop: SHOP, visitorId: VISITOR_ID });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.toggle(mockProduct);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.toggle({ ...mockProduct, id: 'other-product' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
