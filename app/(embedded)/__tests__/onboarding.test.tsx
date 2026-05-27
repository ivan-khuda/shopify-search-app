import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../onboarding/page';

type ShopifyMock = {
  idToken: ReturnType<typeof vi.fn>;
  toast: { show: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };
};

let fetchMock: ReturnType<typeof vi.fn>;
let shopifyMock: ShopifyMock;

beforeEach(() => {
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

  it('renders the "How it works" section', () => {
    const { container } = render(<OnboardingPage />);
    expect(container.querySelector('s-section[heading="How it works"]')).not.toBeNull();
    expect(screen.getByText(/sync your product catalog/i)).toBeInTheDocument();
  });

  it('renders the "What\'s synced" section', () => {
    const { container } = render(<OnboardingPage />);
    expect(container.querySelector('s-section[heading="What\'s synced"]')).not.toBeNull();
    expect(screen.getByText(/product titles/i)).toBeInTheDocument();
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
      expect(screen.getByText(/50 \/ 250 products/)).toBeInTheDocument();
      expect(screen.getByTestId('state-badge').textContent).toBe('Running');
    });

    vi.useRealTimers();
  });

  it('renders <s-banner tone="success"> + "Open admin chat" CTA when state === succeeded (D-14)', async () => {
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
      const banner = container.querySelector('s-banner[tone="success"]');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toMatch(/3247 products synced/);
      const openChat = screen.getByTestId('open-chat');
      expect(openChat.getAttribute('href')).toBe('/chat');
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
