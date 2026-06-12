/**
 * DrawerSaved — saved items pane (drawer-redesign Task 7).
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerSaved (802–826).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawerSaved } from '@/extensions-src/chat-drawer/components/DrawerSaved';
import type { ChatProduct } from '@/types/product';

const products: ChatProduct[] = [
  { id: 'p-1', title: 'Stoneware Mug', price: '$24.00', description: '', handle: 'stoneware-mug' },
  { id: 'p-2', title: 'Linen Apron', price: '$48.00', description: '' },
];

describe('DrawerSaved', () => {
  it('renders the kicker and saved rows (isSaved=true)', () => {
    render(<DrawerSaved products={products} onToggleSave={vi.fn()} />);

    expect(screen.getByText('Your saved items')).toBeInTheDocument();
    expect(screen.getByText('Stoneware Mug')).toBeInTheDocument();
    expect(screen.getByText('Linen Apron')).toBeInTheDocument();
    // Every row renders as saved → hearts offer removal.
    expect(screen.getAllByRole('button', { name: 'Remove saved product' })).toHaveLength(2);
  });

  it('fires onToggleSave with the row product', async () => {
    const user = userEvent.setup();
    const onToggleSave = vi.fn();
    render(<DrawerSaved products={products} onToggleSave={onToggleSave} />);

    await user.click(screen.getAllByRole('button', { name: 'Remove saved product' })[0]);
    expect(onToggleSave).toHaveBeenCalledWith(products[0]);
  });

  it('shows the empty copy without saved products', () => {
    render(<DrawerSaved products={[]} onToggleSave={vi.fn()} />);

    expect(screen.getByText('Tap the heart on a product to save it here.')).toBeInTheDocument();
  });
});
