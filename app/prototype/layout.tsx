import type { ReactNode } from 'react';

export const metadata = {
  title: 'SmartDiscovery AI — Prototype',
};

export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&family=DM+Serif+Display&display=swap"
      />
      {children}
    </>
  );
}
