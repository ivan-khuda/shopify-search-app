// chat-demo.jsx — reusable auto-playing storefront chat demo for the landing page.
// Cycles through scripted shopper queries: types → sends → searches → products
// pop in → assistant streams a reply, then resets to the next scenario.

const DEMO_SCRIPT = [
  { q: 'A low-maintenance plant for my office', ids: ['p3', 'p14', 'p9'],
    a: "The Snake Plant tolerates low light and goes weeks between waterings, and the Pampas Grass is fully dried — no water at all. Both arrive within 5 days." },
  { q: 'Hostess gift under $50', ids: ['p1', 'p10', 'p11'],
    a: "A few thoughtful picks under $50 — the Stoneware Mug, the Cotton Tea Towel Set, and the Olive Wood Spoon. The tea towels arrive gift-wrapped automatically." },
  { q: 'Dinnerware for four — neutral, modern', ids: ['p8', 'p13', 'p1'],
    a: "The Ceramic Dinner Plate Set is exactly that — a four-piece matte stoneware set in cream. Pair it with the speckled bowls for a coherent table." },
];

function useTypewriter() {
  // returns [text, run(fullText, msPerChar, done)]
  const [text, setText] = React.useState('');
  const timer = React.useRef(null);
  const run = React.useCallback((full, ms, done) => {
    let i = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      i++;
      setText(full.slice(0, i));
      if (i >= full.length) { clearInterval(timer.current); done && done(); }
    }, ms);
  }, []);
  const reset = React.useCallback(() => { clearInterval(timer.current); setText(''); }, []);
  React.useEffect(() => () => clearInterval(timer.current), []);
  return [text, run, reset];
}

function MiniProduct({ p, accent, i }) {
  return (
    <div style={{
      display: 'flex', gap: 11, alignItems: 'center', padding: 8,
      background: '#fff', border: '1px solid var(--border-sub)', borderRadius: 12,
      animation: `sd-pop 0.4s cubic-bezier(.2,.7,.2,1) ${i * 0.09}s both`,
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <img src={p.image} alt={p.title} loading="lazy" style={{
        width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
        background: '#f0eee9',
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>{p.type}</div>
      </div>
      <div className="tnum" style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-strong)' }}>${p.price}</div>
      <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}
        fill={i === 0 ? accent : 'none'} stroke={i === 0 ? accent : 'rgba(0,0,0,.28)'} strokeWidth="2">
        <path d="M12 21s-7-4.6-9.5-9C1 9 2.2 5.5 5.5 5.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4C16.8 5.5 18 9 16.5 12 14 16.4 12 21 12 21z"/>
      </svg>
    </div>
  );
}

function ChatDemo({ accent = '#5B4FE9', store = 'Field & Form' }) {
  const [phase, setPhase] = React.useState('idle'); // idle|typing|searching|products|streaming|done
  const [scenario, setScenario] = React.useState(0);
  const [composer, runComposer, resetComposer] = useTypewriter();
  const [reply, runReply, resetReply] = useTypewriter();
  const timers = React.useRef([]);
  const reduce = React.useRef(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches).current;

  const s = DEMO_SCRIPT[scenario];
  const products = s.ids.map(id => CATALOG.find(p => p.id === id)).filter(Boolean);

  React.useEffect(() => {
    const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.current.push(t); };
    const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };

    // run one full cycle for the current scenario
    resetComposer(); resetReply(); setPhase('idle');
    wait(900, () => {
      setPhase('typing');
      runComposer(s.q, reduce ? 8 : 42, () => {
        wait(550, () => {
          setPhase('searching');
          wait(reduce ? 300 : 1400, () => {
            setPhase('products');
            wait(reduce ? 200 : 900, () => {
              setPhase('streaming');
              runReply(s.a, reduce ? 4 : 18, () => {
                setPhase('done');
                wait(reduce ? 1200 : 4200, () => {
                  setScenario(n => (n + 1) % DEMO_SCRIPT.length);
                });
              });
            });
          });
        });
      });
    });
    return clearAll;
    // eslint-disable-next-line
  }, [scenario]);

  const showConvo = phase !== 'idle';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      background: '#fff', borderRadius: 18, overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 1px 1px rgba(0,0,0,0.04), 0 18px 50px -12px rgba(26,29,33,0.22)',
    }}>
      {/* Drawer header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px',
        borderBottom: '1px solid var(--border-sub)', flexShrink: 0 }}>
        <SDLogo size={30} accent={accent} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-strong)' }}>Ask {store}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-sub)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#008060',
              boxShadow: '0 0 0 3px rgba(0,128,96,.16)' }}></span>
            Online · powered by AI
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['Chat', 'Saved'].map((t, i) => (
            <span key={t} style={{ fontSize: 12, fontWeight: 550, padding: '5px 10px', borderRadius: 8,
              color: i === 0 ? accent : 'var(--text-sub)',
              background: i === 0 ? rgba(accent, 0.1) : 'transparent' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Conversation body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'linear-gradient(180deg,#fcfcfd,#fafbfb)' }}>

        {!showConvo && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 280 }}>
            <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-strong)', marginBottom: 4 }}>
              What are you looking for? 👋</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-sub)', marginBottom: 14 }}>
              Describe it in your own words.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {DEMO_SCRIPT.map(d => (
                <span key={d.q} style={{ fontSize: 11.5, padding: '7px 11px', borderRadius: 999,
                  border: '1px solid var(--border)', background: '#fff', color: 'var(--text)' }}>{d.q}</span>
              ))}
            </div>
          </div>
        )}

        {showConvo && (
          <>
            {/* User bubble */}
            <div style={{ alignSelf: 'flex-end', maxWidth: '82%', padding: '9px 13px',
              borderRadius: '14px 14px 4px 14px', background: accent, color: '#fff',
              fontSize: 13, lineHeight: 1.45, animation: 'sd-pop 0.3s ease both' }}>
              {phase === 'typing' ? (composer || '…') : s.q}
            </div>

            {/* Searching */}
            {phase === 'searching' && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 9,
                fontSize: 12.5, color: 'var(--text-sub)', animation: 'sd-pop 0.3s ease both' }}>
                <span style={{ width: 15, height: 15, border: `2px solid ${rgba(accent,.25)}`,
                  borderTopColor: accent, borderRadius: '50%', animation: 'sd-spin 0.7s linear infinite' }}></span>
                Searching your catalog…
              </div>
            )}

            {/* Products */}
            {(phase === 'products' || phase === 'streaming' || phase === 'done') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {products.map((p, i) => <MiniProduct key={p.id} p={p} accent={accent} i={i} />)}
              </div>
            )}

            {/* Assistant reply */}
            {(phase === 'streaming' || phase === 'done') && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '88%', padding: '10px 13px',
                borderRadius: '14px 14px 14px 4px', background: '#fff', border: '1px solid var(--border-sub)',
                fontSize: 13, lineHeight: 1.5, color: 'var(--text-strong)',
                animation: 'sd-pop 0.3s ease both' }}>
                {reply}
                {phase === 'streaming' && <span style={{ display: 'inline-block', width: 2, height: 14,
                  background: accent, marginLeft: 1, verticalAlign: '-2px',
                  animation: 'sd-blink 1s step-end infinite' }}></span>}
                {phase === 'done' && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-sub)',
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#008060' }}></span>
                    {products.length} grounded results
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border-sub)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 14px',
          border: `1px solid ${phase === 'typing' ? accent : 'var(--border)'}`, borderRadius: 12,
          background: '#fff', transition: 'border-color .2s',
          boxShadow: phase === 'typing' ? `0 0 0 3px ${rgba(accent,.12)}` : 'none' }}>
          <span style={{ flex: 1, fontSize: 13, color: phase === 'typing' && composer ? 'var(--text-strong)' : 'var(--text-sub)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {phase === 'typing' ? composer || 'Ask anything…' : 'Ask anything…'}
            {phase === 'typing' && <span style={{ borderLeft: `1.5px solid ${accent}`, marginLeft: 1,
              animation: 'sd-blink 1s step-end infinite' }}></span>}
          </span>
          <button style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: accent,
            display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatDemo });
