// Settings-redesign Task 12 — Sync & webhooks section.
// Pins the prototype WebhooksSection contract (settings.jsx lines 292–339):
// four monospace topic rows with a green status dot and relative last-fired
// time ("—" when the topic never fired), a "Run full resync" button POSTing
// /api/shopify/sync with Bearer token (running state → "Sync queued"
// confirmation), and the last-successful-sync line with product count and
// duration — absent when no successful run exists.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebhooksSection } from '../sections/webhooks-section';
import type { LastSyncSummary, WebhookLastFiredMap } from '../sections/types';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'app/uninstalled',
];

let shopifyIdToken: ReturnType<typeof vi.fn>;
let shopifyToastShow: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  shopifyIdToken = vi.fn().mockResolvedValue('tok');
  shopifyToastShow = vi.fn();
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
    json: async () => ({ syncRunId: 'sr_1' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WebhooksSection — subscribed topics', () => {
  it('renders the four topic rows with relative last-fired times', () => {
    const webhooks: WebhookLastFiredMap = {
      'products/create': new Date(Date.now() - 3 * HOUR).toISOString(),
      'products/update': new Date(Date.now() - 2 * MIN).toISOString(),
      'app/uninstalled': new Date(Date.now() - 5 * DAY).toISOString(),
    };
    render(<WebhooksSection webhooks={webhooks} lastSync={null} />);

    for (const topic of TOPICS) {
      expect(screen.getByText(topic)).toBeInTheDocument();
    }
    expect(screen.getByText('last fired 2m ago')).toBeInTheDocument();
    expect(screen.getByText('last fired 3h ago')).toBeInTheDocument();
    expect(screen.getByText('last fired 5d ago')).toBeInTheDocument();
    // products/delete never fired.
    expect(screen.getByText('last fired —')).toBeInTheDocument();
  });
});

describe('WebhooksSection — manual resync', () => {
  it('POSTs /api/shopify/sync with Bearer token, shows running state then "Sync queued"', async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<WebhooksSection webhooks={{}} lastSync={null} />);
    const button = screen.getByRole('button', { name: /run full resync/i });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/shopify/sync');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ syncRunId: 'sr_1' }),
    });
    await waitFor(() => expect(screen.getByText('Sync queued')).toBeInTheDocument());
    expect(button).toBeEnabled();
  });

  it('surfaces the API error code inline on a failed resync', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'missing_bearer' }),
    } as Response);

    render(<WebhooksSection webhooks={{}} lastSync={null} />);
    fireEvent.click(screen.getByRole('button', { name: /run full resync/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('missing_bearer'),
    );
  });
});

describe('WebhooksSection — last successful sync line', () => {
  it('renders date, product count, and duration when a run exists', () => {
    const lastSync: LastSyncSummary = {
      startedAt: '2026-06-11T16:14:03.000Z',
      finishedAt: '2026-06-11T16:18:15.000Z',
      processedCount: 15,
    };
    render(<WebhooksSection webhooks={{}} lastSync={lastSync} />);

    const line = screen.getByText(/last successful sync:/i);
    expect(line.textContent).toMatch(
      /Last successful sync: .+ · 15 products · 4m 12s/,
    );
  });

  it('is absent when no successful run exists', () => {
    render(<WebhooksSection webhooks={{}} lastSync={null} />);
    expect(screen.queryByText(/last successful sync:/i)).toBeNull();
  });
});
