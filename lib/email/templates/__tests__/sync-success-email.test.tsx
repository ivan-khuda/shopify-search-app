/**
 * Phase 8 Wave 0 RED scaffold — anchors NOT-01 / NOT-03.
 *
 * Pins the SyncSuccessEmail React Email template contract:
 *   - "Catalog sync complete" heading literal
 *   - productCount appears in body copy
 *   - "View in admin" button anchored to the adminUrl prop
 *
 * Implementation lands in Plan 08-04 at lib/email/templates/SyncSuccessEmail.tsx.
 * Until then, this test fails with "Cannot find module".
 */
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — RED scaffold: module does not exist yet (lands in Plan 08-04).
import { SyncSuccessEmail } from '@/lib/email/templates/SyncSuccessEmail';

const fixture = {
  shop: 'test-shop.myshopify.com',
  productCount: 1287,
  adminUrl: 'https://admin.shopify.com/store/test-shop/apps/smartdiscovery',
};

describe('SyncSuccessEmail template (NOT-01, NOT-03)', () => {
  it('renders the "Catalog sync complete" heading literal', async () => {
    const html = await render(SyncSuccessEmail(fixture));
    expect(html).toContain('Catalog sync complete');
  });

  it('renders the productCount in body copy', async () => {
    const html = await render(SyncSuccessEmail(fixture));
    expect(html).toContain('1287');
  });

  it('renders the shop string in body copy', async () => {
    const html = await render(SyncSuccessEmail(fixture));
    expect(html).toContain('test-shop.myshopify.com');
  });

  it('renders an admin button whose href matches the adminUrl prop', async () => {
    const html = await render(SyncSuccessEmail(fixture));
    expect(html).toContain(fixture.adminUrl);
  });

  it('renders a "View in admin" affordance', async () => {
    const html = await render(SyncSuccessEmail(fixture));
    expect(html).toMatch(/View in admin/i);
  });

  it('escapes HTML in the shop name (V5 Input Validation — React Email auto-escapes)', async () => {
    const html = await render(
      SyncSuccessEmail({
        ...fixture,
        shop: '<script>alert(1)</script>.myshopify.com',
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
