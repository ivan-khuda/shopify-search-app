'use client';
/**
 * DrawerMessage — compact message renderer (drawer-redesign Task 6).
 *
 * Translated 1:1 from the design handoff (storefront.jsx DrawerMessage,
 * 618–676). Consumes UIMessage parts directly.
 *
 * tool-searchCatalog renderer — discriminator narrowing (no direct ToolUIPart
 * cast). Vercel AI SDK v6 generates the dynamically-named tool union from the
 * tool registry passed to streamText, so the literal type 'tool-searchCatalog'
 * is not always present in the ambient union at the consumer site. The pattern
 * below uses (part.type === 'tool-searchCatalog' && 'state' in part) followed
 * by progressive part.state discriminator guards to narrow structurally —
 * replicated locally from lib/chat-ui/components/message-parts.tsx (which is
 * intentionally not exported from the barrel).
 */
import type { UIMessage } from 'ai';
// Sub-path import (NOT the `@/lib/chat-ui` barrel) — the barrel drags
// next/image into the storefront bundle (see DrawerBody.tsx).
import { SDLogo } from '@/lib/chat-ui/components/sd-logo';
import type { ChatProduct } from '@/types/product';
import { DrawerProductRow } from './DrawerProductRow';

interface DrawerMessageProps {
  message: UIMessage;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
  /** True while this (last assistant) message is still streaming — drives the blink cursor. */
  isStreaming?: boolean;
}

export function DrawerMessage({
  message,
  savedProductIds,
  onToggleSave,
  isStreaming = false,
}: DrawerMessageProps) {
  const parts = message.parts ?? [];

  if (message.role === 'user') {
    const text = parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[14px] rounded-br-[4px] bg-[var(--sd-accent,#5B4FE9)] px-3 py-2 text-[13.5px] leading-[1.45] text-white">
          {text}
        </div>
      </div>
    );
  }

  const lastTextIndex = parts.reduce(
    (last, part, index) => (part.type === 'text' ? index : last),
    -1,
  );

  return (
    <div className="flex items-start gap-2">
      <SDLogo size={26} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {parts.map((part, index) => {
          const key = `${message.id}-part-${index}`;

          if (part.type === 'tool-searchCatalog' && 'state' in part) {
            if (part.state === 'input-streaming' || part.state === 'input-available') {
              return (
                <div
                  key={key}
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-2 self-start rounded-[10px] border border-[#ededed] bg-white px-3 py-2 text-[12.5px] text-[#5c5c5c]"
                >
                  <span
                    aria-hidden="true"
                    className="h-[11px] w-[11px] animate-[sd-spin_0.8s_linear_infinite] rounded-full border-2 border-[color-mix(in_srgb,var(--sd-accent,#5B4FE9)_20%,transparent)] border-t-[var(--sd-accent,#5B4FE9)]"
                  />
                  Searching…
                </div>
              );
            }

            if (part.state === 'output-available') {
              const products = Array.isArray(part.output)
                ? part.output.filter(
                    (p): p is ChatProduct =>
                      !!p && typeof p === 'object' && typeof (p as ChatProduct).id === 'string',
                  )
                : [];

              if (products.length === 0) {
                return (
                  <div key={key} role="status" className="text-[12.5px] text-[#8c8c8c]">
                    No matching products — try a broader description.
                  </div>
                );
              }

              return (
                <div key={key} className="flex flex-col gap-2">
                  {products.map((product) => (
                    <DrawerProductRow
                      key={product.id}
                      product={product}
                      isSaved={savedProductIds.has(product.id)}
                      onToggleSave={() => onToggleSave(product)}
                    />
                  ))}
                </div>
              );
            }

            if (part.state === 'output-error') {
              return (
                <div key={key} role="status" className="text-[12.5px] text-[#8c8c8c]">
                  Couldn&apos;t fetch results — please try that search again.
                </div>
              );
            }

            // Unknown / unsupported states render nothing.
            return null;
          }

          if (part.type === 'text') {
            return (
              <div
                key={key}
                className="rounded-[10px] rounded-bl-[2px] border border-[#ededed] bg-white px-3 py-2 text-[13px] leading-[1.5] text-[#1a1a1a]"
              >
                {part.text}
                {isStreaming && index === lastTextIndex && (
                  <span
                    aria-hidden="true"
                    className="ml-[3px] inline-block h-3 w-1.5 animate-[sd-blink_1s_steps(2)_infinite] bg-[var(--sd-accent,#5B4FE9)] align-middle"
                  />
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
