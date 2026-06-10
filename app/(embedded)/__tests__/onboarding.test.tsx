import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../onboarding/page';

// Module-level mock for next/navigation — useSearchParams returns null by default.
// Per-test setup can override searchParamsGetMock.implementation to return a specific value.
const searchParamsGetMock = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

type ShopifyMock = {
  idToken: ReturnType<typeof vi.fn>;
  toast: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };
};

let fetchMock: ReturnType<typeof vi.fn>;
let shopifyMock: ShopifyMock;

beforeEach(() => {
  // Reset useSearchParams to return null by default (no ?retry= param)
  searchParamsGetMock.mockReturnValue(null);

  shopifyMock = {
    idToken: vi.fn().mockResolvedValue('test.jwt.token'),
    toast: { show: vi.fn(), hide: vi.fn() },
  };
  vi.stubGlobal('shopify', shopifyMock);
  // Default POST mock returns a syncRunId so the new Phase 2 flow's `await res.json()` works.
  // Per-test mocks can override via mockResolvedValueOnce.
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ syncRunId: 'sr_default' }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OnboardingPage', () => {
  it('renders the welcome heading on the s-page', () => {
    const { container } = render(<OnboardingPage />);
    const page = container.querySelector('s-page');
    expect(page).not.toBeNull();
    expect(page?.getAttribute('heading')).toBe('Welcome to SmartDiscovery AI');
  });

  it('renders the idle sync card with Start sync and background hint', () => {
    const { container } = render(<OnboardingPage />);
    expect(
      container.querySelector('s-section[heading="Sync your product catalog"]')
    ).not.toBeNull();
    expect(screen.getByTestId('start-sync')).toBeInTheDocument();
    expect(
      screen.getByText(/keep using your store while sync runs in the background/i)
    ).toBeInTheDocument();
  });

  it('renders the intro paragraph and the step rail in idle state', () => {
    render(<OnboardingPage />);
    expect(
      screen.getByText(/storefront can answer natural-language questions/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('step-rail')).toBeInTheDocument();
    expect(screen.getByTestId('step-2').getAttribute('data-active')).toBe('false');
  });

  it('renders the two-up info cards', () => {
    render(<OnboardingPage />);
    expect(screen.getByTestId('info-synced')).toBeInTheDocument();
    expect(screen.getByTestId('info-next')).toBeInTheDocument();
    expect(screen.getByText(/variants, options, prices/i)).toBeInTheDocument();
  });

  it('POSTs to /api/shopify/sync with a Bearer session token when Start sync is clicked', async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(shopifyMock.idToken).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer test.jwt.token' },
      });
    });
  });

  it('shows a success toast on 2xx', async () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(shopifyMock.toast.show).toHaveBeenCalledWith('Sync started');
    });
  });

  it('shows a session-expired error toast on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(shopifyMock.toast.show).toHaveBeenCalledWith(
        'Session expired. Reload the app.',
        { isError: true }
      );
    });
  });

  it('shows a generic error toast on other failures', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(shopifyMock.toast.show).toHaveBeenCalledWith(
        'Sync failed. Try again.',
        { isError: true }
      );
    });
  });
});

// =========================================================================
// Phase 2 progress UI tests (D-13, D-14, SYN-09, ADM-01, ADM-02).
// Post-Plan-02-10: onboarding state machine + polling + progress + banners.
// =========================================================================
describe('OnboardingPage — Phase 2 progress UI', () => {
  it('renders <s-progress-bar> + counter + state badge when state === running', async () => {
    // POST returns syncRunId; status returns running state
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncRunId: 'sr_run' }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'running',
          processedCount: 50,
          totalCount: 250,
          errors: [],
          startedAt: new Date().toISOString(),
          finishedAt: null,
        }),
      });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    // wait for POST response → state transitions to queued → progress UI mounts
    await waitFor(() => {
      expect(container.querySelector('[data-testid="progress-bar"]')).not.toBeNull();
    });

    // Advance to trigger one status poll
    await vi.advanceTimersByTimeAsync(2100);

    await waitFor(() => {
      const bar = container.querySelector('[data-testid="progress-bar"]');
      expect(bar?.getAttribute('value')).toBe('20'); // 50/250 = 20%
      expect(screen.getByText(/50 of 250 products/)).toBeInTheDocument();
      expect(screen.getByTestId('state-badge').textContent).toBe('Running');
    });

    vi.useRealTimers();
  });

  it('renders fallback counter and 0% bar when running with totalCount null, step-2 active', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncRunId: 'sr_nototal' }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'running',
          processedCount: 7,
          totalCount: null,
          errors: [],
          startedAt: new Date().toISOString(),
          finishedAt: null,
        }),
      });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(container.querySelector('[data-testid="progress-bar"]')).not.toBeNull();
    });

    await vi.advanceTimersByTimeAsync(2100);

    await waitFor(() => {
      const bar = container.querySelector('[data-testid="progress-bar"]');
      expect(bar?.getAttribute('value')).toBe('0');
      expect(screen.getByText(/7 products synced so far/)).toBeInTheDocument();
      expect(screen.getByTestId('step-2').getAttribute('data-active')).toBe('true');
    });

    vi.useRealTimers();
  });

  it('renders done-state stat tiles + CTAs when state === succeeded (D-14)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncRunId: 'sr_done' }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'succeeded',
          processedCount: 3247,
          totalCount: 3247,
          errors: [],
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        }),
      });

    const { container } = render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(
        container.querySelector('s-section[heading="Catalog synced and indexed"]')
      ).not.toBeNull();
      expect(screen.getByTestId('stat-products').textContent).toMatch(/3247/);
      expect(screen.getByTestId('stat-embeddings').textContent).toMatch(/3247/);
      const openChat = screen.getByTestId('open-chat');
      expect(openChat.getAttribute('href')).toBe('/chat');
      const configure = screen.getByTestId('configure-model');
      expect(configure.getAttribute('href')).toBe('/settings');
      // Step rail: Enable drawer becomes the active step after success
      expect(screen.getByTestId('step-3').getAttribute('data-active')).toBe('true');
    }, { timeout: 5000 });
  });

  it('renders <s-banner tone="warning"> + Retry CTA when state === partial', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncRunId: 'sr_partial' }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'partial',
          processedCount: 95,
          totalCount: 100,
          errors: ['err1', 'err2', 'err3', 'err4', 'err5'],
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        }),
      });

    const { container } = render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(container.querySelector('s-banner[tone="warning"]')).not.toBeNull();
      expect(screen.getByText(/95 products synced, 5 failed/)).toBeInTheDocument();
      expect(screen.getByTestId('retry-sync')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders <s-banner tone="critical"> + Retry CTA when state === failed', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ syncRunId: 'sr_failed' }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'failed',
          processedCount: 0,
          totalCount: null,
          errors: ['boom'],
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        }),
      });

    const { container } = render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));

    await waitFor(() => {
      expect(container.querySelector('s-banner[tone="critical"]')).not.toBeNull();
      expect(screen.getByTestId('retry-sync')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

// =========================================================================
// Phase 8.1 Plan 04 — ?retry= deep-link banner (W-1, NOT-02).
// These tests pin the contract: onboarding reads ?retry=, fetches status,
// renders a critical banner only when the referenced SyncRun is 'failed'.
// =========================================================================
describe('OnboardingPage — ?retry= deep-link banner', () => {
  it('renders a critical retry banner when ?retry= references a failed SyncRun', async () => {
    // Arrange: useSearchParams returns retryId, status endpoint returns failed run
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'retry' ? 'run-failed-1' : null
    );
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: 'failed',
        processedCount: 0,
        totalCount: 5,
        errors: ['oops'],
      }),
    });

    render(<OnboardingPage />);

    // Banner must appear with the critical tone, the heading text, the error, and the retry button
    const banner = await screen.findByTestId('retry-deep-link', undefined, { timeout: 3000 });
    expect(banner).toBeInTheDocument();

    const { container } = await waitFor(() => {
      const el = document.querySelector('s-banner[tone="critical"]');
      expect(el).not.toBeNull();
      return { container: el };
    });
    expect(container?.textContent).toMatch(/Your previous sync failed/);
    expect(container?.textContent).toMatch(/Retry\?/);
    expect(container?.textContent).toMatch(/oops/);
  });

  it('silently ignores the ?retry= param when the referenced SyncRun is not failed (succeeded)', async () => {
    // Arrange: useSearchParams returns retryId, but status says succeeded
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'retry' ? 'run-succeeded-1' : null
    );
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: 'succeeded',
        processedCount: 5,
        totalCount: 5,
        errors: [],
      }),
    });

    render(<OnboardingPage />);

    await waitFor(() => {
      // The status fetch must have been called
      expect(fetchMock).toHaveBeenCalled();
    });

    // Banner must NOT be in DOM — the param is silently dismissed for non-failed states
    expect(screen.queryByTestId('retry-deep-link')).toBeNull();
  });

  it('does not fetch /api/shopify/sync/status and does not render the banner when no ?retry= param', async () => {
    // Arrange: useSearchParams returns null (already the default in beforeEach)
    // fetchMock is the default returning sr_default — we just verify no status call was made

    render(<OnboardingPage />);

    // Give React one tick to settle
    await waitFor(() => {
      expect(screen.getByTestId('start-sync')).toBeInTheDocument();
    });

    // The retry deep-link banner must not appear
    expect(screen.queryByTestId('retry-deep-link')).toBeNull();

    // No call to the status endpoint should have been made
    const statusCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('/api/shopify/sync/status')
    );
    expect(statusCalls).toHaveLength(0);
  });

  it('retry button reuses handleStartSync: banner disappears and progress UI renders after click', async () => {
    // Arrange: deep-link with failed run
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'retry' ? 'run-failed-2' : null
    );

    // First fetch = status endpoint (returns failed state)
    // Second fetch = POST /api/shopify/sync (starts a new run)
    // Subsequent fetches = status polling (running state) — drives the progress bar
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ state: 'failed', processedCount: 0, totalCount: 5, errors: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ syncRunId: 'run-new-1' }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          state: 'running',
          processedCount: 1,
          totalCount: 5,
          errors: [],
        }),
      });

    render(<OnboardingPage />);

    // Wait for banner to appear
    await screen.findByTestId('retry-deep-link', undefined, { timeout: 3000 });

    // Click the Retry sync button
    fireEvent.click(screen.getByTestId('retry-deep-link'));

    // After click, syncRunId becomes non-null → progress bar renders, banner disappears
    await waitFor(() => {
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByTestId('retry-deep-link')).toBeNull();
  });
});
