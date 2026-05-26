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
import { memo, useCallback, useMemo } from "react";
import { ChatMessage } from '@/components/chat/chat-message';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

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

export default function Chat({ savedProducts, onToggleSave, onHistoryAdd }: ChatProps) {
    const { messages, sendMessage, status, } = useChat();
    const savedProductIds = useMemo(
        () => new Set(savedProducts.map((product) => product.id)),
        [savedProducts],
    );

    const handleSubmit = useCallback((message: PromptInputMessage) => {
        const query = message.text.trim();
        const hasText = Boolean(query);
        const hasAttachments = Boolean(message.files?.length);

        if (!(hasText || hasAttachments)) {
            return;
        }

        if (hasText) {
            onHistoryAdd({
                id: `search-${Date.now()}`,
                query,
                timestamp: new Date().toLocaleTimeString(),
                // productCount is no longer client-derivable at submit time; cards arrive via tool-result parts.
                // Phase 5/6 may relocate history derivation to a useEffect that watches messages.
                productCount: 0,
            });
        }

        sendMessage({ text: query });
    }, [onHistoryAdd, sendMessage]);

    return (
        <div className="flex flex-col w-full max-w-3xl h-[calc(100vh-100px)] mx-auto stretch gap-6 pt-3">
            <div className='h-[calc(100%-180px)] flex flex-col flex-1 gap-4 overflow-auto pr-4'>
                {/* <TextShimmer duration={5}>Thinking...</TextShimmer> */}
                {messages.length === 0 && (
                    <div className="">
                        <p>
                            Hello! I&apos;m your AI Shopping Assistant. Try a search like &quot;warm winter clothes&quot; or &quot;running shoes under $80&quot;.
                        </p>
                    </div>
                )}
                {messages.map((message) => (
                    <div key={message.id} className="space-y-4">
                        <ChatMessage
                            message={message}
                            status={status}
                            savedProductIds={savedProductIds}
                            onToggleSave={onToggleSave}
                        />
                    </div>
                ))}
            </div>

            <div className="size-full">
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