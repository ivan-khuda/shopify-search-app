import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import { Nav } from '@/components/landing/nav';
import { HeroConversation } from '@/components/landing/hero';
import { LogoStrip, HowItWorks, Showcase, Features } from '@/components/landing/sections';
import { Testimonials, Pricing, FAQ, FinalCTA, Footer } from '@/components/landing/sections-lower';
import '@/components/landing/landing.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const dmSerif = DM_Serif_Display({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
});

export const metadata: Metadata = {
  title: 'SmartDiscovery AI — Conversational product discovery for Shopify',
  description:
    'SmartDiscovery adds a conversational search assistant to your Shopify storefront. Shoppers ask in plain language — and instantly see real products from your catalog.',
};

export default function Home() {
  return (
    <div id="top" className={`sd-landing ${inter.variable} ${dmSerif.variable}`}>
      <Nav />
      <HeroConversation />
      <LogoStrip />
      <HowItWorks />
      <Showcase />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
