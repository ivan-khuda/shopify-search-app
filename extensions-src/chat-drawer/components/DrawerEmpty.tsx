'use client';
/**
 * DrawerEmpty — drawer empty state (drawer-redesign Task 6).
 *
 * Translated 1:1 from the design handoff (storefront.jsx DrawerEmpty,
 * 571–616): gradient tile, "Hi there 👋", merchant greeting (drawer-specific
 * builtin fallback — copy intentionally differs from the admin
 * BUILTIN_GREETING), and the TRY ASKING prompt list.
 *
 * Gradient end color #4b41bf follows the shade(-18) precedent from the
 * shared SDLogo/hero tiles — do NOT recompute per-merchant.
 */
import { SUGGESTED_PROMPTS } from '@/lib/chat-ui';
import type { SuggestedPrompt } from '@/lib/settings/contract';

export const DRAWER_BUILTIN_GREETING =
  "Tell me what you're looking for. I'll find it in the catalog.";

interface DrawerEmptyProps {
  /** Merchant greeting — overrides the drawer builtin when non-blank. */
  greeting?: string | null;
  /** Merchant prompts — replace the built-ins when non-empty. */
  prompts?: SuggestedPrompt[] | null;
  onPick: (text: string) => void;
}

export function DrawerEmpty({ greeting, prompts, onPick }: DrawerEmptyProps) {
  const activePrompts: readonly SuggestedPrompt[] =
    prompts && prompts.length > 0 ? prompts : SUGGESTED_PROMPTS;
  const activeGreeting = greeting && greeting.trim() ? greeting : DRAWER_BUILTIN_GREETING;

  return (
    <div className="px-[18px] py-7">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3.5 flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--sd-accent,#5B4FE9),#4b41bf)] shadow-[0_8px_24px_color-mix(in_srgb,var(--sd-accent,#5B4FE9)_30%,transparent)]">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M15 15l5 5" />
            <path d="M11 7.5l1.2 2.8L15 11l-2.8.7L11 14.5l-1.2-2.8L7 11l2.8-.7z" fill="#fff" />
          </svg>
        </div>
        <h3 className="m-0 text-lg font-semibold tracking-[-0.01em] text-[#1a1a1a]">
          Hi there 👋
        </h3>
        <p className="mx-0 mt-1.5 mb-0 text-[13px] leading-[1.5] text-[#5c5c5c]">
          {activeGreeting}
        </p>
      </div>

      <div className="mb-2 text-[10.5px] font-bold tracking-[0.08em] text-[#8c8c8c] uppercase">
        Try asking
      </div>
      <div className="flex flex-col gap-1.5">
        {activePrompts.map((prompt) => (
          <button
            key={prompt.text}
            type="button"
            onClick={() => onPick(prompt.text)}
            className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-[#ededed] bg-white px-3 py-2.5 text-left text-[13px] text-[#1a1a1a] transition-colors hover:border-[color-mix(in_srgb,var(--sd-accent,#5B4FE9)_40%,transparent)]"
          >
            <span className="text-[15px]">{prompt.icon}</span>
            <span className="flex-1">{prompt.text}</span>
            <span className="text-[13px] text-[#a0a0a0]">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
