import React from 'react';
import { SDLogo, rgba, shade } from '../prototype-brand';
import {
  CATALOG,
  SUGGESTED_PROMPTS,
  SAMPLE_REPLIES,
  searchCatalog,
  type PrototypeProduct,
  type PrototypeMessage,
  type HistoryEntry,
} from '../prototype-data';

export type FabStyle = 'circle' | 'pill' | 'labeled';
export type DrawerPosition = 'side' | 'bottom-sheet' | 'center-modal';
export type StorefrontViewport = 'desktop' | 'mobile';

interface StorefrontScreenProps {
  accent: string;
  fabStyle: FabStyle;
  drawerPosition: DrawerPosition;
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
  viewport: StorefrontViewport;
}

export function StorefrontScreen({
  accent,
  fabStyle,
  drawerPosition,
  savedIds,
  onToggleSave,
  viewport,
}: StorefrontScreenProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState<'chat' | 'history' | 'saved'>('chat');
  const [messages, setMessages] = React.useState<PrototypeMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [localHistory, setLocalHistory] = React.useState<HistoryEntry[]>([]);

  const sendQuery = (q: string) => {
    const query = q.trim();
    if (!query || streaming) return;
    setInput('');
    setMessages((prev) => [...prev, { id: 'u' + Date.now(), role: 'user', text: query }]);
    setStreaming(true);

    const products = searchCatalog(query);
    const reply = SAMPLE_REPLIES[query] ?? SAMPLE_REPLIES.default;
    const assistantId = 'a' + Date.now();

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', text: '', products: [], status: 'searching' },
      ]);
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, products, status: 'streaming' } : m)),
        );
        const words = reply.split(' ');
        let i = 0;
        const tick = () => {
          if (i >= words.length) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, status: 'done' } : m)),
            );
            setStreaming(false);
            setLocalHistory((h) => [
              { id: 'h' + Date.now(), query, productCount: products.length, timestamp: 'just now' },
              ...h,
            ]);
            return;
          }
          i += 1;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: words.slice(0, i).join(' ') } : m)),
          );
          setTimeout(tick, 28 + Math.random() * 30);
        };
        tick();
      }, 700);
    }, 200);
  };

  const isMobile = viewport === 'mobile';

  return (
    <div
      style={{
        flex: 1,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <DawnStorefront viewport={viewport} />

      {!drawerOpen && (
        <FAB style={fabStyle} accent={accent} onClick={() => setDrawerOpen(true)} viewport={viewport} />
      )}

      {drawerOpen && (
        <ChatDrawer
          position={isMobile ? 'bottom-sheet' : drawerPosition}
          accent={accent}
          tab={drawerTab}
          setTab={setDrawerTab}
          messages={messages}
          input={input}
          setInput={setInput}
          sendQuery={sendQuery}
          streaming={streaming}
          history={localHistory}
          onResume={(q) => {
            setDrawerTab('chat');
            sendQuery(q);
          }}
          onClearHistory={() => setLocalHistory([])}
          savedIds={savedIds}
          onToggleSave={onToggleSave}
          onClose={() => setDrawerOpen(false)}
          viewport={viewport}
        />
      )}
    </div>
  );
}

function DawnStorefront({ viewport }: { viewport: StorefrontViewport }) {
  const isMobile = viewport === 'mobile';
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: '#fff',
        fontFamily: '"DM Serif Display", Georgia, serif',
      }}
    >
      <div
        style={{
          background: '#1a1a1a',
          color: '#fff',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: 12,
          letterSpacing: '0.04em',
          fontFamily: 'system-ui',
        }}
      >
        Free shipping on orders over $75 — through Sunday
      </div>

      <div
        style={{
          padding: isMobile ? '12px 16px' : '18px 32px',
          borderBottom: '1px solid #ededed',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {isMobile && (
          <button style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}
        <div
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: isMobile ? 20 : 24,
            fontWeight: 400,
            color: '#1a1a1a',
            letterSpacing: '-0.01em',
          }}
        >
          Demo Store
        </div>
        {!isMobile && (
          <nav
            style={{
              display: 'flex',
              gap: 24,
              marginLeft: 32,
              fontFamily: 'system-ui',
              fontSize: 13.5,
              color: '#404040',
            }}
          >
            <a style={navLinkStyle}>Shop</a>
            <a style={navLinkStyle}>Footwear</a>
            <a style={navLinkStyle}>Apparel</a>
            <a style={navLinkStyle}>Accessories</a>
            <a style={navLinkStyle}>Journal</a>
          </nav>
        )}
        <div style={{ flex: 1 }} />
        <button style={iconNavStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
        <button style={iconNavStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        <button style={{ ...iconNavStyle, position: 'relative' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <path d="M3 6h18M16 10a4 4 0 01-8 0" />
          </svg>
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              fontSize: 9,
              fontWeight: 700,
              background: '#1a1a1a',
              color: '#fff',
              width: 14,
              height: 14,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'system-ui',
            }}
          >
            2
          </span>
        </button>
      </div>

      <div
        style={{
          padding: isMobile ? '32px 16px 24px' : '52px 32px 40px',
          textAlign: 'center',
          borderBottom: '1px solid #ededed',
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            color: '#8c8c8c',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontFamily: 'system-ui',
            marginBottom: 16,
          }}
        >
          Spring Collection · 2026
        </div>
        <h1
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: isMobile ? 32 : 52,
            fontWeight: 400,
            color: '#1a1a1a',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Built for the road,
          <br />
          made to last.
        </h1>
        <p
          style={{
            fontFamily: 'system-ui',
            fontSize: isMobile ? 13.5 : 15,
            color: '#5c5c5c',
            maxWidth: 520,
            margin: '18px auto 0',
            lineHeight: 1.6,
          }}
        >
          Footwear, outerwear, and small leather goods designed for people who actually use their stuff.
        </p>
      </div>

      <div style={{ padding: isMobile ? '24px 16px' : '40px 32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 24,
            fontFamily: 'system-ui',
          }}
        >
          <h2
            style={{
              fontFamily: '"DM Serif Display", Georgia, serif',
              fontSize: isMobile ? 22 : 28,
              fontWeight: 400,
              color: '#1a1a1a',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Shop all
          </h2>
          {!isMobile && (
            <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: '#404040' }}>
              <button style={pillStyle}>Filter</button>
              <button style={pillStyle}>Sort: Featured ↓</button>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? 12 : 24,
          }}
        >
          {CATALOG.slice(0, isMobile ? 6 : 12).map((p) => (
            <DawnProduct key={p.id} product={p} isMobile={isMobile} />
          ))}
        </div>
      </div>

      <div
        style={{
          background: '#fafafa',
          borderTop: '1px solid #ededed',
          padding: isMobile ? '24px 16px' : '40px 32px',
          marginTop: 24,
          fontFamily: 'system-ui',
          fontSize: 12,
          color: '#5c5c5c',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: 16,
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 20,
            color: '#1a1a1a',
          }}
        >
          Demo Store
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <span>About</span>
          <span>Stockists</span>
          <span>Shipping</span>
          <span>Returns</span>
          <span>Journal</span>
          <span>Contact</span>
        </div>
        <div style={{ textAlign: 'center', color: '#a0a0a0', fontSize: 11 }}>
          © 2026 Demo Store · A SmartDiscovery preview
        </div>
      </div>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = { color: '#1a1a1a', textDecoration: 'none', cursor: 'pointer' };
const iconNavStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 6,
  cursor: 'pointer',
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const pillStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #d4d4d4',
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: 12.5,
  color: '#1a1a1a',
  cursor: 'pointer',
  fontFamily: 'system-ui',
};

function DawnProduct({ product, isMobile }: { product: PrototypeProduct; isMobile: boolean }) {
  return (
    <div style={{ cursor: 'pointer', fontFamily: 'system-ui' }}>
      <div
        style={{
          aspectRatio: '1/1',
          background: '#f5f5f0',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div style={{ fontSize: isMobile ? 12.5 : 13.5, color: '#1a1a1a', marginBottom: 3 }}>
        {product.title}
      </div>
      <div style={{ fontSize: isMobile ? 12 : 13, color: '#5c5c5c' }}>${product.price}.00</div>
    </div>
  );
}

interface FABProps {
  style: FabStyle;
  accent: string;
  onClick: () => void;
  viewport: StorefrontViewport;
}

export function FAB({ style, accent, onClick, viewport }: FABProps) {
  const offset = viewport === 'mobile' ? 16 : 24;

  if (style === 'pill') {
    return (
      <button
        onClick={onClick}
        style={{
          position: 'absolute',
          bottom: offset,
          right: offset,
          zIndex: 50,
          background: '#1a1a1a',
          color: '#fff',
          border: 'none',
          padding: '12px 18px',
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          boxShadow: '0 10px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
          fontFamily: 'system-ui',
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.5l-1.8-4.4L6 9.3l4.2-1.8z" />
          </svg>
        </span>
        Ask the store
      </button>
    );
  }

  if (style === 'labeled') {
    return (
      <button
        onClick={onClick}
        style={{
          position: 'absolute',
          bottom: offset,
          right: offset,
          zIndex: 50,
          background: accent,
          color: '#fff',
          border: 'none',
          padding: '0 0 0 6px',
          borderRadius: 16,
          height: 56,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          boxShadow: `0 12px 30px ${rgba(accent, 0.35)}, 0 2px 6px rgba(0,0,0,0.08)`,
          fontFamily: 'system-ui',
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M15 15l5 5" />
            <path d="M11 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
          </svg>
        </span>
        <span style={{ padding: '0 18px 0 12px', textAlign: 'left', lineHeight: 1.1 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              opacity: 0.85,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 2,
            }}
          >
            Powered by AI
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Find anything</span>
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: offset,
        right: offset,
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        background: accent,
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 12px 30px ${rgba(accent, 0.35)}, 0 2px 6px rgba(0,0,0,0.1)`,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M15.5 15.5L20 20" />
        <path d="M11 7.5L12.2 10.3 15 11 12.2 11.7 11 14.5 9.8 11.7 7 11 9.8 10.3z" fill="currentColor" />
      </svg>
    </button>
  );
}

interface ChatDrawerProps {
  position: DrawerPosition;
  accent: string;
  tab: 'chat' | 'history' | 'saved';
  setTab: (t: 'chat' | 'history' | 'saved') => void;
  messages: PrototypeMessage[];
  input: string;
  setInput: (s: string) => void;
  sendQuery: (q: string) => void;
  streaming: boolean;
  history: HistoryEntry[];
  onResume: (q: string) => void;
  onClearHistory: () => void;
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
  onClose: () => void;
  viewport: StorefrontViewport;
}

function ChatDrawer(props: ChatDrawerProps) {
  const { position, viewport } = props;
  const isMobile = viewport === 'mobile';

  if (position === 'center-modal') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 60,
          background: 'rgba(20,20,20,0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        onClick={props.onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(540px, 100%)',
            height: 'min(680px, calc(100% - 64px))',
            background: '#fff',
            borderRadius: 18,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            animation: 'sd-pop 0.25s ease-out',
          }}
        >
          <DrawerInner {...props} />
        </div>
      </div>
    );
  }

  if (position === 'bottom-sheet' || isMobile) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: 'rgba(20,20,20,0.4)',
        }}
        onClick={props.onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: '18px 18px 0 0',
            height: isMobile ? '88%' : '78%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
            animation: 'sd-slide-up 0.28s cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          {isMobile && (
            <div style={{ padding: '8px 0 0', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d4d4d4' }} />
            </div>
          )}
          <DrawerInner {...props} />
        </div>
      </div>
    );
  }

  // side
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(20,20,20,0.25)',
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '100%',
          height: '100%',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
          animation: 'sd-slide-left 0.28s cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <DrawerInner {...props} />
      </div>
    </div>
  );
}

function DrawerInner({
  accent,
  tab,
  setTab,
  messages,
  input,
  setInput,
  sendQuery,
  streaming,
  history,
  onResume,
  onClearHistory,
  savedIds,
  onToggleSave,
  onClose,
}: ChatDrawerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming, tab]);

  return (
    <>
      <div
        style={{
          padding: '12px 14px 12px 16px',
          borderBottom: '1px solid #ededed',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <SDLogo size={28} accent={accent} />
        <div style={{ flex: 1, lineHeight: 1.1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: '#1a1a1a' }}>Ask the store</div>
          <div
            style={{
              fontSize: 11,
              color: '#8c8c8c',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            AI-powered · usually replies instantly
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: '#f5f5f5',
            border: 'none',
            width: 30,
            height: 30,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#404040" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #ededed',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        {[
          { id: 'chat', label: 'Chat', badge: null as number | null },
          { id: 'history', label: 'History', badge: history.length || null },
          { id: 'saved', label: 'Saved', badge: savedIds.size || null },
        ].map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                padding: '10px 8px',
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? '#1a1a1a' : '#8c8c8c',
                cursor: 'pointer',
                position: 'relative',
                fontFamily: 'system-ui',
              }}
            >
              {t.label}
              {t.badge ? (
                <span
                  style={{
                    background: rgba(accent, 0.12),
                    color: accent,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 5,
                    marginLeft: 4,
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: '15%',
                    right: '15%',
                    height: 2,
                    background: accent,
                    borderRadius: 1,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === 'chat' && (
        <DrawerChat
          accent={accent}
          messages={messages}
          input={input}
          setInput={setInput}
          sendQuery={sendQuery}
          streaming={streaming}
          savedIds={savedIds}
          onToggleSave={onToggleSave}
          scrollRef={scrollRef}
        />
      )}
      {tab === 'history' && (
        <DrawerHistory history={history} onResume={onResume} onClearHistory={onClearHistory} accent={accent} />
      )}
      {tab === 'saved' && <DrawerSaved savedIds={savedIds} onToggleSave={onToggleSave} accent={accent} />}
    </>
  );
}

interface DrawerChatProps {
  accent: string;
  messages: PrototypeMessage[];
  input: string;
  setInput: (s: string) => void;
  sendQuery: (q: string) => void;
  streaming: boolean;
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

function DrawerChat({
  accent,
  messages,
  input,
  setInput,
  sendQuery,
  streaming,
  savedIds,
  onToggleSave,
  scrollRef,
}: DrawerChatProps) {
  const hasMessages = messages.length > 0;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        fontFamily: 'system-ui',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: hasMessages ? '14px 14px 14px' : 0,
          background: '#fafafa',
        }}
      >
        {!hasMessages && <DrawerEmpty accent={accent} onPick={sendQuery} />}
        {hasMessages && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m) => (
              <DrawerMessage
                key={m.id}
                message={m}
                accent={accent}
                savedIds={savedIds}
                onToggleSave={onToggleSave}
              />
            ))}
            {streaming && messages[messages.length - 1]?.role === 'user' && (
              <DrawerThinking accent={accent} />
            )}
          </div>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          borderTop: '1px solid #ededed',
          padding: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1.5px solid #d4d4d4',
            borderRadius: 12,
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendQuery(input);
              }
            }}
            placeholder="Ask anything…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 13.5,
              fontFamily: 'inherit',
              color: '#1a1a1a',
              padding: '6px 4px',
              background: 'transparent',
            }}
          />
          <button
            onClick={() => sendQuery(input)}
            disabled={!input.trim() || streaming}
            style={{
              background: input.trim() && !streaming ? accent : '#d4d4d4',
              color: '#fff',
              border: 'none',
              width: 30,
              height: 30,
              borderRadius: 8,
              cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: '#a0a0a0', textAlign: 'center', marginTop: 8 }}>
          Powered by SmartDiscovery AI · Conversations stay on your store
        </div>
      </div>
    </div>
  );
}

function DrawerEmpty({ accent, onPick }: { accent: string; onPick: (s: string) => void }) {
  return (
    <div style={{ padding: '28px 18px', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -22)} 100%)`,
            margin: '0 auto 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 24px ${rgba(accent, 0.3)}`,
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M15 15l5 5" />
            <path d="M11 7.5l1.2 2.8L15 11l-2.8.7L11 14.5l-1.2-2.8L7 11l2.8-.7z" fill="#fff" />
          </svg>
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 650,
            color: '#1a1a1a',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Hi there 👋
        </h3>
        <p style={{ fontSize: 13, color: '#5c5c5c', margin: '6px 0 0', lineHeight: 1.5 }}>
          Tell me what you&apos;re looking for. I&apos;ll find it in the catalog.
        </p>
      </div>

      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: '#8c8c8c',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Try asking
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.text}
            onClick={() => onPick(p.text)}
            style={{
              background: '#fff',
              border: '1px solid #ededed',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              fontSize: 13,
              color: '#1a1a1a',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = rgba(accent, 0.4))}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#ededed')}
          >
            <span style={{ fontSize: 15 }}>{p.icon}</span>
            <span style={{ flex: 1 }}>{p.text}</span>
            <span style={{ color: '#a0a0a0', fontSize: 13 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DrawerMessage({
  message,
  accent,
  savedIds,
  onToggleSave,
}: {
  message: PrototypeMessage;
  accent: string;
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
}) {
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            background: accent,
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '14px 14px 4px 14px',
            fontSize: 13.5,
            maxWidth: '85%',
            lineHeight: 1.45,
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <SDLogo size={26} accent={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {message.status === 'searching' && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #ededed',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12.5,
              color: '#5c5c5c',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                border: `2px solid ${rgba(accent, 0.2)}`,
                borderTopColor: accent,
                animation: 'sd-spin 0.8s linear infinite',
              }}
            />
            Searching…
          </div>
        )}
        {message.products && message.products.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {message.products.map((p) => (
              <DrawerProduct
                key={p.id}
                product={p}
                isSaved={savedIds.has(p.id)}
                onToggleSave={() => onToggleSave(p)}
                accent={accent}
              />
            ))}
          </div>
        )}
        {message.text && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #ededed',
              borderRadius: '10px 10px 10px 2px',
              padding: '8px 12px',
              fontSize: 13,
              color: '#1a1a1a',
              lineHeight: 1.5,
            }}
          >
            {message.text}
            {message.status === 'streaming' && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 12,
                  background: accent,
                  marginLeft: 3,
                  verticalAlign: 'middle',
                  animation: 'sd-blink 1s steps(2) infinite',
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerProduct({
  product,
  isSaved,
  onToggleSave,
  accent,
}: {
  product: PrototypeProduct;
  isSaved: boolean;
  onToggleSave: () => void;
  accent: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #ededed',
        borderRadius: 10,
        padding: 8,
        display: 'grid',
        gridTemplateColumns: '64px 1fr auto',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          aspectRatio: '1/1',
          background: '#f5f5f0',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: '#8c8c8c',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {product.type}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#1a1a1a',
            marginTop: 2,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {product.title}
        </div>
        <div style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 600, marginTop: 2 }}>
          ${product.price}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={onToggleSave}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid #ededed',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isSaved ? '#e53e3e' : 'none'}
            stroke={isSaved ? '#e53e3e' : '#8c8c8c'}
            strokeWidth="2"
          >
            <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0017.5 4 5 5 0 0012 7a5 5 0 00-5.5-3A4.5 4.5 0 002 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />
          </svg>
        </button>
        <button
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: 'none',
            background: accent,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DrawerThinking({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <SDLogo size={26} accent={accent} />
      <div
        style={{
          background: '#fff',
          border: '1px solid #ededed',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'inline-flex',
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: rgba(accent, 0.6),
              animation: `sd-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DrawerHistory({
  history,
  onResume,
  onClearHistory,
}: {
  history: HistoryEntry[];
  onResume: (q: string) => void;
  onClearHistory: () => void;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '14px',
        fontFamily: 'system-ui',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#8c8c8c',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Past conversations
        </span>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#c43e3e',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Clear
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8c8c', fontSize: 13 }}>
          Your conversations show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map((h) => (
            <button
              key={h.id}
              onClick={() => onResume(h.query)}
              style={{
                background: '#fff',
                border: '1px solid #ededed',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: '#f5f5f0',
                  color: '#5c5c5c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: '#1a1a1a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {h.query}
                </div>
                <div style={{ fontSize: 11, color: '#a0a0a0', marginTop: 1 }}>
                  {h.timestamp} · {h.productCount} results
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DrawerSaved({
  savedIds,
  onToggleSave,
  accent,
}: {
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
  accent: string;
}) {
  const products = CATALOG.filter((p) => savedIds.has(p.id));
  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '14px',
        fontFamily: 'system-ui',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#8c8c8c',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Your saved items
      </div>
      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8c8c8c', fontSize: 13 }}>
          Tap the heart on a product to save it here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {products.map((p) => (
            <DrawerProduct
              key={p.id}
              product={p}
              isSaved={true}
              onToggleSave={() => onToggleSave(p)}
              accent={accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
