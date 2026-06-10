'use client';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ACCENT } from './tokens';
import { SDLogo, ShopifyMark } from './brand';
import { CTAButton } from './hero';
import { SectionLabel } from './sections';
import { useReveal } from './use-reveal';

/* ───────── Testimonials ───────── */
interface TestimonialsProps {
  accent?: string;
}

export function Testimonials({ accent = ACCENT }: TestimonialsProps) {
  const ref = useReveal();
  const quotes = [
    {
      q: 'Shoppers stopped bouncing off our search bar. SmartDiscovery understands "something cozy for a reading nook" — and shows the floor pillow and the throw.',
      n: 'Maya Chen',
      r: 'Founder, Loom & Field',
      stat: '+31%',
      sl: 'search-to-cart',
    },
    {
      q: 'Setup was a single toggle. It picked up our serif headings and felt like part of the theme on day one.',
      n: 'Daniel Okafor',
      r: 'Owner, Heritage Wood',
      stat: '4 min',
      sl: 'to go live',
    },
    {
      q: 'We swapped models from the settings page when volume spiked. Costs stayed predictable with the usage cap.',
      n: 'Priya Anand',
      r: 'Ops, Greenhouse Co.',
      stat: '−42%',
      sl: 'support tickets',
    },
  ];
  return (
    <section
      ref={ref}
      className="bg-(--page) py-[clamp(64px,8vw,110px)] px-[28px] border-t border-(--border-sub)"
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center">
          <div className="reveal">
            <SectionLabel accent={accent}>From the storefront</SectionLabel>
          </div>
          <h2
            className="reveal text-[clamp(28px,3.6vw,44px)] tracking-[-0.025em] font-bold m-0 text-(--text-strong)"
          >
            Merchants feel the difference.
          </h2>
        </div>
        <div className="grid grid-cols-3 max-[920px]:grid-cols-1 gap-[clamp(14px,1.6vw,22px)] mt-[clamp(40px,5vw,58px)]">
          {quotes.map((qt, i) => (
            <figure
              key={qt.n}
              className="reveal m-0 p-[26px] rounded-[16px] bg-white border border-(--border) flex flex-col"
              style={{ animationDelay: `${i * 0.09}s` }}
            >
              <div className="flex items-baseline gap-[8px] mb-[14px]">
                <span
                  className="tabular-nums text-[30px] font-bold text-(--accent) tracking-[-0.02em]"
                >
                  {qt.stat}
                </span>
                <span className="text-[13px] text-(--text-sub)">{qt.sl}</span>
              </div>
              <blockquote className="m-0 text-[15px] leading-[1.6] text-(--text-strong) flex-1">
                &ldquo;{qt.q}&rdquo;
              </blockquote>
              <figcaption className="mt-[18px] flex items-center gap-[11px]">
                <span
                  className="w-[38px] h-[38px] rounded-full bg-(--accent)/14 grid place-items-center font-[650] text-(--accent) text-[14px]"
                >
                  {qt.n
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </span>
                <span>
                  <div className="text-[14px] font-[650] text-(--text-strong)">{qt.n}</div>
                  <div className="text-[12.5px] text-(--text-sub)">{qt.r}</div>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Pricing ───────── */
interface PricingProps {
  accent?: string;
}

export function Pricing({ accent = ACCENT }: PricingProps) {
  const ref = useReveal();
  const tiers = [
    {
      name: 'Starter',
      price: '$0',
      per: 'free to install',
      d: 'For new stores testing the waters.',
      feats: [
        'Up to 500 catalog products',
        '1,000 AI searches / mo',
        'Gemini 2.5 Flash model',
        'Storefront drawer + admin playground',
      ],
      cta: 'Add to Shopify',
      highlight: false,
    },
    {
      name: 'Growth',
      price: '$29',
      per: '/ month',
      d: 'For growing brands that want a choice of models.',
      feats: [
        'Unlimited products',
        '15,000 AI searches / mo',
        'All models (GPT-4o, Claude, Llama)',
        'Saved, history & usage caps',
        'Webhook auto-sync',
      ],
      cta: 'Start free trial',
      highlight: true,
    },
    {
      name: 'Scale',
      price: '$99',
      per: '/ month',
      d: 'For high-volume catalogs and traffic.',
      feats: [
        'Everything in Growth',
        '75,000 AI searches / mo',
        'Priority indexing',
        'Premium models (Gemini 2.5 Pro)',
        'Priority support',
      ],
      cta: 'Start free trial',
      highlight: false,
    },
  ];
  return (
    <section
      id="pricing"
      ref={ref}
      className="bg-white py-[clamp(64px,8vw,110px)] px-[28px]"
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center max-w-[560px] mx-auto">
          <div className="reveal">
            <SectionLabel accent={accent}>Pricing</SectionLabel>
          </div>
          <h2
            className="reveal text-[clamp(28px,3.6vw,44px)] tracking-[-0.025em] font-bold m-0 text-(--text-strong)"
          >
            Free to install. Pay as you grow.
          </h2>
          <p className="reveal text-[17px] text-(--text) mt-[14px] mx-auto mb-0 leading-[1.55]">
            Every plan starts free. Upgrade only when your search volume does.
          </p>
        </div>
        <div className="grid grid-cols-3 max-[920px]:grid-cols-1 gap-[clamp(14px,1.6vw,20px)] mt-[clamp(40px,5vw,58px)] items-stretch">
          {tiers.map((t, i) => (
            <div
              key={t.name}
              className={cn(
                'reveal relative p-[28px] rounded-[18px] flex flex-col',
                t.highlight
                  ? /* border-2 accent + tinted bg + shadow — literal rgba: shadow color can't use var/opacity modifier */
                    'border-2 border-(--accent) bg-(--accent)/[.035] shadow-[0_24px_60px_-28px_rgba(91,79,233,0.55)]'
                  : 'border border-(--border) bg-white',
              )}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 text-[11.5px] font-bold tracking-[.04em] uppercase text-white bg-(--accent) py-[5px] px-[11px] rounded-full">
                  Most popular
                </span>
              )}
              <div className="text-[15px] font-[650] text-(--text-strong)">{t.name}</div>
              <div className="flex items-baseline gap-[7px] mt-[12px] mb-[6px]">
                <span className="tabular-nums text-[42px] font-bold tracking-[-0.03em] text-(--text-strong)">
                  {t.price}
                </span>
                <span className="text-[14px] text-(--text-sub)">{t.per}</span>
              </div>
              <p className="text-[13.5px] text-(--text) m-0 mb-[18px] min-h-[38px] leading-[1.5]">
                {t.d}
              </p>
              <a
                href="/api/auth"
                className={cn(
                  'block w-full py-[12px] px-[12px] rounded-[11px] font-semibold text-[14.5px] text-center no-underline cursor-pointer box-border',
                  t.highlight
                    ? /* shadow: literal rgba — shadow color can't use var/opacity modifier */
                      'border-0 bg-(--accent) text-white shadow-[0_8px_22px_-8px_rgba(91,79,233,0.7)]'
                    : 'border border-(--border) bg-white text-(--text-strong)',
                )}
              >
                {t.cta}
              </a>
              <ul className="list-none p-0 mt-[22px] mb-0 flex flex-col gap-[11px]">
                {t.feats.map((f) => (
                  <li key={f} className="flex gap-[10px] text-[13.5px] text-(--text) leading-[1.4]">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={accent}
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 mt-[1px]"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── FAQ ───────── */
interface FAQItemProps {
  q: string;
  a: string;
  accent?: string;
}

export function FAQItem({ q, a }: FAQItemProps) {
  const [open, setOpen] = useState(false);
  const id = 'faq-' + q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return (
    <div className="border-b border-(--border)">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center justify-between gap-[16px] py-[22px] px-[4px] bg-transparent border-0 text-left text-[17px] font-semibold text-(--text-strong)"
      >
        {q}
        <span
          className={cn(
            'w-[26px] h-[26px] rounded-full border border-(--border) grid place-items-center shrink-0 text-(--accent) transition-transform duration-200',
            open && 'rotate-45',
          )}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <div
        id={id}
        role="region"
        className={cn(
          'overflow-hidden transition-[max-height] duration-300 ease-in-out',
          open ? 'max-h-[320px]' : 'max-h-0',
        )}
      >
        <p className="text-[15px] leading-[1.6] text-(--text) m-0 mb-[22px] max-w-[680px]">
          {a}
        </p>
      </div>
    </div>
  );
}

interface FAQProps {
  accent?: string;
}

export function FAQ({ accent = ACCENT }: FAQProps) {
  const ref = useReveal();
  const faqs = [
    {
      q: 'Does it edit my theme files?',
      a: 'No. SmartDiscovery installs as a Theme App Extension — an injected overlay you toggle on from the Theme Editor. It never touches your theme code, and removing it leaves no trace.',
    },
    {
      q: "Will it invent products that don't exist?",
      a: 'Never. Every result is grounded in your synced catalog. The assistant can only surface real products, with your live prices, images and variants.',
    },
    {
      q: 'Which AI models can I use?',
      a: 'The model catalog is dynamic — currently Gemini 2.5 Flash and Pro, GPT-4o mini, Claude Haiku, and Llama 3.3. You pick one in settings and can switch anytime; pricing and context windows are shown for each.',
    },
    {
      q: 'Do shoppers need to log in?',
      a: 'No. The experience is anonymous-first — visitors can start asking the moment they open the drawer. Saved items and history work without an account.',
    },
    {
      q: 'How do I control costs?',
      a: 'Set a hard monthly token cap in settings with an automatic warning at 80%. You always know your ceiling, and usage breaks down by searches and tokens.',
    },
  ];
  return (
    <section
      id="faq"
      ref={ref}
      className="bg-(--page) py-[clamp(64px,8vw,110px)] px-[28px] border-t border-(--border-sub)"
    >
      <div className="max-w-[820px] mx-auto">
        <div className="text-center mb-[clamp(32px,4vw,48px)]">
          <div className="reveal">
            <SectionLabel accent={accent}>FAQ</SectionLabel>
          </div>
          <h2
            className="reveal text-[clamp(28px,3.6vw,44px)] tracking-[-0.025em] font-bold m-0 text-(--text-strong)"
          >
            Questions, answered.
          </h2>
        </div>
        <div className="reveal">
          {faqs.map((f) => (
            <FAQItem key={f.q} {...f} accent={accent} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Final CTA ───────── */
interface FinalCTAProps {
  accent?: string;
}

export function FinalCTA({ accent = ACCENT }: FinalCTAProps) {
  const ref = useReveal();
  return (
    <section ref={ref} className="bg-white py-[clamp(40px,6vw,90px)] px-[28px]">
      {/* FinalCTA gradient: precomputed shade vars --accent-d6/--accent-d44 from landing.css */}
      <div
        className="reveal max-w-[1100px] mx-auto relative overflow-hidden rounded-[28px] py-[clamp(48px,6vw,84px)] px-[28px] text-center text-white bg-[radial-gradient(120%_140%_at_80%_0%,var(--accent-d6),var(--accent-d44)_70%,#16161f)]"
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
            /* maskImage/WebkitMaskImage: no clean Tailwind arbitrary for vendor-prefixed mask — permitted inline survivor */
            maskImage: 'radial-gradient(100% 100% at 50% 0%, #000, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(100% 100% at 50% 0%, #000, transparent 75%)',
          }}
        ></div>
        <div className="relative">
          <div className="flex justify-center mb-[22px]">
            <SDLogo size={48} accent="#fff" aria-hidden="true" />
          </div>
          <h2
            className="text-[clamp(30px,4vw,52px)] tracking-[-0.03em] font-bold m-0 leading-[1.05]"
          >
            Give every shopper their
            <br />
            own shopkeeper.
          </h2>
          <p
            className="text-[clamp(16px,1.4vw,18px)] text-white/[.82] mt-[18px] mx-auto mb-0 max-w-[480px] leading-[1.55]"
          >
            Install free, sync your catalog, and watch &ldquo;just browsing&rdquo; turn into
            &ldquo;added to cart.&rdquo;
          </p>
          <div className="flex justify-center flex-wrap gap-[12px] mt-[30px]">
            <CTAButton accent="#fff" kind="shopify" large href="/api/auth">
              <span className="text-[#1a1d21]">Add to Shopify — free</span>
            </CTAButton>
            <CTAButton accent={accent} kind="ghost" large onDark>
              Book a 15-min walkthrough
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Footer ───────── */
interface FooterProps {
  accent?: string;
}

export function Footer({ accent = ACCENT }: FooterProps) {
  const cols: [string, string[]][] = [
    ['Product', ['How it works', 'Features', 'Pricing', 'Changelog']],
    ['Resources', ['Docs', 'Setup guide', 'Model catalog', 'Status']],
    ['Company', ['About', 'Blog', 'Contact', 'Privacy']],
  ];
  return (
    <footer className="bg-[#1a1d21] text-white/[.7] py-[56px] px-[28px] pb-[32px]">
      <div className="max-w-[1100px] mx-auto grid grid-cols-[1.6fr_repeat(3,1fr)] max-[920px]:grid-cols-2 max-[560px]:grid-cols-1 gap-[clamp(24px,4vw,48px)]">
        <div>
          <div className="flex items-center gap-[10px] mb-[14px]">
            <SDLogo size={32} accent={accent} aria-hidden="true" />
            <span className="font-bold text-[16px] text-white">
              SmartDiscovery <span className="text-(--accent-l40)">AI</span>
            </span>
          </div>
          <p className="text-[13.5px] leading-[1.6] max-w-[280px] m-0">
            Conversational product discovery for Shopify. Grounded in your real catalog.
          </p>
          <div className="inline-flex items-center gap-[8px] mt-[18px] text-[12.5px] text-white/[.55]">
            <ShopifyMark size={15} /> Built for the Shopify App Store
          </div>
        </div>
        {cols.map(([h, items]) => (
          <div key={h}>
            <h3 className="text-[12px] font-[650] tracking-[.06em] uppercase text-white/[.45] mb-[14px] mt-0">
              {h}
            </h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-[10px]">
              {items.map((it) => (
                <li key={it}>
                  <a href="#" className="text-[13.5px] hover:text-white">
                    {it}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-[1100px] mt-[40px] mx-auto pt-[22px] border-t border-white/[.1] flex justify-between flex-wrap gap-[12px] text-[12.5px] text-white/[.5]">
        <span>© 2026 SmartDiscovery AI · by Field &amp; Form</span>
        <span className="flex gap-[18px]">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Conversations stay on your store</a>
        </span>
      </div>
    </footer>
  );
}
