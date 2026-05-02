'use client';

import { NavMenu } from '@shopify/app-bridge-react';
import { AppProvider as PolarisProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

export default function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  return (
    <PolarisProvider i18n={enTranslations}>
      <NavMenu>
        <a href="/chat" rel="home">Search</a>
        <a href="/onboarding">Onboarding</a>
      </NavMenu>
      {children}
    </PolarisProvider>
  );
}
