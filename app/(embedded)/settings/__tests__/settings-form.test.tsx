// Phase 7 Wave 0 RED scaffold for app/(embedded)/settings/settings-form.tsx.
// Pins the client-component contract: D-04 sort, D-07 dirty-state Save +
// toast + error banner, D-06 warning banner, Pitfall 1 (sort is client-side
// state, not a server round-trip). Implementation lands in Plan 08.
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsForm } from '../settings-form';

interface CatalogRow {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  bestFor: string;
}

const catalog: CatalogRow[] = [
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
  {
    id: 'openai/gpt-5-mini',
    displayName: 'GPT-5 Mini',
    provider: 'OpenAI',
    contextWindow: 128_000,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    bestFor: 'Cheapest reasoning',
  },
];

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
    json: async () => ({ ok: true, displayName: 'Claude Sonnet 4.5' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsForm — radio rendering', () => {
  it('renders one s-choice per catalog row with value=row.id', async () => {
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );
    const choices = container.querySelectorAll('s-choice');
    expect(choices).toHaveLength(catalog.length);
    const values = Array.from(choices).map((el) => el.getAttribute('value'));
    expect(values).toEqual(expect.arrayContaining(catalog.map((c) => c.id)));
  });
});

describe('SettingsForm — sort interaction (D-04, Pitfall 1)', () => {
  it('toggles sort direction on a header click (asc → desc → none)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );

    const header = screen.getByRole('button', { name: /context window/i });

    // First click — ascending by context window
    await user.click(header);
    let rows = container.querySelectorAll('tbody tr');
    let firstIds = Array.from(rows).map((r) => r.getAttribute('data-row-id'));
    expect(firstIds[0]).toBe('openai/gpt-5-mini'); // 128k smallest
    expect(firstIds[firstIds.length - 1]).toBe('google/gemini-2.5-flash'); // 1M largest

    // Second click — descending
    await user.click(header);
    rows = container.querySelectorAll('tbody tr');
    firstIds = Array.from(rows).map((r) => r.getAttribute('data-row-id'));
    expect(firstIds[0]).toBe('google/gemini-2.5-flash');
    expect(firstIds[firstIds.length - 1]).toBe('openai/gpt-5-mini');

    // Third click — back to original ordering
    await user.click(header);
    rows = container.querySelectorAll('tbody tr');
    firstIds = Array.from(rows).map((r) => r.getAttribute('data-row-id'));
    expect(firstIds).toEqual(catalog.map((c) => c.id));
  });
});

describe('SettingsForm — Save bar visibility (D-07)', () => {
  it('ui-save-bar is hidden until selection differs from activeId', async () => {
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );

    expect(container.querySelector('ui-save-bar')).toBeNull();

    const choice = container.querySelector('s-choice[value="anthropic/claude-sonnet-4.5"]');
    expect(choice).not.toBeNull();
    fireEvent.click(choice as Element);

    expect(container.querySelector('ui-save-bar')).not.toBeNull();
  });

  it('selecting the same radio leaves the save bar hidden (no dirty state)', async () => {
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );
    const choice = container.querySelector('s-choice[value="google/gemini-2.5-flash"]');
    fireEvent.click(choice as Element);
    expect(container.querySelector('ui-save-bar')).toBeNull();
  });

  it('save bar stays hidden when saveDisabled prop is true (cold-start fallback)', async () => {
    const { container } = render(
      <SettingsForm
        catalog={catalog}
        activeId="google/gemini-2.5-flash"
        saveDisabled
      />,
    );
    const choice = container.querySelector('s-choice[value="anthropic/claude-sonnet-4.5"]');
    fireEvent.click(choice as Element);
    expect(container.querySelector('ui-save-bar')).toBeNull();
  });
});

describe('SettingsForm — Save handler (D-07)', () => {
  it('clicking Save calls PATCH /api/settings/model with Bearer token + selected id', async () => {
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );
    const choice = container.querySelector('s-choice[value="anthropic/claude-sonnet-4.5"]');
    fireEvent.click(choice as Element);

    const saveBtn = await screen.findByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    // Allow microtasks / async chain to settle.
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/settings/model');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(init.body).toBe(
      JSON.stringify({ activeChatModelId: 'anthropic/claude-sonnet-4.5' }),
    );
  });

  it('shows toast on Save success with the new displayName', async () => {
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );
    const choice = container.querySelector('s-choice[value="anthropic/claude-sonnet-4.5"]');
    fireEvent.click(choice as Element);

    const saveBtn = await screen.findByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(shopifyToastShow).toHaveBeenCalledWith(
      expect.stringContaining('Claude Sonnet 4.5'),
    );
  });

  it('renders error banner with API error code on non-200 Save response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'unknown_model_id' }),
    } as Response);

    const { container } = render(
      <SettingsForm catalog={catalog} activeId="google/gemini-2.5-flash" />,
    );
    const choice = container.querySelector('s-choice[value="anthropic/claude-sonnet-4.5"]');
    fireEvent.click(choice as Element);

    const saveBtn = await screen.findByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    await new Promise<void>((r) => setTimeout(r, 0));

    const banner = container.querySelector('s-banner[tone="critical"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent ?? '').toContain('unknown_model_id');
  });
});

describe('SettingsForm — D-06 warning banner', () => {
  it('renders warning banner when activeId is not in the catalog', () => {
    const { container } = render(
      <SettingsForm catalog={catalog} activeId="removed/old-model" />,
    );
    const banner = container.querySelector('s-banner[tone="warning"]');
    expect(banner).not.toBeNull();
    const text = (banner?.textContent ?? '').toLowerCase();
    expect(text).toContain('previously');
    // Sanity check: the table still rendered.
    expect(within(container).getByText(/gemini 2.5 flash/i)).toBeInTheDocument();
  });
});

// RED: implementation lands in Plan 08 (app/(embedded)/settings/settings-form.tsx).
