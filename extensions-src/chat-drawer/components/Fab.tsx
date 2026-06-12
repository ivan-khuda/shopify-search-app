'use client';
/**
 * Fab — storefront launcher button (drawer-redesign Task 5).
 *
 * Three merchant-selectable variants translated 1:1 from the design handoff
 * (storefront.jsx FAB, lines 275–345):
 *   - circle  (default): 56px round accent button with the search-spark mark.
 *   - pill: dark pill with an accent spark dot and "Ask {shopName}".
 *   - labeled: accent block with "Powered by AI" / "Find anything" two-liner.
 *
 * Accent comes from `var(--sd-accent,#5B4FE9)` — the drawer wrapper sets the
 * var from merchant settings; this component never hardcodes a merchant color.
 */
import type { FabStyle } from '@/lib/settings/contract';

interface FabProps {
  fabStyle?: FabStyle;
  /** Storefront shop name — pill copy "Ask {shopName}", falls back to "Ask us". */
  shopName?: string | null;
  /** Open/close label supplied by the owner (toggles with drawer state). */
  ariaLabel: string;
  onClick: () => void;
}

/** Search-loupe + four-point spark, stroke inherits currentColor. */
function SearchSparkIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.5 15.5L20 20" />
      <path d="M11 7.5L12.2 10.3 15 11 12.2 11.7 11 14.5 9.8 11.7 7 11 9.8 10.3z" fill="currentColor" />
    </svg>
  );
}

export function Fab({ fabStyle = 'circle', shopName, ariaLabel, onClick }: FabProps) {
  if (fabStyle === 'pill') {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className="fixed right-6 bottom-6 z-[2002] flex cursor-pointer items-center gap-[9px] rounded-full border-none bg-[#1a1a1a] px-[18px] py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.08)]"
      >
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--sd-accent,#5B4FE9)]">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.5l-1.8-4.4L6 9.3l4.2-1.8z" />
          </svg>
        </span>
        Ask {shopName || 'us'}
      </button>
    );
  }

  if (fabStyle === 'labeled') {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className="fixed right-6 bottom-6 z-[2002] flex h-14 cursor-pointer items-center rounded-2xl border-none bg-[var(--sd-accent,#5B4FE9)] pl-1.5 text-white shadow-[0_12px_30px_color-mix(in_srgb,var(--sd-accent,#5B4FE9)_35%,transparent),0_2px_6px_rgba(0,0,0,0.08)]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.16]">
          <SearchSparkIcon size={20} />
        </span>
        <span className="pr-[18px] pl-3 text-left leading-[1.1]">
          <span className="mb-0.5 block text-[9.5px] font-semibold tracking-[0.06em] uppercase opacity-85">
            Powered by AI
          </span>
          <span className="block text-[13px] font-semibold">Find anything</span>
        </span>
      </button>
    );
  }

  // circle (default)
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="fixed right-6 bottom-6 z-[2002] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--sd-accent,#5B4FE9)] text-white shadow-[0_12px_30px_color-mix(in_srgb,var(--sd-accent,#5B4FE9)_35%,transparent),0_2px_6px_rgba(0,0,0,0.1)]"
    >
      <SearchSparkIcon size={24} />
    </button>
  );
}
