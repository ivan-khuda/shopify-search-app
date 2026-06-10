'use client';
import React from 'react';
import { ACCENT, rgba } from './tokens';
import { ShopifyMark } from './brand';
import { ChatDemo } from './chat-demo';

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
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 9,
    fontWeight: 600,
    fontSize: large ? 15 : 14,
    padding: large ? '13px 22px' : '11px 18px',
    borderRadius: 11,
    border: '1px solid transparent',
    transition: 'transform .12s, box-shadow .2s, background .2s',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    textDecoration: 'none',
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      ...base,
      background: accent,
      color: '#fff',
      boxShadow: `0 1px 0 rgba(255,255,255,.25) inset, 0 8px 22px -8px ${rgba(accent, 0.7)}`,
    },
    ghost: {
      ...base,
      background: onDark ? 'rgba(255,255,255,.08)' : '#fff',
      color: onDark ? '#fff' : 'var(--text-strong)',
      borderColor: onDark ? 'rgba(255,255,255,.22)' : 'var(--border)',
    },
    shopify: {
      ...base,
      background: '#fff',
      color: '#1a1d21',
      borderColor: 'var(--border)',
    },
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
  };

  const content = (
    <>
      {kind === 'shopify' && <ShopifyMark />}
      {children}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        style={styles[kind]}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      style={styles[kind]}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {content}
    </button>
  );
}

interface TrustLineProps {
  onDark?: boolean;
}

export function TrustLine({ onDark }: TrustLineProps) {
  const c = onDark ? 'rgba(255,255,255,.72)' : 'var(--text-sub)';
  const dot = onDark ? 'rgba(255,255,255,.4)' : 'var(--border)';
  const items = ['Installs in minutes', 'No theme edits', 'Works with your theme'];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        fontSize: 13,
        color: c,
      }}
    >
      {items.map((t, i) => (
        <React.Fragment key={t}>
          {i > 0 && (
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: dot,
              }}
            ></span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={onDark ? '#fff' : '#008060'}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
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
  onDark?: boolean;
}

export function Eyebrow({ accent = ACCENT, onDark }: EyebrowProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12.5,
        fontWeight: 600,
        padding: '6px 12px 6px 8px',
        borderRadius: 999,
        letterSpacing: '.01em',
        background: onDark ? 'rgba(255,255,255,.1)' : rgba(accent, 0.1),
        color: onDark ? '#fff' : accent,
        border: onDark
          ? '1px solid rgba(255,255,255,.16)'
          : `1px solid ${rgba(accent, 0.2)}`,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          background: onDark ? 'rgba(255,255,255,.16)' : '#fff',
          color: onDark ? '#fff' : accent,
          fontWeight: 700,
        }}
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
    <section
      style={{
        background: 'linear-gradient(180deg,#fbfaf8 0%, #f6f6f7 100%)',
        borderBottom: '1px solid var(--border-sub)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'clamp(48px,7vw,92px) 28px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)',
          gap: 'clamp(36px,5vw,72px)',
          alignItems: 'center',
        }}
        className="hero-grid"
      >
        <div className="reveal in">
          <Eyebrow accent={accent} />
          <h1
            style={{
              fontSize: 'clamp(38px,5.2vw,62px)',
              lineHeight: 1.04,
              letterSpacing: '-0.03em',
              fontWeight: 700,
              margin: '22px 0 0',
              color: 'var(--text-strong)',
            }}
          >
            {HEADLINE}
            <br />
            <span style={{ color: accent }}>{HEADLINE2}</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(16px,1.4vw,19px)',
              lineHeight: 1.55,
              color: 'var(--text)',
              margin: '20px 0 0',
              maxWidth: 480,
            }}
          >
            {SUBHEAD}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              margin: '30px 0 22px',
            }}
          >
            <CTAButton accent={accent} kind="primary" large href="/api/auth">
              Add to Shopify — free
            </CTAButton>
            <CTAButton accent={accent} kind="ghost" large>
              Watch the 90-sec demo
            </CTAButton>
          </div>
          <TrustLine />
        </div>
        <div
          className="reveal in"
          style={{ height: 'min(560px, 74vh)', minHeight: 440 }}
        >
          <ChatDemo accent={accent} />
        </div>
      </div>
    </section>
  );
}
