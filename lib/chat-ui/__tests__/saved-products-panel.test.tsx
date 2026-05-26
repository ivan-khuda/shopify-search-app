import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SavedProductsPanel } from '@/lib/chat-ui';
import type { ChatProduct } from '@/types/product';

const product: ChatProduct = {
  id: '1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
};

describe('SavedProductsPanel', () => {
  it('shows the empty state when there are no saved products', () => {
    render(<SavedProductsPanel products={[]} onToggleSave={vi.fn()} />);
    expect(screen.getByText('No saved products')).toBeInTheDocument();
  });

  it('renders saved products and forwards save toggles', () => {
    const onToggleSave = vi.fn();

    render(<SavedProductsPanel products={[product]} onToggleSave={onToggleSave} />);

    fireEvent.click(screen.getByRole('button', { name: /remove saved product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(product);
  });
});
