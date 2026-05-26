import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

/**
 * Phase 5 Plan 4 — app/(embedded)/chat/chat-shell.tsx client component.
 *
 * ChatShell is the embedded-admin surface shell. It instantiates the
 * EmbeddedAdapter, wires the per-shop history + saved-products stores from
 * `@/lib/chat-ui/stores/hooks`, and owns the surface-specific height
 * classes (h-[calc(100vh-100px)] on the outer wrapper; h-[calc(100%-180px)]
 * on the chat TabsContent).
 *
 * This test mocks `@/lib/chat-ui` so the surface under test is the
 * chat-shell tab/state wiring only — ChatPane, HistoryPanel, and
 * SavedProductsPanel are replaced with identity stubs.
 */

const product: ChatProduct = {
  id: 'product-1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
};

const historyItem: ChatHistoryItem = {
  id: 'history-1',
  query: 'running shoes',
  timestamp: '10:30 AM',
  productCount: 1,
};

vi.mock('@/lib/chat-ui', () => ({
  ChatPane: ({
    onHistoryAdd,
    onToggleSave,
  }: {
    adapter: unknown;
    savedProductIds: Set<string>;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
    onToggleSave: (product: ChatProduct) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onHistoryAdd(historyItem)}>
        Add history item
      </button>
      <button type="button" onClick={() => onToggleSave(product)}>
        Toggle saved product
      </button>
    </div>
  ),
  HistoryPanel: ({
    items,
    onClear,
  }: {
    items: ChatHistoryItem[];
    onClear: () => void;
  }) => (
    <div>
      {items.length === 0 ? (
        <p>No search history</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>&quot;{item.query}&quot;</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClear}>
        clear history
      </button>
    </div>
  ),
  SavedProductsPanel: ({
    products,
    onToggleSave,
  }: {
    products: ChatProduct[];
    onToggleSave: (product: ChatProduct) => void;
  }) => (
    <div>
      {products.length === 0 ? (
        <p>No saved products</p>
      ) : (
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onToggleSave(p)}>
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  ),
}));

import { ChatShell } from '../chat-shell';

describe('ChatShell tabs (embedded surface)', () => {
  it('shares history and saved product state across tabs', () => {
    render(<ChatShell shop="example.myshopify.com" />);

    expect(screen.getByText('No search history')).toBeInTheDocument();
    expect(screen.getByText('No saved products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add history item/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle saved product/i }));

    expect(screen.getByText('"running shoes"')).toBeInTheDocument();
    expect(screen.getByText('Midnight Runner Sneakers')).toBeInTheDocument();
  });
});
