'use client';

import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Chat from '@/components/chat/chat';
import { Bookmark, HistoryIcon, MessageSquare, PlusIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';


function TabButton({ id, icon, label, active, onClick }: { id: string, icon: React.ReactNode, label: string, active: string, onClick: (id: string) => void }) {
    const isActive = active === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${isActive
                ? 'bg-white text-[#008060] shadow-sm'
                : 'text-[#6d7175] hover:text-[#202223]'
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

export default function ChatPage() {
    console.log("chat page");

    const [selectedTab, setSelectedTab] = useState<string>('chat');

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
                            variant='outline'
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
                        <Chat />
                    </TabsContent>
                    <TabsContent value="history">
                        {/* <History /> */}
                        <div>History</div>
                    </TabsContent>
                    <TabsContent value="saved">
                        {/* <Saved /> */}
                        <div>Saved</div>
                    </TabsContent>
                </TabsContents>
            </Tabs>
        </div>
    );
}
