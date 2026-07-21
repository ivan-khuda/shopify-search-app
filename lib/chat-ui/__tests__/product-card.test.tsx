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

describe('ProductCard — product page links', () => {
  const PRODUCT_WITH_HANDLE: ChatProduct = {
    ...PRODUCT,
    handle: 'midnight-runner',
  };

  it('standard: VIEW → is a link to /products/{handle} when handle is set', () => {
    const { getByRole } = render(
      <ProductCard product={PRODUCT_WITH_HANDLE} isSaved={false} onSave={noop} />,
    );
    const link = getByRole('link', { name: /view/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/products/midnight-runner');
  });

  it('standard: VIEW → uses productUrlBase and linkTarget when provided', () => {
    const { getByRole } = render(
      <ProductCard
        product={PRODUCT_WITH_HANDLE}
        isSaved={false}
        onSave={noop}
        productUrlBase="https://example.myshopify.com"
        linkTarget="_blank"
      />,
    );
    const link = getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', 'https://example.myshopify.com/products/midnight-runner');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('standard: VIEW → stays as non-link span when no handle', () => {
    const { queryByRole, getByText } = render(
      <ProductCard product={PRODUCT} isSaved={false} onSave={noop} />,
    );
    expect(queryByRole('link')).toBeNull();
    expect(getByText(/view/i)).toBeInTheDocument();
  });

  it('hero: "View product →" is a link to /products/{handle} when handle is set', () => {
    const { getByRole } = render(
      <ProductCard product={PRODUCT_WITH_HANDLE} density="hero" isSaved={false} onSave={noop} />,
    );
    const link = getByRole('link', { name: /view product/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/products/midnight-runner');
  });

  it('hero: "View product →" stays as button when no handle', () => {
    const { getByRole } = render(
      <ProductCard product={PRODUCT} density="hero" isSaved={false} onSave={noop} />,
    );
    expect(getByRole('button', { name: /view product/i })).toBeInTheDocument();
  });

  it('compact: no VIEW affordance regardless of handle (density=compact hides it)', () => {
    const { queryByRole } = render(
      <ProductCard product={PRODUCT_WITH_HANDLE} density="compact" isSaved={false} onSave={noop} />,
    );
    // compact density hides the VIEW link entirely
    expect(queryByRole('link')).toBeNull();
  });
});
