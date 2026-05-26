'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bookmark, HistoryIcon, MessageSquare, PlusIcon, Sparkles } from 'lucide-react';
import { ChatPane, HistoryPanel, SavedProductsPanel } from '@/lib/chat-ui';
import { EmbeddedAdapter } from '@/lib/chat-ui/adapters/embedded';
import { useHistoryStore, useSavedProductsStore } from '@/lib/chat-ui/stores/hooks';

export function ChatShell({ shop }: { shop: string }) {
    const [selectedTab, setSelectedTab] = useState<string>('chat');
    const adapter = useMemo(() => new EmbeddedAdapter(), []);
    const history = useHistoryStore(shop);
    const saved = useSavedProductsStore(shop);

    const savedProductIds = useMemo(
        () => new Set(saved.items.map((p) => p.id)),
        [saved.items],
    );

    const handleNewChat = () => {
        setSelectedTab('chat');
    };

    return (
        <div className='mx-auto w-full h-[calc(100vh-100px)]'>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>

                {/* Header */}
                <header className="bg-white border-b border-[#e1e3e5] px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#008060] p-1.5 rounded-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold leading-none">SmartDiscovery AI</h1>
                            <p className="text-xs text-gray-500 mt-1">Shopify Assistant</p>
                        </div>
                    </div>

                    <TabsList className='justify-between h-auto'>
                        <TabsTrigger
                            className={cn(
                                'flex items-center gap-2',
                                selectedTab === 'chat' ? 'data-[state=active]:text-[#008060]' : 'text-[#6d7175] hover:text-[#202223]'
                            )}
                            value="chat"
                        >
                            <MessageSquare className='w-4 h-4' />
                            Chat
                        </TabsTrigger>
                        <TabsTrigger
                            className={cn(
                                'flex items-center gap-2',
                                selectedTab === 'history' ? 'data-[state=active]:text-[#008060]' : 'text-[#6d7175] hover:text-[#202223]'
                            )}
                            value="history"
                        >
                            <HistoryIcon className='w-4 h-4' />
                            History
                        </TabsTrigger>
                        <TabsTrigger
                            className={cn(
                                'flex items-center gap-2',
                                selectedTab === 'saved' ? 'data-[state=active]:text-[#008060]' : 'text-[#6d7175] hover:text-[#202223]'
                            )}
                            value="saved"
                        >
                            <Bookmark className='w-4 h-4' />
                            Saved
                        </TabsTrigger>
                        <Button
                            className='flex items-center gap-2 ml-2 text-black'
                            onClick={handleNewChat}
                        >
                            <PlusIcon className='w-4 h-4' />
                            New Chat
                        </Button>
                    </TabsList>
                </header>
                <TabsContents>
                    <TabsContent value="chat" className="h-[calc(100%-180px)]">
                        <ChatPane
                            adapter={adapter}
                            savedProductIds={savedProductIds}
                            onToggleSave={saved.toggle}
                            onHistoryAdd={history.add}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <HistoryPanel items={history.items} onClear={history.clear} />
                    </TabsContent>
                    <TabsContent value="saved">
                        <SavedProductsPanel products={saved.items} onToggleSave={saved.toggle} />
                    </TabsContent>
                </TabsContents>
            </Tabs>
        </div>
    );
}
