/**
 * DB-backed History + SavedProducts stores for the storefront drawer (D-01/D-02).
 *
 * Mirrors the LocalStorage analogs structurally — both implement the Phase 5
 * HistoryStore / SavedProductsStore interfaces byte-identically — but persist
 * via the App Proxy endpoints under /apps/smartdiscovery/* instead of
 * window.localStorage. Same-origin from the merchant's storefront (STR-08);
 * Shopify's signing infrastructure handles auth.
 *
 * list() is synchronous (useSyncExternalStore contract). refresh() repopulates
 * the cache from the server and notifies subscribers. Mutations (add/toggle/
 * clear) optimistically update the cache then fire-and-forget the network
 * call — V1 has no rollback path; that matches the LocalStorage analog's
 * quota-error behavior. Errors are swallowed (no console.* logging per
 * PROJECT.md hard constraint).
 *
 * DbBackedSavedProductsStore caveat: server stores only { productId, savedAt }
 * (Plan 08), so refresh() merges the server-known productId set with locally-
 * cached ChatProduct objects — unknown productIds get dropped. Full hydration
 * is deferred to a future plan.
 */
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { HistoryStore, SavedProductsStore } from './types';

interface StoreOpts {
  shop: string;
  visitorId: string;
  customerId?: string | null;
}

function proxyPath(path: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) search.set(k, v);
  }
  const qs = search.toString();
  return qs.length > 0 ? `${path}?${qs}` : path;
}

export class DbBackedHistoryStore implements HistoryStore {
  private readonly shop: string;
  private readonly visitorId: string;
  private readonly customerId: string | null;
  private readonly listeners = new Set<() => void>();
  private cache: ChatHistoryItem[] = [];

  constructor(opts: StoreOpts) {
    if (!opts.shop) throw new Error('DbBackedHistoryStore requires a non-empty shop');
    if (!opts.visitorId) throw new Error('DbBackedHistoryStore requires a non-empty visitorId');
    this.shop = opts.shop;
    this.visitorId = opts.visitorId;
    this.customerId = opts.customerId ?? null;
  }

  list(): ChatHistoryItem[] {
    return this.cache;
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch(
        proxyPath('/apps/smartdiscovery/conversations', { visitor_id: this.visitorId }),
        { method: 'GET' }
      );
      if (!res.ok) {
        this.cache = [];
        this.notify();
        return;
      }
      const data = (await res.json()) as { items?: unknown };
      if (Array.isArray(data.items)) {
        this.cache = data.items as ChatHistoryItem[];
      } else {
        this.cache = [];
      }
      this.notify();
    } catch {
      this.cache = [];
      this.notify();
    }
  }

  add(entry: ChatHistoryItem): void {
    this.cache = [entry, ...this.cache];
    this.notify();
    void fetch('/apps/smartdiscovery/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: this.visitorId,
        customer_id: this.customerId ?? undefined,
        firstMessage: { text: entry.query ?? '' },
      }),
    })?.catch?.(() => {
      /* swallow */
    });
  }

  clear(): void {
    this.cache = [];
    this.notify();
    void fetch(
      proxyPath('/apps/smartdiscovery/conversations', { visitor_id: this.visitorId }),
      { method: 'DELETE' }
    )?.catch?.(() => {
      /* swallow */
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export class DbBackedSavedProductsStore implements SavedProductsStore {
  private readonly shop: string;
  private readonly visitorId: string;
  private readonly customerId: string | null;
  private readonly listeners = new Set<() => void>();
  private cache: ChatProduct[] = [];

  constructor(opts: StoreOpts) {
    if (!opts.shop) throw new Error('DbBackedSavedProductsStore requires a non-empty shop');
    if (!opts.visitorId) throw new Error('DbBackedSavedProductsStore requires a non-empty visitorId');
    this.shop = opts.shop;
    this.visitorId = opts.visitorId;
    this.customerId = opts.customerId ?? null;
  }

  list(): ChatProduct[] {
    return this.cache;
  }

  has(productId: string): boolean {
    return this.cache.some((p) => p.id === productId);
  }

  toggle(product: ChatProduct): void {
    if (this.has(product.id)) {
      this.cache = this.cache.filter((p) => p.id !== product.id);
      this.notify();
      void fetch(
        proxyPath(`/apps/smartdiscovery/saved-products/${encodeURIComponent(product.id)}`, {
          visitor_id: this.visitorId,
        }),
        { method: 'DELETE' }
      )?.catch?.(() => {
        /* swallow */
      });
    } else {
      this.cache = [product, ...this.cache];
      this.notify();
      void fetch('/apps/smartdiscovery/saved-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_id: this.visitorId,
          customer_id: this.customerId ?? undefined,
          product_id: product.id,
        }),
      })?.catch?.(() => {
        /* swallow */
      });
    }
  }

  /** @deprecated Storefront UI does not expose a Clear All affordance; method retained for interface parity. */
  clear(): void {
    this.cache = [];
    this.notify();
  }

  async refresh(): Promise<void> {
    try {
      const res = await fetch(
        proxyPath('/apps/smartdiscovery/saved-products', { visitor_id: this.visitorId }),
        { method: 'GET' }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Array<{ productId: string }> };
      if (Array.isArray(data.items)) {
        const knownIds = new Set(data.items.map((i) => i.productId));
        this.cache = this.cache.filter((p) => knownIds.has(p.id));
        this.notify();
      }
    } catch {
      /* swallow */
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
