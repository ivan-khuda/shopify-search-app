import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter, DM_Serif_Display } from 'next/font/google';
import { SDLogo } from '@/components/landing/brand';
import { TrustLine } from '@/components/landing/hero';
import { InstallForm } from './install-form';
import '@/components/landing/landing.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const dmSerif = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
});

export const metadata: Metadata = {
  title: 'Install SmartDiscovery AI — Conversational product discovery for Shopify',
  description:
    'Connect your Shopify store to add an AI-powered product discovery assistant to your storefront.',
};

export default function InstallPage() {
  return (
    <div className={`sd-landing ${inter.variable} ${dmSerif.variable}`}>
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 28px',
          background: 'linear-gradient(180deg,#fbfaf8 0%, #f6f6f7 100%)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 28,
            }}
          >
            <SDLogo size={36} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: '-0.01em',
                color: 'var(--text-strong)',
              }}
            >
              SmartDiscovery <span style={{ color: 'var(--accent)' }}>AI</span>
            </span>
          </Link>

          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 'clamp(26px,4vw,36px)',
              boxShadow: '0 18px 44px -24px rgba(26,26,26,.22)',
            }}
          >
            <h1
              style={{
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-strong)',
                textAlign: 'center',
              }}
            >
              Install SmartDiscovery AI
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--text)',
                margin: '12px 0 24px',
                textAlign: 'center',
              }}
            >
              Enter your Shopify store URL to add AI-powered product discovery
              to your storefront.
            </p>
            <InstallForm />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 22,
            }}
          >
            <TrustLine />
          </div>
        </div>
      </main>
    </div>
  );
}
