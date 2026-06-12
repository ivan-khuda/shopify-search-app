'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';
import type { ChatHistoryItem } from '@/types/product';
import type { ChatIdentityAdapter } from './adapters/types';

/** Result count from a message's tool-searchCatalog output — drives the action row badge. */
function groundedCountFor(message: UIMessage): number {
    return (message.parts ?? []).reduce((count, part) => {
        if (
            part.type === 'tool-searchCatalog' &&
            'state' in part &&
            part.state === 'output-available' &&
            'output' in part &&
            Array.isArray(part.output)
        ) {
            return count + part.output.length;
        }
        return count;
    }, 0);
}

export interface ChatControllerOptions {
    adapter: ChatIdentityAdapter;
    onHistoryAdd: (entry: ChatHistoryItem) => void;
    /** History-resume: submitted once per id change. */
    autoSubmitQuery?: { id: number; query: string } | null;
    /**
     * Fired right after an autoSubmitQuery is submitted. Owners that unmount
     * the consuming pane (e.g. the drawer's tab switch) MUST clear their
     * pending query here — a remounted pane has a fresh lastAutoSubmitIdRef
     * and would otherwise re-submit the stale query.
     */
    onAutoSubmitConsumed?: () => void;
}

/**
 * Headless chat controller — owns the transport/useChat wiring, submit
 * pipeline, auto-submit-on-resume semantics, and auto-scroll behavior.
 * Presentation (admin ChatPane, storefront DrawerChat) renders over it.
 */
export function useChatController({
    adapter,
    onHistoryAdd,
    autoSubmitQuery,
    onAutoSubmitConsumed,
}: ChatControllerOptions) {
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

    // History-resume: fire exactly once per autoSubmitQuery.id.
    const lastAutoSubmitIdRef = useRef<number | null>(null);
    useEffect(() => {
        if (!autoSubmitQuery) return;
        if (lastAutoSubmitIdRef.current === autoSubmitQuery.id) return;
        lastAutoSubmitIdRef.current = autoSubmitQuery.id;
        submitText(autoSubmitQuery.query);
        onAutoSubmitConsumed?.();
    }, [autoSubmitQuery, submitText, onAutoSubmitConsumed]);

    // Keep the newest message in view as the conversation grows/streams.
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, status]);

    return { messages, status, submitText, handleSubmit, scrollRef, groundedCountFor };
}
