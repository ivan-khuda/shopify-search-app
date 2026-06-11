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
  it('shows the dashed empty-state card when there are no saved products', () => {
    render(<SavedProductsPanel products={[]} onToggleSave={vi.fn()} />);
    expect(screen.getByText('Nothing saved')).toBeInTheDocument();
  });

  it('shows the bookmarked-count subheading', () => {
    render(<SavedProductsPanel products={[product]} onToggleSave={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Saved products' })).toBeInTheDocument();
    expect(screen.getByText(/1 item bookmarked/i)).toBeInTheDocument();
  });

  it('pluralizes the bookmarked count', () => {
    render(
      <SavedProductsPanel
        products={[product, { ...product, id: '2', title: 'Trail Mug' }]}
        onToggleSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 items bookmarked/i)).toBeInTheDocument();
  });

  it('renders saved products and forwards save toggles', () => {
    const onToggleSave = vi.fn();

    render(<SavedProductsPanel products={[product]} onToggleSave={onToggleSave} />);

    fireEvent.click(screen.getByRole('button', { name: /remove saved product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(product);
  });

  it('uses the five-column compact grid when density="compact"', () => {
    const { container } = render(
      <SavedProductsPanel products={[product]} onToggleSave={vi.fn()} density="compact" />,
    );
    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
    expect(grid!.className).toContain('lg:grid-cols-5');
    expect(grid!.className).toContain('grid-cols-2');
  });

  it('uses the standard four-column grid by default', () => {
    const { container } = render(
      <SavedProductsPanel products={[product]} onToggleSave={vi.fn()} />,
    );
    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
    expect(grid!.className).toContain('lg:grid-cols-4');
  });

  it('downgrades hero density to standard cards in the standard grid', () => {
    const { container } = render(
      <SavedProductsPanel products={[product]} onToggleSave={vi.fn()} density="hero" />,
    );
    const grid = container.querySelector('.grid');
    expect(grid!.className).toContain('lg:grid-cols-4');
    // standard card (not the hero two-column layout)
    expect(container.querySelector('.grid-cols-\\[200px_1fr\\]')).toBeNull();
  });
});
