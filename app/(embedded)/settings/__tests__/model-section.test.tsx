// Settings-redesign Task 9 — AI model section radio cards.
// Pins the prototype ModelSection contract (settings.jsx lines 66–183):
// one radio card per catalog model (name, provider, bestFor, $/M pricing,
// context label), "Recommended" badge only on the default model, click to
// select, dark Save button → PATCH /api/settings/model with Bearer token.
// fetch/idToken mock idiom ported from the retired settings-form test.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelSection } from '../sections/model-section';
import type { ModelSectionProps } from '../sections/types';

const models = [
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

function makeProps(overrides: Partial<ModelSectionProps> = {}): ModelSectionProps {
  return {
    catalog: { models, stale: false, coldStartFallback: false },
    activeModel: { id: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    ...overrides,
  };
}

function cardOf(displayName: string): HTMLElement {
  // Locate via the radio's accessible name — the "Currently active" footer
  // also renders the display name, so a bare text query would be ambiguous.
  const radio = screen.getByRole('radio', { name: `Select ${displayName}` });
  const card = radio.closest('label');
  expect(card).not.toBeNull();
  expect(card?.textContent).toContain(displayName);
  return card as HTMLElement;
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
    json: async () => ({ ok: true, displayName: 'Claude Sonnet 4.5' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ModelSection — radio cards', () => {
  it('renders one radio card per catalog model with the active model checked', () => {
    render(<ModelSection {...makeProps()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(models.length);
    expect(screen.getByRole('radio', { name: /gemini 2\.5 flash/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /claude sonnet 4\.5/i })).not.toBeChecked();
  });

  it('each card shows name, provider, bestFor, pricing, and context label', () => {
    render(<ModelSection {...makeProps()} />);

    const gemini = cardOf('Gemini 2.5 Flash');
    expect(gemini.textContent).toContain('by Google');
    expect(gemini.textContent).toContain('Fastest, low cost — great default');
    expect(gemini.textContent).toMatch(/\$0\.30\s*in\s*·\s*\$2\.50\s*out/);
    expect(gemini.textContent).toContain('1M context');

    const sonnet = cardOf('Claude Sonnet 4.5');
    expect(sonnet.textContent).toContain('by Anthropic');
    expect(sonnet.textContent).toMatch(/\$3\.00\s*in\s*·\s*\$15\.00\s*out/);
    expect(sonnet.textContent).toContain('200K context');

    const mini = cardOf('GPT-5 Mini');
    expect(mini.textContent).toMatch(/\$0\.15\s*in\s*·\s*\$0\.60\s*out/);
    expect(mini.textContent).toContain('128K context');
  });

  it('shows the Recommended badge ONLY on the default model card', () => {
    render(<ModelSection {...makeProps()} />);
    const badges = screen.getAllByText('Recommended');
    expect(badges).toHaveLength(1);
    expect(badges[0].closest('label')).toBe(cardOf('Gemini 2.5 Flash'));
  });

  it('clicking a card selects its radio', () => {
    render(<ModelSection {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    expect(screen.getByRole('radio', { name: /claude sonnet 4\.5/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /gemini 2\.5 flash/i })).not.toBeChecked();
  });
});

describe('ModelSection — Save flow', () => {
  it('Save is disabled until the selection differs from the active model', () => {
    render(<ModelSection {...makeProps()} />);
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    expect(save).toBeEnabled();
  });

  it('Save PATCHes /api/settings/model with Bearer token + selected id', async () => {
    render(<ModelSection {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/settings/model');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(init.body).toBe(
      JSON.stringify({ activeChatModelId: 'anthropic/claude-sonnet-4.5' }),
    );
  });

  it('shows "Currently active: {name}" with the new name + toast after success', async () => {
    render(<ModelSection {...makeProps()} />);
    expect(screen.getByText(/currently active:/i).textContent).toContain(
      'Gemini 2.5 Flash',
    );

    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText(/currently active:/i).textContent).toContain(
        'Claude Sonnet 4.5',
      ),
    );
    expect(shopifyToastShow).toHaveBeenCalledWith(
      expect.stringContaining('Claude Sonnet 4.5'),
    );
  });

  it('shows the API error code inline on a failed save', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'unknown_model_id' }),
    } as Response);

    render(<ModelSection {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('unknown_model_id'),
    );
    expect(shopifyToastShow).not.toHaveBeenCalled();
  });

  it('shows network_error inline when the request throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    render(<ModelSection {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('network_error'),
    );
  });

  it('Save stays disabled on cold-start fallback catalogs', () => {
    render(
      <ModelSection
        {...makeProps({
          catalog: { models, stale: false, coldStartFallback: true },
        })}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /claude sonnet 4\.5/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });
});

describe('ModelSection — catalog degradation notice', () => {
  const NOTICE =
    'Model catalog is temporarily unavailable — showing cached list.';

  it('renders a muted status notice when the catalog is stale', () => {
    render(
      <ModelSection
        {...makeProps({ catalog: { models, stale: true, coldStartFallback: false } })}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(NOTICE);
  });

  it('renders the notice on cold-start fallback catalogs', () => {
    render(
      <ModelSection
        {...makeProps({ catalog: { models, stale: false, coldStartFallback: true } })}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(NOTICE);
  });

  it('renders no notice on a healthy catalog', () => {
    render(<ModelSection {...makeProps()} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('ModelSection — footer note', () => {
  it('renders the pricing info note verbatim', () => {
    render(<ModelSection {...makeProps()} />);
    expect(
      screen.getByText(
        /Pricing reflects the Vercel AI Gateway live rate card\. We pin a specific model version per shop so behavior never silently changes underneath you\. Embeddings are billed separately at \$0\.02 \/ 1M tokens\./,
      ),
    ).toBeInTheDocument();
  });
});
