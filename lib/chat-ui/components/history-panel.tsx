'use client';

import { ChevronRight, History, Search, Trash2 } from 'lucide-react';
import type { ChatHistoryItem } from '@/types/product';

interface HistoryPanelProps {
  items: ChatHistoryItem[];
  onClear: () => void;
  /** Re-runs the row's query in the chat tab (prototype HistoryPane onResume). */
  onResume: (query: string) => void;
}

export function HistoryPanel({ items, onClear, onResume }: HistoryPanelProps) {
  return (
    <div className="mx-auto w-full max-w-[780px] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="m-0 text-base font-semibold text-[#202223]">Search history</h2>
          <p className="m-0 mt-[3px] text-[12.5px] text-[#6d7175]">
            Conversations from this preview session
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-[7px] border border-[#e1e3e5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#c43e3e] hover:bg-red-50"
          >
            <Trash2 size={11} aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e1e3e5] bg-white px-6 py-10 text-center">
          <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f2f4] text-[#8c9196]">
            <History size={22} aria-hidden="true" />
          </div>
          <div className="mb-1 text-sm font-semibold text-[#202223]">No history yet</div>
          <div className="text-[12.5px] text-[#6d7175]">
            Ask the assistant a question — it&apos;ll show up here.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onResume(item.query)}
              className="flex w-full items-center gap-3 rounded-[10px] border border-[#e1e3e5] bg-white px-3.5 py-3 text-left transition-colors hover:border-[var(--sd-accent,#5B4FE9)]/40 hover:bg-[var(--sd-accent,#5B4FE9)]/[0.02]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f2f4] text-[#5c5f62]">
                <Search size={14} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-[#202223]">
                  {item.query}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#8c9196]">
                  {item.timestamp} · {item.productCount} result
                  {item.productCount === 1 ? '' : 's'}
                </div>
              </div>
              <ChevronRight size={14} className="shrink-0 text-[#a5acb1]" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
