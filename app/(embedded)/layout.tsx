'use client';

import { NavMenu } from '@shopify/app-bridge-react';
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import Script from 'next/script';
import '@shopify/polaris/build/esm/styles.css';

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY!;

  return (
    <>
      <meta name="shopify-api-key" content={apiKey} />
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      <PolarisProvider i18n={enTranslations}>
        <NavMenu>
          <a href="/chat" rel="home">Search</a>
          <a href="/onboarding">Onboarding</a>
        </NavMenu>
        {children}
      </PolarisProvider>
    </>
  );
}
