// Settings-redesign Task 8 — Server Component contract for the rebuilt
// /settings page. Pins the parallel SSR data assembly (catalog, active model,
// shop settings bundle, usage snapshot, webhook last-fired map, last
// successful sync) plus WR-01 shop validation parity with /chat.
import { render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { webhookGroupBy, syncRunFindFirst } = vi.hoisted(() => ({
  webhookGroupBy: vi.fn(),
  syncRunFindFirst: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    webhookEvent: { groupBy: webhookGroupBy },
    syncRun: { findFirst: syncRunFindFirst },
  },
}));

vi.mock('@/services/chat/getActiveChatModel', () => ({
  getActiveChatModel: vi.fn(),
}));

vi.mock('@/services/chat/model-catalog', () => ({
  fetchModelCatalog: vi.fn(),
}));

vi.mock('@/services/settings/getShopSettings', () => ({
  getShopSettings: vi.fn(),
}));

vi.mock('@/services/settings/getUsageSnapshot', () => ({
  getUsageSnapshot: vi.fn(),
}));

// Stub the client shell — this suite asserts the SSR data layer only.
vi.mock('../settings-shell', () => ({
  SettingsShell: (props: Record<string, unknown>) => (
    <div data-testid="settings-shell-stub" data-props={JSON.stringify(props)} />
  ),
}));

import { getActiveChatModel } from '@/services/chat/getActiveChatModel';
import { fetchModelCatalog } from '@/services/chat/model-catalog';
import { getShopSettings } from '@/services/settings/getShopSettings';
import { getUsageSnapshot } from '@/services/settings/getUsageSnapshot';
import { DEFAULT_SHOP_SETTINGS } from '@/lib/settings/contract';
import SettingsPage from '@/app/(embedded)/settings/page';

const getActiveMock = getActiveChatModel as ReturnType<typeof vi.fn>;
const fetchCatalogMock = fetchModelCatalog as ReturnType<typeof vi.fn>;
const getSettingsMock = getShopSettings as ReturnType<typeof vi.fn>;
const getUsageMock = getUsageSnapshot as ReturnType<typeof vi.fn>;

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

const baseUsage = {
  used: 1284,
  adminUsed: 182,
  storefrontUsed: 1102,
  cap: 2000,
  periodLabel: 'June 2026',
  resetsAt: '2026-07-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchCatalogMock.mockResolvedValue(baseCatalog);
  getActiveMock.mockResolvedValue({
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
  });
  getSettingsMock.mockResolvedValue(DEFAULT_SHOP_SETTINGS);
  getUsageMock.mockResolvedValue(baseUsage);
  webhookGroupBy.mockResolvedValue([]);
  syncRunFindFirst.mockResolvedValue(null);
});

async function renderPage(searchParams: Record<string, string | undefined>) {
  const tree = await SettingsPage({
    searchParams: Promise.resolve(searchParams),
  } as { searchParams: Promise<Record<string, string | undefined>> });
  return render(tree as React.ReactElement);
}

function shellProps(getByTestId: (id: string) => HTMLElement) {
  return JSON.parse(
    getByTestId('settings-shell-stub').getAttribute('data-props') ?? '{}',
  ) as Record<string, unknown>;
}

describe('SettingsPage — SSR data assembly', () => {
  it('loads catalog, active model, settings, and usage for the validated shop', async () => {
    const { getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });

    expect(fetchCatalogMock).toHaveBeenCalledTimes(1);
    expect(getActiveMock).toHaveBeenCalledWith('demo.myshopify.com');
    expect(getSettingsMock).toHaveBeenCalledWith('demo.myshopify.com');
    expect(getUsageMock).toHaveBeenCalledWith('demo.myshopify.com');

    const props = shellProps(getByTestId);
    expect(props.shop).toBe('demo.myshopify.com');
    expect(props.catalog).toEqual(baseCatalog);
    expect(props.activeModel).toEqual({
      id: 'google/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
    });
    expect(props.settings).toEqual(DEFAULT_SHOP_SETTINGS);
    expect(props.usage).toEqual(baseUsage);
  });

  it('builds the webhook last-fired map from the shop-scoped groupBy', async () => {
    webhookGroupBy.mockResolvedValue([
      { topic: 'products/update', _max: { receivedAt: new Date('2026-06-12T10:00:00.000Z') } },
      { topic: 'products/delete', _max: { receivedAt: null } },
    ]);

    const { getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });

    expect(webhookGroupBy).toHaveBeenCalledWith({
      by: ['topic'],
      where: { shop: 'demo.myshopify.com' },
      _max: { receivedAt: true },
    });
    expect(shellProps(getByTestId).webhooks).toEqual({
      'products/update': '2026-06-12T10:00:00.000Z',
    });
  });

  it('passes the last successful sync summary when one exists', async () => {
    syncRunFindFirst.mockResolvedValue({
      startedAt: new Date('2026-06-12T16:14:00.000Z'),
      finishedAt: new Date('2026-06-12T16:18:12.000Z'),
      processedCount: 15,
    });

    const { getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });

    expect(syncRunFindFirst).toHaveBeenCalledWith({
      where: { shop: 'demo.myshopify.com', state: 'succeeded' },
      orderBy: { finishedAt: 'desc' },
    });
    expect(shellProps(getByTestId).lastSync).toEqual({
      startedAt: '2026-06-12T16:14:00.000Z',
      finishedAt: '2026-06-12T16:18:12.000Z',
      processedCount: 15,
    });
  });

  it('passes lastSync: null when no successful sync exists', async () => {
    const { getByTestId } = await renderPage({ shop: 'demo.myshopify.com' });
    expect(shellProps(getByTestId).lastSync).toBeNull();
  });
});

describe('SettingsPage — WR-01 shop validation', () => {
  it('does NOT crash when searchParams.shop is undefined; passes empty shop to resolvers', async () => {
    const { getByTestId } = await renderPage({});
    expect(getByTestId('settings-shell-stub')).toBeInTheDocument();
    expect(getActiveMock).toHaveBeenCalledWith('');
    expect(getSettingsMock).toHaveBeenCalledWith('');
    expect(getUsageMock).toHaveBeenCalledWith('');
    expect(webhookGroupBy).not.toHaveBeenCalled();
    expect(syncRunFindFirst).not.toHaveBeenCalled();
  });

  // WR-01 parity with /chat: searchParams.shop is attacker-controllable on
  // direct navigation — a non-.myshopify.com value must never reach the
  // shop-scoped resolvers or DB queries.
  it('rejects an invalid searchParams.shop and passes empty shop everywhere', async () => {
    const { getByTestId } = await renderPage({ shop: 'evil.example.com' });
    expect(shellProps(getByTestId).shop).toBe('');
    expect(getActiveMock).toHaveBeenCalledWith('');
    expect(getSettingsMock).toHaveBeenCalledWith('');
    expect(getUsageMock).toHaveBeenCalledWith('');
    expect(webhookGroupBy).not.toHaveBeenCalled();
    expect(syncRunFindFirst).not.toHaveBeenCalled();
  });
});
