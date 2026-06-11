import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HistoryPanel } from '@/lib/chat-ui';
import type { ChatHistoryItem } from '@/types/product';

const items: ChatHistoryItem[] = [
  {
    id: '1',
    query: 'running shoes',
    timestamp: '10:30 AM',
    productCount: 3,
  },
];

describe('HistoryPanel', () => {
  it('renders the redesigned header copy', () => {
    render(<HistoryPanel items={[]} onClear={vi.fn()} onResume={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Search history' })).toBeInTheDocument();
    expect(
      screen.getByText('Conversations from this preview session'),
    ).toBeInTheDocument();
  });

  it('shows the dashed empty-state card when there is no history', () => {
    render(<HistoryPanel items={[]} onClear={vi.fn()} onResume={vi.fn()} />);
    expect(screen.getByText('No history yet')).toBeInTheDocument();
    // Clear all is hidden while the list is empty (prototype line 706).
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('renders each history item when data exists', () => {
    render(<HistoryPanel items={items} onClear={vi.fn()} onResume={vi.fn()} />);

    expect(screen.getByText('running shoes')).toBeInTheDocument();
    expect(screen.getByText(/3 results/i)).toBeInTheDocument();
  });

  it('uses singular "result" for a single-product entry', () => {
    render(
      <HistoryPanel
        items={[{ ...items[0], productCount: 1 }]}
        onClear={vi.fn()}
        onResume={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 result$/i)).toBeInTheDocument();
  });

  it('calls onResume with the row query when a history row is clicked', () => {
    const onResume = vi.fn();

    render(<HistoryPanel items={items} onClear={vi.fn()} onResume={onResume} />);

    fireEvent.click(screen.getByRole('button', { name: /running shoes/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledWith('running shoes');
  });

  it('calls onClear when clear all is clicked', () => {
    const onClear = vi.fn();

    render(<HistoryPanel items={items} onClear={onClear} onResume={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
