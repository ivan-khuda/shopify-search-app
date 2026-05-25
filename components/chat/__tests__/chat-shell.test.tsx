import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

/**
 * Phase 4 Plan 6 — components/chat/chat-shell.tsx client component.
 *
 * ChatShell owns all tab state, history, and saved-products state
 * (lifted from the legacy client page.tsx). It's a no-props client
 * component in Phase 4.
 *
 * This test mocks the inner Chat (which uses useChat from @ai-sdk/react)
 * so the surface under test is the ChatShell tab/state shell only.
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

vi.mock('@/components/chat/chat', () => ({
  default: ({
    onHistoryAdd,
    onToggleSave,
  }: {
    savedProducts: ChatProduct[];
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
}));

import { ChatShell } from '@/components/chat/chat-shell';

describe('ChatShell tabs', () => {
  it('shares history and saved product state across tabs', () => {
    render(<ChatShell />);

    expect(screen.getByText('No search history')).toBeInTheDocument();
    expect(screen.getByText('No saved products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add history item/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle saved product/i }));

    expect(screen.getByText('"running shoes"')).toBeInTheDocument();
    expect(screen.getByText('Midnight Runner Sneakers')).toBeInTheDocument();
  });
});
