/**
 * DrawerChat — chat pane over useChatController (drawer-redesign Task 7).
 *
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerChat (508–569).
 * Mocks @ai-sdk/react (same idiom as use-chat-controller.test.tsx) so the
 * REAL useChatController drives submit/auto-submit/scroll semantics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatIdentityAdapter } from '@/lib/chat-ui';

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

import { DrawerChat } from '@/extensions-src/chat-drawer/components/DrawerChat';
import { DRAWER_BUILTIN_GREETING } from '@/extensions-src/chat-drawer/components/DrawerEmpty';

const mockAdapter: ChatIdentityAdapter = {
  endpoint: '/apps/smartdiscovery/chat',
  getAuthHeaders: async () => ({}),
  getRequestBody: async () => ({}),
};

function baseProps() {
  return {
    adapter: mockAdapter,
    savedProductIds: new Set<string>(),
    onToggleSave: vi.fn(),
    onHistoryAdd: vi.fn(),
  };
}

beforeEach(() => {
  setMessages([]);
  setStatus('ready');
  sendMessage.mockClear();
});

describe('DrawerChat — empty state', () => {
  it('renders DrawerEmpty with the builtin greeting and submits a picked prompt', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<DrawerChat {...props} />);

    expect(screen.getByText(DRAWER_BUILTIN_GREETING)).toBeInTheDocument();

    await user.click(screen.getByText('Something to drink coffee out of'));
    expect(sendMessage).toHaveBeenCalledWith({ text: 'Something to drink coffee out of' });
    expect(props.onHistoryAdd).toHaveBeenCalledTimes(1);
  });

  it('threads merchant greeting and prompts into DrawerEmpty', () => {
    render(
      <DrawerChat
        {...baseProps()}
        greeting="Welcome to Acme!"
        prompts={[{ icon: '☕', text: 'Best pour-over gear?' }]}
      />,
    );

    expect(screen.getByText('Welcome to Acme!')).toBeInTheDocument();
    expect(screen.getByText('Best pour-over gear?')).toBeInTheDocument();
  });
});

describe('DrawerChat — conversation', () => {
  it('maps messages to DrawerMessage bubbles', () => {
    setMessages([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'red mug' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Two picks below.' }] },
    ]);
    render(<DrawerChat {...baseProps()} />);

    expect(screen.getByText('red mug')).toBeInTheDocument();
    expect(screen.getByText('Two picks below.')).toBeInTheDocument();
    expect(screen.queryByText(DRAWER_BUILTIN_GREETING)).not.toBeInTheDocument();
  });

  it('shows the thinking bubble while submitted with a trailing user message', () => {
    setMessages([{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'red mug' }] }]);
    setStatus('submitted');
    render(<DrawerChat {...baseProps()} />);

    expect(screen.getByRole('status', { name: 'Assistant is thinking' })).toBeInTheDocument();
  });

  it('does not show the thinking bubble once the assistant replies', () => {
    setMessages([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'red mug' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Here.' }] },
    ]);
    setStatus('streaming');
    render(<DrawerChat {...baseProps()} />);

    expect(
      screen.queryByRole('status', { name: 'Assistant is thinking' }),
    ).not.toBeInTheDocument();
  });
});

describe('DrawerChat — composer', () => {
  it('sends on Enter, records history, and clears the input', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<DrawerChat {...props} />);

    const input = screen.getByPlaceholderText('Ask anything…');
    await user.type(input, 'linen apron{Enter}');

    expect(sendMessage).toHaveBeenCalledWith({ text: 'linen apron' });
    expect(props.onHistoryAdd).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('does NOT send on Enter while an IME composition is in progress', async () => {
    const user = userEvent.setup();
    render(<DrawerChat {...baseProps()} />);

    const input = screen.getByPlaceholderText('Ask anything…');
    await user.type(input, 'ラーメン');

    // Enter mid-composition confirms the IME candidate — never the message.
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(input).toHaveValue('ラーメン');
  });

  it('send button submits the typed query', async () => {
    const user = userEvent.setup();
    render(<DrawerChat {...baseProps()} />);

    await user.type(screen.getByPlaceholderText('Ask anything…'), 'ceramic vase');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(sendMessage).toHaveBeenCalledWith({ text: 'ceramic vase' });
  });

  it('disables the send button when the input is empty', () => {
    render(<DrawerChat {...baseProps()} />);

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('disables sending while streaming', async () => {
    const user = userEvent.setup();
    setMessages([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'red mug' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Here' }] },
    ]);
    setStatus('streaming');
    render(<DrawerChat {...baseProps()} />);

    const input = screen.getByPlaceholderText('Ask anything…');
    await user.type(input, 'another query');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('renders the footer copy', () => {
    render(<DrawerChat {...baseProps()} />);

    expect(
      screen.getByText('Powered by SmartDiscovery AI · Conversations stay on your store'),
    ).toBeInTheDocument();
  });
});

describe('DrawerChat — history resume', () => {
  it('auto-submits autoSubmitQuery once and reports consumption', () => {
    const onAutoSubmitConsumed = vi.fn();
    const props = baseProps();
    const { rerender } = render(
      <DrawerChat {...props} autoSubmitQuery={null} onAutoSubmitConsumed={onAutoSubmitConsumed} />,
    );

    expect(sendMessage).not.toHaveBeenCalled();

    rerender(
      <DrawerChat
        {...props}
        autoSubmitQuery={{ id: 1, query: 'blue running shoes' }}
        onAutoSubmitConsumed={onAutoSubmitConsumed}
      />,
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'blue running shoes' });
    expect(onAutoSubmitConsumed).toHaveBeenCalledTimes(1);
  });
});
