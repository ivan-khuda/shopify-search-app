/**
 * RED scaffold — StorefrontDrawer component tests.
 * Tests fail with "Cannot find module" until Wave 3 ships the component.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StorefrontDrawer } from '@/extensions/chat-drawer/src/components/StorefrontDrawer';

// Mock @/lib/chat-ui barrel so the composition tests have stable testid markers.
// Also stubs DbBacked hooks to prevent constructor throws (Pitfall 3) and avoid
// real network calls in jsdom.
vi.mock('@/lib/chat-ui', () => ({
  ChatPane: () => <div data-testid="chat-pane">Chat Pane</div>,
  HistoryPanel: () => <div data-testid="history-panel">History Panel</div>,
  SavedProductsPanel: () => <div data-testid="saved-products-panel">Saved Products Panel</div>,
  useDbBackedHistoryStore: () => ({ items: [], add: vi.fn(), clear: vi.fn(), refresh: vi.fn() }),
  useDbBackedSavedProductsStore: () => ({
    items: [],
    toggle: vi.fn(),
    clear: vi.fn(),
    has: () => false,
    refresh: vi.fn(),
  }),
}));

describe('StorefrontDrawer — UI-SPEC copywriting and interaction contract', () => {
  it('renders FAB with aria-label "Open SmartDiscovery AI chat"', () => {
    render(<StorefrontDrawer />);
    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    expect(fab).toBeDefined();
  });

  it('FAB click toggles drawer open state', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer />);

    // Initially closed — aside should not be visible
    expect(screen.queryByRole('complementary')).toBeNull();

    // Click FAB to open
    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    // Drawer aside should now be visible
    expect(screen.getByRole('complementary')).toBeDefined();
  });

  it('drawer aside contains tabs labeled "Chat", "History", "Saved" (UI-SPEC)', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    expect(screen.getByRole('tab', { name: 'Chat' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'History' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Saved' })).toBeDefined();
  });

  it('Escape key closes the drawer', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer />);

    // Open drawer
    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);
    expect(screen.getByRole('complementary')).toBeDefined();

    // Press Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('close button has aria-label "Close chat drawer"', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    const closeButton = screen.getByRole('button', { name: 'Close chat drawer' });
    expect(closeButton).toBeDefined();
  });

  it('close button click closes the drawer', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);
    expect(screen.getByRole('complementary')).toBeDefined();

    const closeButton = screen.getByRole('button', { name: 'Close chat drawer' });
    await user.click(closeButton);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('FAB click when drawer is open toggles it closed', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab); // open
    expect(screen.getByRole('complementary')).toBeDefined();

    await user.click(fab); // close
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  // --- Composition assertions (RED: fail until Task 2 wires DrawerBody) ---

  it('composes ChatPane on the Chat tab when shop+visitorId are passed', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer shop="test.myshopify.com" visitorId="v-test-1" />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    // Chat tab is active by default
    expect(screen.getByTestId('chat-pane')).toBeDefined();
  });

  it('composes HistoryPanel on the History tab when shop+visitorId are passed', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer shop="test.myshopify.com" visitorId="v-test-1" />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    const historyTab = screen.getByRole('tab', { name: 'History' });
    await user.click(historyTab);

    expect(screen.getByTestId('history-panel')).toBeDefined();
  });

  it('composes SavedProductsPanel on the Saved tab when shop+visitorId are passed', async () => {
    const user = userEvent.setup();
    render(<StorefrontDrawer shop="test.myshopify.com" visitorId="v-test-1" />);

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    const savedTab = screen.getByRole('tab', { name: 'Saved' });
    await user.click(savedTab);

    expect(screen.getByTestId('saved-products-panel')).toBeDefined();
  });

  it('renders placeholder copy (no DbBacked hook invocation) when rendered with no props', async () => {
    const user = userEvent.setup();

    // Should not throw even though DbBacked stores require non-empty visitorId
    expect(() => render(<StorefrontDrawer />)).not.toThrow();

    const fab = screen.getByRole('button', { name: 'Open SmartDiscovery AI chat' });
    await user.click(fab);

    // Placeholder strings visible for the propless path
    expect(screen.getByText('Chat coming up…')).toBeDefined();

    // ChatPane should NOT be in the DOM in the propless path
    expect(screen.queryByTestId('chat-pane')).toBeNull();
  });
});
