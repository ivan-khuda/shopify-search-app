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
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
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
// Phase 2 Wave 0 RED stubs for SYN-09, ADM-01, ADM-02 (D-13/D-14).
// describe.skip until Plan 02-10 lands the polling + progress UI + banner.
// Plan 02-10 must remove the .skip and ensure each assertion matches the
// rewritten onboarding component.
// =========================================================================
describe.skip('OnboardingPage — Phase 2 progress UI (Plan 02-10)', () => {
  it('starts polling /api/shopify/sync/status every 2000ms after POST returns syncRunId', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ syncRunId: 'sr_test_001' }),
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        state: 'running',
        processedCount: 50,
        totalCount: 250,
        errors: [],
        startedAt: new Date().toISOString(),
        finishedAt: null,
      }),
    });
    render(<OnboardingPage />);
    fireEvent.click(screen.getByTestId('start-sync'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/shopify/sync',
      expect.anything()
    ));
    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/shopify/sync/status?syncRunId=sr_test_001'),
      expect.anything()
    ));
    vi.useRealTimers();
  });

  it('renders <s-progress-bar> with value derived from processedCount/totalCount when state === running', async () => {
    // Plan 02-10: container.querySelector('s-progress-bar') exists and value attr === Math.round(processed/total*100)
    render(<OnboardingPage />);
  });

  it('renders state badge text Queued / Running / Succeeded / Partial / Failed', async () => {
    render(<OnboardingPage />);
  });

  it('stops polling when state transitions to a terminal value (succeeded | partial | failed)', async () => {
    render(<OnboardingPage />);
  });

  it('renders <s-banner tone="success"> with product count + "Open admin chat" CTA linking to /chat (D-14)', async () => {
    render(<OnboardingPage />);
  });

  it('renders <s-banner tone="warning"> + Retry CTA when state === partial', async () => {
    render(<OnboardingPage />);
  });

  it('renders <s-banner tone="critical"> + Retry CTA when state === failed', async () => {
    render(<OnboardingPage />);
  });
});
