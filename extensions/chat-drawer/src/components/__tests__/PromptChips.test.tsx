/**
 * RED scaffold for STR-06 — PromptChips component.
 * Tests exactly 4 chips with EXACT label strings from UI-SPEC §Copywriting Contract.
 *
 * CRITICAL: chip 2 uses U+2019 RIGHT SINGLE QUOTATION MARK (') in "What’s on sale right now?"
 * NOT the ASCII apostrophe (').
 *
 * Tests fail with "Cannot find module" until Wave 3 ships the component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PromptChips } from '@/extensions/chat-drawer/src/components/PromptChips';

// ── UI-SPEC §Copywriting Contract chip strings (BYTE-PRECISE) ────────────────
// Chip 2 uses U+2019 RIGHT SINGLE QUOTATION MARK — not ASCII apostrophe
const CHIP_LABELS = [
  'Show me your best sellers',
  'What’s on sale right now?', // U+2019 smart apostrophe
  'Help me find a gift under $50',
  "I'm looking for something warm and cozy", // ASCII apostrophe (I'm)
] as const;

describe('PromptChips — STR-06 exact chip labels', () => {
  it('renders exactly 4 chips', () => {
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);

    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(4);
  });

  it('chip 1: "Show me your best sellers"', () => {
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: CHIP_LABELS[0] })).toBeDefined();
  });

  it('chip 2: "What’s on sale right now?" — MUST use U+2019 smart apostrophe, not ASCII', () => {
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);

    const chip = screen.getByRole('button', { name: CHIP_LABELS[1] });
    expect(chip).toBeDefined();

    // Explicitly verify the text contains U+2019, not ASCII apostrophe (U+0027)
    const textContent = chip.textContent ?? '';
    expect(textContent).toContain('’'); // RIGHT SINGLE QUOTATION MARK
    expect(textContent).not.toBe(textContent.replace('’', "'")); // would differ
  });

  it('chip 3: "Help me find a gift under $50"', () => {
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: CHIP_LABELS[2] })).toBeDefined();
  });

  it('chip 4: "I\'m looking for something warm and cozy"', () => {
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: CHIP_LABELS[3] })).toBeDefined();
  });

  it('clicking a chip invokes onSubmit with the exact chip text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);

    const chip1 = screen.getByRole('button', { name: CHIP_LABELS[0] });
    await user.click(chip1);
    expect(onSubmit).toHaveBeenCalledWith(CHIP_LABELS[0]);
  });

  it('clicking chip 2 invokes onSubmit with the U+2019 smart apostrophe string', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);

    const chip2 = screen.getByRole('button', { name: CHIP_LABELS[1] });
    await user.click(chip2);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const calledWith = onSubmit.mock.calls[0][0] as string;
    // Byte-precise check: must have U+2019, not ASCII '
    expect(calledWith).toBe('What’s on sale right now?');
    expect(calledWith.charCodeAt(4)).toBe(0x2019); // char at index 4: the apostrophe
  });

  it('clicking chip 3 invokes onSubmit with "Help me find a gift under $50"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: CHIP_LABELS[2] }));
    expect(onSubmit).toHaveBeenCalledWith(CHIP_LABELS[2]);
  });

  it('clicking chip 4 invokes onSubmit with "I\'m looking for something warm and cozy"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptChips onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: CHIP_LABELS[3] }));
    expect(onSubmit).toHaveBeenCalledWith(CHIP_LABELS[3]);
  });
});
