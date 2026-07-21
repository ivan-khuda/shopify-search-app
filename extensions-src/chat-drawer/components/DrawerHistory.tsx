'use client';
/**
 * DrawerHistory — past conversations pane (drawer-redesign Task 7).
 * Translated 1:1 from the design handoff (storefront.jsx DrawerHistory,
 * 748–800): kicker + Clear (only with items), search-icon rows firing
 * onResume(query), empty copy otherwise.
 */
import type { ChatHistoryItem } from '@/types/product';

interface DrawerHistoryProps {
  items: ChatHistoryItem[];
  onResume: (query: string) => void;
  onClear: () => void;
}

export function DrawerHistory({ items, onResume, onClear }: DrawerHistoryProps) {
  return (
    <div className="flex-1 overflow-auto bg-[#fafafa] p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold tracking-[0.06em] text-[#8c8c8c] uppercase">
          Past conversations
        </span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer border-none bg-transparent text-xs text-[#c43e3e]"
          >
            Clear
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-[13px] text-[#8c8c8c]">
          Your conversations show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onResume(item.query)}
              className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-[#ededed] bg-white px-3 py-2.5 text-left"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#f5f5f0] text-[#5c5c5c]">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[#1a1a1a]">{item.query}</span>
                <span className="mt-px block text-[11px] text-[#a0a0a0]">
                  {item.timestamp} · {item.productCount} results
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
