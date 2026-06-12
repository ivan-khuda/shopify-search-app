/**
 * Fab — storefront launcher button variants (drawer-redesign Task 5).
 *
 * Pixel reference: /tmp/design-handoff3 storefront.jsx FAB (275–345).
 * Three merchant-selectable styles: circle (56px round), pill (dark
 * "Ask {shop}"), labeled ("Powered by AI" / "Find anything" two-liner).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Fab } from '@/extensions-src/chat-drawer/components/Fab';

describe('Fab — circle (default)', () => {
  it('renders a 56px round button with the search-spark icon', () => {
    render(<Fab fabStyle="circle" ariaLabel="Open chat" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Open chat' });
    expect(button.className).toContain('h-14');
    expect(button.className).toContain('w-14');
    expect(button.className).toContain('rounded-full');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('defaults to circle when fabStyle is omitted', () => {
    render(<Fab ariaLabel="Open chat" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Open chat' }).className).toContain('rounded-full');
  });

  it('fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Fab fabStyle="circle" ariaLabel="Open chat" onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Fab — pill', () => {
  it('renders a dark pill with "Ask {shopName}"', () => {
    render(
      <Fab fabStyle="pill" shopName="Field & Form" ariaLabel="Open chat" onClick={vi.fn()} />,
    );

    const button = screen.getByRole('button', { name: /Open chat/ });
    expect(button.className).toContain('bg-[#1a1a1a]');
    expect(button).toHaveTextContent('Ask Field & Form');
  });

  it('falls back to "Ask us" without a shop name', () => {
    render(<Fab fabStyle="pill" ariaLabel="Open chat" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Open chat/ })).toHaveTextContent('Ask us');
  });
});

describe('Fab — labeled', () => {
  it('renders the "Powered by AI" / "Find anything" two-liner', () => {
    render(<Fab fabStyle="labeled" ariaLabel="Open chat" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /Open chat/ });
    expect(button).toHaveTextContent('Powered by AI');
    expect(button).toHaveTextContent('Find anything');
  });
});

describe('Fab — shared affordances', () => {
  it.each(['circle', 'pill', 'labeled'] as const)(
    '%s carries the provided aria-label',
    (fabStyle) => {
      render(<Fab fabStyle={fabStyle} ariaLabel="Close SmartDiscovery AI chat" onClick={vi.fn()} />);

      expect(
        screen.getByRole('button', { name: 'Close SmartDiscovery AI chat' }),
      ).toBeInTheDocument();
    },
  );
});
