'use client';
// Empty-state variants from the design handoff (chat.jsx EmptyChat).
// Three merchant-configurable layouts: cards (default), minimal, hero.

import { SDLogo } from './sd-logo';
import type { EmptyStateVariant } from '../appearance';

export const SUGGESTED_PROMPTS = [
  { icon: '☕', text: 'Something to drink coffee out of' },
  { icon: '🌿', text: 'A low-maintenance plant for my office' },
  { icon: '🍽️', text: 'Dinnerware for four — neutral, modern' },
  { icon: '🎁', text: 'Hostess gift under $50' },
] as const;

interface EmptyChatProps {
  variant: EmptyStateVariant;
  onPick: (text: string) => void;
  catalogCount?: number;
  modelName?: string;
}

export function EmptyChat({ variant, onPick, catalogCount, modelName }: EmptyChatProps) {
  if (variant === 'minimal') {
    return (
      <div className="mx-auto max-w-[600px] px-6 pt-[60px] pb-10">
        <div className="mb-7 text-center">
          <SDLogo size={44} />
          <h2 className="mt-3.5 mb-1.5 text-[22px] font-semibold tracking-[-0.01em] text-[#202223]">
            Ask anything about your catalog
          </h2>
          <p className="m-0 text-sm text-[#6d7175]">
            Natural language. Hybrid semantic + keyword search.
          </p>
        </div>
        <div className="grid gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p.text}
              type="button"
              onClick={() => onPick(p.text)}
              className="flex items-center gap-2.5 rounded-[10px] border border-[#e1e3e5] bg-white px-3.5 py-3 text-left text-[13.5px] text-[#202223] transition-colors hover:border-[var(--sd-accent,#5B4FE9)]/40"
            >
              <span className="text-base">{p.icon}</span>
              {p.text}
              <span className="ml-auto text-[#a5acb1]">↗</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="mx-auto max-w-[780px] px-6 py-8">
        <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,var(--sd-accent,#5B4FE9)_0%,#4b41bf_100%)] px-8 pt-8 pb-7 text-white">
          {/* Decorative blobs */}
          <div className="absolute -top-[60px] -right-10 h-[200px] w-[200px] rounded-full bg-white/10" />
          <div className="absolute -bottom-10 right-[60px] h-[140px] w-[140px] rounded-full bg-white/[0.08]" />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.18] px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {modelName ? `Live · ${modelName}` : 'Live'}
            </div>
            <h2 className="mt-3.5 mb-2 text-[28px] leading-[1.2] font-semibold tracking-[-0.015em]">
              What are your customers
              <br />
              looking for today?
            </h2>
            <p className="m-0 max-w-[460px] text-sm leading-[1.55] opacity-90">
              Test queries the way a real shopper would. Results are pulled from your live synced
              catalog.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] font-bold tracking-[0.06em] text-[#6d7175] uppercase">
            Try one
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.text}
                type="button"
                onClick={() => onPick(p.text)}
                className="flex items-start gap-2.5 rounded-xl border border-[#e1e3e5] bg-white p-3.5 text-left text-[13px] leading-[1.4] text-[#202223] transition-colors hover:border-[var(--sd-accent,#5B4FE9)]/40 hover:bg-[var(--sd-accent,#5B4FE9)]/[0.03]"
              >
                <span className="-mt-px text-lg">{p.icon}</span>
                <span>{p.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default: 'cards'
  return (
    <div className="mx-auto max-w-[780px] px-6 py-12">
      <div className="mb-6 flex items-start gap-3.5">
        <SDLogo size={40} />
        <div className="flex-1">
          <h2 className="m-0 text-xl font-semibold tracking-[-0.01em] text-[#202223]">
            Hi there 👋 I&apos;m your SmartDiscovery assistant.
          </h2>
          <p className="mt-1.5 mb-0 text-[13.5px] leading-[1.55] text-[#5c5f62]">
            I&apos;ve indexed all{' '}
            <strong className="text-[#202223]">{catalogCount ?? '—'} products</strong>. Ask me
            anything a shopper might — here are a few starters to try:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => onPick(p.text)}
            className="flex flex-col gap-1.5 rounded-xl border border-[#e1e3e5] bg-white p-3.5 text-left transition-all hover:-translate-y-px hover:border-[var(--sd-accent,#5B4FE9)]/45 hover:shadow-[0_4px_12px_rgba(91,79,233,0.08)]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--sd-accent,#5B4FE9)]/[0.08] text-sm">
                {p.icon}
              </span>
              <span className="text-[10px] font-bold tracking-[0.06em] text-[#8c9196] uppercase">
                Try it
              </span>
            </div>
            <div className="text-sm leading-[1.4] font-medium text-[#202223]">{p.text}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2.5 rounded-[10px] border border-[var(--sd-accent,#5B4FE9)]/15 bg-[var(--sd-accent,#5B4FE9)]/5 px-3.5 py-2.5 text-[12.5px] text-[var(--sd-accent,#5B4FE9)]">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h0" />
        </svg>
        <span>
          <strong>Tip:</strong> queries with brand names or SKUs use BM25; descriptive queries use
          vector similarity. Both fuse via RRF.
        </span>
      </div>
    </div>
  );
}
