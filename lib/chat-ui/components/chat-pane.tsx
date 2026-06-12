'use client';

import { PromptInputProvider, PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputActionMenu, PromptInputActionMenuTrigger, PromptInputActionMenuContent, PromptInputActionAddAttachments, PromptInputButton, PromptInputSubmit, usePromptInputAttachments } from '@/components/ai-elements/prompt-input';

import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai-elements/attachments";
import { GlobeIcon, PaperclipIcon } from "lucide-react";
import { memo, useCallback } from "react";
import { ChatMessage } from './chat-message';
import { EmptyChat } from './empty-chat';
import { SDLogo } from './sd-logo';
import { type CardDensity, type EmptyStateVariant } from '../appearance';
import { useChatController } from '../use-chat-controller';
import type { SuggestedPrompt } from '@/lib/settings/contract';
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

/** Bouncing-dots placeholder shown between submit and the first streamed token. */
function ThinkingBubble() {
    return (
        <div className="flex w-full items-start gap-2.5">
            <SDLogo size={28} />
            <div
                role="status"
                aria-label="Assistant is thinking"
                className="inline-flex gap-1 self-start rounded-[14px] rounded-bl-[4px] border border-[#e1e3e5] bg-white px-3.5 py-3"
            >
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--sd-accent,#5B4FE9)]/60"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
        </div>
    );
}

// Restyles the PromptInput compound shell (form > InputGroup) into the
// handoff composer card without forking the ai-elements components.
const COMPOSER_CARD_CLASS = [
    '[&_[data-slot=input-group]]:rounded-[14px]',
    '[&_[data-slot=input-group]]:border-[1.5px]',
    '[&_[data-slot=input-group]]:border-[#c9ccd0]',
    '[&_[data-slot=input-group]]:bg-white',
    '[&_[data-slot=input-group]]:shadow-none!',
    '[&_[data-slot=input-group]]:transition-colors',
    '[&_[data-slot=input-group]:focus-within]:border-[var(--sd-accent,#5B4FE9)]!',
].join(' ');

const COMPOSER_CHIP_CLASS =
    'rounded-[7px] bg-[#f1f2f4] px-2.5 py-1 text-[11.5px] font-medium text-[#5c5f62] hover:bg-[#e7e8ea] hover:text-[#5c5f62]';

interface ChatPaneProps {
    adapter: ChatIdentityAdapter;
    savedProductIds: Set<string>;
    onToggleSave: (product: ChatProduct) => void;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
    density?: CardDensity;
    emptyStateVariant?: EmptyStateVariant;
    /** Cards-variant greeting ("I've indexed all N products"). */
    catalogCount?: number;
    /** Hero-variant live badge. */
    modelName?: string;
    /** Merchant greeting — passed through to EmptyChat. */
    greeting?: string | null;
    /** Merchant suggested prompts — passed through to EmptyChat. */
    prompts?: SuggestedPrompt[] | null;
    /** History-resume: submitted once per id change. */
    autoSubmitQuery?: { id: number; query: string } | null;
    /**
     * Fired right after an autoSubmitQuery is submitted. Owners that unmount
     * ChatPane (e.g. the drawer's tab switch) MUST clear their pending query
     * here — a remounted pane has a fresh lastAutoSubmitIdRef and would
     * otherwise re-submit the stale query.
     */
    onAutoSubmitConsumed?: () => void;
    productUrlBase?: string;
    linkTarget?: '_blank' | '_self';
}

export function ChatPane({
    adapter,
    savedProductIds,
    onToggleSave,
    onHistoryAdd,
    density = 'standard',
    emptyStateVariant = 'cards',
    catalogCount,
    modelName,
    greeting,
    prompts,
    autoSubmitQuery,
    onAutoSubmitConsumed,
    productUrlBase,
    linkTarget,
}: ChatPaneProps) {
    const { messages, status, submitText, handleSubmit, scrollRef, groundedCountFor } =
        useChatController({ adapter, onHistoryAdd, autoSubmitQuery, onAutoSubmitConsumed });

    const lastMessage = messages[messages.length - 1];
    const showThinking = status === 'submitted' && lastMessage?.role === 'user';
    const isBusy = status === 'submitted' || status === 'streaming';

    return (
        // --sd-accent is NOT set here: the owning surface provides it
        // (admin chat-shell hardcodes SD_ACCENT; the storefront DrawerBody
        // wrapper applies the merchant's drawerAccent). Every usage below
        // carries the #5B4FE9 fallback for standalone renders.
        <div className="flex h-full min-h-0 w-full flex-col">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#fafbfb]">
                {messages.length === 0 ? (
                    <EmptyChat
                        variant={emptyStateVariant}
                        onPick={submitText}
                        catalogCount={catalogCount}
                        modelName={modelName}
                        greeting={greeting}
                        prompts={prompts}
                    />
                ) : (
                    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 px-6 py-5">
                        {messages.map((message) => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                status={status}
                                density={density}
                                groundedCount={groundedCountFor(message)}
                                savedProductIds={savedProductIds}
                                onToggleSave={onToggleSave}
                                productUrlBase={productUrlBase}
                                linkTarget={linkTarget}
                            />
                        ))}
                        {showThinking && <ThinkingBubble />}
                    </div>
                )}
            </div>

            <div className="shrink-0 border-t border-[#e1e3e5] bg-white px-6 pt-4 pb-5">
                <div className="mx-auto w-full max-w-[780px]">
                    <PromptInputProvider>
                        <PromptInput globalDrop multiple onSubmit={handleSubmit} className={COMPOSER_CARD_CLASS}>
                            <PromptInputAttachmentsDisplay />
                            <PromptInputBody>
                                <PromptInputTextarea
                                    className="max-h-[120px] min-h-[22px] text-sm text-[#202223]"
                                    placeholder="Search your catalog — e.g. “a low-maintenance plant for my office”"
                                />
                            </PromptInputBody>
                            <PromptInputFooter className="gap-2">
                                <PromptInputTools className="gap-2">
                                    <PromptInputActionMenu>
                                        <PromptInputActionMenuTrigger className={COMPOSER_CHIP_CLASS}>
                                            <PaperclipIcon size={13} aria-hidden="true" />
                                            <span>Attach</span>
                                        </PromptInputActionMenuTrigger>
                                        <PromptInputActionMenuContent>
                                            <PromptInputActionAddAttachments />
                                        </PromptInputActionMenuContent>
                                    </PromptInputActionMenu>
                                    <PromptInputButton className={COMPOSER_CHIP_CLASS}>
                                        <GlobeIcon size={13} aria-hidden="true" />
                                        <span>Hybrid search</span>
                                    </PromptInputButton>
                                </PromptInputTools>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[#8c9196]">
                                        Press{' '}
                                        <kbd className="rounded border border-[#e1e3e5] bg-[#f1f2f4] px-1 py-px text-[10px]">
                                            ↵
                                        </kbd>{' '}
                                        to send
                                    </span>
                                    <PromptInputSubmit
                                        status={status}
                                        className="h-[30px] w-[30px] rounded-lg bg-[var(--sd-accent,#5B4FE9)] text-white hover:bg-[var(--sd-accent,#5B4FE9)]/90 disabled:bg-[#dadada]"
                                    >
                                        {isBusy ? null : (
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.4"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="M5 12h14M13 5l7 7-7 7" />
                                            </svg>
                                        )}
                                    </PromptInputSubmit>
                                </div>
                            </PromptInputFooter>
                        </PromptInput>
                    </PromptInputProvider>
                </div>
            </div>
        </div>
    );
}
