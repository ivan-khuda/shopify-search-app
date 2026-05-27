/**
 * RED scaffold — StorefrontDrawer component tests.
 * Tests fail with "Cannot find module" until Wave 3 ships the component.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StorefrontDrawer } from '@/extensions/chat-drawer/src/components/StorefrontDrawer';

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
});
