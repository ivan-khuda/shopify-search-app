// landing-app.jsx — root: wires Tweaks, sets accent CSS var, assembles the page.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroStyle": "conversation",
  "accent": "#5B4FE9"
}/*EDITMODE-END*/;

const ACCENTS = ['#5B4FE9', '#008060', '#D4823A', '#D9457A', '#1A1A1A'];

// Responsive rules (injected once)
const RESPONSIVE_CSS = `
  @media (max-width: 920px) {
    .hero-grid { grid-template-columns: 1fr !important; }
    .bold-cluster { margin-top: 8px; }
    .nav-links { display: none !important; }
    .how-grid, .feat-grid, .quote-grid, .price-grid, .show-grid, .foot-grid { grid-template-columns: 1fr !important; }
    .foot-grid { grid-template-columns: 1fr 1fr !important; }
    .edi-band { flex-wrap: wrap; }
    .edi-band > div { flex: 1 1 30% !important; height: 180px !important; border-radius: 12px !important; }
  }
  @media (max-width: 560px) {
    .nav-signin { display: none !important; }
    .foot-grid { grid-template-columns: 1fr !important; }
  }
`;

function LandingApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-d', shade(t.accent, -20));
  }, [t.accent]);

  React.useEffect(() => {
    const s = document.createElement('style');
    s.textContent = RESPONSIVE_CSS;
    document.head.appendChild(s);
    // Safety net: ensure every reveal becomes visible even if an observer misfires.
    const t = setTimeout(() => {
      document.querySelectorAll('.reveal:not(.in)').forEach(n => n.classList.add('in'));
    }, 2600);
    return () => { s.remove(); clearTimeout(t); };
  }, []);

  // remount hero when style/accent changes so demo restarts cleanly
  const Hero = { conversation: HeroConversation, editorial: HeroEditorial, bold: HeroBold }[t.heroStyle]
    || HeroConversation;
  const heroKey = t.heroStyle + t.accent;

  return (
    <div id="top">
      <Nav accent={t.accent} hero={t.heroStyle} setHero={(v) => setTweak('heroStyle', v)} />
      <Hero accent={t.accent} key={heroKey} />
      <LogoStrip />
      <HowItWorks accent={t.accent} />
      <Showcase accent={t.accent} />
      <Features accent={t.accent} />
      <Testimonials accent={t.accent} />
      <Pricing accent={t.accent} />
      <FAQ accent={t.accent} />
      <FinalCTA accent={t.accent} />
      <Footer accent={t.accent} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Hero direction" />
        <TweakRadio label="Style" value={t.heroStyle}
          options={['conversation', 'editorial', 'bold']}
          onChange={(v) => setTweak('heroStyle', v)} />
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent} options={ACCENTS}
          onChange={(v) => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LandingApp />);
