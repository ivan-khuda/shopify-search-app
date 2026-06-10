// heroes.jsx — three hero directions for the SmartDiscovery AI landing page.
// HeroConversation (default) · HeroEditorial · HeroBold. Switchable via Tweaks.

const HEADLINE = 'Your shoppers describe it.';
const HEADLINE2 = 'Your store finds it.';
const SUBHEAD = 'SmartDiscovery adds a conversational search assistant to your Shopify storefront. Shoppers ask in plain language — and instantly see real products from your catalog.';

function ShopifyMark({ size = 17, color = '#95BF47' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill={color} aria-hidden="true">
      <path d="M37 10.7c0-.3-.3-.5-.5-.5l-3.4-.3-2.5-2.5c-.2-.2-.7-.2-.9-.1l-1.3.4C27.6 5.4 26.4 4.5 25 4.5c-.1 0-.2 0-.4.1-.4-.6-1-.9-1.7-.9-2.9.1-4.3 3.7-4.8 5.5l-2.4.7c-.7.2-.8.3-.9 1-.1.5-2 15.5-2 15.5L28 30.4l8.1-1.8S37 11 37 10.7zM23 8.5l-2.2.7c.4-1.6 1.2-3.2 2.5-3.3.2.4.3 1 .3 1.7l-.6.2zm-1.2-3.6c.2 0 .4.1.5.2-1.4.7-2.3 2.5-2.7 4.4l-1.8.6c.5-1.9 1.7-5.1 4-5.2zm.7 11.2l-.6 1.7s-.9-.5-2.1-.5c-1.7 0-1.8 1.1-1.8 1.3 0 1.4 3.8 2 3.8 5.4 0 2.7-1.7 4.4-4 4.4-2.7 0-4.1-1.7-4.1-1.7l.7-2.4s1.4 1.2 2.6 1.2c.8 0 1.1-.6 1.1-1.1 0-1.9-3.1-2-3.1-5.1 0-2.6 1.9-5.2 5.7-5.2 1.4 0 2.1.5 2.1.5l-.2 1.5z"/>
      <path d="M31 9.4c-.1 0-.2 0-.3.1-.4-.6-1-.9-1.7-.9V30.4l8.1-1.8S37 11 37 10.7c0-.3-.3-.5-.5-.5l-3.4-.3-2.1-.5z" opacity="0.85"/>
    </svg>
  );
}

function CTAButton({ children, accent, kind = 'primary', large, onDark }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 600,
    fontSize: large ? 15 : 14, padding: large ? '13px 22px' : '11px 18px',
    borderRadius: 11, border: '1px solid transparent', transition: 'transform .12s, box-shadow .2s, background .2s',
    whiteSpace: 'nowrap',
  };
  const styles = {
    primary: { ...base, background: accent, color: '#fff',
      boxShadow: `0 1px 0 rgba(255,255,255,.25) inset, 0 8px 22px -8px ${rgba(accent,.7)}` },
    ghost: { ...base, background: onDark ? 'rgba(255,255,255,.08)' : '#fff',
      color: onDark ? '#fff' : 'var(--text-strong)',
      borderColor: onDark ? 'rgba(255,255,255,.22)' : 'var(--border)' },
    shopify: { ...base, background: '#fff', color: '#1a1d21', borderColor: 'var(--border)' },
  };
  return (
    <button style={styles[kind]}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
      {kind === 'shopify' && <ShopifyMark />}
      {children}
    </button>
  );
}

function TrustLine({ onDark }) {
  const c = onDark ? 'rgba(255,255,255,.72)' : 'var(--text-sub)';
  const dot = onDark ? 'rgba(255,255,255,.4)' : 'var(--border)';
  const items = ['Installs in minutes', 'No theme edits', 'Works with your theme'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, fontSize: 13, color: c }}>
      {items.map((t, i) => (
        <React.Fragment key={t}>
          {i > 0 && <span style={{ width: 4, height: 4, borderRadius: '50%', background: dot }}></span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={onDark ? '#fff' : '#008060'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            {t}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function Eyebrow({ accent, onDark }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
      padding: '6px 12px 6px 8px', borderRadius: 999, letterSpacing: '.01em',
      background: onDark ? 'rgba(255,255,255,.1)' : rgba(accent, 0.1),
      color: onDark ? '#fff' : accent,
      border: onDark ? '1px solid rgba(255,255,255,.16)' : `1px solid ${rgba(accent,.2)}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999,
        background: onDark ? 'rgba(255,255,255,.16)' : '#fff', color: onDark ? '#fff' : accent, fontWeight: 700 }}>
        <ShopifyMark size={13} color="#95BF47" /> Shopify App
      </span>
      Conversational product discovery
    </span>
  );
}

/* ───────────────── 1 · CONVERSATION (default) ───────────────── */
function HeroConversation({ accent }) {
  return (
    <section style={{ background: 'linear-gradient(180deg,#fbfaf8 0%, #f6f6f7 100%)',
      borderBottom: '1px solid var(--border-sub)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px,7vw,92px) 28px',
        display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)', gap: 'clamp(36px,5vw,72px)',
        alignItems: 'center' }} className="hero-grid">
        <div className="reveal in">
          <Eyebrow accent={accent} />
          <h1 style={{ fontSize: 'clamp(38px,5.2vw,62px)', lineHeight: 1.04, letterSpacing: '-0.03em',
            fontWeight: 700, margin: '22px 0 0', color: 'var(--text-strong)' }}>
            {HEADLINE}<br/>
            <span style={{ color: accent }}>{HEADLINE2}</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px,1.4vw,19px)', lineHeight: 1.55, color: 'var(--text)',
            margin: '20px 0 0', maxWidth: 480 }}>{SUBHEAD}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '30px 0 22px' }}>
            <CTAButton accent={accent} kind="primary" large>Add to Shopify — free</CTAButton>
            <CTAButton accent={accent} kind="ghost" large>Watch the 90-sec demo</CTAButton>
          </div>
          <TrustLine />
        </div>
        <div className="reveal in" style={{ height: 'min(560px, 74vh)', minHeight: 440 }}>
          <ChatDemo accent={accent} />
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 2 · EDITORIAL ───────────────── */
function EditorialSearch({ accent }) {
  const queries = ['a low-maintenance plant for my office',
    'a hostess gift under $50', 'neutral, modern dinnerware for four'];
  const [qi, setQi] = React.useState(0);
  const [txt, run, reset] = useTypewriter();
  const reduce = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  React.useEffect(() => {
    let alive = true;
    reset();
    const t = setTimeout(() => {
      run(queries[qi], reduce ? 6 : 50, () => {
        const t2 = setTimeout(() => { if (alive) setQi(n => (n + 1) % queries.length); }, reduce ? 1400 : 2600);
      });
    }, 500);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line
  }, [qi]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 'min(620px,92vw)',
      margin: '0 auto', padding: '12px 12px 12px 22px', background: '#fff', borderRadius: 999,
      border: '1px solid var(--border)', boxShadow: '0 18px 50px -18px rgba(26,29,33,.3)' }}>
      <SDLogo size={26} accent={accent} />
      <span style={{ flex: 1, textAlign: 'left', fontSize: 'clamp(14px,1.6vw,17px)',
        color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {txt || 'Ask Field & Form anything…'}
        <span style={{ borderLeft: `2px solid ${accent}`, marginLeft: 1, animation: 'sd-blink 1s step-end infinite' }}></span>
      </span>
      <button style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: accent,
        display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3"
          strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
  );
}

function HeroEditorial({ accent }) {
  const imgs = ['p4', 'p1', 'p2', 'p3', 'p8', 'p6']
    .map(id => CATALOG.find(p => p.id === id)).filter(Boolean);
  return (
    <section style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border-sub)', overflow: 'hidden' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(52px,7vw,96px) 28px 0', textAlign: 'center' }}>
        <div className="reveal in" style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <Eyebrow accent={accent} />
        </div>
        <h1 className="serif reveal in" style={{ fontSize: 'clamp(40px,6.6vw,82px)', lineHeight: 1.02,
          letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>
          Every shopper gets<br/>a <span style={{ color: accent, fontStyle: 'italic' }}>personal</span> shopkeeper.
        </h1>
        <p className="reveal in" style={{ fontSize: 'clamp(16px,1.5vw,20px)', lineHeight: 1.55, color: 'var(--text)',
          margin: '22px auto 0', maxWidth: 560 }}>{SUBHEAD}</p>
        <div className="reveal in" style={{ margin: '30px 0 14px' }}>
          <EditorialSearch accent={accent} />
        </div>
        <div className="reveal in" style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '20px 0 0' }}>
          <CTAButton accent={accent} kind="primary" large>Add to Shopify — free</CTAButton>
          <CTAButton accent={accent} kind="ghost" large>Watch the demo</CTAButton>
        </div>
      </div>
      {/* product image band */}
      <div style={{ display: 'flex', gap: 'clamp(10px,1.4vw,18px)', padding: 'clamp(40px,5vw,70px) 28px 0',
        maxWidth: 1280, margin: '0 auto', alignItems: 'flex-end' }} className="edi-band">
        {imgs.map((p, i) => {
          const h = [210, 270, 320, 270, 210, 160][i] || 220;
          return (
            <div key={p.id} className="reveal in" style={{ flex: 1, height: h, borderRadius: '14px 14px 0 0',
              overflow: 'hidden', position: 'relative', minWidth: 0,
              boxShadow: '0 -10px 40px -22px rgba(0,0,0,.4)', animationDelay: `${i * 0.06}s` }}>
              <img src={p.image} alt={p.title} loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#ece8e1' }} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────── 3 · BOLD ───────────────── */
function FloatCard({ children, style, delay = 0 }) {
  return (
    <div style={{ position: 'absolute', background: '#fff', borderRadius: 14, padding: 12,
      boxShadow: '0 24px 60px -20px rgba(0,0,0,.5)', animation: `sd-float 6s ease-in-out ${delay}s infinite`,
      ...style }}>{children}</div>
  );
}

function HeroBold({ accent }) {
  const p1 = CATALOG.find(p => p.id === 'p3'), p2 = CATALOG.find(p => p.id === 'p1');
  return (
    <section style={{ position: 'relative', overflow: 'hidden',
      background: `radial-gradient(120% 120% at 80% 0%, ${shade(accent,-8)} 0%, ${shade(accent,-46)} 55%, #15151f 100%)`,
      color: '#fff' }}>
      {/* grid texture */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)',
        backgroundSize: '54px 54px', maskImage: 'radial-gradient(120% 90% at 50% 0%, #000 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(120% 90% at 50% 0%, #000 30%, transparent 75%)' }}></div>
      <div style={{ position: 'relative', maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(54px,7vw,100px) 28px', display: 'grid',
        gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: 'clamp(32px,4vw,60px)', alignItems: 'center' }}
        className="hero-grid">
        <div className="reveal in">
          <Eyebrow accent={accent} onDark />
          <h1 style={{ fontSize: 'clamp(40px,5.6vw,68px)', lineHeight: 1.02, letterSpacing: '-0.032em',
            fontWeight: 700, margin: '22px 0 0' }}>
            Turn “I'm looking<br/>for…” into<br/>
            <span style={{ background: `linear-gradient(90deg,#fff, ${shade(accent,55)})`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>added to cart.</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px,1.4vw,19px)', lineHeight: 1.55, color: 'rgba(255,255,255,.8)',
            margin: '20px 0 0', maxWidth: 470 }}>{SUBHEAD}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '30px 0 22px' }}>
            <CTAButton accent="#fff" kind="shopify" large>
              <span style={{ color: '#1a1d21' }}>Add to Shopify — free</span></CTAButton>
            <CTAButton accent={accent} kind="ghost" large onDark>Watch the demo</CTAButton>
          </div>
          <TrustLine onDark />
        </div>
        {/* floating UI cluster */}
        <div className="reveal in bold-cluster" style={{ position: 'relative', height: 'min(520px,68vh)', minHeight: 420 }}>
          <div style={{ position: 'absolute', inset: '0 0 0 6%', height: '100%' }}>
            <ChatDemo accent={accent} />
          </div>
          <FloatCard delay={0.4} style={{ left: -28, top: 38, width: 168, display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src={p1.image} style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover' }} alt=""/>
            <div>
              <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-strong)' }}>{p1.title.split(' in')[0]}</div>
              <div className="tnum" style={{ fontSize: 12, color: accent, fontWeight: 650 }}>${p1.price}</div>
            </div>
          </FloatCard>
          <FloatCard delay={1.2} style={{ right: -22, bottom: 64, padding: '10px 14px', display: 'flex',
            alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#008060',
              boxShadow: '0 0 0 4px rgba(0,128,96,.16)' }}></span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-strong)' }}>3 grounded results</span>
          </FloatCard>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HeroConversation, HeroEditorial, HeroBold, CTAButton, TrustLine, Eyebrow, ShopifyMark });
