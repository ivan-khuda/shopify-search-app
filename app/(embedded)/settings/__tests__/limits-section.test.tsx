// Settings-redesign Task 11 — Usage & limits section.
// Pins the prototype LimitsSection contract (settings.jsx lines 243–290):
// big tabular-nums used count, "of {cap} chat requests", "{pct}% used"
// (accent under 80%, #bf4800 above), progress bar, Storefront/Admin stats
// (prototype `Stat`, 385–394), period label + "resets in N days", and the
// hard-cap input saving { monthlyCapRequests } to PATCH /api/settings/shop
// with cap_above_limit surfacing inline.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UsageSnapshot } from '@/services/settings/getUsageSnapshot';
import { LimitsSection } from '../sections/limits-section';

const DAY = 86_400_000;

function makeUsage(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    used: 1284,
    adminUsed: 182,
    storefrontUsed: 1102,
    cap: 2000,
    periodLabel: 'June 2026',
    // 9 days minus an hour from now → ceil = "resets in 9 days".
    resetsAt: new Date(Date.now() + 9 * DAY - 3_600_000).toISOString(),
    ...overrides,
  };
}

let shopifyToastShow: ReturnType<typeof vi.fn>;
let shopifyIdToken: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  shopifyToastShow = vi.fn();
  shopifyIdToken = vi.fn().mockResolvedValue('tok');
  Object.defineProperty(globalThis, 'shopify', {
    configurable: true,
    writable: true,
    value: {
      idToken: shopifyIdToken,
      toast: { show: shopifyToastShow },
    },
  });

  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LimitsSection — usage display', () => {
  it('renders the formatted counts, cap line, and surface stats', () => {
    render(<LimitsSection usage={makeUsage()} />);

    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('of 2,000 chat requests')).toBeInTheDocument();
    expect(screen.getByText('Storefront')).toBeInTheDocument();
    expect(screen.getByText('1,102')).toBeInTheDocument();
    expect(screen.getByText('Admin playground')).toBeInTheDocument();
    expect(screen.getByText('182')).toBeInTheDocument();
  });

  it('shows the period label with "resets in N days"', () => {
    render(<LimitsSection usage={makeUsage()} />);
    expect(screen.getByText('June 2026 · resets in 9 days')).toBeInTheDocument();
  });

  it('renders "64% used" in the accent color under the 80% threshold', () => {
    render(<LimitsSection usage={makeUsage()} />);
    const pct = screen.getByText('64% used');
    expect(pct.className).toContain('text-[var(--sd-accent');
    expect(pct.className).not.toContain('bf4800');

    const fill = screen.getByTestId('usage-bar-fill');
    expect(fill.style.width).toBe('64%');
    expect(fill.style.background).toContain('--sd-accent');
  });

  it('shifts to #bf4800 above the 80% threshold', () => {
    render(
      <LimitsSection usage={makeUsage({ used: 1800, storefrontUsed: 1618 })} />,
    );
    const pct = screen.getByText('90% used');
    expect(pct.className).toContain('text-[#bf4800]');

    const fill = screen.getByTestId('usage-bar-fill');
    expect(fill.style.width).toBe('90%');
    expect(fill.style.background).toContain('rgb(191, 72, 0)');
  });
});

describe('LimitsSection — hard cap save', () => {
  it('prefills the cap input from the effective cap', () => {
    render(<LimitsSection usage={makeUsage()} />);
    expect(screen.getByRole('spinbutton', { name: 'Monthly request cap' })).toHaveValue(
      2000,
    );
  });

  it('Save cap is disabled until the value changes', () => {
    render(<LimitsSection usage={makeUsage()} />);
    expect(screen.getByRole('button', { name: /save cap/i })).toBeDisabled();
  });

  it('Save PATCHes /api/settings/shop with { monthlyCapRequests }', async () => {
    render(<LimitsSection usage={makeUsage()} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Monthly request cap' }), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save cap/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/settings/shop');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(init.body).toBe(JSON.stringify({ monthlyCapRequests: 500 }));
    await waitFor(() => expect(shopifyToastShow).toHaveBeenCalledWith('Cap updated'));
  });

  it('surfaces the server cap_above_limit error inline', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'cap_above_limit' }),
    } as Response);

    render(<LimitsSection usage={makeUsage()} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Monthly request cap' }), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save cap/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('cap_above_limit'),
    );
    expect(shopifyToastShow).not.toHaveBeenCalled();
  });
});
