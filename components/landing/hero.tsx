'use client';
import React from 'react';
import { ACCENT, rgba } from './tokens';
import { ShopifyMark } from './brand';
import { ChatDemo } from './chat-demo';
import { cn } from '@/lib/utils';

const HEADLINE = 'Your shoppers describe it.';
const HEADLINE2 = 'Your store finds it.';
const SUBHEAD =
  'SmartDiscovery adds a conversational search assistant to your Shopify storefront. Shoppers ask in plain language — and instantly see real products from your catalog.';

interface CTAButtonProps {
  children: React.ReactNode;
  accent?: string;
  kind?: 'primary' | 'ghost' | 'shopify';
  large?: boolean;
  onDark?: boolean;
  href?: string;
}

export function CTAButton({
  children,
  accent = ACCENT,
  kind = 'primary',
  large,
  onDark,
  href,
}: CTAButtonProps) {
  const base =
    'inline-flex items-center gap-[9px] font-semibold rounded-[11px] border border-transparent [transition:transform_.12s,box-shadow_.2s,background_.2s] whitespace-nowrap cursor-pointer no-underline hover:-translate-y-px';

  const sizeClasses = large
    ? 'px-[22px] py-[13px] text-[15px]'
    : 'px-[18px] py-[11px] text-[14px]';

  const kindClasses: Record<string, string> = {
    primary: '',
    ghost: cn(
      'border',
      onDark
        ? 'bg-white/[.08] text-white border-white/[.22]'
        : 'bg-white text-(--text-strong) border-(--border)'
    ),
    shopify: 'bg-white text-[#1a1d21] border-(--border)',
  };

  // primary: accent background and shadow are runtime-prop-derived — stay inline
  const primaryStyle =
    kind === 'primary'
      ? {
          background: accent,
          color: '#fff',
          boxShadow: `0 1px 0 rgba(255,255,255,.25) inset, 0 8px 22px -8px ${rgba(accent, 0.7)}`,
        }
      : undefined;

  const cls = cn(base, sizeClasses, kindClasses[kind]);

  const content = (
    <>
      {kind === 'shopify' && <ShopifyMark />}
      {children}
    </>
  );

  if (href) {
    return (
      <a href={href} className={cls} style={primaryStyle}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={cls} style={primaryStyle}>
      {content}
    </button>
  );
}

export function TrustLine() {
  const items = ['Installs in minutes', 'No theme edits', 'Works with your theme'];
  return (
    <div className="flex items-center flex-wrap gap-[14px] text-[13px] text-(--text-sub)">
      {items.map((t, i) => (
        <React.Fragment key={t}>
          {i > 0 && (
            <span className="w-[4px] h-[4px] rounded-full bg-(--border)"></span>
          )}
          <span className="inline-flex items-center gap-[6px]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#008060"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {t}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

interface EyebrowProps {
  accent?: string;
}

export function Eyebrow({ accent = ACCENT }: EyebrowProps) {
  return (
    <span
      className="inline-flex items-center gap-[8px] text-[12.5px] font-semibold px-[12px] py-[6px] pl-[8px] rounded-full tracking-[.01em] bg-(--accent)/10 border border-(--accent)/20"
      style={{ color: accent }}
    >
      <span
        className="inline-flex items-center gap-[5px] px-[8px] py-[2px] rounded-full bg-white font-bold"
        style={{ color: accent }}
      >
        <ShopifyMark size={13} color="#95BF47" /> Shopify App
      </span>
      Conversational product discovery
    </span>
  );
}

interface HeroConversationProps {
  accent?: string;
}

export function HeroConversation({ accent = ACCENT }: HeroConversationProps) {
  return (
    <section className="bg-[linear-gradient(180deg,#fbfaf8_0%,#f6f6f7_100%)] border-b border-(--border-sub)">
      <div
        className="max-w-[1200px] mx-auto px-[28px] py-[clamp(48px,7vw,92px)] grid grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] max-[920px]:grid-cols-1 gap-[clamp(36px,5vw,72px)] items-center"
      >
        <div className="reveal in">
          <Eyebrow accent={accent} />
          <h1 className="text-[clamp(38px,5.2vw,62px)] leading-[1.04] tracking-[-0.03em] font-bold mt-[22px] text-(--text-strong)">
            {HEADLINE}
            <br />
            {/* accent is a runtime prop — color stays inline */}
            <span style={{ color: accent }}>{HEADLINE2}</span>
          </h1>
          <p className="text-[clamp(16px,1.4vw,19px)] leading-[1.55] text-(--text) mt-[20px] max-w-[480px]">
            {SUBHEAD}
          </p>
          <div className="flex flex-wrap gap-[12px] mt-[30px] mb-[22px]">
            <CTAButton accent={accent} kind="primary" large href="/api/auth">
              Add to Shopify — free
            </CTAButton>
            <CTAButton accent={accent} kind="ghost" large>
              Watch the 90-sec demo
            </CTAButton>
          </div>
          <TrustLine />
        </div>
        <div className="reveal in h-[min(560px,74vh)] min-h-[440px]">
          <ChatDemo accent={accent} />
        </div>
      </div>
    </section>
  );
}
