const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
const STORE_HANDLE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

/**
 * Normalizes user-entered store identifiers to a canonical
 * `<store>.myshopify.com` domain. Accepts bare handles, full domains,
 * URLs with protocol/path, and `admin.shopify.com/store/<handle>` URLs.
 * Returns null when the input cannot be resolved to a valid shop domain.
 */
export function normalizeShopDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^https?:\/\//, "");

  // admin.shopify.com/store/<handle> URLs
  const adminMatch = value.match(/^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/);
  if (adminMatch) {
    return `${adminMatch[1]}.myshopify.com`;
  }

  // Drop path, query, hash
  value = value.split(/[/?#]/)[0];

  if (STORE_HANDLE_PATTERN.test(value)) {
    return `${value}.myshopify.com`;
  }

  if (SHOP_DOMAIN_PATTERN.test(value)) {
    return value;
  }

  return null;
}
