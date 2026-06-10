/* eslint-disable @next/next/no-img-element */
'use client';
import React from 'react';
import { ACCENT, rgba } from './tokens';
import { CATALOG } from './catalog';
import type { LandingProduct } from './catalog';
import { useReveal } from './use-reveal';

/* ───────── SectionLabel ───────── */
interface SectionLabelProps {
  accent?: string;
  children: React.ReactNode;
}

export function SectionLabel({ accent = ACCENT, children }: SectionLabelProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 650,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: accent,
        marginBottom: 14,
      }}
    >
      <span
        style={{ width: 22, height: 1.5, background: accent, borderRadius: 2 }}
      ></span>
      {children}
    </div>
  );
}

/* ───────── Logos / trust strip ───────── */
export function LogoStrip() {
  const names = ['Loom & Field', 'Greenhouse Co.', 'Heritage Wood', 'North Foundry', 'Field & Form'];
  return (
    <div style={{ borderBottom: '1px solid var(--border-sub)', background: '#fff' }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '26px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 'clamp(20px,4vw,52px)',
        }}
      >
        <span style={{ fontSize: 12.5, color: 'var(--text-sub)', fontWeight: 500 }}>
          Trusted by independent Shopify brands
        </span>
        {names.map((n) => (
          <span
            key={n}
            className="serif"
            style={{
              fontSize: 19,
              color: 'var(--text-sub)',
              opacity: 0.7,
              letterSpacing: '-0.01em',
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────── How it works ───────── */
interface HowItWorksProps {
  accent?: string;
}

export function HowItWorks({ accent = ACCENT }: HowItWorksProps) {
  const ref = useReveal();
  const steps = [
    {
      n: '01',
      t: 'Connect & sync',
      d: 'Install from the Shopify App Store and we index your entire catalog with embeddings — one click, no spreadsheets.',
      icon: (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </>
      ),
    },
    {
      n: '02',
      t: 'Drop in the drawer',
      d: 'A Theme App Extension toggle adds the assistant to your storefront. No code, no theme-file edits, fully reversible.',
      icon: (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M15 3v18" />
        </>
      ),
    },
    {
      n: '03',
      t: 'Shoppers just ask',
      d: 'Natural-language search returns real products from your store — grounded in your catalog, never invented.',
      icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    },
  ];
  return (
    <section
      id="how"
      ref={ref}
      style={{ background: '#fff', padding: 'clamp(64px,8vw,110px) 28px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div className="reveal">
          <SectionLabel accent={accent}>How it works</SectionLabel>
        </div>
        <h2
          className="reveal"
          style={{
            fontSize: 'clamp(28px,3.6vw,44px)',
            letterSpacing: '-0.025em',
            fontWeight: 700,
            margin: 0,
            color: 'var(--text-strong)',
          }}
        >
          Live on your store in an afternoon.
        </h2>
        <p
          className="reveal"
          style={{
            fontSize: 17,
            color: 'var(--text)',
            maxWidth: 540,
            margin: '14px auto 0',
            lineHeight: 1.55,
          }}
        >
          No developers, no migration. SmartDiscovery sits on top of the store you already have.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 'clamp(16px,2vw,26px)',
            marginTop: 'clamp(40px,5vw,64px)',
            textAlign: 'left',
          }}
          className="how-grid"
        >
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="reveal"
              style={{
                animationDelay: `${i * 0.1}s`,
                padding: 26,
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'var(--page)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: rgba(accent, 0.12),
                    display: 'grid',
                    placeItems: 'center',
                    color: accent,
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {s.icon}
                  </svg>
                </div>
                <span
                  className="tnum"
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: rgba(accent, 0.22),
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.n}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 19,
                  fontWeight: 650,
                  margin: '20px 0 8px',
                  color: 'var(--text-strong)',
                }}
              >
                {s.t}
              </h3>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Showcase: grounded results ───────── */
interface ProductCardProps {
  p: LandingProduct;
  accent?: string;
}

export function ProductCard({ p, accent = ACCENT }: ProductCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          aspectRatio: '4/3',
          overflow: 'hidden',
          background: '#f0eee9',
          position: 'relative',
        }}
      >
        <img
          src={p.image}
          alt={p.title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.9)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,0,0,.4)"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 21s-7-4.6-9.5-9C1 9 2.2 5.5 5.5 5.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4C16.8 5.5 18 9 16.5 12 14 16.4 12 21 12 21z" />
          </svg>
        </span>
      </div>
      <div style={{ padding: '13px 14px 15px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            color: 'var(--text-sub)',
          }}
        >
          {p.type}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
            marginTop: 5,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-strong)' }}>
            {p.title}
          </span>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 650, color: accent }}>
            ${p.price}
          </span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', margin: '7px 0 0' }}>
          {p.description}
        </p>
      </div>
    </div>
  );
}

interface ShowcaseProps {
  accent?: string;
}

export function Showcase({ accent = ACCENT }: ShowcaseProps) {
  const ref = useReveal();
  const prods = (['p3', 'p14', 'p9'] as const)
    .map((id) => CATALOG.find((p) => p.id === id))
    .filter((p): p is LandingProduct => Boolean(p));
  return (
    <section
      ref={ref}
      style={{
        background: 'var(--cream)',
        padding: 'clamp(64px,8vw,110px) 28px',
        borderTop: '1px solid var(--border-sub)',
        borderBottom: '1px solid var(--border-sub)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <div className="reveal">
            <SectionLabel accent={accent}>Grounded, not guessed</SectionLabel>
          </div>
          <h2
            className="reveal"
            style={{
              fontSize: 'clamp(28px,3.6vw,44px)',
              letterSpacing: '-0.025em',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-strong)',
            }}
          >
            Every answer is a real product from your store.
          </h2>
          <p
            className="reveal"
            style={{
              fontSize: 17,
              color: 'var(--text)',
              margin: '14px auto 0',
              lineHeight: 1.55,
            }}
          >
            Hybrid semantic + keyword search reads intent, color, material and price — then returns
            products that actually exist in your catalog. No hallucinated SKUs, ever.
          </p>
        </div>
        <div
          className="reveal"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            margin: '34px auto 22px',
            padding: '11px 16px 11px 11px',
            background: '#fff',
            borderRadius: 999,
            border: '1px solid var(--border)',
            boxShadow: '0 10px 30px -16px rgba(0,0,0,.25)',
            width: 'fit-content',
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: accent,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
          </span>
          <span style={{ fontSize: 15, color: 'var(--text-strong)', fontWeight: 500 }}>
            &quot;A low-maintenance plant for my office&quot;
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 'clamp(14px,1.6vw,20px)',
          }}
          className="show-grid"
        >
          {prods.map((p, i) => (
            <div key={p.id} className="reveal" style={{ animationDelay: `${i * 0.08}s` }}>
              <ProductCard p={p} accent={accent} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Features grid ───────── */
interface FeaturesProps {
  accent?: string;
}

export function Features({ accent = ACCENT }: FeaturesProps) {
  const ref = useReveal();
  const feats = [
    {
      t: 'Bring your own model',
      d: 'Gemini, GPT-4o, Claude or Llama — switch anytime from settings. Pricing and context shown per model.',
      icon: (
        <>
          <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1 0 8 4 4 0 0 1-8 0 4 4 0 0 1 0-8 4 4 0 0 1 4-4z" />
          <path d="M12 6v12" />
        </>
      ),
    },
    {
      t: 'Native to your theme',
      d: "The drawer inherits your storefront's typography and voice. It looks built-in, because it behaves built-in.",
      icon: (
        <>
          <path d="M3 9h18M9 21V9" />
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </>
      ),
    },
    {
      t: 'Anonymous-first',
      d: 'No login wall anywhere in the shopper flow. Visitors start asking the moment they land.',
      icon: (
        <>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      ),
    },
    {
      t: 'Saved & history',
      d: 'Shoppers bookmark products and revisit past searches — synced across the drawer and your admin playground.',
      icon: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
    },
    {
      t: 'Usage caps & cost control',
      d: 'Set a hard monthly token cap with an 80% warning. Always know what your AI spend will be.',
      icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    },
    {
      t: 'Always in sync',
      d: 'Webhooks keep your index fresh as products change. Health dots and one-click resync in settings.',
      icon: (
        <>
          <path d="M21 2v6h-6M3 22v-6h6" />
          <path d="M3.5 9a9 9 0 0 1 14.85-3.36L21 8M21 15a9 9 0 0 1-14.85 3.36L3 16" />
        </>
      ),
    },
  ];
  return (
    <section
      id="features"
      ref={ref}
      style={{ background: '#fff', padding: 'clamp(64px,8vw,110px) 28px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="reveal">
            <SectionLabel accent={accent}>Built for merchants</SectionLabel>
          </div>
          <h2
            className="reveal"
            style={{
              fontSize: 'clamp(28px,3.6vw,44px)',
              letterSpacing: '-0.025em',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-strong)',
            }}
          >
            Everything you need, nothing you don&apos;t.
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 'clamp(14px,1.6vw,22px)',
            marginTop: 'clamp(40px,5vw,60px)',
          }}
          className="feat-grid"
        >
          {feats.map((f, i) => (
            <div
              key={f.t}
              className="reveal"
              style={{
                animationDelay: `${(i % 3) * 0.08}s`,
                padding: 24,
                borderRadius: 16,
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: rgba(accent, 0.12),
                  display: 'grid',
                  placeItems: 'center',
                  color: accent,
                  marginBottom: 16,
                }}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {f.icon}
                </svg>
              </div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 650,
                  margin: '0 0 7px',
                  color: 'var(--text-strong)',
                }}
              >
                {f.t}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text)', margin: 0 }}>
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
