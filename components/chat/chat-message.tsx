import { cn } from '@/lib/utils';
import { cva } from "class-variance-authority";
import { forwardRef, ReactNode } from "react";
import { ChatStatus, UIDataTypes, UIMessage, UITools } from "ai";
import { MessageParts } from './message-parts';
import type { ChatProduct } from '@/types/product';

const messageVariants = cva("flex flex-col gap-2 p-4 rounded-lg", {
  variants: {
    variant: {
      user: "bg-blue-500 self-end text-white rounded-br-none [&_a]:text-white",
      assistant: "bg-gray-50 self-start rounded-tl-none border border-gray-200",
    },
  },
});

interface ChatMessageProps {
  message: UIMessage<unknown, UIDataTypes, UITools>;
  additionalComponents?: ReactNode;
  status?: ChatStatus;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
}

export const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  (
    {
      message,
      additionalComponents,
      status,
      savedProductIds,
      onToggleSave,
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
    const partsTextHasIframe = partsToRender?.some(
      (part) => part.type === "text" && part.text.includes("<iframe")
    );

    return (
      <div
        className={cn(
          "relative group",
          "flex flex-col gap-2 max-w-full",
          isAiMessage ? "self-start" : "self-end",
          partsTextHasIframe ? "w-full" : ""
        )}
      >
        <div
          ref={ref}
          className={cn(
            "flex gap-2 self-end max-w-full",
            partsTextHasIframe ? "w-full" : ""
          )}
        >
          {isAiMessage && (
            // <Image
            //   src="/images/logo-avatar.svg"
            //   alt="logo-favicon"
            //   width="40"
            //   height="40"
            //   className="self-start translate-y-[-50%]"
            // />
            <div className="flex items-center justify-center rounded-full bg-blue-100 text-blue-400 w-8 h-8 min-w-8 min-h-8">
              S
            </div>
          )}
          <div
            className={cn(
              "overflow-hidden max-w-full",
              isAiMessage ? "max-w-[calc(100%-40px)]" : "max-w-md",
              partsTextHasIframe ? "w-full" : ""
            )}
          >
            {!!hasContent && (
              <div
                className={cn(
                  messageVariants({ variant: role as "user" | "assistant" })
                )}
              >
                {!!partsToRender?.length && (
                  <MessageParts
                    status={status}
                    parts={partsToRender}
                    messageId={id}
                    savedProductIds={savedProductIds}
                    onToggleSave={onToggleSave}
                  />
                )}
              </div>
            )}
            {additionalComponents}
          </div>
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
