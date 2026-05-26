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
