import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { HistoryStore, SavedProductsStore } from './types';

const HISTORY_CAP = 10;

export class LocalStorageHistoryStore implements HistoryStore {
  private readonly scope: string;
  private readonly listeners = new Set<() => void>();
  private cache: ChatHistoryItem[] | null = null;

  constructor(scope: string) {
    if (!scope) {
      throw new Error('LocalStorageHistoryStore requires a non-empty scope');
    }
    this.scope = scope;
  }

  private get key(): string {
    return `smartdiscovery.history.${this.scope}`;
  }

  list(): ChatHistoryItem[] {
    if (this.cache) return this.cache;
    if (typeof window === 'undefined') {
      this.cache = [];
      return this.cache;
    }
    const raw = window.localStorage.getItem(this.key);
    if (!raw) {
      this.cache = [];
      return this.cache;
    }
    try {
      const parsed = JSON.parse(raw) as ChatHistoryItem[];
      this.cache = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.cache = [];
    }
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
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.key);
    }
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export class LocalStorageSavedProductsStore implements SavedProductsStore {
  private readonly scope: string;
  private readonly listeners = new Set<() => void>();
  private cache: ChatProduct[] | null = null;

  constructor(scope: string) {
    if (!scope) {
      throw new Error('LocalStorageSavedProductsStore requires a non-empty scope');
    }
    this.scope = scope;
  }

  private get key(): string {
    return `smartdiscovery.saved.${this.scope}`;
  }

  list(): ChatProduct[] {
    if (this.cache) return this.cache;
    if (typeof window === 'undefined') {
      this.cache = [];
      return this.cache;
    }
    const raw = window.localStorage.getItem(this.key);
    if (!raw) {
      this.cache = [];
      return this.cache;
    }
    try {
      const parsed = JSON.parse(raw) as ChatProduct[];
      this.cache = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  has(productId: string): boolean {
    return this.list().some((p) => p.id === productId);
  }

  toggle(product: ChatProduct): void {
    const current = this.list();
    const next = current.some((p) => p.id === product.id)
      ? current.filter((p) => p.id !== product.id)
      : [product, ...current];
    this.cache = next;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.key, JSON.stringify(next));
    }
    this.notify();
  }

  clear(): void {
    this.cache = [];
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(this.key);
    }
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
