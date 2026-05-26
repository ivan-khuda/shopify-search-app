/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import {
  ChatStatus,
  DynamicToolUIPart,
  StepStartUIPart,
  ToolUIPart,
  UIMessage,
} from "ai";
import { AlertCircle, Loader2, SearchX } from "lucide-react";

import { TextShimmer } from "../ui/text-shimmer";
import { Response } from "../ai-elements/response";
import { ProductCard } from "@/components/chat/product-card";
import type { ChatProduct } from "@/types/product";

type MessagePart = UIMessage["parts"][number];
type ToolLikeUIPart = ToolUIPart | DynamicToolUIPart;


const isStepStartPart = (part?: MessagePart): part is StepStartUIPart =>
  !!part && typeof part.type === "string" && part.type === "step-start";

const isToolLikePart = (part?: MessagePart): part is ToolLikeUIPart =>
  !!part &&
  typeof part.type === "string" &&
  (part.type === "dynamic-tool" || part.type.startsWith("tool-"));

const isRenderableTextPart = (part?: MessagePart) =>
  part?.type === "text" &&
  (part.text === "Thinking..." || part.text.trim().length > 0);

const isRenderableReasoningPart = (
  part: MessagePart | undefined,
) => part?.type === "reasoning" && part.text.trim().length > 0;

const isRenderableDataPart = (part?: MessagePart) =>
  !!part &&
  typeof part.type === "string" &&
  part.type.startsWith("data-") &&
  "data" in part &&
  !!part.data &&
  typeof part.data === "object" &&
  part.data !== null &&
  Object.keys(part.data).length > 0;

const hasRenderableContentAfter = (
  parts: MessagePart[],
  startIndex: number,
) => {
  for (let index = startIndex + 1; index < parts.length; index += 1) {
    const candidate = parts[index];

    const isRenderablePart =
      isRenderableTextPart(candidate) ||
      isRenderableReasoningPart(candidate) ||
      isRenderableDataPart(candidate);

    if (isRenderablePart) {
      return true;
    }
  }

  return false;
};

const shouldShowToolLoading = (
  parts: MessagePart[],
  part: ToolLikeUIPart,
  index: number,
) => {

  return !hasRenderableContentAfter(parts, index);
};

const findNearestToolNeighbor = (
  parts: MessagePart[],
  startIndex: number,
  direction: -1 | 1
) => {
  let cursor = startIndex + direction;

  while (cursor >= 0 && cursor < parts.length) {
    const candidate = parts[cursor];

    if (!candidate || candidate.type === "step-start") {
      cursor += direction;
      continue;
    }

    if (isToolLikePart(candidate)) {
      return { part: candidate, index: cursor };
    }

    break;
  }

  return null;
};

const shouldShowStepStartLoading = (
  parts: MessagePart[],
  index: number,
) => {
  const previousTool = findNearestToolNeighbor(parts, index, -1);
  if (
    previousTool &&
    shouldShowToolLoading(
      parts,
      previousTool.part,
      previousTool.index,
    )
  ) {
    return false;
  }

  const nextTool = findNearestToolNeighbor(parts, index, 1);
  if (
    nextTool &&
    shouldShowToolLoading(parts, nextTool.part, nextTool.index)
  ) {
    return false;
  }

  return !hasRenderableContentAfter(parts, index);
};


interface MessagePartProps {
  parts: UIMessage["parts"];
  messageId: string;
  status?: ChatStatus;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
}

export const MessageParts = ({
  parts,
  messageId,
  status,
  savedProductIds,
  onToggleSave,
}: MessagePartProps) => {
  const isChatStreaming = status === "streaming";
  const messageParts = parts ?? [];

  return (
    <div>
      {messageParts.map((part, index) => {
        const { type } = part;
        const key = `message-${messageId}-part-${index}`;

        // tool-searchCatalog renderer — discriminator narrowing (no direct ToolUIPart cast).
        // Vercel AI SDK v6 generates the dynamically-named tool union from the tool
        // registry passed to streamText, so the literal type 'tool-searchCatalog' is
        // not always present in the ambient union at the consumer site. The pattern
        // below uses (part.type === 'tool-searchCatalog' && 'state' in part) followed
        // by progressive part.state discriminator guards to narrow structurally.
        if (part.type === 'tool-searchCatalog' && 'state' in part) {
          if (part.state === 'input-streaming' || part.state === 'input-available') {
            return (
              <div
                key={key}
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-opacity duration-150"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Searching your catalog…
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
                <div
                  key={key}
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-start gap-1 transition-opacity duration-150"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <SearchX className="size-5" aria-hidden="true" />
                    No matching products
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Try a broader description or remove the price filter.
                  </p>
                </div>
              );
            }

            return (
              <ul
                key={key}
                role="list"
                aria-live="polite"
                aria-label={`${products.length} matching products`}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-150"
              >
                {products.map((product) => (
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      isSaved={savedProductIds.has(product.id)}
                      onSave={() => onToggleSave(product)}
                    />
                  </li>
                ))}
              </ul>
            );
          }

          if (part.state === 'output-error') {
            return (
              <div
                key={key}
                role="status"
                aria-live="polite"
                className="flex flex-col items-start gap-1 transition-opacity duration-150"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <AlertCircle className="size-3 text-destructive" aria-hidden="true" />
                  Couldn&apos;t fetch results
                </div>
                <p className="text-xs text-muted-foreground">
                  Please try that search again.
                </p>
              </div>
            );
          }

          // Unknown / unsupported states (approval-requested, approval-responded, ...) render nothing.
          return null;
        }

        if (type === "text" && part.text === "Thinking...") {
          return <TextShimmer duration={10} key={key}>Thinking...</TextShimmer>;
        }

        if (type === "text") {
          return (
            <div className="markdown" key={key}>
              <Response>{part.text}</Response>
            </div>
          );
        }

        // if (type === "reasoning" && enableReasoning) {
        //   markContentRendered();
        //   return (
        //     <div className="w-full my-2" key={key}>
        //       <Reasoning
        //         className="w-full"
        //         isStreaming={part.state === "streaming"}
        //       >
        //         <ReasoningTrigger />
        //         <ReasoningContent>{part.text}</ReasoningContent>
        //       </Reasoning>
        //     </div>
        //   );
        // }

        if (!isChatStreaming) return null;

        return null;
      })}
    </div>
  );
};
