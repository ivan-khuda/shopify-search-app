'use client';
// Message bubble shells from the design handoff (chat.jsx Message):
// user = accent bubble right-aligned; assistant = SDLogo avatar + content
// column (searching pill / product grid / white text bubble via MessageParts)
// plus the Helpful/Copy/grounded-results action row once streaming settles.

import { forwardRef, ReactNode } from "react";
import { ChatStatus, UIDataTypes, UIMessage, UITools } from "ai";
import { MessageParts } from './message-parts';
import { SDLogo } from './sd-logo';
import type { ChatProduct } from '@/types/product';
import type { CardDensity } from '../appearance';

interface ChatMessageProps {
  message: UIMessage<unknown, UIDataTypes, UITools>;
  additionalComponents?: ReactNode;
  status?: ChatStatus;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
  density?: CardDensity;
  /** Result count from the message's tool-searchCatalog output (computed in ChatPane). */
  groundedCount?: number;
  productUrlBase?: string;
  linkTarget?: '_blank' | '_self';
}

export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  (
    {
      message,
      additionalComponents,
      status,
      savedProductIds,
      onToggleSave,
      density = 'standard',
      groundedCount,
      productUrlBase,
      linkTarget,
    },
    ref
  ) => {

    const { role, parts, id } = message;

    const isAiMessage = role === "assistant";

    let partsToRender = parts;

    if (status === "streaming" && !partsToRender?.length) {
      partsToRender = [
        {
          type: "text",
          text: "Thinking...",
        },
      ];
    }

    const hasContent = !!partsToRender?.length;

    if (!isAiMessage) {
      return (
        <div ref={ref} className="flex w-full justify-end">
          <div className="max-w-[480px] rounded-[14px] rounded-br-[4px] bg-[var(--sd-accent,#5B4FE9)] px-3.5 py-2.5 text-sm leading-[1.5] text-white shadow-[0_1px_2px_rgba(91,79,233,0.3)] [&_a]:text-white">
            {hasContent && (
              <MessageParts
                parts={partsToRender}
                messageId={id}
                variant="user"
                savedProductIds={savedProductIds}
                onToggleSave={onToggleSave}
                productUrlBase={productUrlBase}
                linkTarget={linkTarget}
              />
            )}
            {additionalComponents}
          </div>
        </div>
      );
    }

    const textContent = (parts ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n\n');

    const resultCount = groundedCount ?? 0;
    const showActions =
      hasContent && status !== 'streaming' && status !== 'submitted';

    return (
      <div ref={ref} className="flex w-full items-start gap-2.5">
        <SDLogo size={28} />
        <div className="min-w-0 flex-1">
          {hasContent && (
            <MessageParts
              parts={partsToRender}
              messageId={id}
              density={density}
              savedProductIds={savedProductIds}
              onToggleSave={onToggleSave}
              productUrlBase={productUrlBase}
              linkTarget={linkTarget}
            />
          )}
          {additionalComponents}
          {showActions && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8c9196]">
              <button type="button" className="rounded px-1.5 py-0.5">👍 Helpful</button>
              <button type="button" className="rounded px-1.5 py-0.5">👎</button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5"
                onClick={() => navigator.clipboard?.writeText(textContent)}
              >
                📋 Copy
              </button>
              <span className="ml-auto flex items-center gap-1">
                <span className="h-[5px] w-[5px] rounded-full bg-[#008060]" />
                {resultCount} grounded result{resultCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
