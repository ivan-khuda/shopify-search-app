/**
 * DrawerHistory — past conversations pane (drawer-redesign Task 7).
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerHistory (748–800).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawerHistory } from '@/extensions-src/chat-drawer/components/DrawerHistory';
import type { ChatHistoryItem } from '@/types/product';

const items: ChatHistoryItem[] = [
  { id: 'h1', query: 'red mug', timestamp: '10:01 AM', productCount: 3 },
  { id: 'h2', query: 'linen apron', timestamp: '10:05 AM', productCount: 1 },
];

describe('DrawerHistory', () => {
  it('renders the kicker, rows with metadata, and Clear', () => {
    render(<DrawerHistory items={items} onResume={vi.fn()} onClear={vi.fn()} />);

    expect(screen.getByText('Past conversations')).toBeInTheDocument();
    expect(screen.getByText('red mug')).toBeInTheDocument();
    expect(screen.getByText('10:01 AM · 3 results')).toBeInTheDocument();
    expect(screen.getByText('linen apron')).toBeInTheDocument();
    expect(screen.getByText('10:05 AM · 1 results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('fires onResume with the row query', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<DrawerHistory items={items} onResume={onResume} onClear={vi.fn()} />);

    await user.click(screen.getByText('red mug'));
    expect(onResume).toHaveBeenCalledWith('red mug');
  });

  it('fires onClear from the Clear button', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<DrawerHistory items={items} onResume={vi.fn()} onClear={onClear} />);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('hides Clear and shows the empty copy without items', () => {
    render(<DrawerHistory items={[]} onResume={vi.fn()} onClear={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByText('Your conversations show up here.')).toBeInTheDocument();
  });
});
