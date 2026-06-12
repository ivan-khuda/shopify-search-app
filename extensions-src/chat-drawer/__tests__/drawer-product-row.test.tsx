/**
 * DrawerProductRow — compact product row (drawer-redesign Task 6).
 *
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerProduct (678–727).
 * 64px image | kicker/title/price | heart + arrow-link column.
 * Links are SAME-ORIGIN relative `/products/{handle}`; no handle → disabled button.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawerProductRow } from '@/extensions-src/chat-drawer/components/DrawerProductRow';
import type { ChatProduct } from '@/types/product';

const product: ChatProduct = {
  id: 'p-1',
  title: 'Stoneware Mug',
  price: '$24.00',
  description: 'A mug.',
  image: 'https://cdn.example.com/mug.jpg',
  handle: 'stoneware-mug',
  type: 'Drinkware',
};

describe('DrawerProductRow', () => {
  it('renders the 64px image grid with kicker, title, and price', () => {
    render(<DrawerProductRow product={product} isSaved={false} onToggleSave={vi.fn()} />);

    const row = screen.getByText('Stoneware Mug').closest('[class*="grid-cols-[64px_1fr_auto]"]');
    expect(row).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Stoneware Mug' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/mug.jpg',
    );
    expect(screen.getByText('Drinkware')).toBeInTheDocument();
    expect(screen.getByText('$24.00')).toBeInTheDocument();
  });

  it('heart toggles save with state-dependent aria-label', async () => {
    const user = userEvent.setup();
    const onToggleSave = vi.fn();
    const { rerender } = render(
      <DrawerProductRow product={product} isSaved={false} onToggleSave={onToggleSave} />,
    );

    const heart = screen.getByRole('button', { name: 'Save product' });
    await user.click(heart);
    expect(onToggleSave).toHaveBeenCalledTimes(1);

    rerender(<DrawerProductRow product={product} isSaved onToggleSave={onToggleSave} />);
    const unsave = screen.getByRole('button', { name: 'Remove saved product' });
    expect(unsave.querySelector('svg')).toHaveAttribute('fill', '#e53e3e');
  });

  it('renders the arrow as a same-origin relative product link', () => {
    render(<DrawerProductRow product={product} isSaved={false} onToggleSave={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'View Stoneware Mug' });
    expect(link).toHaveAttribute('href', '/products/stoneware-mug');
  });

  it('renders a disabled button instead of a link when handle is missing', () => {
    render(
      <DrawerProductRow
        product={{ ...product, handle: undefined }}
        isSaved={false}
        onToggleSave={vi.fn()}
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Stoneware Mug' })).toBeDisabled();
  });
});
