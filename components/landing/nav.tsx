'use client';
import { useEffect, useState } from 'react';
import { ACCENT } from './tokens';
import { SDLogo } from './brand';
import { CTAButton } from './hero';
import { cn } from '@/lib/utils';

interface NavProps {
  accent?: string;
}

export function Nav({ accent = ACCENT }: NavProps) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links: [string, string][] = [
    ['How it works', '#how'],
    ['Features', '#features'],
    ['Pricing', '#pricing'],
    ['FAQ', '#faq'],
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-[100] [transition:background_.25s,border-color_.25s]',
        solid
          ? 'bg-white/[.82] backdrop-blur-[14px] backdrop-saturate-[160%] border-b border-(--border-sub)'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <div className="max-w-[1200px] mx-auto px-[28px] py-[12px] flex items-center gap-[22px]">
        <a href="#top" className="flex items-center gap-[10px]">
          <SDLogo size={32} accent={accent} />
          <span className="font-bold text-[16px] tracking-[-0.01em] text-(--text-strong)">
            SmartDiscovery{' '}
            {/* accent is a runtime prop — color stays inline */}
            <span style={{ color: accent }}>AI</span>
          </span>
        </a>
        <nav className="flex gap-[4px] ml-[14px] max-[920px]:hidden">
          {links.map(([t, h]) => (
            <a
              key={t}
              href={h}
              className="text-[14px] font-medium text-(--text) px-[12px] py-[7px] rounded-[8px] hover:bg-black/[.04]"
            >
              {t}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-[10px]">
          <a
            href="/install"
            className="text-[14px] font-semibold text-(--text-strong) max-[560px]:hidden"
          >
            Sign in
          </a>
          <CTAButton accent={accent} kind="primary" href="/install">
            Add to Shopify
          </CTAButton>
        </div>
      </div>
    </header>
  );
}
