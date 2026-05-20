export {};

// Augment React's JSX namespace so Polaris web components (`s-*` custom
// elements) are accepted as JSX intrinsic elements. `@shopify/polaris-types`
// only augments preact's createElement.JSX, not React's, so we add explicit
// declarations here for the Polaris tags this app uses.
//
// The `shopify` global is typed by `@shopify/app-bridge-types`.
type PolarisIntrinsicProps = {
  children?: import('react').ReactNode;
  onClick?: (e: Event) => void;
} & Record<string, unknown>;

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        's-page': PolarisIntrinsicProps;
        's-section': PolarisIntrinsicProps;
        's-heading': PolarisIntrinsicProps;
        's-button': PolarisIntrinsicProps;
        's-unordered-list': PolarisIntrinsicProps;
        's-list-item': PolarisIntrinsicProps;
      }
    }
  }
}
