import Script from 'next/script';
import EmbeddedProviders from './EmbeddedProviders';

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta name="shopify-api-key" content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY!} />
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      <EmbeddedProviders>{children}</EmbeddedProviders>
    </>
  );
}
