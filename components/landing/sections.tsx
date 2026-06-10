/* eslint-disable @next/next/no-img-element */
'use client';
import React from 'react';
import { ACCENT } from './tokens';
import { CATALOG } from './catalog';
import type { LandingProduct } from './catalog';
import { useReveal } from './use-reveal';

/* ───────── SectionLabel ───────── */
interface SectionLabelProps {
  accent?: string;
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div
      className="inline-flex items-center gap-[8px] text-[12px] font-[650] tracking-[.08em] uppercase mb-[14px] text-(--accent)"
    >
      <span
        className="w-[22px] h-[1.5px] rounded-[2px] bg-(--accent)"
      ></span>
      {children}
    </div>
  );
}

/* ───────── Logos / trust strip ───────── */
export function LogoStrip() {
  const names = ['Loom & Field', 'Greenhouse Co.', 'Heritage Wood', 'North Foundry', 'Field & Form'];
  return (
    <div className="border-b border-(--border-sub) bg-white">
      <div className="max-w-[1100px] mx-auto px-[28px] py-[26px] flex items-center justify-center flex-wrap gap-[clamp(20px,4vw,52px)]">
        <span className="text-[12.5px] text-(--text-sub) font-[500]">
          Trusted by independent Shopify brands
        </span>
        {names.map((n) => (
          <span
            key={n}
            className="font-(family-name:--font-dm-serif) font-normal text-[19px] text-(--text-sub) opacity-70 tracking-[-0.01em]"
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
      className="bg-white py-[clamp(64px,8vw,110px)] px-[28px]"
    >
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="reveal">
          <SectionLabel accent={accent}>How it works</SectionLabel>
        </div>
        <h2
          className="reveal text-[clamp(28px,3.6vw,44px)] tracking-[-0.025em] font-bold m-0 text-(--text-strong)"
        >
          Live on your store in an afternoon.
        </h2>
        <p
          className="reveal text-[17px] text-(--text) max-w-[540px] mx-auto mt-[14px] leading-[1.55]"
        >
          No developers, no migration. SmartDiscovery sits on top of the store you already have.
        </p>
        <div
          className="grid grid-cols-3 max-[920px]:grid-cols-1 gap-[clamp(16px,2vw,26px)] mt-[clamp(40px,5vw,64px)] text-left"
        >
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="reveal p-[26px] rounded-[16px] border border-(--border) bg-(--page) relative"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-[46px] h-[46px] rounded-[12px] grid place-items-center bg-(--accent)/12 text-(--accent)"
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
                  className="tabular-nums text-[30px] font-bold tracking-[-0.02em] text-(--accent)/[.22]"
                >
                  {s.n}
                </span>
              </div>
              <h3
                className="text-[19px] font-[650] mt-[20px] mb-[8px] text-(--text-strong)"
              >
                {s.t}
              </h3>
              <p
                className="text-[14.5px] leading-[1.55] text-(--text) m-0"
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

export function ProductCard({ p }: ProductCardProps) {
  return (
    <div
      className="bg-white border border-(--border) rounded-[14px] overflow-hidden flex flex-col"
    >
      <div
        className="aspect-[4/3] overflow-hidden bg-[#f0eee9] relative"
      >
        <img
          src={p.image}
          alt={p.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <span
          className="absolute top-[10px] right-[10px] size-[30px] rounded-full bg-white/90 grid place-items-center"
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
      <div className="px-[14px] pt-[13px] pb-[15px]">
        <div
          className="text-[11px] font-[600] tracking-[.04em] uppercase text-(--text-sub)"
        >
          {p.type}
        </div>
        <div
          className="flex justify-between items-baseline gap-[8px] mt-[5px]"
        >
          <span className="text-[15px] font-[650] text-(--text-strong)">
            {p.title}
          </span>
          <span
            className="tabular-nums text-[15px] font-[650] text-(--accent)"
          >
            ${p.price}
          </span>
        </div>
        <p className="text-[13px] leading-[1.5] text-(--text) mt-[7px] mb-0">
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
      className="bg-(--cream) py-[clamp(64px,8vw,110px)] px-[28px] border-t border-(--border-sub) border-b"
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[640px] mx-auto">
          <div className="reveal">
            <SectionLabel accent={accent}>Grounded, not guessed</SectionLabel>
          </div>
          <h2
            className="reveal text-[clamp(28px,3.6vw,44px)] tracking-[-0.025em] font-bold m-0 text-(--text-strong)"
          >
            Every answer is a real product from your store.
          </h2>
          <p
            className="reveal text-[17px] text-(--text) mt-[14px] mx-auto leading-[1.55]"
          >
            Hybrid semantic + keyword search reads intent, color, material and price — then returns
            products that actually exist in your catalog. No hallucinated SKUs, ever.
          </p>
        </div>
        <div
          className="reveal inline-flex items-center gap-[10px] mt-[34px] mx-auto mb-[22px] py-[11px] pr-[16px] pl-[11px] bg-white rounded-[999px] border border-(--border) shadow-[0_10px_30px_-16px_rgba(0,0,0,.25)] w-fit"
        >
          <span
            className="size-[30px] rounded-full grid place-items-center shrink-0 bg-(--accent)"
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
          <span className="text-[15px] text-(--text-strong) font-[500]">
            &quot;A low-maintenance plant for my office&quot;
          </span>
        </div>
        <div
          className="grid grid-cols-3 max-[920px]:grid-cols-1 gap-[clamp(14px,1.6vw,20px)]"
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
      className="bg-white py-[clamp(64px,8vw,110px)] px-[28px]"
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[600px] mx-auto">
          <div className="reveal">
            <SectionLabel accent={accent}>Built for merchants</SectionLabel>
          </div>
          <h2
            className="reveal text-[clamp(28px,3.6vw,44px)] tracking-[-0.025em] font-bold m-0 text-(--text-strong)"
          >
            Everything you need, nothing you don&apos;t.
          </h2>
        </div>
        <div
          className="grid grid-cols-3 max-[920px]:grid-cols-1 gap-[clamp(14px,1.6vw,22px)] mt-[clamp(40px,5vw,60px)]"
        >
          {feats.map((f, i) => (
            <div
              key={f.t}
              className="reveal p-[24px] rounded-[16px] border border-(--border)"
              style={{ animationDelay: `${(i % 3) * 0.08}s` }}
            >
              <div
                className="w-[42px] h-[42px] rounded-[11px] grid place-items-center mb-[16px] bg-(--accent)/12 text-(--accent)"
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
                className="text-[17px] font-[650] mt-0 mb-[7px] text-(--text-strong)"
              >
                {f.t}
              </h3>
              <p className="text-[14px] leading-[1.55] text-(--text) m-0">
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
