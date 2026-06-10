/**
 * Phase 8 Wave 0 RED scaffold — anchors NOT-04 (env-scoped from) +
 * D-04 idempotency-key shape + A4 error propagation.
 *
 * Pins the EmailService contract:
 *   - sendSyncSuccess / sendSyncFailure
 *   - resend.emails.send called with from === process.env.RESEND_FROM_ADDRESS
 *   - subject literals
 *   - second-arg options bag carries { idempotencyKey: 'sync-success/${id}' | 'sync-failure/${id}' }
 *   - throws on result.error so Inngest retries (A4)
 *
 * Implementation lands in Plan 08-04 at services/email/EmailService.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sendMock, renderMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  renderMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

vi.mock('@react-email/render', () => ({
  render: renderMock,
}));

vi.mock('@/lib/email/templates/SyncSuccessEmail', () => ({
  SyncSuccessEmail: (props: unknown) => ({ __template: 'success', props }),
}));

vi.mock('@/lib/email/templates/SyncFailureEmail', () => ({
  SyncFailureEmail: (props: unknown) => ({ __template: 'failure', props }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.RESEND_API_KEY = 'rk_test_xxx';
  process.env.RESEND_FROM_ADDRESS = 'noreply@smartdiscovery.test';
  renderMock.mockResolvedValue('<html><body>rendered</body></html>');
  sendMock.mockResolvedValue({ data: { id: 'msg_001' }, error: null });
});

describe('EmailService.sendSyncSuccess (NOT-04, D-04)', () => {
  it('calls resend.emails.send with from === process.env.RESEND_FROM_ADDRESS (env-scoped, not per-shop)', async () => {
    const { sendSyncSuccess } = await import('@/services/email/EmailService');
    await sendSyncSuccess({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      productCount: 42,
      adminUrl: 'https://admin.shopify.com/store/test-shop/apps/smartdiscovery',
      syncRunId: 'sr_001',
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload] = sendMock.mock.calls[0];
    expect(payload.from).toBe('noreply@smartdiscovery.test');
  });

  it('passes the rendered HTML as the html field', async () => {
    const { sendSyncSuccess } = await import('@/services/email/EmailService');
    await sendSyncSuccess({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      productCount: 42,
      adminUrl: 'https://admin.shopify.com/store/test-shop/apps/smartdiscovery',
      syncRunId: 'sr_001',
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.html).toBe('<html><body>rendered</body></html>');
  });

  it('uses subject `Catalog sync complete — {productCount} products`', async () => {
    const { sendSyncSuccess } = await import('@/services/email/EmailService');
    await sendSyncSuccess({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      productCount: 42,
      adminUrl: 'https://admin.shopify.com/store/test-shop/apps/smartdiscovery',
      syncRunId: 'sr_001',
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.subject).toBe('Catalog sync complete — 42 products');
  });

  it('passes idempotencyKey === `sync-success/${syncRunId}` in the second-arg options bag (D-04)', async () => {
    const { sendSyncSuccess } = await import('@/services/email/EmailService');
    await sendSyncSuccess({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      productCount: 42,
      adminUrl: 'https://admin.shopify.com/store/test-shop/apps/smartdiscovery',
      syncRunId: 'sr_idem_001',
    });
    const [, options] = sendMock.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: 'sync-success/sr_idem_001' });
  });

  it('throws when Resend returns an error (A4 — must bubble so Inngest retries)', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'rate_limited', name: 'rate_limit_exceeded' },
    });
    const { sendSyncSuccess } = await import('@/services/email/EmailService');
    await expect(
      sendSyncSuccess({
        to: 'owner@example.com',
        shop: 'test-shop.myshopify.com',
        productCount: 1,
        adminUrl: 'https://admin.shopify.com/store/test-shop/apps/smartdiscovery',
        syncRunId: 'sr_err_001',
      }),
    ).rejects.toThrow(/Resend send failed/);
  });
});

describe('EmailService.sendSyncFailure (NOT-04, D-04)', () => {
  it('uses subject `Catalog sync failed`', async () => {
    const { sendSyncFailure } = await import('@/services/email/EmailService');
    await sendSyncFailure({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      syncRunId: 'sr_002',
      errorMessage: 'upstream 502',
      retryUrl: 'https://app.example.com/onboarding?retry=sr_002',
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.subject).toBe('Catalog sync failed');
  });

  it('reads `from` from process.env.RESEND_FROM_ADDRESS (NOT the args)', async () => {
    const { sendSyncFailure } = await import('@/services/email/EmailService');
    await sendSyncFailure({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      syncRunId: 'sr_002',
      errorMessage: 'upstream 502',
      retryUrl: 'https://app.example.com/onboarding?retry=sr_002',
    });
    const [payload] = sendMock.mock.calls[0];
    expect(payload.from).toBe('noreply@smartdiscovery.test');
  });

  it('passes idempotencyKey === `sync-failure/${syncRunId}` in the options bag', async () => {
    const { sendSyncFailure } = await import('@/services/email/EmailService');
    await sendSyncFailure({
      to: 'owner@example.com',
      shop: 'test-shop.myshopify.com',
      syncRunId: 'sr_idem_failure_001',
      errorMessage: 'upstream 502',
      retryUrl: 'https://app.example.com/onboarding?retry=sr_idem_failure_001',
    });
    const [, options] = sendMock.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: 'sync-failure/sr_idem_failure_001' });
  });

  it('throws when Resend returns an error (A4)', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'unauthorized', name: 'invalid_api_key' },
    });
    const { sendSyncFailure } = await import('@/services/email/EmailService');
    await expect(
      sendSyncFailure({
        to: 'owner@example.com',
        shop: 'test-shop.myshopify.com',
        syncRunId: 'sr_err_002',
        errorMessage: 'whatever',
        retryUrl: 'https://app.example.com/onboarding?retry=sr_err_002',
      }),
    ).rejects.toThrow(/Resend send failed/);
  });
});
