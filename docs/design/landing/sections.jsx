// sections.jsx — landing page sections below the hero.

function useReveal() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    el.querySelectorAll('.reveal').forEach(n => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

function SectionLabel({ accent, children }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 650,
      letterSpacing: '.08em', textTransform: 'uppercase', color: accent, marginBottom: 14 }}>
      <span style={{ width: 22, height: 1.5, background: accent, borderRadius: 2 }}></span>
      {children}
    </div>
  );
}

/* ───────── Nav ───────── */
function Nav({ accent, hero, setHero }) {
  const [solid, setSolid] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [['How it works', '#how'], ['Features', '#features'], ['Pricing', '#pricing'], ['FAQ', '#faq']];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100,
      background: solid ? 'rgba(255,255,255,.82)' : 'transparent',
      backdropFilter: solid ? 'blur(14px) saturate(160%)' : 'none',
      WebkitBackdropFilter: solid ? 'blur(14px) saturate(160%)' : 'none',
      borderBottom: solid ? '1px solid var(--border-sub)' : '1px solid transparent',
      transition: 'background .25s, border-color .25s' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 28px',
        display: 'flex', alignItems: 'center', gap: 22 }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SDLogo size={32} accent={accent} />
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em', color: 'var(--text-strong)' }}>
            SmartDiscovery <span style={{ color: accent }}>AI</span></span>
        </a>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 14 }} className="nav-links">
          {links.map(([t, h]) => (
            <a key={t} href={h} style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)',
              padding: '7px 12px', borderRadius: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{t}</a>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="#" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }} className="nav-signin">Sign in</a>
          <CTAButton accent={accent} kind="primary">Add to Shopify</CTAButton>
        </div>
      </div>
    </header>
  );
}

/* ───────── Logos / trust strip ───────── */
function LogoStrip() {
  const names = ['Loom & Field', 'Greenhouse Co.', 'Heritage Wood', 'North Foundry', 'Field & Form'];
  return (
    <div style={{ borderBottom: '1px solid var(--border-sub)', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 28px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 'clamp(20px,4vw,52px)' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-sub)', fontWeight: 500 }}>Trusted by independent Shopify brands</span>
        {names.map(n => (
          <span key={n} className="serif" style={{ fontSize: 19, color: 'var(--text-sub)', opacity: 0.7,
            letterSpacing: '-0.01em' }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

/* ───────── How it works ───────── */
function HowItWorks({ accent }) {
  const ref = useReveal();
  const steps = [
    { n: '01', t: 'Connect & sync', d: 'Install from the Shopify App Store and we index your entire catalog with embeddings — one click, no spreadsheets.',
      icon: <><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></> },
    { n: '02', t: 'Drop in the drawer', d: 'A Theme App Extension toggle adds the assistant to your storefront. No code, no theme-file edits, fully reversible.',
      icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></> },
    { n: '03', t: 'Shoppers just ask', d: 'Natural-language search returns real products from your store — grounded in your catalog, never invented.',
      icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></> },
  ];
  return (
    <section id="how" ref={ref} style={{ background: '#fff', padding: 'clamp(64px,8vw,110px) 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div className="reveal"><SectionLabel accent={accent}>How it works</SectionLabel></div>
        <h2 className="reveal" style={{ fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em',
          fontWeight: 700, margin: 0, color: 'var(--text-strong)' }}>Live on your store in an afternoon.</h2>
        <p className="reveal" style={{ fontSize: 17, color: 'var(--text)', maxWidth: 540, margin: '14px auto 0', lineHeight: 1.55 }}>
          No developers, no migration. SmartDiscovery sits on top of the store you already have.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(16px,2vw,26px)',
          marginTop: 'clamp(40px,5vw,64px)', textAlign: 'left' }} className="how-grid">
          {steps.map((s, i) => (
            <div key={s.n} className="reveal" style={{ animationDelay: `${i * 0.1}s`,
              padding: 26, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--page)',
              position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: rgba(accent, 0.12),
                  display: 'grid', placeItems: 'center', color: accent }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                </div>
                <span className="tnum" style={{ fontSize: 30, fontWeight: 700, color: rgba(accent, 0.22),
                  letterSpacing: '-0.02em' }}>{s.n}</span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 650, margin: '20px 0 8px', color: 'var(--text-strong)' }}>{s.t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text)', margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Showcase: grounded results ───────── */
function ProductCard({ p, accent }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: '#f0eee9', position: 'relative' }}>
        <img src={p.image} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <span style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,.9)', display: 'grid', placeItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="2">
            <path d="M12 21s-7-4.6-9.5-9C1 9 2.2 5.5 5.5 5.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4C16.8 5.5 18 9 16.5 12 14 16.4 12 21 12 21z"/></svg>
        </span>
      </div>
      <div style={{ padding: '13px 14px 15px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
          color: 'var(--text-sub)' }}>{p.type}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-strong)' }}>{p.title}</span>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 650, color: accent }}>${p.price}</span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', margin: '7px 0 0' }}>{p.description}</p>
      </div>
    </div>
  );
}

function Showcase({ accent }) {
  const ref = useReveal();
  const prods = ['p3', 'p14', 'p9'].map(id => CATALOG.find(p => p.id === id)).filter(Boolean);
  return (
    <section ref={ref} style={{ background: 'var(--cream)', padding: 'clamp(64px,8vw,110px) 28px',
      borderTop: '1px solid var(--border-sub)', borderBottom: '1px solid var(--border-sub)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <div className="reveal"><SectionLabel accent={accent}>Grounded, not guessed</SectionLabel></div>
          <h2 className="reveal" style={{ fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em',
            fontWeight: 700, margin: 0, color: 'var(--text-strong)' }}>
            Every answer is a real product from your store.</h2>
          <p className="reveal" style={{ fontSize: 17, color: 'var(--text)', margin: '14px auto 0', lineHeight: 1.55 }}>
            Hybrid semantic + keyword search reads intent, color, material and price — then returns products that
            actually exist in your catalog. No hallucinated SKUs, ever.</p>
        </div>
        <div className="reveal" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, margin: '34px auto 22px',
          padding: '11px 16px 11px 11px', background: '#fff', borderRadius: 999, border: '1px solid var(--border)',
          boxShadow: '0 10px 30px -16px rgba(0,0,0,.25)', width: 'fit-content', display: 'flex' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: accent, display: 'grid',
            placeItems: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3"
              strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          </span>
          <span style={{ fontSize: 15, color: 'var(--text-strong)', fontWeight: 500 }}>
            “A low-maintenance plant for my office”</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(14px,1.6vw,20px)' }}
          className="show-grid">
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
function Features({ accent }) {
  const ref = useReveal();
  const feats = [
    { t: 'Bring your own model', d: 'Gemini, GPT-4o, Claude or Llama — switch anytime from settings. Pricing and context shown per model.',
      icon: <><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1 0 8 4 4 0 0 1-8 0 4 4 0 0 1 0-8 4 4 0 0 1 4-4z"/><path d="M12 6v12"/></> },
    { t: 'Native to your theme', d: 'The drawer inherits your storefront’s typography and voice. It looks built-in, because it behaves built-in.',
      icon: <><path d="M3 9h18M9 21V9"/><rect x="3" y="3" width="18" height="18" rx="2"/></> },
    { t: 'Anonymous-first', d: 'No login wall anywhere in the shopper flow. Visitors start asking the moment they land.',
      icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
    { t: 'Saved & history', d: 'Shoppers bookmark products and revisit past searches — synced across the drawer and your admin playground.',
      icon: <><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></> },
    { t: 'Usage caps & cost control', d: 'Set a hard monthly token cap with an 80% warning. Always know what your AI spend will be.',
      icon: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></> },
    { t: 'Always in sync', d: 'Webhooks keep your index fresh as products change. Health dots and one-click resync in settings.',
      icon: <><path d="M21 2v6h-6M3 22v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.85-3.36L21 8M21 15a9 9 0 0 1-14.85 3.36L3 16"/></> },
  ];
  return (
    <section id="features" ref={ref} style={{ background: '#fff', padding: 'clamp(64px,8vw,110px) 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div className="reveal"><SectionLabel accent={accent}>Built for merchants</SectionLabel></div>
          <h2 className="reveal" style={{ fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em',
            fontWeight: 700, margin: 0, color: 'var(--text-strong)' }}>Everything you need, nothing you don’t.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(14px,1.6vw,22px)',
          marginTop: 'clamp(40px,5vw,60px)' }} className="feat-grid">
          {feats.map((f, i) => (
            <div key={f.t} className="reveal" style={{ animationDelay: `${(i % 3) * 0.08}s`,
              padding: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: rgba(accent, 0.12),
                display: 'grid', placeItems: 'center', color: accent, marginBottom: 16 }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 650, margin: '0 0 7px', color: 'var(--text-strong)' }}>{f.t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text)', margin: 0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Testimonials ───────── */
function Testimonials({ accent }) {
  const ref = useReveal();
  const quotes = [
    { q: 'Shoppers stopped bouncing off our search bar. SmartDiscovery understands “something cozy for a reading nook” — and shows the floor pillow and the throw.',
      n: 'Maya Chen', r: 'Founder, Loom & Field', stat: '+31%', sl: 'search-to-cart' },
    { q: 'Setup was a single toggle. It picked up our serif headings and felt like part of the theme on day one.',
      n: 'Daniel Okafor', r: 'Owner, Heritage Wood', stat: '4 min', sl: 'to go live' },
    { q: 'We swapped models from the settings page when volume spiked. Costs stayed predictable with the usage cap.',
      n: 'Priya Anand', r: 'Ops, Greenhouse Co.', stat: '−42%', sl: 'support tickets' },
  ];
  return (
    <section ref={ref} style={{ background: 'var(--page)', padding: 'clamp(64px,8vw,110px) 28px',
      borderTop: '1px solid var(--border-sub)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="reveal"><SectionLabel accent={accent}>From the storefront</SectionLabel></div>
          <h2 className="reveal" style={{ fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em',
            fontWeight: 700, margin: 0, color: 'var(--text-strong)' }}>Merchants feel the difference.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(14px,1.6vw,22px)',
          marginTop: 'clamp(40px,5vw,58px)' }} className="quote-grid">
          {quotes.map((qt, i) => (
            <figure key={qt.n} className="reveal" style={{ animationDelay: `${i * 0.09}s`, margin: 0,
              padding: 26, borderRadius: 16, background: '#fff', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                <span className="tnum" style={{ fontSize: 30, fontWeight: 700, color: accent, letterSpacing: '-0.02em' }}>{qt.stat}</span>
                <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{qt.sl}</span>
              </div>
              <blockquote style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-strong)', flex: 1 }}>“{qt.q}”</blockquote>
              <figcaption style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: rgba(accent, 0.14),
                  display: 'grid', placeItems: 'center', fontWeight: 650, color: accent, fontSize: 14 }}>
                  {qt.n.split(' ').map(w => w[0]).join('')}</span>
                <span>
                  <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-strong)' }}>{qt.n}</div>
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
function Pricing({ accent }) {
  const ref = useReveal();
  const tiers = [
    { name: 'Starter', price: '$0', per: 'free to install', d: 'For new stores testing the waters.',
      feats: ['Up to 500 catalog products', '1,000 AI searches / mo', 'Gemini 2.5 Flash model', 'Storefront drawer + admin playground'], cta: 'Add to Shopify', highlight: false },
    { name: 'Growth', price: '$29', per: '/ month', d: 'For growing brands that want a choice of models.',
      feats: ['Unlimited products', '15,000 AI searches / mo', 'All models (GPT-4o, Claude, Llama)', 'Saved, history & usage caps', 'Webhook auto-sync'], cta: 'Start free trial', highlight: true },
    { name: 'Scale', price: '$99', per: '/ month', d: 'For high-volume catalogs and traffic.',
      feats: ['Everything in Growth', '75,000 AI searches / mo', 'Priority indexing', 'Premium models (Gemini 2.5 Pro)', 'Priority support'], cta: 'Start free trial', highlight: false },
  ];
  return (
    <section id="pricing" ref={ref} style={{ background: '#fff', padding: 'clamp(64px,8vw,110px) 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <div className="reveal"><SectionLabel accent={accent}>Pricing</SectionLabel></div>
          <h2 className="reveal" style={{ fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em',
            fontWeight: 700, margin: 0, color: 'var(--text-strong)' }}>Free to install. Pay as you grow.</h2>
          <p className="reveal" style={{ fontSize: 17, color: 'var(--text)', margin: '14px auto 0', lineHeight: 1.55 }}>
            Every plan starts free. Upgrade only when your search volume does.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(14px,1.6vw,20px)',
          marginTop: 'clamp(40px,5vw,58px)', alignItems: 'stretch' }} className="price-grid">
          {tiers.map((t, i) => (
            <div key={t.name} className="reveal" style={{ animationDelay: `${i * 0.08}s`, position: 'relative',
              padding: 28, borderRadius: 18, display: 'flex', flexDirection: 'column',
              border: t.highlight ? `2px solid ${accent}` : '1px solid var(--border)',
              background: t.highlight ? rgba(accent, 0.035) : '#fff',
              boxShadow: t.highlight ? `0 24px 60px -28px ${rgba(accent,.55)}` : 'none' }}>
              {t.highlight && <span style={{ position: 'absolute', top: -12, left: 28, fontSize: 11.5, fontWeight: 700,
                letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: accent,
                padding: '5px 11px', borderRadius: 999 }}>Most popular</span>}
              <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-strong)' }}>{t.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, margin: '12px 0 6px' }}>
                <span className="tnum" style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-strong)' }}>{t.price}</span>
                <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>{t.per}</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text)', margin: '0 0 18px', minHeight: 38, lineHeight: 1.5 }}>{t.d}</p>
              <button style={{ width: '100%', padding: '12px', borderRadius: 11, fontWeight: 600, fontSize: 14.5,
                border: t.highlight ? 'none' : '1px solid var(--border)',
                background: t.highlight ? accent : '#fff', color: t.highlight ? '#fff' : 'var(--text-strong)',
                boxShadow: t.highlight ? `0 8px 22px -8px ${rgba(accent,.7)}` : 'none' }}>{t.cta}</button>
              <ul style={{ listStyle: 'none', padding: 0, margin: '22px 0 0', display: 'flex',
                flexDirection: 'column', gap: 11 }}>
                {t.feats.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.6"
                      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5"/></svg>
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
function FAQItem({ q, a, accent }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16, padding: '22px 4px', background: 'none', border: 'none',
        textAlign: 'left', fontSize: 17, fontWeight: 600, color: 'var(--text-strong)' }}>
        {q}
        <span style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)',
          display: 'grid', placeItems: 'center', flexShrink: 0, color: accent,
          transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </span>
      </button>
      <div style={{ maxHeight: open ? 240 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text)', margin: '0 0 22px', maxWidth: 680 }}>{a}</p>
      </div>
    </div>
  );
}

function FAQ({ accent }) {
  const ref = useReveal();
  const faqs = [
    { q: 'Does it edit my theme files?', a: 'No. SmartDiscovery installs as a Theme App Extension — an injected overlay you toggle on from the Theme Editor. It never touches your theme code, and removing it leaves no trace.' },
    { q: 'Will it invent products that don’t exist?', a: 'Never. Every result is grounded in your synced catalog. The assistant can only surface real products, with your live prices, images and variants.' },
    { q: 'Which AI models can I use?', a: 'The model catalog is dynamic — currently Gemini 2.5 Flash and Pro, GPT-4o mini, Claude Haiku, and Llama 3.3. You pick one in settings and can switch anytime; pricing and context windows are shown for each.' },
    { q: 'Do shoppers need to log in?', a: 'No. The experience is anonymous-first — visitors can start asking the moment they open the drawer. Saved items and history work without an account.' },
    { q: 'How do I control costs?', a: 'Set a hard monthly token cap in settings with an automatic warning at 80%. You always know your ceiling, and usage breaks down by searches and tokens.' },
  ];
  return (
    <section id="faq" ref={ref} style={{ background: 'var(--page)', padding: 'clamp(64px,8vw,110px) 28px',
      borderTop: '1px solid var(--border-sub)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,4vw,48px)' }}>
          <div className="reveal"><SectionLabel accent={accent}>FAQ</SectionLabel></div>
          <h2 className="reveal" style={{ fontSize: 'clamp(28px,3.6vw,44px)', letterSpacing: '-0.025em',
            fontWeight: 700, margin: 0, color: 'var(--text-strong)' }}>Questions, answered.</h2>
        </div>
        <div className="reveal">
          {faqs.map(f => <FAQItem key={f.q} {...f} accent={accent} />)}
        </div>
      </div>
    </section>
  );
}

/* ───────── Final CTA ───────── */
function FinalCTA({ accent }) {
  const ref = useReveal();
  return (
    <section ref={ref} style={{ background: '#fff', padding: 'clamp(40px,6vw,90px) 28px' }}>
      <div className="reveal" style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', overflow: 'hidden',
        borderRadius: 28, padding: 'clamp(48px,6vw,84px) 28px', textAlign: 'center',
        background: `radial-gradient(120% 140% at 80% 0%, ${shade(accent,-6)}, ${shade(accent,-44)} 70%, #16161f)`,
        color: '#fff' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)',
          backgroundSize: '48px 48px', maskImage: 'radial-gradient(100% 100% at 50% 0%, #000, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(100% 100% at 50% 0%, #000, transparent 75%)' }}></div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><SDLogo size={48} accent="#fff" /></div>
          <h2 style={{ fontSize: 'clamp(30px,4vw,52px)', letterSpacing: '-0.03em', fontWeight: 700,
            margin: 0, lineHeight: 1.05 }}>Give every shopper their<br/>own shopkeeper.</h2>
          <p style={{ fontSize: 'clamp(16px,1.4vw,18px)', color: 'rgba(255,255,255,.82)', margin: '18px auto 0',
            maxWidth: 480, lineHeight: 1.55 }}>Install free, sync your catalog, and watch “just browsing” turn into “added to cart.”</p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
            <CTAButton accent="#fff" kind="shopify" large><span style={{ color: '#1a1d21' }}>Add to Shopify — free</span></CTAButton>
            <CTAButton accent={accent} kind="ghost" large onDark>Book a 15-min walkthrough</CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Footer ───────── */
function Footer({ accent }) {
  const cols = [
    ['Product', ['How it works', 'Features', 'Pricing', 'Changelog']],
    ['Resources', ['Docs', 'Setup guide', 'Model catalog', 'Status']],
    ['Company', ['About', 'Blog', 'Contact', 'Privacy']],
  ];
  return (
    <footer style={{ background: '#1a1d21', color: 'rgba(255,255,255,.7)', padding: '56px 28px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid',
        gridTemplateColumns: '1.6fr repeat(3,1fr)', gap: 'clamp(24px,4vw,48px)' }} className="foot-grid">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <SDLogo size={32} accent={accent} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>SmartDiscovery <span style={{ color: shade(accent, 40) }}>AI</span></span>
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 280, margin: 0 }}>
            Conversational product discovery for Shopify. Grounded in your real catalog.</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 12.5,
            color: 'rgba(255,255,255,.55)' }}>
            <ShopifyMark size={15} /> Built for the Shopify App Store
          </div>
        </div>
        {cols.map(([h, items]) => (
          <div key={h}>
            <div style={{ fontSize: 12, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.45)', marginBottom: 14 }}>{h}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(it => <li key={it}><a href="#" style={{ fontSize: 13.5 }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = ''}>{it}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1100, margin: '40px auto 0', paddingTop: 22, borderTop: '1px solid rgba(255,255,255,.1)',
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12.5,
        color: 'rgba(255,255,255,.5)' }}>
        <span>© 2026 SmartDiscovery AI · by Field &amp; Form</span>
        <span style={{ display: 'flex', gap: 18 }}>
          <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Conversations stay on your store</a>
        </span>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, LogoStrip, HowItWorks, Showcase, Features, Testimonials, Pricing, FAQ, FinalCTA, Footer });
