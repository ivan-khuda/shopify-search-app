// Settings-redesign Task 10 — Drawer styling section.
// Pins the prototype DrawerSection contract (settings.jsx lines 185–241):
// five accent swatches with dark ring on the selected one, greeting input
// (placeholder = built-in copy when null), suggested-prompt editor
// (add/edit/delete, capped at MAX_SUGGESTED_PROMPTS), one section-level
// "Save changes" → PATCH /api/settings/shop (changed fields only), plus the
// appearance radio groups ported from the retired settings-form (own
// "Save appearance" → PATCH /api/settings/appearance, changed fields only).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SHOP_SETTINGS, MAX_SUGGESTED_PROMPTS } from '@/lib/settings/contract';
import type { ShopSettingsBundle } from '@/lib/settings/contract';
import { DrawerSection } from '../sections/drawer-section';

function makeSettings(overrides: Partial<ShopSettingsBundle> = {}): ShopSettingsBundle {
  return { ...DEFAULT_SHOP_SETTINGS, ...overrides };
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

async function lastShopPatchBody(): Promise<Record<string, unknown>> {
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/settings/shop');
  expect(init.method).toBe('PATCH');
  const headers = init.headers as Record<string, string>;
  expect(headers.Authorization).toBe('Bearer tok');
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('DrawerSection — accent swatches', () => {
  it('renders the five palette swatches with the selected one pressed', () => {
    render(<DrawerSection settings={makeSettings()} />);
    const swatches = [
      '#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A',
    ].map((c) => screen.getByRole('button', { name: `Use accent ${c}` }));
    expect(swatches).toHaveLength(5);
    expect(swatches[0]).toHaveAttribute('aria-pressed', 'true');
    expect(swatches[1]).toHaveAttribute('aria-pressed', 'false');
    // Selected swatch carries the dark prototype ring.
    expect(swatches[0].className).toContain('border-[#202223]');
    expect(swatches[1].className).not.toContain('border-[#202223]');
  });

  it('clicking a swatch selects it; Save PATCHes only { drawerAccent }', async () => {
    render(<DrawerSection settings={makeSettings()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use accent #008060' }));
    expect(
      screen.getByRole('button', { name: 'Use accent #008060' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = await lastShopPatchBody();
    expect(body).toEqual({ drawerAccent: '#008060' });
    await waitFor(() =>
      expect(shopifyToastShow).toHaveBeenCalledWith('Drawer styling saved'),
    );
  });
});

describe('DrawerSection — greeting message', () => {
  it('prefills from settings and falls back to the built-in copy as placeholder', () => {
    const { unmount } = render(
      <DrawerSection settings={makeSettings({ greetingMessage: 'Welcome to my shop' })} />,
    );
    expect(screen.getByRole('textbox', { name: 'Greeting message' })).toHaveValue(
      'Welcome to my shop',
    );
    unmount();

    render(<DrawerSection settings={makeSettings()} />);
    const input = screen.getByRole('textbox', { name: 'Greeting message' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute(
      'placeholder',
      "Hi there 👋 I'm your SmartDiscovery assistant.",
    );
  });

  it('Save sends { greetingMessage } when edited', async () => {
    render(<DrawerSection settings={makeSettings()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Greeting message' }), {
      target: { value: 'Hello shopper' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await lastShopPatchBody()).toEqual({ greetingMessage: 'Hello shopper' });
  });

  it('clearing the greeting sends an empty string (route nulls it)', async () => {
    render(
      <DrawerSection settings={makeSettings({ greetingMessage: 'Old greeting' })} />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Greeting message' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await lastShopPatchBody()).toEqual({ greetingMessage: '' });
  });
});

describe('DrawerSection — suggested prompts editor', () => {
  const prompts = [
    { icon: '☕', text: 'Find me a coffee gift' },
    { icon: '🎁', text: 'Gifts under $50' },
  ];

  it('lists the current prompts', () => {
    render(<DrawerSection settings={makeSettings({ suggestedPrompts: prompts })} />);
    expect(screen.getByText('Find me a coffee gift')).toBeInTheDocument();
    expect(screen.getByText('Gifts under $50')).toBeInTheDocument();
  });

  it('delete removes a prompt; Save sends the remaining full array', async () => {
    render(<DrawerSection settings={makeSettings({ suggestedPrompts: prompts })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove prompt 1' }));
    expect(screen.queryByText('Find me a coffee gift')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await lastShopPatchBody()).toEqual({
      suggestedPrompts: [{ icon: '🎁', text: 'Gifts under $50' }],
    });
  });

  it('pencil toggles inline edit inputs for icon and text', () => {
    render(<DrawerSection settings={makeSettings({ suggestedPrompts: prompts })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit prompt 2' }));
    expect(screen.getByRole('textbox', { name: 'Prompt 2 icon' })).toHaveValue('🎁');
    expect(screen.getByRole('textbox', { name: 'Prompt 2 text' })).toHaveValue(
      'Gifts under $50',
    );
  });

  it('add appends an editable prompt; Save sends the full array', async () => {
    render(<DrawerSection settings={makeSettings({ suggestedPrompts: prompts })} />);
    fireEvent.click(screen.getByRole('button', { name: /add prompt/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt 3 text' }), {
      target: { value: 'Show me bestsellers' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await lastShopPatchBody()).toEqual({
      suggestedPrompts: [...prompts, { icon: '✨', text: 'Show me bestsellers' }],
    });
  });

  it('disables Add prompt at the maximum of 6', () => {
    const six = Array.from({ length: MAX_SUGGESTED_PROMPTS }, (_, i) => ({
      icon: '✨',
      text: `Prompt ${i}`,
    }));
    render(<DrawerSection settings={makeSettings({ suggestedPrompts: six })} />);
    expect(screen.getByRole('button', { name: /add prompt/i })).toBeDisabled();
  });
});

describe('DrawerSection — save guard + errors', () => {
  it('Save changes is disabled until something differs from settings', () => {
    render(<DrawerSection settings={makeSettings()} />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('shows the API error code inline on a failed shop save', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'missing_bearer' }),
    } as Response);

    render(<DrawerSection settings={makeSettings()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use accent #1A1A1A' }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('missing_bearer'),
    );
    expect(shopifyToastShow).not.toHaveBeenCalled();
  });
});

describe('DrawerSection — FAB style and drawer position pickers', () => {
  it('renders "FAB style" card with Circle/Pill/Labeled buttons', () => {
    render(<DrawerSection settings={makeSettings()} />);
    // The card title
    expect(screen.getByText('FAB style')).toBeInTheDocument();
    // The three option buttons
    expect(screen.getByRole('button', { name: 'FAB style Circle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FAB style Pill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FAB style Labeled' })).toBeInTheDocument();
    // Default is circle
    expect(screen.getByRole('button', { name: 'FAB style Circle' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders "Drawer position" card with Side/Bottom sheet/Center modal buttons', () => {
    render(<DrawerSection settings={makeSettings()} />);
    expect(screen.getByText('Drawer position')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drawer position Side' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drawer position Bottom-sheet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drawer position Center-modal' })).toBeInTheDocument();
    // Default is side
    expect(screen.getByRole('button', { name: 'Drawer position Side' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('selecting Pill and saving PATCHes only { fabStyle: "pill" }', async () => {
    render(<DrawerSection settings={makeSettings()} />);
    fireEvent.click(screen.getByRole('button', { name: 'FAB style Pill' }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = await lastShopPatchBody();
    expect(body).toEqual({ fabStyle: 'pill' });
  });

  it('selecting Bottom sheet and saving PATCHes only { drawerPosition: "bottom-sheet" }', async () => {
    render(<DrawerSection settings={makeSettings()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Drawer position Bottom-sheet' }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const body = await lastShopPatchBody();
    expect(body).toEqual({ drawerPosition: 'bottom-sheet' });
  });
});

describe('DrawerSection — appearance (ported from settings-form)', () => {
  it('renders both radio groups with every option', () => {
    render(<DrawerSection settings={makeSettings()} />);

    const emptyGroup = screen.getByRole('radiogroup', { name: 'Empty state style' });
    const densityGroup = screen.getByRole('radiogroup', {
      name: 'Product card density',
    });

    expect(
      within(emptyGroup)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(['cards', 'minimal', 'hero']);
    expect(
      within(densityGroup)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(['compact', 'standard', 'hero']);

    expect(within(emptyGroup).getByRole('radio', { name: 'Cards' })).toBeChecked();
    expect(within(densityGroup).getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  it('selecting hero + Save appearance PATCHes ONLY the changed field', async () => {
    render(<DrawerSection settings={makeSettings()} />);

    const emptyGroup = screen.getByRole('radiogroup', { name: 'Empty state style' });
    fireEvent.click(within(emptyGroup).getByRole('radio', { name: 'Hero' }));
    fireEvent.click(screen.getByRole('button', { name: /save appearance/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/settings/appearance');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(init.body).toBe(JSON.stringify({ emptyStateVariant: 'hero' }));
  });

  it('density-only change sends a density-only body + "Appearance saved" toast', async () => {
    render(<DrawerSection settings={makeSettings()} />);

    const densityGroup = screen.getByRole('radiogroup', {
      name: 'Product card density',
    });
    fireEvent.click(within(densityGroup).getByRole('radio', { name: 'Compact' }));
    fireEvent.click(screen.getByRole('button', { name: /save appearance/i }));

    await waitFor(() =>
      expect(shopifyToastShow).toHaveBeenCalledWith('Appearance saved'),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ cardDensity: 'compact' }));
  });

  it('shows the API error code inline on a failed appearance save', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'missing_bearer' }),
    } as Response);

    render(<DrawerSection settings={makeSettings()} />);
    const emptyGroup = screen.getByRole('radiogroup', { name: 'Empty state style' });
    fireEvent.click(within(emptyGroup).getByRole('radio', { name: 'Hero' }));
    fireEvent.click(screen.getByRole('button', { name: /save appearance/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('missing_bearer'),
    );
    expect(shopifyToastShow).not.toHaveBeenCalled();
  });
});
