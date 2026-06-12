'use client';
/**
 * DrawerChat — drawer chat pane over the headless useChatController
 * (drawer-redesign Task 7).
 *
 * Translated 1:1 from the design handoff (storefront.jsx DrawerChat,
 * 508–569): scrollable message column over #fafafa, compact composer with
 * Enter-to-send and an accent send button, "Powered by SmartDiscovery AI"
 * footer. The drawer uses submitText only — it never constructs an admin
 * PromptInputMessage.
 */
import { useState } from 'react';
import { useChatController } from '@/lib/chat-ui';
import type { ChatIdentityAdapter } from '@/lib/chat-ui';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { SuggestedPrompt } from '@/lib/settings/contract';
import { DrawerEmpty } from './DrawerEmpty';
import { DrawerMessage } from './DrawerMessage';
import { DrawerThinking } from './DrawerThinking';

interface DrawerChatProps {
  adapter: ChatIdentityAdapter;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
  onHistoryAdd: (entry: ChatHistoryItem) => void;
  /** History-resume: submitted once per id change (see useChatController). */
  autoSubmitQuery?: { id: number; query: string } | null;
  onAutoSubmitConsumed?: () => void;
  /** Merchant greeting/prompts threaded into DrawerEmpty. */
  greeting?: string | null;
  prompts?: SuggestedPrompt[] | null;
}

export function DrawerChat({
  adapter,
  savedProductIds,
  onToggleSave,
  onHistoryAdd,
  autoSubmitQuery,
  onAutoSubmitConsumed,
  greeting,
  prompts,
}: DrawerChatProps) {
  const { messages, status, submitText, scrollRef } = useChatController({
    adapter,
    onHistoryAdd,
    autoSubmitQuery,
    onAutoSubmitConsumed,
  });
  const [input, setInput] = useState('');

  const isBusy = status === 'submitted' || status === 'streaming';
  const lastMessage = messages[messages.length - 1];
  const showThinking = status === 'submitted' && lastMessage?.role === 'user';
  const hasMessages = messages.length > 0;
  const canSend = Boolean(input.trim()) && !isBusy;

  const send = (text: string): void => {
    const query = text.trim();
    if (!query || isBusy) return;
    setInput('');
    submitText(query);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto bg-[#fafafa] ${hasMessages ? 'p-3.5' : 'p-0'}`}
      >
        {hasMessages ? (
          <div className="flex flex-col gap-3">
            {messages.map((message, index) => (
              <DrawerMessage
                key={message.id}
                message={message}
                savedProductIds={savedProductIds}
                onToggleSave={onToggleSave}
                isStreaming={
                  status === 'streaming' &&
                  index === messages.length - 1 &&
                  message.role === 'assistant'
                }
              />
            ))}
            {showThinking && <DrawerThinking />}
          </div>
        ) : (
          <DrawerEmpty greeting={greeting} prompts={prompts} onPick={send} />
        )}
      </div>

      <div className="shrink-0 border-t border-[#ededed] bg-white p-3">
        <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-[#d4d4d4] bg-white px-2.5 py-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask anything…"
            className="flex-1 border-none bg-transparent px-1 py-1.5 text-[13.5px] text-[#1a1a1a] outline-none placeholder:text-[#a0a0a0]"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={() => send(input)}
            disabled={!canSend}
            className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border-none text-white ${
              canSend ? 'cursor-pointer bg-[var(--sd-accent,#5B4FE9)]' : 'cursor-not-allowed bg-[#d4d4d4]'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-center text-[10.5px] text-[#a0a0a0]">
          Powered by SmartDiscovery AI · Conversations stay on your store
        </div>
      </div>
    </div>
  );
}
