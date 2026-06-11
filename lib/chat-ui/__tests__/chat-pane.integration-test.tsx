import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPane } from '@/lib/chat-ui';
import type { ChatIdentityAdapter } from '@/lib/chat-ui';
import type { ChatProduct } from '@/types/product';

const TEST_PRODUCT: ChatProduct = {
  id: 'p-1',
  title: 'Test Sneakers',
  price: '$89.00',
  description: 'A test product.',
};

const mockAdapter: ChatIdentityAdapter = {
  endpoint: '/api/chat',
  getAuthHeaders: async () => ({}),
  getRequestBody: async () => ({}),
};

const DEFAULT_MESSAGES = [
  {
    id: 'assistant-1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Earlier suggestions are ready.' }],
  },
];

const { getMessages, sendMessage, setMessages, getStatus, setStatus } = vi.hoisted(() => {
  let messages: { id: string; role: string; parts: { type: string; text: string }[] }[] = [];
  let status = 'ready';

  return {
    getMessages: () => messages,
    sendMessage: vi.fn(),
    setMessages: (nextMessages: typeof messages) => {
      messages = nextMessages;
    },
    getStatus: () => status,
    setStatus: (nextStatus: string) => {
      status = nextStatus;
    },
  };
});

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: getMessages(),
    sendMessage,
    status: getStatus(),
  }),
}));

describe('ChatPane', () => {
  beforeEach(() => {
    setMessages(DEFAULT_MESSAGES);
    setStatus('ready');
    sendMessage.mockClear();
  });

  it('renders product cards from tool-searchCatalog parts on the assistant response', async () => {
    const onHistoryAdd = vi.fn();
    const onToggleSave = vi.fn();

    const { rerender } = render(
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set([TEST_PRODUCT.id])}
        onToggleSave={onToggleSave}
        onHistoryAdd={onHistoryAdd}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(/search your catalog/i),
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
      {
        id: 'assistant-3',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Two more matches below.' },
          {
            type: 'tool-searchCatalog',
            state: 'output-available',
            output: [
              { ...TEST_PRODUCT, id: 'p-2', title: 'Trail Sneakers' },
              { ...TEST_PRODUCT, id: 'p-3', title: 'Road Sneakers' },
            ],
            input: {},
            toolCallId: 't2',
          } as never,
        ],
      },
    ]);

    rerender(
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set([TEST_PRODUCT.id])}
        onToggleSave={onToggleSave}
        onHistoryAdd={onHistoryAdd}
      />,
    );

    expect(screen.getByText('Earlier suggestions are ready.')).toBeInTheDocument();
    expect(screen.getByText('Fresh running options for you.')).toBeInTheDocument();
    expect(screen.getByText(TEST_PRODUCT.title)).toBeInTheDocument();

    // Action row reflects the tool-searchCatalog output length for its message,
    // singular and plural.
    expect(
      screen.getByText((_, element) => element?.textContent === '1 grounded result'),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '2 grounded results'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove saved product/i }));
    expect(onToggleSave).toHaveBeenCalledWith(TEST_PRODUCT);
  });

  it('renders the EmptyChat cards variant when there are no messages', () => {
    setMessages([]);

    render(
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set<string>()}
        onToggleSave={vi.fn()}
        onHistoryAdd={vi.fn()}
        catalogCount={151}
      />,
    );

    expect(screen.getByText(/hi there/i)).toBeInTheDocument();
    expect(screen.getByText(/151 products/)).toBeInTheDocument();
  });

  it('picking a suggested prompt from the empty state submits it', () => {
    setMessages([]);
    const onHistoryAdd = vi.fn();

    render(
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set<string>()}
        onToggleSave={vi.fn()}
        onHistoryAdd={onHistoryAdd}
      />,
    );

    fireEvent.click(screen.getByText('Something to drink coffee out of'));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Something to drink coffee out of' });
    expect(onHistoryAdd).toHaveBeenCalledTimes(1);
  });

  it('submits autoSubmitQuery exactly once per id', () => {
    setMessages([]);
    const onHistoryAdd = vi.fn();

    const renderPane = (autoSubmitQuery: { id: number; query: string } | null) => (
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set<string>()}
        onToggleSave={vi.fn()}
        onHistoryAdd={onHistoryAdd}
        autoSubmitQuery={autoSubmitQuery}
      />
    );

    const { rerender } = render(renderPane(null));
    expect(sendMessage).not.toHaveBeenCalled();

    rerender(renderPane({ id: 1, query: 'red mug' }));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'red mug' });
    expect(onHistoryAdd).toHaveBeenCalledTimes(1);

    rerender(renderPane({ id: 1, query: 'red mug' }));
    expect(sendMessage).toHaveBeenCalledTimes(1);

    rerender(renderPane({ id: 2, query: 'blue mug' }));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'blue mug' });
  });

  it('auto-scrolls the messages container to the bottom when messages change', () => {
    const props = {
      adapter: mockAdapter,
      savedProductIds: new Set<string>(),
      onToggleSave: vi.fn(),
      onHistoryAdd: vi.fn(),
    };

    const { container, rerender } = render(<ChatPane {...props} />);
    const scrollArea = container.firstElementChild!.firstElementChild as HTMLDivElement;
    Object.defineProperty(scrollArea, 'scrollHeight', { configurable: true, value: 640 });

    setMessages([
      ...DEFAULT_MESSAGES,
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'more please' }] },
    ]);
    rerender(<ChatPane {...props} />);

    expect(scrollArea.scrollTop).toBe(640);
  });

  it('shows the thinking bubble while submitted and awaiting the assistant', () => {
    setMessages([
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'red mug' }] },
    ]);
    setStatus('submitted');

    render(
      <ChatPane
        adapter={mockAdapter}
        savedProductIds={new Set<string>()}
        onToggleSave={vi.fn()}
        onHistoryAdd={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: /thinking/i })).toBeInTheDocument();
  });
});
