'use client';
import React, { useState } from 'react';
import { ACCENT, rgba, shade } from './tokens';
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
      style={{
        background: 'var(--page)',
        padding: 'clamp(64px,8vw,110px) 28px',
        borderTop: '1px solid var(--border-sub)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="reveal">
            <SectionLabel accent={accent}>From the storefront</SectionLabel>
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
            Merchants feel the difference.
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 'clamp(14px,1.6vw,22px)',
            marginTop: 'clamp(40px,5vw,58px)',
          }}
          className="quote-grid"
        >
          {quotes.map((qt, i) => (
            <figure
              key={qt.n}
              className="reveal"
              style={{
                animationDelay: `${i * 0.09}s`,
                margin: 0,
                padding: 26,
                borderRadius: 16,
                background: '#fff',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <span
                  className="tnum"
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: accent,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {qt.stat}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{qt.sl}</span>
              </div>
              <blockquote
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'var(--text-strong)',
                  flex: 1,
                }}
              >
                &ldquo;{qt.q}&rdquo;
              </blockquote>
              <figcaption
                style={{
                  marginTop: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: rgba(accent, 0.14),
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 650,
                    color: accent,
                    fontSize: 14,
                  }}
                >
                  {qt.n
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </span>
                <span>
                  <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-strong)' }}>
                    {qt.n}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-sub)' }}>{qt.r}</div>
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
      style={{ background: '#fff', padding: 'clamp(64px,8vw,110px) 28px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <div className="reveal">
            <SectionLabel accent={accent}>Pricing</SectionLabel>
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
            Free to install. Pay as you grow.
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
            Every plan starts free. Upgrade only when your search volume does.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 'clamp(14px,1.6vw,20px)',
            marginTop: 'clamp(40px,5vw,58px)',
            alignItems: 'stretch',
          }}
          className="price-grid"
        >
          {tiers.map((t, i) => (
            <div
              key={t.name}
              className="reveal"
              style={{
                animationDelay: `${i * 0.08}s`,
                position: 'relative',
                padding: 28,
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                border: t.highlight ? `2px solid ${accent}` : '1px solid var(--border)',
                background: t.highlight ? rgba(accent, 0.035) : '#fff',
                boxShadow: t.highlight ? `0 24px 60px -28px ${rgba(accent, 0.55)}` : 'none',
              }}
            >
              {t.highlight && (
                <span
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: 28,
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    background: accent,
                    padding: '5px 11px',
                    borderRadius: 999,
                  }}
                >
                  Most popular
                </span>
              )}
              <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-strong)' }}>
                {t.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 7,
                  margin: '12px 0 6px',
                }}
              >
                <span
                  className="tnum"
                  style={{
                    fontSize: 42,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-strong)',
                  }}
                >
                  {t.price}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>{t.per}</span>
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  color: 'var(--text)',
                  margin: '0 0 18px',
                  minHeight: 38,
                  lineHeight: 1.5,
                }}
              >
                {t.d}
              </p>
              <a
                href="/api/auth"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  borderRadius: 11,
                  fontWeight: 600,
                  fontSize: 14.5,
                  border: t.highlight ? 'none' : '1px solid var(--border)',
                  background: t.highlight ? accent : '#fff',
                  color: t.highlight ? '#fff' : 'var(--text-strong)',
                  boxShadow: t.highlight ? `0 8px 22px -8px ${rgba(accent, 0.7)}` : 'none',
                  textAlign: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {t.cta}
              </a>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '22px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 11,
                }}
              >
                {t.feats.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      gap: 10,
                      fontSize: 13.5,
                      color: 'var(--text)',
                      lineHeight: 1.4,
                    }}
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={accent}
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: 1 }}
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

export function FAQItem({ q, a, accent = ACCENT }: FAQItemProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '22px 4px',
          background: 'none',
          border: 'none',
          textAlign: 'left',
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--text-strong)',
        }}
      >
        {q}
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: accent,
            transform: open ? 'rotate(45deg)' : 'none',
            transition: 'transform .2s',
          }}
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
        style={{
          maxHeight: open ? 240 : 0,
          overflow: 'hidden',
          transition: 'max-height .3s ease',
        }}
      >
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--text)',
            margin: '0 0 22px',
            maxWidth: 680,
          }}
        >
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
      style={{
        background: 'var(--page)',
        padding: 'clamp(64px,8vw,110px) 28px',
        borderTop: '1px solid var(--border-sub)',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,4vw,48px)' }}>
          <div className="reveal">
            <SectionLabel accent={accent}>FAQ</SectionLabel>
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
    <section ref={ref} style={{ background: '#fff', padding: 'clamp(40px,6vw,90px) 28px' }}>
      <div
        className="reveal"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 28,
          padding: 'clamp(48px,6vw,84px) 28px',
          textAlign: 'center',
          background: `radial-gradient(120% 140% at 80% 0%, ${shade(accent, -6)}, ${shade(accent, -44)} 70%, #16161f)`,
          color: '#fff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.5,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(100% 100% at 50% 0%, #000, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(100% 100% at 50% 0%, #000, transparent 75%)',
          }}
        ></div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <SDLogo size={48} accent="#fff" aria-hidden="true" />
          </div>
          <h2
            style={{
              fontSize: 'clamp(30px,4vw,52px)',
              letterSpacing: '-0.03em',
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Give every shopper their
            <br />
            own shopkeeper.
          </h2>
          <p
            style={{
              fontSize: 'clamp(16px,1.4vw,18px)',
              color: 'rgba(255,255,255,.82)',
              margin: '18px auto 0',
              maxWidth: 480,
              lineHeight: 1.55,
            }}
          >
            Install free, sync your catalog, and watch &ldquo;just browsing&rdquo; turn into
            &ldquo;added to cart.&rdquo;
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 30,
            }}
          >
            <CTAButton accent="#fff" kind="shopify" large href="/api/auth">
              <span style={{ color: '#1a1d21' }}>Add to Shopify — free</span>
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
    <footer style={{ background: '#1a1d21', color: 'rgba(255,255,255,.7)', padding: '56px 28px 32px' }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.6fr repeat(3,1fr)',
          gap: 'clamp(24px,4vw,48px)',
        }}
        className="foot-grid"
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <SDLogo size={32} accent={accent} aria-hidden="true" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
              SmartDiscovery <span style={{ color: shade(accent, 40) }}>AI</span>
            </span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 280, margin: 0 }}>
            Conversational product discovery for Shopify. Grounded in your real catalog.
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 18,
              fontSize: 12.5,
              color: 'rgba(255,255,255,.55)',
            }}
          >
            <ShopifyMark size={15} /> Built for the Shopify App Store
          </div>
        </div>
        {cols.map(([h, items]) => (
          <div key={h}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 650,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.45)',
                marginBottom: 14,
              }}
            >
              {h}
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {items.map((it) => (
                <li key={it}>
                  <a
                    href="#"
                    style={{ fontSize: 13.5 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                  >
                    {it}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1100,
          margin: '40px auto 0',
          paddingTop: 22,
          borderTop: '1px solid rgba(255,255,255,.1)',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 12.5,
          color: 'rgba(255,255,255,.5)',
        }}
      >
        <span>© 2026 SmartDiscovery AI · by Field &amp; Form</span>
        <span style={{ display: 'flex', gap: 18 }}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Conversations stay on your store</a>
        </span>
      </div>
    </footer>
  );
}
