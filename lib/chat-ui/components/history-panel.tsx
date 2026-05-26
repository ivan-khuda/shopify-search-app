'use client';

import { ChevronRight, History, Search, Trash2 } from 'lucide-react';
import type { ChatHistoryItem } from '@/types/product';
import { EmptyState } from './empty-state';

interface HistoryPanelProps {
  items: ChatHistoryItem[];
  onClear: () => void;
}

export function HistoryPanel({ items, onClear }: HistoryPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold">Search History</h2>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 rounded p-2 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<History size={48} />}
          title="No search history"
          description="Your previous AI searches will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between rounded-lg border border-[#e1e3e5] p-4 transition-colors hover:bg-[#f6f6f7]"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-md bg-[#f1f2f4] p-2">
                  <Search size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">&quot;{item.query}&quot;</p>
                  <p className="text-xs text-gray-500">
                    {item.timestamp} - {item.productCount} results
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-600" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
