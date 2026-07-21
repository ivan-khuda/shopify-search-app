'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Bookmark, HistoryIcon, MessageSquare, PlusIcon } from 'lucide-react';
import { ChatPane, HistoryPanel, SavedProductsPanel } from '@/lib/chat-ui';
import {
    CARD_DENSITIES,
    SD_ACCENT,
    type CardDensity,
    type ShopAppearance,
} from '@/lib/chat-ui/appearance';
import { EmbeddedAdapter } from '@/lib/chat-ui/adapters/embedded';
import { useHistoryStore, useSavedProductsStore } from '@/lib/chat-ui/stores/hooks';

interface ChatShellProps {
    shop: string;
    modelName: string;
    appearance: ShopAppearance;
    catalogCount: number;
}

const DENSITY_LABELS: Record<CardDensity, string> = {
    compact: 'Compact',
    standard: 'Standard',
    hero: 'Hero',
};

/** Fire-and-forget persistence; the optimistic local value is kept on failure
 *  (next page load re-reads the server truth, same as the settings page). */
async function persistDensity(cardDensity: CardDensity): Promise<void> {
    try {
        const token = await shopify.idToken();
        await fetch('/api/settings/appearance', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardDensity }),
        });
    } catch {
        // ignore — optimistic value stays
    }
}

export function ChatShell({ shop, modelName, appearance, catalogCount }: ChatShellProps) {
    const [selectedTab, setSelectedTab] = useState<string>('chat');
    // Remount key for ChatPane: incrementing it discards the useChat
    // conversation state inside the pane, starting a fresh chat.
    const [chatKey, setChatKey] = useState(0);
    const [density, setDensity] = useState<CardDensity>(appearance.cardDensity);
    // History resume: a fresh id per click so ChatPane submits exactly once.
    const [resume, setResume] = useState<{ id: number; query: string } | null>(null);
    const adapter = useMemo(() => new EmbeddedAdapter(), []);
    const history = useHistoryStore(shop);
    const saved = useSavedProductsStore(shop);

    const savedProductIds = useMemo(
        () => new Set(saved.items.map((p) => p.id)),
        [saved.items],
    );

    const handleNewChat = () => {
        setChatKey((k) => k + 1);
        // Drop any pending resume so the fresh pane doesn't replay it.
        setResume(null);
        setSelectedTab('chat');
    };

    const handleDensityChange = (next: CardDensity) => {
        setDensity(next);
        void persistDensity(next);
    };

    const handleResume = (query: string) => {
        setResume({ id: Date.now(), query });
        setSelectedTab('chat');
    };

    // Admin tabs keep ChatPane mounted (TabsContents), so a stale resume is
    // harmless here today — but clearing consumed state mirrors the drawer
    // wiring and keeps the contract honest if the tab tree ever changes.
    const handleAutoSubmitConsumed = useCallback(() => {
        setResume(null);
    }, []);

    const tabs = [
        { id: 'chat', label: 'Chat', Icon: MessageSquare, badge: null as number | null },
        { id: 'history', label: 'History', Icon: HistoryIcon, badge: history.items.length || null },
        { id: 'saved', label: 'Saved', Icon: Bookmark, badge: saved.items.length || null },
    ];

    return (
        <div
            className='mx-auto flex h-full w-full flex-col'
            style={{ '--sd-accent': SD_ACCENT } as CSSProperties}
        >
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className='min-h-0 flex-1'>

                {/* Header — prototype chat.jsx lines 72–203 */}
                <header className="flex shrink-0 items-center gap-3.5 border-b border-[#e1e3e5] bg-white px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-semibold tracking-[-0.01em] text-[#1a1a1a]">
                            Playground
                        </h1>
                        <div className="mt-[3px] flex items-center gap-2">
                            <span className="inline-flex items-center gap-[5px] rounded-[10px] bg-[var(--sd-accent,#5B4FE9)]/10 px-[7px] py-0.5 text-[11px] font-semibold text-[var(--sd-accent,#5B4FE9)]">
                                <span
                                    className="h-1.5 w-1.5 rounded-full bg-[var(--sd-accent,#5B4FE9)]"
                                    aria-hidden="true"
                                />
                                Preview mode — using your real catalog
                            </span>
                            <span className="truncate text-xs text-[#6d7175]">
                                · Model:{' '}
                                <strong className="font-semibold text-[#202223]">{modelName}</strong>
                            </span>
                        </div>
                    </div>

                    <TabsList className='h-auto rounded-[10px] bg-[#f1f2f4] p-[3px]'>
                        {tabs.map(({ id, label, Icon, badge }) => {
                            const active = selectedTab === id;
                            return (
                                <TabsTrigger
                                    key={id}
                                    value={id}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[12.5px]',
                                        active
                                            ? 'font-semibold text-[#202223] data-[state=active]:text-[var(--sd-accent,#5B4FE9)]'
                                            : 'font-medium text-[#5c5f62] hover:text-[#202223]',
                                    )}
                                >
                                    <Icon className='h-[13px] w-[13px]' aria-hidden="true" />
                                    {label}
                                    {badge !== null && (
                                        <span
                                            className={cn(
                                                'ml-0.5 rounded-md px-1.5 py-px text-[10px] font-bold',
                                                active
                                                    ? 'bg-[var(--sd-accent,#5B4FE9)]/[0.12] text-[var(--sd-accent,#5B4FE9)]'
                                                    : 'bg-[#dadada] text-[#5c5f62]',
                                            )}
                                        >
                                            {badge}
                                        </span>
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    <div
                        role="group"
                        aria-label="Card density"
                        className="flex items-center rounded-[10px] bg-[#f1f2f4] p-[3px]"
                    >
                        {CARD_DENSITIES.map((d) => (
                            <button
                                key={d}
                                type="button"
                                aria-pressed={density === d}
                                onClick={() => handleDensityChange(d)}
                                className={cn(
                                    'rounded-[7px] px-2.5 py-1.5 text-xs',
                                    density === d
                                        ? 'bg-white font-semibold text-[#202223] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]'
                                        : 'font-medium text-[#5c5f62] hover:text-[#202223]',
                                )}
                            >
                                {DENSITY_LABELS[d]}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleNewChat}
                        className='flex items-center gap-1.5 rounded-lg border border-[#c9ccd0] bg-white px-3 py-[7px] text-[12.5px] font-semibold text-[#202223] hover:bg-[#f6f6f7]'
                    >
                        <PlusIcon className='h-[13px] w-[13px]' aria-hidden="true" />
                        New chat
                    </button>
                </header>

                <TabsContents className="min-h-0 flex-1">
                    <TabsContent value="chat" className="h-full">
                        <ChatPane
                            key={chatKey}
                            adapter={adapter}
                            savedProductIds={savedProductIds}
                            onToggleSave={saved.toggle}
                            onHistoryAdd={history.add}
                            density={density}
                            emptyStateVariant={appearance.emptyStateVariant}
                            catalogCount={catalogCount}
                            modelName={modelName}
                            autoSubmitQuery={resume}
                            onAutoSubmitConsumed={handleAutoSubmitConsumed}
                            productUrlBase={`https://${shop}`}
                            linkTarget="_blank"
                        />
                    </TabsContent>
                    <TabsContent value="history" className="h-full overflow-y-auto bg-[#fafbfb]">
                        <HistoryPanel
                            items={history.items}
                            onClear={history.clear}
                            onResume={handleResume}
                        />
                    </TabsContent>
                    <TabsContent value="saved" className="h-full overflow-y-auto bg-[#fafbfb]">
                        <SavedProductsPanel
                            products={saved.items}
                            onToggleSave={saved.toggle}
                            density={density}
                            productUrlBase={`https://${shop}`}
                            linkTarget="_blank"
                        />
                    </TabsContent>
                </TabsContents>
            </Tabs>
        </div>
    );
}
