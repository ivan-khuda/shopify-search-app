/**
 * DrawerEmpty — drawer empty state (drawer-redesign Task 6).
 *
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerEmpty (571–616).
 * Gradient tile + "Hi there 👋" + merchant greeting (builtin fallback) +
 * TRY ASKING prompt list (merchant prompts, SUGGESTED_PROMPTS fallback).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DrawerEmpty,
  DRAWER_BUILTIN_GREETING,
} from '@/extensions-src/chat-drawer/components/DrawerEmpty';
import { SUGGESTED_PROMPTS } from '@/lib/chat-ui';

describe('DrawerEmpty', () => {
  it('renders the gradient tile, headline, and built-in greeting by default', () => {
    render(<DrawerEmpty onPick={vi.fn()} />);

    expect(screen.getByText('Hi there 👋')).toBeInTheDocument();
    expect(DRAWER_BUILTIN_GREETING).toBe(
      "Tell me what you're looking for. I'll find it in the catalog.",
    );
    expect(screen.getByText(DRAWER_BUILTIN_GREETING)).toBeInTheDocument();
    expect(
      document.querySelector(
        '[class*="linear-gradient(135deg,var(--sd-accent,#5B4FE9),#4b41bf)"]',
      ),
    ).not.toBeNull();
  });

  it('prefers the merchant greeting over the builtin', () => {
    render(<DrawerEmpty greeting="Welcome to Acme!" onPick={vi.fn()} />);

    expect(screen.getByText('Welcome to Acme!')).toBeInTheDocument();
    expect(screen.queryByText(DRAWER_BUILTIN_GREETING)).not.toBeInTheDocument();
  });

  it('lists built-in suggested prompts under TRY ASKING and fires onPick', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<DrawerEmpty onPick={onPick} />);

    expect(screen.getByText('Try asking')).toBeInTheDocument();
    for (const prompt of SUGGESTED_PROMPTS) {
      expect(screen.getByText(prompt.text)).toBeInTheDocument();
    }

    await user.click(screen.getByText(SUGGESTED_PROMPTS[0].text));
    expect(onPick).toHaveBeenCalledWith(SUGGESTED_PROMPTS[0].text);
  });

  it('replaces built-ins with merchant prompts when provided', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <DrawerEmpty prompts={[{ icon: '☕', text: 'Best pour-over gear?' }]} onPick={onPick} />,
    );

    expect(screen.getByText('Best pour-over gear?')).toBeInTheDocument();
    expect(screen.queryByText(SUGGESTED_PROMPTS[0].text)).not.toBeInTheDocument();

    await user.click(screen.getByText('Best pour-over gear?'));
    expect(onPick).toHaveBeenCalledWith('Best pour-over gear?');
  });
});
