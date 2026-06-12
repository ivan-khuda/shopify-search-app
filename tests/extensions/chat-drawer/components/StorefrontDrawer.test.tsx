/**
 * StorefrontDrawer — redesigned shell (drawer-redesign Task 8).
 *
 * The drawer now owns the settings fetch (lifted from DrawerBody): one
 * mount-time request against the app-proxy appearance meta endpoint drives
 * the Fab variant, the DrawerShell position, the accent var, and the
 * kill-switch (drawerEnabled / Theme Editor preview). DrawerBody is mocked
 * with a prop-capturing stub — its own behavior is pinned in
 * extensions-src/chat-drawer/__tests__/drawer-body.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StorefrontDrawer } from '@/extensions-src/chat-drawer/components/StorefrontDrawer';

interface BodyStubProps {
  activeTab: string;
  shop: string;
  visitorId: string;
  customerId: string | null;
  settings: Record<string, unknown>;
  onSwitchToChat?: () => void;
  onCountsChange?: (counts: { history: number; saved: number }) => void;
}

const bodyProps: BodyStubProps[] = [];

vi.mock('@/extensions-src/chat-drawer/components/DrawerBody', () => ({
  default: (props: BodyStubProps) => {
    bodyProps.push(props);
    return (
      <div data-testid="drawer-body" data-active-tab={props.activeTab}>
        <button type="button" onClick={() => props.onSwitchToChat?.()}>
          switch-to-chat
        </button>
        <button
          type="button"
          onClick={() => props.onCountsChange?.({ history: 3, saved: 2 })}
        >
          emit-counts
        </button>
      </div>
    );
  },
}));

function stubSettings(body: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  bodyProps.length = 0;
  // Default: settings lookup fails — fail-open keeps the drawer rendering
  // with DEFAULT_SHOP_SETTINGS.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  shop: 'test.myshopify.com',
  visitorId: 'v-test-1',
} as const;

async function openDrawer(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' }));
}

describe('StorefrontDrawer — settings fetch (lifted from DrawerBody)', () => {
  it('fetches the appearance meta exactly once on mount, before the drawer opens', async () => {
    const fetchMock = stubSettings({});
    const { rerender } = render(<StorefrontDrawer {...baseProps} />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/apps/smartdiscovery/_meta/appearance');

    rerender(<StorefrontDrawer {...baseProps} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('applies the fetched drawerAccent as --sd-accent on the root wrapper', async () => {
    stubSettings({ drawerAccent: '#008060' });
    const { container } = render(<StorefrontDrawer {...baseProps} />);

    await waitFor(() => {
      const root = container.querySelector('.sd-root') as HTMLElement;
      expect(root.style.getPropertyValue('--sd-accent')).toBe('#008060');
    });
  });

  it('fails open: network error keeps the default circle FAB', async () => {
    render(<StorefrontDrawer {...baseProps} />);
    expect(
      screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' }),
    ).toBeInTheDocument();
  });
});

describe('StorefrontDrawer — FAB variants from settings', () => {
  it('renders the pill FAB with "Ask {shopName}" when fabStyle is pill', async () => {
    stubSettings({ fabStyle: 'pill' });
    render(<StorefrontDrawer {...baseProps} shopName="Field & Form" />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await waitFor(() => expect(fab.textContent).toContain('Ask Field & Form'));
  });

  it('renders the labeled FAB when fabStyle is labeled', async () => {
    stubSettings({ fabStyle: 'labeled' });
    render(<StorefrontDrawer {...baseProps} />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await waitFor(() => expect(fab.textContent).toContain('Find anything'));
  });
});

describe('StorefrontDrawer — DrawerShell position from settings', () => {
  it('passes the fetched drawerPosition to the shell (center-modal)', async () => {
    stubSettings({ drawerPosition: 'center-modal' });
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);

    await waitFor(() =>
      expect(screen.getByTestId('sd-drawer-scrim').getAttribute('data-position')).toBe(
        'center-modal',
      ),
    );
  });

  it('defaults to the side panel', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    expect(screen.getByTestId('sd-drawer-scrim').getAttribute('data-position')).toBe('side');
  });
});

describe('StorefrontDrawer — header (prototype DrawerInner)', () => {
  it('shows "Ask {shopName}" with the green-dot subline', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} shopName="Field & Form" />);

    await openDrawer(user);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ask Field & Form')).toBeInTheDocument();
    expect(
      within(dialog).getByText('AI-powered · usually replies instantly'),
    ).toBeInTheDocument();
  });

  it('falls back to "Ask us" when no shop name is provided', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    expect(within(screen.getByRole('dialog')).getByText('Ask us')).toBeInTheDocument();
  });

  it('close button has aria-label "Close chat drawer" and closes the drawer', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close chat drawer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('StorefrontDrawer — tabs with badges', () => {
  it('renders Chat/History/Saved tabs, chat selected by default', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);

    expect(screen.getByRole('tab', { name: /Chat/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Saved/ })).toBeInTheDocument();
  });

  it('switching tab re-renders DrawerBody with the new activeTab', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    await waitFor(() => expect(screen.getByTestId('drawer-body')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /History/ }));
    expect(screen.getByTestId('drawer-body').getAttribute('data-active-tab')).toBe('history');
  });

  it('shows history/saved badges from DrawerBody onCountsChange', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    await waitFor(() => expect(screen.getByTestId('drawer-body')).toBeInTheDocument());

    // No counts yet — no badges.
    expect(screen.getByRole('tab', { name: /History/ }).textContent).toBe('History');
    expect(screen.getByRole('tab', { name: /Saved/ }).textContent).toBe('Saved');

    await user.click(screen.getByRole('button', { name: 'emit-counts' }));

    expect(screen.getByRole('tab', { name: /History/ }).textContent).toContain('3');
    expect(screen.getByRole('tab', { name: /Saved/ }).textContent).toContain('2');
  });

  it('history resume switches the active tab back to chat', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    await waitFor(() => expect(screen.getByTestId('drawer-body')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /History/ }));
    await user.click(screen.getByRole('button', { name: 'switch-to-chat' }));

    expect(screen.getByRole('tab', { name: /Chat/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('drawer-body').getAttribute('data-active-tab')).toBe('chat');
  });
});

describe('StorefrontDrawer — kill-switch (settings owned by the shell)', () => {
  it('drawerEnabled:false renders null (no FAB) without needing the drawer open', async () => {
    stubSettings({ drawerEnabled: false });
    render(<StorefrontDrawer {...baseProps} />);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /SmartDiscovery AI chat/ })).toBeNull(),
    );
  });

  it('design mode + editorPreviewVisible:false hides the FAB', async () => {
    vi.stubGlobal('Shopify', { designMode: true });
    stubSettings({ editorPreviewVisible: false });
    render(<StorefrontDrawer {...baseProps} />);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /SmartDiscovery AI chat/ })).toBeNull(),
    );
  });

  it('design mode with editorPreviewVisible:true keeps the FAB but blocks click-open', async () => {
    vi.stubGlobal('Shopify', { designMode: true });
    stubSettings({ editorPreviewVisible: true });
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);
    // STR-07: designMode click guard — drawer must not open in the editor.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('storefront (non-design-mode) ignores editorPreviewVisible:false', async () => {
    stubSettings({ editorPreviewVisible: false });
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('StorefrontDrawer — interaction contract (preserved behaviors)', () => {
  it('FAB click toggles the drawer open and closed', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await openDrawer(user);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close SmartDiscovery AI chat' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape closes the drawer and returns focus to the FAB', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} />);

    await openDrawer(user);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' }),
      ),
    );
  });

  it('registerToggle exposes an imperative toggle that opens the drawer', async () => {
    let toggle: (() => void) | null = null;
    render(<StorefrontDrawer {...baseProps} registerToggle={(fn) => (toggle = fn)} />);

    expect(toggle).not.toBeNull();
    act(() => toggle!());
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('renders placeholder copy (no DrawerBody) when rendered with no props', async () => {
    const user = userEvent.setup();
    expect(() => render(<StorefrontDrawer />)).not.toThrow();

    await openDrawer(user);

    expect(screen.getByText('Chat coming up…')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-body')).toBeNull();
  });

  it('threads shop/visitorId/customerId and the fetched settings into DrawerBody', async () => {
    stubSettings({ drawerAccent: '#008060' });
    const user = userEvent.setup();
    render(<StorefrontDrawer {...baseProps} customerId="123" />);

    await openDrawer(user);
    await waitFor(() => expect(screen.getByTestId('drawer-body')).toBeInTheDocument());

    const props = bodyProps[bodyProps.length - 1];
    expect(props.shop).toBe('test.myshopify.com');
    expect(props.visitorId).toBe('v-test-1');
    expect(props.customerId).toBe('123');
    expect(props.settings.drawerAccent).toBe('#008060');
  });
});
