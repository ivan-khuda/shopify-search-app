import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChatProduct } from '@/types/product';
import { ProductCard } from '@/lib/chat-ui';

const PRODUCT: ChatProduct = {
  id: '1',
  title: 'Midnight Runner Sneakers',
  price: '$85.00',
  description: 'Breathable mesh running shoes for night joggers.',
  image: 'https://example.com/shoe.jpg',
  vendor: 'Field & Form',
  type: 'Footwear',
};

const noop = () => {};

describe('ProductCard', () => {
  it('renders product details and calls onSave when the heart button is clicked', () => {
    const onSave = vi.fn();

    render(<ProductCard product={PRODUCT} isSaved={false} onSave={onSave} />);

    expect(screen.getByText(PRODUCT.title)).toBeInTheDocument();
    expect(screen.getByText(PRODUCT.description)).toBeInTheDocument();
    expect(screen.getByText(PRODUCT.price)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save product/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('compact density hides kicker and description', () => {
    const { container, queryByText } = render(
      <ProductCard product={PRODUCT} density="compact" isSaved={false} onSave={noop} />,
    );
    expect(queryByText(PRODUCT.description!)).toBeNull();
    expect(container.firstElementChild!.className).toContain('rounded-lg');
  });

  it('hero density renders the horizontal layout with View product button', () => {
    const { getByRole } = render(
      <ProductCard product={PRODUCT} density="hero" isSaved={false} onSave={noop} />,
    );
    expect(getByRole('button', { name: /view product/i })).toBeInTheDocument();
  });

  it('defaults to standard density with VIEW link affordance', () => {
    const { getByText } = render(
      <ProductCard product={PRODUCT} isSaved={false} onSave={noop} />,
    );
    expect(getByText(/view/i)).toBeInTheDocument();
  });
});
