'use client';

import { NavMenu } from '@shopify/app-bridge-react';
import Link from 'next/link';

export default function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavMenu>
        <Link href="/chat" rel="home">Search</Link>
        <Link href="/onboarding">Onboarding</Link>
      </NavMenu>
      {children}
    </>
  );
}
