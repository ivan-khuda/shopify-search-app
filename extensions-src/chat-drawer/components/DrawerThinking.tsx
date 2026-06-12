'use client';
/**
 * DrawerThinking — three-dot pending bubble (drawer-redesign Task 6).
 * Translated 1:1 from the design handoff (storefront.jsx DrawerThinking,
 * 729–746). sd-bounce keyframes are injected by DrawerShell.
 */
import { SDLogo } from '@/lib/chat-ui';

export function DrawerThinking() {
  return (
    <div className="flex gap-2" role="status" aria-label="Assistant is thinking">
      <SDLogo size={26} />
      <div className="inline-flex items-center gap-1 self-start rounded-[10px] border border-[#ededed] bg-white px-3.5 py-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-[5px] w-[5px] animate-[sd-bounce_1.2s_ease-in-out_infinite] rounded-full bg-[color-mix(in_srgb,var(--sd-accent,#5B4FE9)_60%,transparent)]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
