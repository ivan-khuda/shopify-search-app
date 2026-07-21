import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatController } from '@/lib/chat-ui';
import type { ChatIdentityAdapter } from '@/lib/chat-ui';
import type { UIMessage } from 'ai';

const mockAdapter: ChatIdentityAdapter = {
  endpoint: '/api/chat',
  getAuthHeaders: async () => ({}),
  getRequestBody: async () => ({}),
};

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

describe('useChatController', () => {
  beforeEach(() => {
    setMessages([]);
    setStatus('ready');
    sendMessage.mockClear();
  });

  it('exposes messages and status from useChat', () => {
    setMessages([
      { id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Hello.' }] },
    ]);
    setStatus('streaming');

    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd: vi.fn() }),
    );

    expect(result.current.messages).toEqual(getMessages());
    expect(result.current.status).toBe('streaming');
    expect(result.current.scrollRef).toEqual(expect.objectContaining({ current: null }));
  });

  it('submitText trims the query, records history, and sends the message', () => {
    const onHistoryAdd = vi.fn();
    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd }),
    );

    act(() => result.current.submitText('  red mug  '));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'red mug' });
    expect(onHistoryAdd).toHaveBeenCalledTimes(1);
    expect(onHistoryAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        query: 'red mug',
        productCount: 0,
      }),
    );
  });

  it('submitText ignores empty and whitespace-only queries', () => {
    const onHistoryAdd = vi.fn();
    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd }),
    );

    act(() => result.current.submitText(''));
    act(() => result.current.submitText('   '));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(onHistoryAdd).not.toHaveBeenCalled();
  });

  it('handleSubmit routes text messages through submitText', () => {
    const onHistoryAdd = vi.fn();
    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd }),
    );

    act(() => result.current.handleSubmit({ text: 'running shoes', files: [] }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'running shoes' });
    expect(onHistoryAdd).toHaveBeenCalledTimes(1);
  });

  it('handleSubmit forwards attachments-only submissions without history', () => {
    const onHistoryAdd = vi.fn();
    const files = [
      { type: 'file' as const, mediaType: 'image/png', url: 'blob:1' },
    ];
    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd }),
    );

    act(() => result.current.handleSubmit({ text: '   ', files }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: '', files });
    expect(onHistoryAdd).not.toHaveBeenCalled();
  });

  it('handleSubmit ignores submissions with neither text nor attachments', () => {
    const onHistoryAdd = vi.fn();
    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd }),
    );

    act(() => result.current.handleSubmit({ text: '  ', files: [] }));

    expect(sendMessage).not.toHaveBeenCalled();
    expect(onHistoryAdd).not.toHaveBeenCalled();
  });

  it('submits autoSubmitQuery exactly once per id and reports consumption', () => {
    const onHistoryAdd = vi.fn();
    const onAutoSubmitConsumed = vi.fn();

    const { rerender } = renderHook(
      ({ autoSubmitQuery }: { autoSubmitQuery: { id: number; query: string } | null }) =>
        useChatController({
          adapter: mockAdapter,
          onHistoryAdd,
          autoSubmitQuery,
          onAutoSubmitConsumed,
        }),
      { initialProps: { autoSubmitQuery: null as { id: number; query: string } | null } },
    );

    expect(sendMessage).not.toHaveBeenCalled();
    expect(onAutoSubmitConsumed).not.toHaveBeenCalled();

    rerender({ autoSubmitQuery: { id: 1, query: 'red mug' } });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ text: 'red mug' });
    expect(onHistoryAdd).toHaveBeenCalledTimes(1);
    expect(onAutoSubmitConsumed).toHaveBeenCalledTimes(1);

    rerender({ autoSubmitQuery: { id: 1, query: 'red mug' } });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(onAutoSubmitConsumed).toHaveBeenCalledTimes(1);

    rerender({ autoSubmitQuery: { id: 2, query: 'blue mug' } });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith({ text: 'blue mug' });
    expect(onAutoSubmitConsumed).toHaveBeenCalledTimes(2);
  });

  it('auto-scrolls the attached element to the bottom when messages change', () => {
    const { result, rerender } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd: vi.fn() }),
    );

    const fakeEl = { scrollTop: 0, scrollHeight: 640 } as HTMLDivElement;
    result.current.scrollRef.current = fakeEl;

    setMessages([
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'more please' }] },
    ]);
    rerender();

    expect(fakeEl.scrollTop).toBe(640);
  });

  it('groundedCountFor sums tool-searchCatalog output lengths for a message', () => {
    const { result } = renderHook(() =>
      useChatController({ adapter: mockAdapter, onHistoryAdd: vi.fn() }),
    );

    const message = {
      id: 'assistant-2',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Two matches below.' },
        {
          type: 'tool-searchCatalog',
          state: 'output-available',
          output: [{ id: 'p-2' }, { id: 'p-3' }],
          input: {},
          toolCallId: 't2',
        } as never,
      ],
    } as UIMessage;

    expect(result.current.groundedCountFor(message)).toBe(2);
    expect(
      result.current.groundedCountFor({
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'No tools.' }],
      } as UIMessage),
    ).toBe(0);
  });
});
