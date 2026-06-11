import type { Metadata } from 'next';
import EmbeddedProviders from './EmbeddedProviders';

export const metadata: Metadata = {
  other: {
    'shopify-api-key': process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? '',
  },
};

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* App Bridge requires a plain synchronous <script> tag — next/script
          (any strategy) injects dynamically in App Router, which App Bridge
          rejects with "must be included as the first <script> tag". */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      <EmbeddedProviders>{children}</EmbeddedProviders>
    </>
  );
}
