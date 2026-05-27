'use client';
/**
 * PromptChips — STR-06; four suggested-prompt chips for the empty chat state.
 *
 * Strings locked by UI-SPEC §Copywriting Contract. Do NOT modify without a
 * UI-SPEC supplement (Phase 5 lock pattern). Chip 2 uses U+2019 RIGHT SINGLE
 * QUOTATION MARK ('); chip 4 uses ASCII apostrophe (').
 */
import * as React from 'react';

export const CHIP_LABELS = [
  'Show me your best sellers',
  'What’s on sale right now?',
  'Help me find a gift under $50',
  "I'm looking for something warm and cozy",
] as const;

interface PromptChipsProps {
  onSubmit: (text: string) => void;
}

export function PromptChips({ onSubmit }: PromptChipsProps): React.ReactElement {
  return (
    <div role="group" aria-label="Suggested prompts" className="flex flex-wrap gap-2">
      {CHIP_LABELS.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onSubmit(label)}
          className="h-9 px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-full text-sm font-normal text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sd-accent,#008060)]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
