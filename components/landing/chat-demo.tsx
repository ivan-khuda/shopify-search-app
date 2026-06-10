/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useRef, useState } from 'react';
import { ACCENT, rgba } from './tokens';
import { CATALOG } from './catalog';
import type { LandingProduct } from './catalog';
import { SDLogo } from './brand';
import { useTypewriter } from './use-typewriter';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'typing' | 'searching' | 'products' | 'streaming' | 'done';

const DEMO_SCRIPT = [
  {
    q: 'A low-maintenance plant for my office',
    ids: ['p3', 'p14', 'p9'],
    a: "The Snake Plant tolerates low light and goes weeks between waterings, and the Pampas Grass is fully dried — no water at all. Both arrive within 5 days.",
  },
  {
    q: 'Hostess gift under $50',
    ids: ['p1', 'p10', 'p11'],
    a: "A few thoughtful picks under $50 — the Stoneware Mug, the Cotton Tea Towel Set, and the Olive Wood Spoon. The tea towels arrive gift-wrapped automatically.",
  },
  {
    q: 'Dinnerware for four — neutral, modern',
    ids: ['p8', 'p13', 'p1'],
    a: "The Ceramic Dinner Plate Set is exactly that — a four-piece matte stoneware set in cream. Pair it with the speckled bowls for a coherent table.",
  },
];

interface MiniProductProps {
  p: LandingProduct;
  accent: string;
  i: number;
}

function MiniProduct({ p, accent, i }: MiniProductProps) {
  return (
    <div
      className="flex gap-[11px] items-center p-2 bg-white border border-(--border-sub) rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.03)] [animation:sd-pop_0.4s_cubic-bezier(.2,.7,.2,1)_both]"
      style={{ animationDelay: `${i * 0.09}s` }}
    >
      <img
        src={p.image}
        alt={p.title}
        loading="lazy"
        className="w-12 h-12 rounded-[8px] object-cover shrink-0 bg-[#f0eee9]"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-(--text-strong) whitespace-nowrap overflow-hidden text-ellipsis">
          {p.title}
        </div>
        <div className="text-[11px] text-(--text-sub) mt-px">{p.type}</div>
      </div>
      <div className="tabular-nums text-[13px] font-[650] text-(--text-strong)">${p.price}</div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        className="shrink-0"
        fill={i === 0 ? accent : 'none'}
        stroke={i === 0 ? accent : 'rgba(0,0,0,.28)'}
        strokeWidth="2"
      >
        <path d="M12 21s-7-4.6-9.5-9C1 9 2.2 5.5 5.5 5.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4C16.8 5.5 18 9 16.5 12 14 16.4 12 21 12 21z"/>
      </svg>
    </div>
  );
}

interface ChatDemoProps {
  accent?: string;
  store?: string;
}

export function ChatDemo({ accent = ACCENT, store = 'Field & Form' }: ChatDemoProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scenario, setScenario] = useState(0);
  const [composer, runComposer, resetComposer] = useTypewriter();
  const [reply, runReply, resetReply] = useTypewriter();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const s = DEMO_SCRIPT[scenario];
  const products = s.ids.map(id => CATALOG.find(p => p.id === id)).filter(Boolean) as LandingProduct[];

  useEffect(() => {
    const wait = (ms: number, fn: () => void) => {
      const t = setTimeout(fn, ms);
      timers.current.push(t);
    };
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

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
    // Omitted deps: reduce (stale-ok, only read on first cycle after mount),
    //   runComposer/runReply/resetComposer/resetReply (stable refs from useTypewriter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const showConvo = phase !== 'idle';

  return (
    <div
      aria-hidden="true"
      className="flex flex-col h-full min-h-0 bg-white rounded-[18px] overflow-hidden border border-(--border) shadow-[0_1px_1px_rgba(0,0,0,0.04),0_18px_50px_-12px_rgba(26,29,33,0.22)]"
    >
      {/* Drawer header */}
      <div className="flex items-center gap-[11px] px-4 py-[14px] border-b border-(--border-sub) shrink-0">
        <SDLogo size={30} accent={accent} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-[650] text-(--text-strong)">Ask {store}</div>
          <div className="flex items-center gap-[6px] text-[11.5px] text-(--text-sub)">
            <span className="w-[7px] h-[7px] rounded-full bg-[#008060] shadow-[0_0_0_3px_rgba(0,128,96,0.16)]"></span>
            Online · powered by AI
          </div>
        </div>
        <div className="flex gap-1">
          {['Chat', 'Saved'].map((t, i) => (
            <span
              key={t}
              className="text-[12px] font-[550] px-[10px] py-[5px] rounded-[8px]"
              style={{
                color: i === 0 ? accent : 'var(--text-sub)',
                background: i === 0 ? rgba(accent, 0.1) : 'transparent',
              }}
            >{t}</span>
          ))}
        </div>
      </div>

      {/* Conversation body */}
      <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col gap-3 bg-[linear-gradient(180deg,#fcfcfd,#fafbfb)]">

        {!showConvo && (
          <div className="m-auto text-center max-w-[280px]">
            <div className="text-[15px] font-[650] text-(--text-strong) mb-1">
              What are you looking for? 👋</div>
            <div className="text-[12.5px] text-(--text-sub) mb-[14px]">
              Describe it in your own words.</div>
            <div className="flex flex-wrap gap-[7px] justify-center">
              {DEMO_SCRIPT.map(d => (
                <span
                  key={d.q}
                  className="text-[11.5px] px-[11px] py-[7px] rounded-full border border-(--border) bg-white text-(--text)"
                >{d.q}</span>
              ))}
            </div>
          </div>
        )}

        {showConvo && (
          <>
            {/* User bubble */}
            <div
              className="self-end max-w-[82%] px-[13px] py-[9px] rounded-tl-[14px] rounded-tr-[14px] rounded-br-[4px] rounded-bl-[14px] text-white text-[13px] leading-[1.45] [animation:sd-pop_0.3s_ease_both]"
              style={{ background: accent }}
            >
              {phase === 'typing' ? (composer || '…') : s.q}
            </div>

            {/* Searching */}
            {phase === 'searching' && (
              <div className="self-start flex items-center gap-[9px] text-[12.5px] text-(--text-sub) [animation:sd-pop_0.3s_ease_both]">
                <span
                  className="w-[15px] h-[15px] rounded-full [animation:sd-spin_0.7s_linear_infinite]"
                  style={{
                    border: `2px solid ${rgba(accent, .25)}`,
                    borderTopColor: accent,
                  }}
                ></span>
                Searching your catalog…
              </div>
            )}

            {/* Products */}
            {(phase === 'products' || phase === 'streaming' || phase === 'done') && (
              <div className="flex flex-col gap-2">
                {products.map((p, i) => <MiniProduct key={p.id} p={p} accent={accent} i={i} />)}
              </div>
            )}

            {/* Assistant reply */}
            {(phase === 'streaming' || phase === 'done') && (
              <div className="self-start max-w-[88%] px-[13px] py-[10px] rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[4px] bg-white border border-(--border-sub) text-[13px] leading-[1.5] text-(--text-strong) [animation:sd-pop_0.3s_ease_both]">
                {reply}
                {phase === 'streaming' && (
                  <span
                    className="inline-block w-[2px] h-[14px] ml-px align-[-2px] [animation:sd-blink_1s_step-end_infinite]"
                    style={{ background: accent }}
                  ></span>
                )}
                {phase === 'done' && (
                  <div className="mt-2 text-[11px] text-(--text-sub) flex items-center gap-[6px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#008060]"></span>
                    {products.length} grounded results
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-(--border-sub) shrink-0">
        <div className={cn(
          'flex items-center gap-2 pt-2 pr-2 pb-2 pl-[14px] rounded-[12px] bg-white [transition:border-color_.2s,box-shadow_.2s]',
          phase === 'typing'
            ? 'border border-(--accent) shadow-[0_0_0_3px_rgba(91,79,233,0.12)]'
            : 'border border-(--border)',
        )}>
          <span className={cn(
            'flex-1 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis',
            phase === 'typing' && composer ? 'text-(--text-strong)' : 'text-(--text-sub)',
          )}>
            {phase === 'typing' ? composer || 'Ask anything…' : 'Ask anything…'}
            {phase === 'typing' && (
              <span
                className="ml-px [animation:sd-blink_1s_step-end_infinite]"
                style={{ borderLeft: `1.5px solid ${accent}` }}
              ></span>
            )}
          </span>
          <button
            type="button"
            tabIndex={-1}
            className="w-8 h-8 rounded-[9px] border-0 grid place-items-center shrink-0"
            style={{ background: accent }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
