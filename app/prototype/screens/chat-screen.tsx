import React from 'react';
import { SDLogo, rgba, shade } from '../prototype-brand';
import {
  CATALOG,
  SUGGESTED_PROMPTS,
  SAMPLE_REPLIES,
  searchCatalog,
  type PrototypeMessage,
  type PrototypeProduct,
  type HistoryEntry,
  type PrototypeModel,
} from '../prototype-data';

export type ChatDensity = 'compact' | 'standard' | 'hero';
export type ChatEmptyStyle = 'cards' | 'minimal' | 'hero';

interface ChatScreenProps {
  accent: string;
  density: ChatDensity;
  emptyStyle: ChatEmptyStyle;
  savedIds: Set<string>;
  onToggleSave: (product: PrototypeProduct) => void;
  history: HistoryEntry[];
  onAddHistory: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
  model: PrototypeModel;
}

type Tab = 'chat' | 'history' | 'saved';

export function ChatScreen({
  accent,
  density,
  emptyStyle,
  savedIds,
  onToggleSave,
  history,
  onAddHistory,
  onClearHistory,
  model,
}: ChatScreenProps) {
  const [tab, setTab] = React.useState<Tab>('chat');
  const [messages, setMessages] = React.useState<PrototypeMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [chatKey, setChatKey] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

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
            onAddHistory({
              id: 'h' + Date.now(),
              query,
              timestamp: 'just now',
              productCount: products.length,
            });
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

  const newChat = () => {
    setMessages([]);
    setChatKey((k) => k + 1);
    setStreaming(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #e1e3e5',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 650,
              color: '#1a1a1a',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Playground
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                color: accent,
                fontWeight: 600,
                background: rgba(accent, 0.1),
                padding: '2px 7px',
                borderRadius: 10,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
              Preview mode — using your real catalog
            </span>
            <span style={{ fontSize: 12, color: '#6d7175' }}>
              · Model: <strong style={{ color: '#202223', fontWeight: 600 }}>{model.name}</strong>
            </span>
          </div>
        </div>

        <ChatTabs
          value={tab}
          onChange={setTab}
          accent={accent}
          historyCount={history.length}
          savedCount={savedIds.size}
        />

        <button
          onClick={newChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 12px',
            background: '#fff',
            border: '1px solid #c9ccd0',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#202223',
            cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'chat' && (
          <ChatPane
            key={chatKey}
            scrollRef={scrollRef}
            messages={messages}
            input={input}
            setInput={setInput}
            sendQuery={sendQuery}
            streaming={streaming}
            accent={accent}
            density={density}
            emptyStyle={emptyStyle}
            savedIds={savedIds}
            onToggleSave={onToggleSave}
          />
        )}
        {tab === 'history' && (
          <HistoryPane
            history={history}
            onClearHistory={onClearHistory}
            onResume={(q) => {
              setTab('chat');
              sendQuery(q);
            }}
            accent={accent}
          />
        )}
        {tab === 'saved' && (
          <SavedPane savedIds={savedIds} onToggleSave={onToggleSave} density={density} accent={accent} />
        )}
      </div>
    </div>
  );
}

interface ChatTabsProps {
  value: Tab;
  onChange: (t: Tab) => void;
  accent: string;
  historyCount: number;
  savedCount: number;
}

function ChatTabs({ value, onChange, accent, historyCount, savedCount }: ChatTabsProps) {
  const tabs: { id: Tab; label: string; icon: 'message' | 'history' | 'bookmark'; badge: number | null }[] = [
    { id: 'chat', label: 'Chat', icon: 'message', badge: null },
    { id: 'history', label: 'History', icon: 'history', badge: historyCount || null },
    { id: 'saved', label: 'Saved', icon: 'bookmark', badge: savedCount || null },
  ];
  return (
    <div style={{ display: 'inline-flex', background: '#f1f2f4', borderRadius: 10, padding: 3 }}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              background: active ? '#fff' : 'transparent',
              color: active ? '#202223' : '#5c5f62',
              fontSize: 12.5,
              fontWeight: active ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: active
                ? '0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)'
                : 'none',
            }}
          >
            <TabIcon name={t.icon} active={active} accent={accent} />
            {t.label}
            {t.badge && (
              <span
                style={{
                  background: active ? rgba(accent, 0.12) : '#dadada',
                  color: active ? accent : '#5c5f62',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 6,
                  marginLeft: 2,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TabIcon({ name, active, accent }: { name: 'message' | 'history' | 'bookmark'; active: boolean; accent: string }) {
  const color = active ? accent : '#5c5f62';
  const props = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'message':
      return (
        <svg {...props}>
          <path d="M21 11.5a8.4 8.4 0 01-9 8.5 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 1121 11.5z" />
        </svg>
      );
    case 'history':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-7 3L3 8" />
          <path d="M3 3v5h5M12 7v5l3 3" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...props}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      );
  }
}

interface ChatPaneProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: PrototypeMessage[];
  input: string;
  setInput: (s: string) => void;
  sendQuery: (q: string) => void;
  streaming: boolean;
  accent: string;
  density: ChatDensity;
  emptyStyle: ChatEmptyStyle;
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
}

function ChatPane({
  scrollRef,
  messages,
  input,
  setInput,
  sendQuery,
  streaming,
  accent,
  density,
  emptyStyle,
  savedIds,
  onToggleSave,
}: ChatPaneProps) {
  const hasMessages = messages.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: hasMessages ? '20px 0' : 0,
          background: '#fafbfb',
        }}
      >
        {!hasMessages && <EmptyChat accent={accent} variant={emptyStyle} onPick={(t) => sendQuery(t)} />}
        {hasMessages && (
          <div
            style={{
              maxWidth: 780,
              margin: '0 auto',
              padding: '0 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                accent={accent}
                density={density}
                savedIds={savedIds}
                onToggleSave={onToggleSave}
              />
            ))}
            {streaming && messages[messages.length - 1]?.role === 'user' && (
              <ThinkingBubble accent={accent} />
            )}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', borderTop: '1px solid #e1e3e5', padding: '16px 24px 20px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div
            className="sd-composer"
            style={{
              background: '#fff',
              border: '1.5px solid #c9ccd0',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              transition: 'border-color 0.2s',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendQuery(input);
                }
              }}
              placeholder='Search your catalog — e.g. "comfortable running shoes for night runs"'
              rows={1}
              style={{
                border: 'none',
                resize: 'none',
                outline: 'none',
                width: '100%',
                fontSize: 14,
                color: '#202223',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                padding: 0,
                minHeight: 22,
                maxHeight: 120,
                background: 'transparent',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={composerToolStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Attach
              </button>
              <button style={composerToolStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                </svg>
                Hybrid search
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8c9196' }}>
                Press <kbd style={kbdStyle}>↵</kbd> to send
              </span>
              <button
                onClick={() => sendQuery(input)}
                disabled={!input.trim() || streaming}
                style={{
                  background: input.trim() && !streaming ? accent : '#dadada',
                  color: '#fff',
                  border: 'none',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const composerToolStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  background: '#f1f2f4',
  border: 'none',
  borderRadius: 7,
  fontSize: 11.5,
  fontWeight: 500,
  color: '#5c5f62',
  cursor: 'pointer',
};

const kbdStyle: React.CSSProperties = {
  padding: '1px 5px',
  background: '#f1f2f4',
  borderRadius: 4,
  border: '1px solid #e1e3e5',
  fontSize: 10,
  fontFamily: 'inherit',
};

function EmptyChat({ accent, variant, onPick }: { accent: string; variant: ChatEmptyStyle; onPick: (s: string) => void }) {
  if (variant === 'minimal') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <SDLogo size={44} accent={accent} />
          <h2
            style={{
              fontSize: 22,
              fontWeight: 650,
              color: '#202223',
              margin: '14px 0 6px',
              letterSpacing: '-0.01em',
            }}
          >
            Ask anything about your catalog
          </h2>
          <p style={{ color: '#6d7175', fontSize: 14, margin: 0 }}>
            Natural language. Hybrid semantic + keyword search.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p.text}
              onClick={() => onPick(p.text)}
              style={{
                background: '#fff',
                border: '1px solid #e1e3e5',
                borderRadius: 10,
                padding: '12px 14px',
                textAlign: 'left',
                fontSize: 13.5,
                color: '#202223',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = rgba(accent, 0.4))}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e1e3e5')}
            >
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              {p.text}
              <span style={{ marginLeft: 'auto', color: '#a5acb1' }}>↗</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -20)} 100%)`,
            color: '#fff',
            borderRadius: 18,
            padding: '32px 32px 28px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -40,
              top: -60,
              width: 200,
              height: 200,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 60,
              bottom: -40,
              width: 140,
              height: 140,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '50%',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.18)',
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
              Live
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 650,
                margin: '14px 0 8px',
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
              }}
            >
              What are your customers
              <br />
              looking for today?
            </h2>
            <p style={{ fontSize: 14, opacity: 0.9, margin: 0, maxWidth: 460, lineHeight: 1.55 }}>
              Test queries the way a real shopper would. Results are pulled from your live synced catalog.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#6d7175',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Try one
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.text}
                onClick={() => onPick(p.text)}
                style={{
                  background: '#fff',
                  border: '1px solid #e1e3e5',
                  borderRadius: 12,
                  padding: '14px',
                  textAlign: 'left',
                  fontSize: 13,
                  color: '#202223',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  transition: 'all 0.15s',
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = rgba(accent, 0.4);
                  e.currentTarget.style.background = rgba(accent, 0.03);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e1e3e5';
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <span style={{ fontSize: 18, marginTop: -1 }}>{p.icon}</span>
                <span>{p.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // cards (default)
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <SDLogo size={40} accent={accent} />
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 650,
              color: '#202223',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Hi there 👋 I&apos;m your SmartDiscovery assistant.
          </h2>
          <p style={{ color: '#5c5f62', fontSize: 13.5, margin: '6px 0 0', lineHeight: 1.55 }}>
            I&apos;ve indexed all <strong style={{ color: '#202223' }}>{CATALOG.length} products</strong> in
            your catalog. Ask me anything a shopper might — here are a few starters to try:
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.text}
            onClick={() => onPick(p.text)}
            style={{
              background: '#fff',
              border: '1px solid #e1e3e5',
              borderRadius: 12,
              padding: '14px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = rgba(accent, 0.45);
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${rgba(accent, 0.08)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e1e3e5';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: rgba(accent, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                {p.icon}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#8c9196',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Try it
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#202223', fontWeight: 500, lineHeight: 1.4 }}>
              {p.text}
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: '10px 14px',
          borderRadius: 10,
          background: rgba(accent, 0.05),
          border: `1px solid ${rgba(accent, 0.15)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12.5,
          color: accent,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h0" />
        </svg>
        <span>
          <strong>Tip:</strong> queries with brand names or SKUs use BM25; descriptive queries use vector
          similarity. Both fuse via RRF.
        </span>
      </div>
    </div>
  );
}

interface MessageProps {
  message: PrototypeMessage;
  accent: string;
  density: ChatDensity;
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
}

function Message({ message, accent, density, savedIds, onToggleSave }: MessageProps) {
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            background: accent,
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '14px 14px 4px 14px',
            fontSize: 14,
            maxWidth: 480,
            lineHeight: 1.5,
            boxShadow: `0 1px 2px ${rgba(accent, 0.3)}`,
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <SDLogo size={28} accent={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {message.status === 'searching' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: '#fff',
              border: '1px solid #e1e3e5',
              borderRadius: 12,
              fontSize: 13,
              color: '#5c5f62',
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: `2px solid ${rgba(accent, 0.2)}`,
                borderTopColor: accent,
                animation: 'sd-spin 0.8s linear infinite',
              }}
            />
            Searching your catalog…
          </div>
        )}

        {message.products && message.products.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: density === 'hero' ? '1fr' : 'repeat(3, 1fr)',
              gap: density === 'compact' ? 8 : 12,
              marginBottom: 12,
            }}
          >
            {message.products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                density={density}
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
              border: '1px solid #e1e3e5',
              borderRadius: '14px 14px 14px 4px',
              padding: '12px 14px',
              fontSize: 14,
              color: '#202223',
              lineHeight: 1.55,
              maxWidth: 600,
            }}
          >
            {message.text}
            {message.status === 'streaming' && (
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 14,
                  background: accent,
                  marginLeft: 3,
                  verticalAlign: 'middle',
                  animation: 'sd-blink 1s steps(2) infinite',
                }}
              />
            )}
          </div>
        )}

        {message.status === 'done' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 11, color: '#8c9196' }}>
            <button style={msgActionStyle}>👍 Helpful</button>
            <button style={msgActionStyle}>👎</button>
            <button style={msgActionStyle}>📋 Copy</button>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#008060' }} />
              {message.products?.length || 0} grounded result{message.products?.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const msgActionStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#8c9196',
  fontSize: 11,
  padding: '2px 6px',
  cursor: 'pointer',
  borderRadius: 4,
};

function ThinkingBubble({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <SDLogo size={28} accent={accent} />
      <div
        style={{
          background: '#fff',
          border: '1px solid #e1e3e5',
          borderRadius: '14px 14px 14px 4px',
          padding: '12px 14px',
          display: 'inline-flex',
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
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

interface ProductCardProps {
  product: PrototypeProduct;
  density: ChatDensity;
  isSaved: boolean;
  onToggleSave: () => void;
  accent: string;
}

export function ProductCard({ product, density, isSaved, onToggleSave, accent }: ProductCardProps) {
  const compact = density === 'compact';
  const hero = density === 'hero';

  if (hero) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1px solid #e1e3e5',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
        }}
      >
        <div style={{ aspectRatio: '1/1', background: '#f6f6f7', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <SaveButton isSaved={isSaved} onClick={onToggleSave} />
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#6d7175',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {product.vendor} · {product.type}
          </div>
          <div style={{ fontSize: 15, fontWeight: 650, color: '#202223', marginBottom: 6 }}>{product.title}</div>
          <p style={{ fontSize: 12.5, color: '#5c5f62', lineHeight: 1.5, margin: 0, flex: 1 }}>
            {product.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 650, color: '#202223' }}>${product.price}</span>
            <button
              style={{
                background: accent,
                color: '#fff',
                border: 'none',
                padding: '7px 12px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View product →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e1e3e5',
        borderRadius: compact ? 8 : 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ aspectRatio: '1/1', background: '#f6f6f7', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <SaveButton isSaved={isSaved} onClick={onToggleSave} small={compact} />
      </div>
      <div
        style={{
          padding: compact ? '8px 10px' : '10px 12px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!compact && (
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: '#8c9196',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            {product.type}
          </div>
        )}
        <div
          style={{
            fontSize: compact ? 12 : 13,
            fontWeight: 600,
            color: '#202223',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {product.title}
        </div>
        {!compact && (
          <div
            style={{
              fontSize: 11.5,
              color: '#6d7175',
              lineHeight: 1.4,
              marginTop: 2,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {product.description}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: compact ? 4 : 8,
          }}
        >
          <span style={{ fontSize: compact ? 13 : 14, fontWeight: 650, color: '#202223' }}>${product.price}</span>
          {!compact && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, letterSpacing: '0.04em' }}>
              VIEW →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveButton({ isSaved, onClick, small }: { isSaved: boolean; onClick: () => void; small?: boolean }) {
  const size = small ? 24 : 28;
  return (
    <button
      onClick={onClick}
      aria-label={isSaved ? 'Unsave' : 'Save'}
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: size,
        height: size,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      <svg
        width={small ? 12 : 14}
        height={small ? 12 : 14}
        viewBox="0 0 24 24"
        fill={isSaved ? '#e53e3e' : 'none'}
        stroke={isSaved ? '#e53e3e' : '#6d7175'}
        strokeWidth="2.2"
      >
        <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0017.5 4 5 5 0 0012 7a5 5 0 00-5.5-3A4.5 4.5 0 002 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}

function HistoryPane({
  history,
  onClearHistory,
  onResume,
  accent,
}: {
  history: HistoryEntry[];
  onClearHistory: () => void;
  onResume: (q: string) => void;
  accent: string;
}) {
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 650, color: '#202223', margin: 0 }}>Search history</h2>
          <p style={{ fontSize: 12.5, color: '#6d7175', margin: '3px 0 0' }}>
            Conversations from this preview session
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            style={{
              background: '#fff',
              border: '1px solid #e1e3e5',
              borderRadius: 7,
              padding: '6px 10px',
              fontSize: 12,
              color: '#c43e3e',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-7 3L3 8" />
              <path d="M3 3v5h5M12 7v5l3 3" />
            </svg>
          }
          title="No history yet"
          subtitle="Ask the assistant a question — it'll show up here."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map((h) => (
            <button
              key={h.id}
              onClick={() => onResume(h.query)}
              style={{
                background: '#fff',
                border: '1px solid #e1e3e5',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = rgba(accent, 0.4);
                e.currentTarget.style.background = rgba(accent, 0.02);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e1e3e5';
                e.currentTarget.style.background = '#fff';
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#f1f2f4',
                  color: '#5c5f62',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    color: '#202223',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.query}
                </div>
                <div style={{ fontSize: 11.5, color: '#8c9196', marginTop: 2 }}>
                  {h.timestamp} · {h.productCount} result{h.productCount === 1 ? '' : 's'}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a5acb1" strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedPane({
  savedIds,
  onToggleSave,
  density,
  accent,
}: {
  savedIds: Set<string>;
  onToggleSave: (p: PrototypeProduct) => void;
  density: ChatDensity;
  accent: string;
}) {
  const products = CATALOG.filter((p) => savedIds.has(p.id));
  return (
    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '24px', width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650, color: '#202223', margin: 0 }}>Saved products</h2>
        <p style={{ fontSize: 12.5, color: '#6d7175', margin: '3px 0 0' }}>
          {products.length} item{products.length === 1 ? '' : 's'} bookmarked from this preview
        </p>
      </div>
      {products.length === 0 ? (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.5-1.5 3-3.3 3-5.5A4.5 4.5 0 0017.5 4 5 5 0 0012 7a5 5 0 00-5.5-3A4.5 4.5 0 002 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />
            </svg>
          }
          title="Nothing saved"
          subtitle="Tap the heart on any product to save it for later."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              density === 'hero' ? '1fr' : density === 'compact' ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
            gap: density === 'compact' ? 8 : 14,
          }}
        >
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              density={density === 'hero' ? 'standard' : density}
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

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px dashed #e1e3e5',
        borderRadius: 12,
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: '#f1f2f4',
          color: '#8c9196',
          margin: '0 auto 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#202223', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#6d7175' }}>{subtitle}</div>
    </div>
  );
}
