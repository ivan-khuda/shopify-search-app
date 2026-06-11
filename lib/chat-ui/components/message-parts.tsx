"use client";

import { UIMessage } from "ai";
import { AlertCircle, SearchX } from "lucide-react";

import { TextShimmer } from "@/components/ui/text-shimmer";
import { Response } from "@/components/ai-elements/response";
import { ProductCard } from "./product-card";
import type { ChatProduct } from "@/types/product";
import type { CardDensity } from "../appearance";

interface MessagePartProps {
  parts: UIMessage["parts"];
  messageId: string;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
  /** Threads ShopSettings.cardDensity into the results grid + cards. */
  density?: CardDensity;
  /**
   * 'assistant' (default) wraps text parts in the white handoff bubble;
   * 'user' renders text plain — ChatMessage supplies the accent bubble.
   */
  variant?: "user" | "assistant";
}

export const MessageParts = ({
  parts,
  messageId,
  savedProductIds,
  onToggleSave,
  density = "standard",
  variant = "assistant",
}: MessagePartProps) => {
  const messageParts = parts ?? [];

  const gridClass =
    density === "hero"
      ? "grid grid-cols-1 gap-3"
      : density === "compact"
        ? "grid grid-cols-2 gap-2 lg:grid-cols-3"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={variant === "assistant" ? "flex w-full min-w-0 flex-col gap-3" : undefined}>
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
                className="inline-flex items-center gap-2 self-start rounded-xl border border-[#e1e3e5] bg-white px-3 py-2 text-[13px] text-[#5c5f62] transition-opacity duration-150"
              >
                <div
                  aria-hidden="true"
                  className="size-3 animate-spin rounded-full border-2 border-[var(--sd-accent,#5B4FE9)]/20 border-t-[var(--sd-accent,#5B4FE9)]"
                />
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
                className={`${gridClass} transition-opacity duration-150`}
              >
                {products.map((product) => (
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      density={density}
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
          if (variant === "user") {
            return (
              <div className="markdown" key={key}>
                <Response>{part.text}</Response>
              </div>
            );
          }
          return (
            <div
              className="markdown max-w-[600px] rounded-[14px] rounded-bl-[4px] border border-[#e1e3e5] bg-white px-3.5 py-3 text-sm leading-[1.55] text-[#202223]"
              key={key}
            >
              <Response>{part.text}</Response>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
