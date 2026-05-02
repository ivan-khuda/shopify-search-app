'use client';

import { PromptInputProvider, PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputActionMenu, PromptInputActionMenuTrigger, PromptInputActionMenuContent, PromptInputActionAddAttachments, PromptInputButton, PromptInputSubmit, usePromptInputAttachments } from '@/components/ai-elements/prompt-input';
import { useChat } from '@ai-sdk/react';
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai-elements/attachments";
import { GlobeIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { ChatMessage } from '@/components/chat/chat-message';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import { ProductCard } from '@/components/chat/product-card';
import { MOCK_PRODUCTS } from '@/components/chat/mock-products';

interface AttachmentItemProps {
    attachment: {
        id: string;
        type: "file";
        filename?: string;
        mediaType: string;
        url: string;
    };
    onRemove: (id: string) => void;
}

const AttachmentItem = memo(({ attachment, onRemove }: AttachmentItemProps) => {
    const handleRemove = useCallback(
        () => onRemove(attachment.id),
        [onRemove, attachment.id]
    );
    return (
        <Attachment data={attachment} key={attachment.id} onRemove={handleRemove}>
            <AttachmentPreview />
            <AttachmentRemove />
        </Attachment>
    );
});

AttachmentItem.displayName = "AttachmentItem";

const PromptInputAttachmentsDisplay = () => {
    const attachments = usePromptInputAttachments();

    const handleRemove = useCallback(
        (id: string) => attachments.remove(id),
        [attachments]
    );

    if (attachments.files.length === 0) {
        return null;
    }

    return (
        <Attachments variant="inline">
            {attachments.files.map((attachment) => (
                <AttachmentItem
                    attachment={attachment}
                    key={attachment.id}
                    onRemove={handleRemove}
                />
            ))}
        </Attachments>
    );
};

interface ChatProps {
    savedProducts: ChatProduct[];
    onToggleSave: (product: ChatProduct) => void;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
}

interface ProductAttachmentState {
    messageId: string;
    products: ChatProduct[];
}

interface PendingProductAttachment {
    anchorMessageId: string | null;
    products: ChatProduct[];
}

const buildMockResults = (query: string) => {
    const searchWords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2);

    return MOCK_PRODUCTS.filter((product) => {
        const haystack = [
            product.title,
            product.description,
            product.category ?? '',
            ...(product.tags ?? []),
        ].join(' ').toLowerCase();

        return searchWords.some((word) => haystack.includes(word));
    }).slice(0, 3);
};

export default function Chat({ savedProducts, onToggleSave, onHistoryAdd }: ChatProps) {
    const [pendingProducts, setPendingProducts] = useState<PendingProductAttachment | null>(null);
    const { messages, sendMessage, status, } = useChat();
    const savedProductIds = useMemo(
        () => new Set(savedProducts.map((product) => product.id)),
        [savedProducts],
    );
    const attachedProducts = useMemo<ProductAttachmentState | null>(() => {
        if (!pendingProducts) {
            return null;
        }

        if (pendingProducts.anchorMessageId) {
            const anchorIndex = messages.findIndex(
                (message) => message.id === pendingProducts.anchorMessageId,
            );

            if (anchorIndex === -1) {
                return null;
            }

            const attachedMessage = messages
                .slice(anchorIndex + 1)
                .find((message) => message.role === 'assistant');

            return attachedMessage ? {
                messageId: attachedMessage.id,
                products: pendingProducts.products,
            } : null;
        }

        const firstAssistantMessage = messages.find((message) => message.role === 'assistant');

        return firstAssistantMessage ? {
            messageId: firstAssistantMessage.id,
            products: pendingProducts.products,
        } : null;
    }, [messages, pendingProducts]);

    const handleSubmit = useCallback((message: PromptInputMessage) => {
        const query = message.text.trim();
        const hasText = Boolean(query);
        const hasAttachments = Boolean(message.files?.length);

        if (!(hasText || hasAttachments)) {
            return;
        }

        const products = hasText ? buildMockResults(query) : [];
        setPendingProducts({
            anchorMessageId: messages.at(-1)?.id ?? null,
            products,
        });

        if (hasText) {
            onHistoryAdd({
                id: `search-${Date.now()}`,
                query,
                timestamp: new Date().toLocaleTimeString(),
                productCount: products.length,
            });
        }

        sendMessage({ text: query });
    }, [messages, onHistoryAdd, sendMessage]);

    return (
        <div className="flex flex-col w-full max-w-3xl h-[calc(100vh-100px)] mx-auto stretch gap-6 pt-3">
            <div className='h-[calc(100%-180px)] flex flex-col flex-1 gap-4 overflow-auto pr-4'>
                {/* <TextShimmer duration={5}>Thinking...</TextShimmer> */}
                {messages.length === 0 && (
                    <div className="">
                        <p>
                            Hello! I&apos;m your AI Shopping Assistant. Looking for something specific today, like
                            &apos;warm winter clothes&apos; or &apos;minimalist accessories&apos;?
                        </p>
                    </div>
                )}
                {messages.map((message) => {
                    const productsForMessage = attachedProducts?.messageId === message.id
                        ? attachedProducts.products
                        : [];

                    return (
                        <div key={message.id} className="space-y-4">
                            <ChatMessage message={message} status={status} />
                            {productsForMessage.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {productsForMessage.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            isSaved={savedProductIds.has(product.id)}
                                            onSave={() => onToggleSave(product)}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="size-full1">
                <PromptInputProvider>
                    <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                        <PromptInputAttachmentsDisplay />
                        <PromptInputBody>
                            <PromptInputTextarea placeholder="Search for something (e.g. 'comfortable shoes for running')" />
                        </PromptInputBody>
                        <PromptInputFooter>
                            <PromptInputTools>
                                <PromptInputActionMenu>
                                    <PromptInputActionMenuTrigger />
                                    <PromptInputActionMenuContent>
                                        <PromptInputActionAddAttachments />
                                    </PromptInputActionMenuContent>
                                </PromptInputActionMenu>
                                <PromptInputButton>
                                    <GlobeIcon size={16} />
                                    <span>Search</span>
                                </PromptInputButton>
                            </PromptInputTools>
                            <PromptInputSubmit status={status} />
                        </PromptInputFooter>
                    </PromptInput>
                </PromptInputProvider>
            </div>
        </div>
    );
}