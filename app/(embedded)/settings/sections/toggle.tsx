'use client';

/**
 * Settings-redesign Task 13 — prototype Toggle (settings.jsx lines 396–414)
 * with switch ARIA added: 36×20 pill, 16px knob sliding 2px → 18px, accent
 * background when on, #c9ccd0 when off. Controlled — the parent owns the
 * value and persistence.
 */
import { cn } from '@/lib/utils';

export function Toggle({
  on,
  label,
  ariaLabel,
  onToggle,
}: {
  on: boolean;
  /** Visible label rendered next to the pill (prototype copy). */
  label: string;
  /** Accessible switch name (the card-level intent). */
  ariaLabel: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel}
        onClick={() => onToggle(!on)}
        className={cn(
          'relative h-5 w-9 cursor-pointer rounded-[10px] border-none p-0 transition-colors duration-200',
          on ? 'bg-[var(--sd-accent,#5B4FE9)]' : 'bg-[#c9ccd0]',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left] duration-200',
            on ? 'left-[18px]' : 'left-[2px]',
          )}
        />
      </button>
      <span className="text-[13px] text-[#202223]">{label}</span>
    </div>
  );
}
