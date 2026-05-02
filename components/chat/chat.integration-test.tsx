import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Chat from '@/components/chat/chat';
import { MOCK_PRODUCTS } from '@/components/chat/mock-products';

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
  it('attaches product cards to the newly generated assistant response', async () => {
    const onHistoryAdd = vi.fn();
    const onToggleSave = vi.fn();
    const savedProduct = MOCK_PRODUCTS[0];

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
        savedProducts={[savedProduct]}
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
          productCount: 1,
        }),
      );
    });

    expect(sendMessage).toHaveBeenCalledWith({ text: 'running shoes' });
    expect(screen.queryByText(savedProduct.title)).not.toBeInTheDocument();

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
        parts: [{ type: 'text', text: 'Fresh running options for you.' }],
      },
    ]);

    rerender(
      <Chat
        savedProducts={[savedProduct]}
        onToggleSave={onToggleSave}
        onHistoryAdd={onHistoryAdd}
      />,
    );

    expect(screen.getByText('Earlier suggestions are ready.')).toBeInTheDocument();
    expect(screen.getByText('Fresh running options for you.')).toBeInTheDocument();
    expect(screen.getByText(savedProduct.title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove saved product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(savedProduct);
  });
});
