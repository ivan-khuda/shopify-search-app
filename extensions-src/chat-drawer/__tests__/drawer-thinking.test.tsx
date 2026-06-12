/**
 * DrawerThinking — three-dot pending bubble (drawer-redesign Task 6).
 * Pixel reference: /tmp/design-handoff3 storefront.jsx DrawerThinking (729–746).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DrawerThinking } from '@/extensions-src/chat-drawer/components/DrawerThinking';

describe('DrawerThinking', () => {
  it('renders an accessible status bubble with three bouncing dots', () => {
    render(<DrawerThinking />);

    const bubble = screen.getByRole('status');
    const dots = bubble.querySelectorAll('[class*="sd-bounce"]');
    expect(dots).toHaveLength(3);
  });
});
