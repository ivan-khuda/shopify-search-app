import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HistoryPanel } from '@/components/chat/history-panel';

describe('HistoryPanel', () => {
  it('shows the empty state when there is no history', () => {
    render(<HistoryPanel items={[]} onClear={vi.fn()} />);
    expect(screen.getByText('No search history')).toBeInTheDocument();
  });

  it('renders each history item when data exists', () => {
    render(
      <HistoryPanel
        items={[
          {
            id: '1',
            query: 'running shoes',
            timestamp: '10:30 AM',
            productCount: 3,
          },
        ]}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText('"running shoes"')).toBeInTheDocument();
    expect(screen.getByText(/3 results/i)).toBeInTheDocument();
  });

  it('calls onClear when clear all is clicked', () => {
    const onClear = vi.fn();

    render(<HistoryPanel items={[]} onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
