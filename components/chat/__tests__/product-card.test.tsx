import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChatProduct } from '@/types/product';
import { ProductCard } from '@/components/chat/product-card';

describe('ProductCard', () => {
  it('renders product details and calls onSave when the heart button is clicked', () => {
    const onSave = vi.fn();
    const product: ChatProduct = {
      id: '1',
      title: 'Midnight Runner Sneakers',
      price: '$85.00',
      description: 'Breathable mesh running shoes for night joggers.',
      image: 'https://example.com/shoe.jpg',
    };

    render(
      <ProductCard
        product={product}
        isSaved={false}
        onSave={onSave}
      />,
    );

    expect(screen.getByText(product.title)).toBeInTheDocument();
    expect(screen.getByText(product.description)).toBeInTheDocument();
    expect(screen.getByText(product.price)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
