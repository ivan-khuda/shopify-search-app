'use client';

import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Chat from '@/components/chat/chat';
import { HistoryPanel } from '@/components/chat/history-panel';
import { SavedProductsPanel } from '@/components/chat/saved-products-panel';
import { Bookmark, HistoryIcon, MessageSquare, PlusIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatHistoryItem, ChatProduct } from '@/types/product';

export function ChatShell() {
    const [selectedTab, setSelectedTab] = useState<string>('chat');
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [savedProducts, setSavedProducts] = useState<ChatProduct[]>([]);

    const handleToggleSave = (product: ChatProduct) => {
        setSavedProducts((current) =>
            current.some((item) => item.id === product.id)
                ? current.filter((item) => item.id !== product.id)
                : [...current, product],
        );
    };

    const handleHistoryAdd = (entry: ChatHistoryItem) => {
        setHistory((current) => [entry, ...current].slice(0, 10));
    };

    const handleNewChat = () => {
        setSelectedTab('chat');
    }

    return (
        <div className='mx-auto w-full'>
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
                            variant={null}
                            // size='icon'
                            onClick={handleNewChat}
                        >
                            <PlusIcon className='w-4 h-4' />
                            New Chat
                        </Button>
                    </TabsList>
                </header>
                <TabsContents>
                    <TabsContent value="chat">
                        <Chat
                            savedProducts={savedProducts}
                            onToggleSave={handleToggleSave}
                            onHistoryAdd={handleHistoryAdd}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <HistoryPanel items={history} onClear={() => setHistory([])} />
                    </TabsContent>
                    <TabsContent value="saved">
                        <SavedProductsPanel products={savedProducts} onToggleSave={handleToggleSave} />
                    </TabsContent>
                </TabsContents>
            </Tabs>
        </div>
    );
}
