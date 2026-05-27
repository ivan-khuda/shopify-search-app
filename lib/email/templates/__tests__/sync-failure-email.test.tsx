/**
 * Phase 8 Wave 0 RED scaffold — anchors NOT-02 / NOT-03.
 *
 * Pins the SyncFailureEmail React Email template contract:
 *   - "Catalog sync failed" heading literal
 *   - errorMessage appears in body (auto-escaped)
 *   - "Retry sync" button anchored to retryUrl = `/onboarding?retry={syncRunId}`
 *
 * Implementation lands in Plan 08-04 at lib/email/templates/SyncFailureEmail.tsx.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — RED scaffold: module does not exist yet (lands in Plan 08-04).
import { SyncFailureEmail } from '@/lib/email/templates/SyncFailureEmail';

const fixture = {
  shop: 'test-shop.myshopify.com',
  syncRunId: 'sr_failure_001',
  errorMessage: 'Shopify GraphQL returned 502: upstream unavailable',
  retryUrl: 'https://app.example.com/onboarding?retry=sr_failure_001',
};

describe('SyncFailureEmail template (NOT-02, NOT-03)', () => {
  it('renders the "Catalog sync failed" heading literal', async () => {
    const html = await render(SyncFailureEmail(fixture));
    expect(html).toContain('Catalog sync failed');
  });

  it('renders the errorMessage in body', async () => {
    const html = await render(SyncFailureEmail(fixture));
    expect(html).toContain('Shopify GraphQL returned 502: upstream unavailable');
  });

  it('renders a retry button whose href matches the retryUrl prop', async () => {
    const html = await render(SyncFailureEmail(fixture));
    expect(html).toContain(fixture.retryUrl);
  });

  it('retryUrl follows the /onboarding?retry={syncRunId} shape (D-06)', async () => {
    const html = await render(SyncFailureEmail(fixture));
    expect(html).toMatch(/\/onboarding\?retry=sr_failure_001/);
  });

  it('renders a "Retry sync" affordance', async () => {
    const html = await render(SyncFailureEmail(fixture));
    expect(html).toMatch(/Retry sync/i);
  });

  it('escapes HTML in errorMessage (V5 Input Validation — React Email auto-escapes)', async () => {
    const html = await render(
      SyncFailureEmail({
        ...fixture,
        errorMessage: '<img src=x onerror=alert(1)>',
      }),
    );
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
