import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Chat from '@/components/chat/chat';
import type { ChatProduct } from '@/types/product';

const TEST_PRODUCT: ChatProduct = {
  id: 'p-1',
  title: 'Test Sneakers',
  price: '$89.00',
  description: 'A test product.',
};

const { getMessages, sendMessage, setMessages } = vi.hoisted(() => {
  let messages = [
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Earlier suggestions are ready.' }],
    },
  ];

  return {
    getMessages: () => messages,
    sendMessage: vi.fn(),
    setMessages: (nextMessages: typeof messages) => {
      messages = nextMessages;
    },
  };
});

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: getMessages(),
    sendMessage,
    status: 'ready',
  }),
}));

describe('Chat', () => {
  it('renders product cards from tool-searchCatalog parts on the assistant response', async () => {
    const onHistoryAdd = vi.fn();
    const onToggleSave = vi.fn();

    setMessages([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Earlier suggestions are ready.' }],
      },
    ]);
    sendMessage.mockClear();

    const { rerender } = render(
      <Chat
        savedProducts={[TEST_PRODUCT]}
        onToggleSave={onToggleSave}
        onHistoryAdd={onHistoryAdd}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(/comfortable shoes for running/i),
      { target: { value: 'running shoes' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onHistoryAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          query: 'running shoes',
          productCount: 0,
        }),
      );
    });

    expect(sendMessage).toHaveBeenCalledWith({ text: 'running shoes' });
    expect(screen.queryByText(TEST_PRODUCT.title)).not.toBeInTheDocument();

    setMessages([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Earlier suggestions are ready.' }],
      },
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'running shoes' }],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Fresh running options for you.' },
          // The tool-searchCatalog part shape must match what Vercel AI SDK v6 emits;
          // cast as never because the test composes raw runtime objects rather than going through the SDK.
          { type: 'tool-searchCatalog', state: 'output-available', output: [TEST_PRODUCT], input: {}, toolCallId: 't1' } as never,
        ],
      },
    ]);

    rerender(
      <Chat
        savedProducts={[TEST_PRODUCT]}
        onToggleSave={onToggleSave}
        onHistoryAdd={onHistoryAdd}
      />,
    );

    expect(screen.getByText('Earlier suggestions are ready.')).toBeInTheDocument();
    expect(screen.getByText('Fresh running options for you.')).toBeInTheDocument();
    expect(screen.getByText(TEST_PRODUCT.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove saved product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(TEST_PRODUCT);
  });
});
