'use client';

import { PromptInputProvider, PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputActionMenu, PromptInputActionMenuTrigger, PromptInputActionMenuContent, PromptInputActionAddAttachments, PromptInputButton, PromptInputSubmit, usePromptInputAttachments } from '@/components/ai-elements/prompt-input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";

import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai-elements/attachments";
import { GlobeIcon } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { ChatMessage } from './chat-message';
import { PromptChips } from './prompt-chips';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';
import type { ChatIdentityAdapter } from '../adapters/types';

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

interface ChatPaneProps {
    adapter: ChatIdentityAdapter;
    savedProductIds: Set<string>;
    onToggleSave: (product: ChatProduct) => void;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
}

export function ChatPane({ adapter, savedProductIds, onToggleSave, onHistoryAdd }: ChatPaneProps) {
    const transport = useMemo(
        () => new DefaultChatTransport({
            api: adapter.endpoint,
            headers: () => adapter.getAuthHeaders(),
            body: () => adapter.getRequestBody(),
        }),
        [adapter],
    );
    const { messages, sendMessage, status } = useChat({ transport });

    const submitText = useCallback((query: string) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        onHistoryAdd({
            id: `search-${Date.now()}`,
            query: trimmed,
            timestamp: new Date().toLocaleTimeString(),
            productCount: 0,
        });
        sendMessage({ text: trimmed });
    }, [onHistoryAdd, sendMessage]);

    const handleSubmit = useCallback((message: PromptInputMessage) => {
        const query = message.text.trim();
        const hasText = Boolean(query);
        const hasAttachments = Boolean(message.files?.length);

        if (!(hasText || hasAttachments)) {
            return;
        }

        if (hasText) {
            submitText(query);
            return;
        }

        // WR-02: attachments-only submit — forward the files instead of
        // silently dropping them and posting an empty message.
        sendMessage({ text: query, files: message.files });
    }, [submitText, sendMessage]);

    return (
        <div className="flex flex-col w-full max-w-3xl mx-auto stretch gap-6 pt-3">
            <div className='flex flex-col flex-1 gap-4 overflow-auto pr-4'>
                {messages.length === 0 && (
                    <div className="flex flex-col gap-4">
                        <p>
                            Hello! I&apos;m your AI Shopping Assistant. Try a search like &quot;warm winter clothes&quot; or &quot;running shoes under $80&quot;.
                        </p>
                        <PromptChips onSubmit={submitText} />
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
