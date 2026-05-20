export {};

declare global {
  interface ShopifyToastOptions {
    isError?: boolean;
    duration?: number;
  }

  interface ShopifyGlobal {
    idToken(): Promise<string>;
    toast: {
      show(message: string, options?: ShopifyToastOptions): void;
    };
  }

  // App Bridge installs `shopify` on `window`/`globalThis` once its script loads.
  // eslint-disable-next-line no-var
  var shopify: ShopifyGlobal;
}
