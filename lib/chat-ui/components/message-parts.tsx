"use client";

import { UIMessage } from "ai";
import { AlertCircle, Loader2, SearchX } from "lucide-react";

import { TextShimmer } from "@/components/ui/text-shimmer";
import { Response } from "@/components/ai-elements/response";
import { ProductCard } from "./product-card";
import type { ChatProduct } from "@/types/product";

interface MessagePartProps {
  parts: UIMessage["parts"];
  messageId: string;
  savedProductIds: Set<string>;
  onToggleSave: (product: ChatProduct) => void;
}

export const MessageParts = ({
  parts,
  messageId,
  savedProductIds,
  onToggleSave,
}: MessagePartProps) => {
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

        return null;
      })}
    </div>
  );
};
