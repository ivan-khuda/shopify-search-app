import { describe, expect, it } from "vitest";

import { normalizeShopDomain } from "@/lib/shopify/normalize-shop-domain";

describe("normalizeShopDomain", () => {
  it("returns full myshopify domain unchanged", () => {
    expect(normalizeShopDomain("my-store.myshopify.com")).toBe(
      "my-store.myshopify.com"
    );
  });

  it("appends myshopify.com to bare store handle", () => {
    expect(normalizeShopDomain("my-store")).toBe("my-store.myshopify.com");
  });

  it("strips protocol and trailing path", () => {
    expect(
      normalizeShopDomain("https://my-store.myshopify.com/admin/products")
    ).toBe("my-store.myshopify.com");
  });

  it("resolves admin.shopify.com store URLs", () => {
    expect(
      normalizeShopDomain("https://admin.shopify.com/store/my-store/settings")
    ).toBe("my-store.myshopify.com");
  });

  it("lowercases input", () => {
    expect(normalizeShopDomain("My-Store.MYSHOPIFY.com")).toBe(
      "my-store.myshopify.com"
    );
  });

  it("rejects empty input", () => {
    expect(normalizeShopDomain("   ")).toBeNull();
  });

  it("rejects non-shopify custom domains", () => {
    expect(normalizeShopDomain("example.com")).toBeNull();
  });

  it("rejects handles with invalid characters", () => {
    expect(normalizeShopDomain("my store!")).toBeNull();
  });
});
