import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatShell } from '../chat-shell';

/**
 * "New Chat" must start a fresh conversation, not just switch to the chat
 * tab. ChatShell does this by remounting ChatPane via a key counter — a
 * remount discards the useChat message state inside the pane. The stub
 * records mounts so the test can observe the remount.
 */

const { mounts } = vi.hoisted(() => ({ mounts: [] as number[] }));

vi.mock('@/lib/chat-ui', () => ({
  ChatPane: () => {
    useEffect(() => {
      mounts.push(1);
    }, []);
    return <div data-testid="chat-pane-stub" />;
  },
  HistoryPanel: () => <div data-testid="history-stub" />,
  SavedProductsPanel: () => <div data-testid="saved-stub" />,
}));

describe('ChatShell — New Chat', () => {
  it('remounts ChatPane so the conversation starts fresh', () => {
    render(<ChatShell shop="test.myshopify.com" />);
    expect(mounts.length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /new chat/i }));

    expect(mounts.length).toBe(2);
    expect(screen.getByTestId('chat-pane-stub')).toBeInTheDocument();
  });
});
