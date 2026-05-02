import type { Metadata } from 'next';
import Script from 'next/script';
import EmbeddedProviders from './EmbeddedProviders';

export const metadata: Metadata = {
  other: {
    'shopify-api-key': process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? '',
  },
};

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      <EmbeddedProviders>{children}</EmbeddedProviders>
    </>
  );
}
