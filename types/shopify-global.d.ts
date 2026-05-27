export {};

// Augment React's JSX namespace so Polaris web components (`s-*` custom
// elements) are accepted as JSX intrinsic elements. `@shopify/polaris-types`
// only augments preact's createElement.JSX, not React's, so we add explicit
// declarations here for the Polaris tags this app uses.
//
// Also surface a minimal `shopify` runtime global. `@shopify/app-bridge-types`
// declares the full type but is not auto-included in `compilerOptions.types`,
// so consumers under `lib/chat-ui/adapters/` (which must not import from
// `@shopify/*`) and embedded routes that already rely on `shopify.*` need an
// ambient declaration here.
type PolarisIntrinsicProps = {
  children?: import('react').ReactNode;
  onClick?: (e: Event) => void;
} & Record<string, unknown>;

type ShopifyToastOptions = { isError?: boolean; duration?: number };

interface ShopifyRuntimeGlobal {
  idToken(): Promise<string>;
  toast: {
    show(message: string, options?: ShopifyToastOptions): void;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var shopify: ShopifyRuntimeGlobal;

  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        's-page': PolarisIntrinsicProps;
        's-section': PolarisIntrinsicProps;
        's-heading': PolarisIntrinsicProps;
        's-button': PolarisIntrinsicProps;
        's-unordered-list': PolarisIntrinsicProps;
        's-list-item': PolarisIntrinsicProps;
        's-app-nav': PolarisIntrinsicProps;
        's-link': PolarisIntrinsicProps;
        's-progress-bar': PolarisIntrinsicProps;
        's-text': PolarisIntrinsicProps;
        's-badge': PolarisIntrinsicProps;
        's-banner': PolarisIntrinsicProps;
      }
    }
  }
}
