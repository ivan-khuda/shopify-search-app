// Settings-redesign Task 8 — client side-nav shell. Pins the prototype
// layout contract (settings.jsx SettingsScreen lines 1–51): "Settings"
// heading, five nav items, click-to-switch sections, accent classes on the
// active item, and the --sd-accent var on the shell root.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SHOP_SETTINGS } from '@/lib/settings/contract';
import { SettingsShell } from '../settings-shell';
import type { SettingsShellProps } from '../sections/types';

const baseProps: SettingsShellProps = {
  shop: 'demo.myshopify.com',
  catalog: {
    models: [
      {
        id: 'google/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        provider: 'Google',
        contextWindow: 1_048_576,
        inputPricePerMillion: 0.3,
        outputPricePerMillion: 2.5,
        bestFor: 'Fastest, low cost — great default',
      },
    ],
    stale: false,
    coldStartFallback: false,
  },
  activeModel: { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
  settings: DEFAULT_SHOP_SETTINGS,
  usage: {
    used: 1284,
    adminUsed: 182,
    storefrontUsed: 1102,
    cap: 2000,
    periodLabel: 'June 2026',
    resetsAt: '2026-07-01T00:00:00.000Z',
  },
  webhooks: {},
  lastSync: null,
};

const NAV_LABELS = [
  'AI model',
  'Drawer styling',
  'Usage & limits',
  'Sync & webhooks',
  'General',
];

describe('SettingsShell — side nav', () => {
  it('renders the Settings heading and all five nav items', () => {
    render(<SettingsShell {...baseProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    for (const label of NAV_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('shows the AI model section by default', () => {
    render(<SettingsShell {...baseProps} />);
    expect(screen.getByRole('heading', { name: 'AI model' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usage & limits' })).toBeNull();
  });

  it('clicking a nav item switches the visible section', async () => {
    const user = userEvent.setup();
    render(<SettingsShell {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Usage & limits' }));
    expect(screen.getByRole('heading', { name: 'Usage & limits' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI model' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'General' }));
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usage & limits' })).toBeNull();
  });

  it('the active nav item carries the accent classes', async () => {
    const user = userEvent.setup();
    render(<SettingsShell {...baseProps} />);

    const modelBtn = screen.getByRole('button', { name: 'AI model' });
    expect(modelBtn.className).toContain('text-[var(--sd-accent');
    expect(modelBtn.className).toContain('bg-[var(--sd-accent');

    await user.click(screen.getByRole('button', { name: 'General' }));
    const generalBtn = screen.getByRole('button', { name: 'General' });
    expect(generalBtn.className).toContain('text-[var(--sd-accent');
    expect(screen.getByRole('button', { name: 'AI model' }).className).not.toContain(
      'text-[var(--sd-accent',
    );
  });

  it('sets the --sd-accent var on the shell root', () => {
    const { container } = render(<SettingsShell {...baseProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--sd-accent')).toBe('#5B4FE9');
  });
});
