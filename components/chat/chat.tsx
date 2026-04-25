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
import { memo, useCallback, useState } from "react";
import { ChatMessage } from '@/components/chat/chat-message';

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

export default function Chat() {
    const [input, setInput] = useState('');
    const { messages, sendMessage, status, } = useChat();
    // const [status, setStatus] = useState<
    //     "submitted" | "streaming" | "ready" | "error"
    // >("ready");

    console.log("chat status", status);


    const handleSubmit = useCallback((message: PromptInputMessage) => {
        const hasText = Boolean(message.text);
        const hasAttachments = Boolean(message.files?.length);

        if (!(hasText || hasAttachments)) {
            return;
        }

        sendMessage({ text: message.text });
        setInput('');

        // setStatus("submitted");

        // eslint-disable-next-line no-console
        console.log("Submitting message:", message);

        // setTimeout(() => {
        //     setStatus("streaming");
        // }, SUBMITTING_TIMEOUT);

        // setTimeout(() => {
        //     setStatus("ready");
        // }, STREAMING_TIMEOUT);
    }, [sendMessage]);

    console.log("messages", JSON.stringify(messages));

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
                {messages.map(message => (
                    <ChatMessage key={message.id} message={message} status={status} />
                ))}
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