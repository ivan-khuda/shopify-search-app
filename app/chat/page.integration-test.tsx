import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import ChatPage from '@/app/chat/page';

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

describe('ChatPage tabs', () => {
  it('shares history and saved product state across tabs', () => {
    render(<ChatPage />);

    expect(screen.getByText('No search history')).toBeInTheDocument();
    expect(screen.getByText('No saved products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add history item/i }));
    fireEvent.click(screen.getByRole('button', { name: /toggle saved product/i }));

    expect(screen.getByText('"running shoes"')).toBeInTheDocument();
    expect(screen.getByText('Midnight Runner Sneakers')).toBeInTheDocument();
  });
});
