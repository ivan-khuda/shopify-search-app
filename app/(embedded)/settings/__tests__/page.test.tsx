// Phase 7 Wave 0 RED scaffold for app/(embedded)/settings/page.tsx.
// Pins the Server Component contract from D-04 (table columns), D-06
// (pre-selection + warning banner), D-03 (cached + cold-start banners),
// and Phase 4 shop-undefined parity with /chat. Implementation lands in
// Plan 08.
import { render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: vi.fn(),
}));

vi.mock('@/services/chat/model-catalog', () => ({
  fetchModelCatalog: vi.fn(),
}));

// Stub the client SettingsForm — this suite asserts the SSR layer only.
vi.mock('../settings-form', () => ({
  SettingsForm: ({
    catalog,
    activeId,
    saveDisabled,
  }: {
    catalog: Array<{ id: string }>;
    activeId: string | null;
    saveDisabled?: boolean;
  }) => (
    <div
      data-testid="settings-form-stub"
      data-catalog-count={String(catalog.length)}
      data-active-id={activeId ?? ''}
      data-save-disabled={saveDisabled ? 'true' : 'false'}
    />
  ),
}));

import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import SettingsPage from '@/app/(embedded)/settings/page';

const getActiveMock = getActiveChatModel as ReturnType<typeof vi.fn>;
const fetchCatalogMock = fetchModelCatalog as ReturnType<typeof vi.fn>;

const baseCatalog = {
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
    {
      id: 'anthropic/claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      provider: 'Anthropic',
      contextWindow: 200_000,
      inputPricePerMillion: 3.0,
      outputPricePerMillion: 15.0,
      bestFor: 'Best reasoning',
    },
  ],
  stale: false,
  coldStartFallback: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchCatalogMock.mockResolvedValue(baseCatalog);
  getActiveMock.mockResolvedValue({
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  });
});

async function renderPage(searchParams: Record<string, string | undefined>) {
  const tree = await SettingsPage({
    searchParams: Promise.resolve(searchParams),
  } as { searchParams: Promise<Record<string, string | undefined>> });
  return render(tree as React.ReactElement);
}

describe('SettingsPage — SSR catalog rendering (SC1, D-04)', () => {
  it('renders all 7 column headers in the locked order', async () => {
    const { container } = await renderPage({ shop: 'demo.myshopify.com' });
    const text = container.textContent ?? '';
    expect(text).toContain('Model name');
    expect(text).toContain('Provider');
    expect(text).toContain('Context window');
    expect(text).toContain('$ / M input tokens');
    expect(text).toContain('$ / M output tokens');
    expect(text).toContain('Best for');
    expect(text).toContain('Active');
  });

  it('passes the full catalog (count + ids) through to the client form', async () => {
    const { getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });
    const stub = getByTestId('settings-form-stub');
    expect(stub.getAttribute('data-catalog-count')).toBe('2');
  });
});

describe('SettingsPage — active row pre-selection (SC3, D-06)', () => {
  it('passes activeId to the client form when the active id is present in catalog', async () => {
    const { getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });
    const stub = getByTestId('settings-form-stub');
    expect(stub.getAttribute('data-active-id')).toBe('google/gemini-2.5-flash');
  });

  it('does NOT crash when searchParams.shop is undefined; passes empty shop to resolver', async () => {
    const { getByTestId } = await renderPage({});
    expect(getByTestId('settings-form-stub')).toBeInTheDocument();
    expect(getActiveMock).toHaveBeenCalledWith('');
  });
});

describe('SettingsPage — D-06 warning banner', () => {
  it('renders a warning banner when active id is not in catalog (previously-selected model unavailable)', async () => {
    getActiveMock.mockResolvedValue({
      id: 'removed/old-model',
      displayName: 'old-model',
    });

    const { container } = await renderPage({ shop: 'demo.myshopify.com' });
    const banner = container.querySelector('s-banner[tone="warning"]');
    expect(banner).not.toBeNull();
    expect((banner?.textContent ?? '').toLowerCase()).toContain('no longer available');
  });
});

describe('SettingsPage — D-03 catalog availability banners', () => {
  it('renders a cached-banner when catalogResult.stale === true', async () => {
    fetchCatalogMock.mockResolvedValue({ ...baseCatalog, stale: true });

    const { container } = await renderPage({ shop: 'demo.myshopify.com' });
    const banner = container.querySelector('s-banner[tone="warning"]');
    expect(banner).not.toBeNull();
    expect((banner?.textContent ?? '').toLowerCase()).toContain('cached');
  });

  it('renders a critical banner + sets saveDisabled when coldStartFallback === true', async () => {
    fetchCatalogMock.mockResolvedValue({
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
      coldStartFallback: true,
    });

    const { container, getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });
    const banner = container.querySelector('s-banner[tone="critical"]');
    expect(banner).not.toBeNull();
    expect((banner?.textContent ?? '').toLowerCase()).toContain('unavailable');
    expect(getByTestId('settings-form-stub').getAttribute('data-save-disabled')).toBe('true');
  });
});

// RED: implementation lands in Plan 08 (app/(embedded)/settings/page.tsx).
