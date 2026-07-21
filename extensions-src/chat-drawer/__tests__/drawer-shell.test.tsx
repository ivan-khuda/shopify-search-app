/**
 * DrawerShell — positionable drawer container (drawer-redesign Task 5).
 *
 * Pixel reference: /tmp/design-handoff3 storefront.jsx ChatDrawer (349–416).
 * Three positions: side (420px right panel), bottom-sheet, center-modal.
 * `isMobile` (matchMedia max-width:640px) forces the bottom sheet.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawerShell } from '@/extensions-src/chat-drawer/components/DrawerShell';

/** Same shape as the vitest.setup.ts jsdom polyfill, with a controllable match. */
function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DrawerShell — side (default)', () => {
  it('renders a right-aligned 420px dialog panel inside a scrim', () => {
    render(
      <DrawerShell position="side" onClose={vi.fn()}>
        <p>drawer content</p>
      </DrawerShell>,
    );

    const scrim = screen.getByTestId('sd-drawer-scrim');
    expect(scrim.dataset.position).toBe('side');
    expect(scrim.className).toContain('justify-end');

    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('w-[420px]');
    expect(screen.getByText('drawer content')).toBeInTheDocument();
  });

  it('calls onClose on scrim click but NOT on panel click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DrawerShell position="side" onClose={onClose}>
        <p>drawer content</p>
      </DrawerShell>,
    );

    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('sd-drawer-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DrawerShell — bottom-sheet', () => {
  it('renders a bottom panel at 78% height without a grab handle on desktop', () => {
    render(
      <DrawerShell position="bottom-sheet" onClose={vi.fn()}>
        <p>sheet content</p>
      </DrawerShell>,
    );

    const scrim = screen.getByTestId('sd-drawer-scrim');
    expect(scrim.dataset.position).toBe('bottom-sheet');
    expect(scrim.className).toContain('justify-end');

    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('h-[78%]');
    expect(screen.queryByTestId('sd-grab-handle')).not.toBeInTheDocument();
  });

  it('renders at 88% height with a grab handle when mobile', () => {
    stubMatchMedia(true);
    render(
      <DrawerShell position="bottom-sheet" onClose={vi.fn()}>
        <p>sheet content</p>
      </DrawerShell>,
    );

    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('h-[88%]');
    expect(screen.getByTestId('sd-grab-handle')).toBeInTheDocument();
  });
});

describe('DrawerShell — center-modal', () => {
  it('renders a centered modal panel', () => {
    render(
      <DrawerShell position="center-modal" onClose={vi.fn()}>
        <p>modal content</p>
      </DrawerShell>,
    );

    const scrim = screen.getByTestId('sd-drawer-scrim');
    expect(scrim.dataset.position).toBe('center-modal');
    expect(scrim.className).toContain('items-center');
    expect(scrim.className).toContain('justify-center');

    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('rounded-[18px]');
  });
});

describe('DrawerShell — mobile override', () => {
  it.each(['side', 'center-modal'] as const)(
    'isMobile forces bottom-sheet over position="%s"',
    (position) => {
      stubMatchMedia(true);
      render(
        <DrawerShell position={position} onClose={vi.fn()}>
          <p>content</p>
        </DrawerShell>,
      );

      expect(screen.getByTestId('sd-drawer-scrim').dataset.position).toBe('bottom-sheet');
      expect(screen.getByTestId('sd-grab-handle')).toBeInTheDocument();
    },
  );
});

describe('DrawerShell — animation keyframes', () => {
  it('injects the sd keyframes style tag exactly once', () => {
    document.getElementById('sd-drawer-keyframes')?.remove();
    const { unmount } = render(
      <DrawerShell position="side" onClose={vi.fn()}>
        <p>a</p>
      </DrawerShell>,
    );
    unmount();
    render(
      <DrawerShell position="side" onClose={vi.fn()}>
        <p>b</p>
      </DrawerShell>,
    );

    const tags = document.querySelectorAll('#sd-drawer-keyframes');
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toContain('sd-slide-left');
    expect(tags[0].textContent).toContain('sd-slide-up');
    expect(tags[0].textContent).toContain('sd-pop');
    expect(tags[0].textContent).toContain('sd-spin');
    expect(tags[0].textContent).toContain('sd-blink');
    expect(tags[0].textContent).toContain('sd-bounce');
  });

  it('exposes an accessible dialog (aria-modal + label)', () => {
    render(
      <DrawerShell position="side" onClose={vi.fn()} ariaLabel="Shopping assistant">
        <p>content</p>
      </DrawerShell>,
    );

    const panel = screen.getByRole('dialog', { name: 'Shopping assistant' });
    expect(panel).toHaveAttribute('aria-modal', 'true');
  });
});
