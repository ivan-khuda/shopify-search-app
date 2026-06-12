// Settings-redesign Task 13 — General section.
// Pins the prototype GeneralSection contract (settings.jsx lines 341–366)
// + Toggle (396–414, with switch ARIA added): notification-email input
// (placeholder "Shop contact email" when null, empty input saves null),
// and the two storefront toggles (drawerEnabled / editorPreviewVisible)
// that PATCH /api/settings/shop immediately on flip — optimistic, like the
// chat-header density control.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SHOP_SETTINGS } from '@/lib/settings/contract';
import type { ShopSettingsBundle } from '@/lib/settings/contract';
import { GeneralSection } from '../sections/general-section';

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

describe('GeneralSection — notification email', () => {
  it('prefills from settings; placeholder is "Shop contact email" when null', () => {
    const { unmount } = render(
      <GeneralSection settings={makeSettings({ notificationEmail: 'ops@x.com' })} />,
    );
    expect(screen.getByRole('textbox', { name: 'Notification email' })).toHaveValue(
      'ops@x.com',
    );
    unmount();

    render(<GeneralSection settings={makeSettings()} />);
    const input = screen.getByRole('textbox', { name: 'Notification email' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Shop contact email');
  });

  it('Save sends { notificationEmail } with the new address', async () => {
    render(<GeneralSection settings={makeSettings()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Notification email' }), {
      target: { value: 'alerts@x.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save email/i }));
    expect(await lastShopPatchBody()).toEqual({ notificationEmail: 'alerts@x.com' });
  });

  it('clearing the input saves null (revert to shop contact email)', async () => {
    render(
      <GeneralSection settings={makeSettings({ notificationEmail: 'ops@x.com' })} />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Notification email' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save email/i }));
    expect(await lastShopPatchBody()).toEqual({ notificationEmail: null });
  });

  it('shows the API error code inline on a failed save', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_body' }),
    } as Response);

    render(<GeneralSection settings={makeSettings()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Notification email' }), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save email/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('invalid_body'),
    );
  });
});

describe('GeneralSection — storefront toggles', () => {
  it('renders role="switch" toggles reflecting the settings flags', () => {
    render(
      <GeneralSection
        settings={makeSettings({ drawerEnabled: true, editorPreviewVisible: false })}
      />,
    );
    expect(
      screen.getByRole('switch', { name: 'Enable on storefront' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('switch', { name: 'Show in Theme Editor preview' }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('flipping "Enable on storefront" PATCHes immediately and optimistically', async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<GeneralSection settings={makeSettings()} />);
    const toggle = screen.getByRole('switch', { name: 'Enable on storefront' });
    fireEvent.click(toggle);

    // Optimistic: flips before the request settles.
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    const body = await lastShopPatchBody();
    expect(body).toEqual({ drawerEnabled: false });
    resolveFetch({ ok: true, status: 200, json: async () => ({ ok: true }) });
  });

  it('flipping "Show in Theme Editor preview" PATCHes { editorPreviewVisible }', async () => {
    render(
      <GeneralSection settings={makeSettings({ editorPreviewVisible: false })} />,
    );
    const toggle = screen.getByRole('switch', { name: 'Show in Theme Editor preview' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await lastShopPatchBody()).toEqual({ editorPreviewVisible: true });
  });

  it('keeps the optimistic value when the PATCH fails (degrade silently)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    render(<GeneralSection settings={makeSettings()} />);
    const toggle = screen.getByRole('switch', { name: 'Enable on storefront' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
