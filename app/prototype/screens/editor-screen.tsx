import React from 'react';
import { SDLogo, rgba } from '../prototype-brand';
import { CATALOG } from '../prototype-data';
import { FAB, type FabStyle } from './storefront-screen';

interface ThemeEditorScreenProps {
  accent: string;
  fabStyle: FabStyle;
}

export function ThemeEditorScreen({ accent, fabStyle }: ThemeEditorScreenProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1d21',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 48,
          background: '#1a1d21',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 16,
          flexShrink: 0,
          borderBottom: '1px solid #000',
        }}
      >
        <button
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            border: 'none',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Exit editor
        </button>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          <span style={{ opacity: 0.6 }}>Dawn</span> · Live theme
        </div>
        <div style={{ flex: 1 }} />

        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: 2 }}>
          {(['desktop', 'tablet', 'mobile'] as const).map((d, i) => (
            <button
              key={d}
              style={{
                background: i === 0 ? 'rgba(255,255,255,0.16)' : 'transparent',
                color: '#fff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <DeviceIcon name={d} />
            </button>
          ))}
        </div>

        <button
          style={{
            background: '#fff',
            color: '#1a1d21',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '264px 1fr 312px', overflow: 'hidden' }}>
        <div
          style={{
            background: '#202326',
            borderRight: '1px solid #000',
            color: '#fff',
            padding: '14px 8px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '0 6px 8px',
            }}
          >
            Template · Home page
          </div>
          {[
            { name: 'Header', soft: true },
            { name: 'Image banner', soft: false },
            { name: 'Featured collection', soft: false },
            { name: 'Multicolumn', soft: false },
            { name: 'Newsletter', soft: false },
            { name: 'Footer', soft: true },
          ].map((s) => (
            <button
              key={s.name}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: s.soft ? 'rgba(255,255,255,0.55)' : '#fff',
                padding: '6px 10px',
                fontSize: 12.5,
                borderRadius: 5,
                cursor: 'pointer',
                marginBottom: 1,
              }}
            >
              {s.name}
            </button>
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 6px' }} />

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '0 6px 8px',
            }}
          >
            App Embeds
          </div>
          <button
            style={{
              width: '100%',
              textAlign: 'left',
              background: rgba(accent, 0.16),
              border: `1px solid ${rgba(accent, 0.3)}`,
              color: '#fff',
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              fontSize: 12.5,
            }}
          >
            <SDLogo size={18} accent={accent} />
            <span style={{ flex: 1, fontWeight: 600 }}>SmartDiscovery</span>
            <span
              style={{
                width: 24,
                height: 12,
                borderRadius: 6,
                background: accent,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 1,
                  left: 13,
                  width: 10,
                  height: 10,
                  background: '#fff',
                  borderRadius: '50%',
                }}
              />
            </span>
          </button>
        </div>

        <div style={{ background: '#fff', overflow: 'auto', position: 'relative' }}>
          <MiniStorefront />
          <FAB style={fabStyle} accent={accent} onClick={() => undefined} viewport="desktop" />
        </div>

        <div
          style={{
            background: '#fff',
            borderLeft: '1px solid #ededed',
            padding: '16px 16px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <SDLogo size={28} accent={accent} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: '#1a1a1a' }}>SmartDiscovery</div>
                <div style={{ fontSize: 11, color: '#6d7175' }}>App embed</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#5c5f62', margin: '10px 0 0', lineHeight: 1.5 }}>
              Adds an AI-powered chat drawer to your storefront. Visitors describe what they want; we surface
              real products from your synced catalog.
            </p>
          </div>

          <div style={{ height: 1, background: '#ededed' }} />

          <EditorSetting label="Status">
            <EditorToggle defaultOn accent={accent} label="Visible on storefront" />
          </EditorSetting>

          <EditorSetting label="Accent color" help="Used for the FAB and bot messages.">
            <div style={{ display: 'flex', gap: 6 }}>
              {['#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A'].map((c) => (
                <div
                  key={c}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: c,
                    cursor: 'pointer',
                    border: c === accent ? '2.5px solid #1a1a1a' : '1px solid rgba(0,0,0,0.1)',
                    boxShadow: c === accent ? '0 0 0 2px #fff inset' : 'none',
                  }}
                />
              ))}
            </div>
          </EditorSetting>

          <EditorSetting label="Button style" help="How the launcher appears on your storefront.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { id: 'circle', label: 'Circle', sub: 'Compact icon-only FAB' },
                { id: 'pill', label: 'Pill', sub: '"Ask the store" label' },
                { id: 'labeled', label: 'Labeled', sub: 'Wide CTA with subtitle' },
              ].map((o) => {
                const active = o.id === fabStyle;
                return (
                  <div
                    key={o.id}
                    style={{
                      background: active ? rgba(accent, 0.06) : '#fafbfb',
                      border: `1.5px solid ${active ? accent : '#ededed'}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: `2px solid ${active ? accent : '#c9ccd0'}`,
                        background: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a1a' }}>{o.label}</div>
                      <div style={{ fontSize: 11, color: '#8c9196' }}>{o.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </EditorSetting>

          <EditorSetting label="Position" help="Where the FAB sits on your storefront.">
            <div style={{ display: 'inline-flex', background: '#f1f2f4', borderRadius: 7, padding: 2 }}>
              {['Bottom right', 'Bottom left'].map((p, i) => (
                <button
                  key={p}
                  style={{
                    background: i === 0 ? '#fff' : 'transparent',
                    color: '#202223',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: 5,
                    fontSize: 11.5,
                    fontWeight: i === 0 ? 600 : 500,
                    cursor: 'pointer',
                    boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </EditorSetting>

          <EditorSetting label="Bottom offset" help="Pixels from the bottom of the viewport (24 default).">
            <div
              style={{
                background: '#fafbfb',
                border: '1px solid #ededed',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <input type="range" min={0} max={120} defaultValue={24} style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 12,
                  color: '#202223',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  width: 36,
                  textAlign: 'right',
                }}
              >
                24px
              </span>
            </div>
          </EditorSetting>

          <div
            style={{
              background: '#fafbfb',
              border: '1px solid #ededed',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              gap: 8,
              fontSize: 11.5,
              color: '#5c5f62',
              lineHeight: 1.45,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6d7175"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 1, flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h0" />
            </svg>
            More options (greeting copy, suggested prompts, model) live in the SmartDiscovery admin under{' '}
            <strong>Settings</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceIcon({ name }: { name: 'desktop' | 'tablet' | 'mobile' }) {
  const p = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'desktop':
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      );
    case 'tablet':
      return (
        <svg {...p}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M11 18h2" />
        </svg>
      );
    case 'mobile':
      return (
        <svg {...p}>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M11 18h2" />
        </svg>
      );
  }
}

function EditorSetting({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{label}</div>
      {help && (
        <div style={{ fontSize: 11.5, color: '#8c9196', marginBottom: 8, lineHeight: 1.45 }}>{help}</div>
      )}
      {children}
    </div>
  );
}

function EditorToggle({ defaultOn, accent, label }: { defaultOn: boolean; accent: string; label: string }) {
  const [on, setOn] = React.useState(defaultOn);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={() => setOn(!on)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          padding: 0,
          border: 'none',
          background: on ? accent : '#c9ccd0',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 18 : 2,
            width: 16,
            height: 16,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            transition: 'left 0.2s',
          }}
        />
      </button>
      <span style={{ fontSize: 13, color: '#202223' }}>{label}</span>
    </div>
  );
}

function MiniStorefront() {
  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100%' }}>
      <div
        style={{
          background: '#1a1a1a',
          color: '#fff',
          textAlign: 'center',
          padding: '6px',
          fontSize: 11,
        }}
      >
        Free shipping on orders over $75
      </div>
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #ededed',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 20,
            color: '#1a1a1a',
          }}
        >
          Demo Store
        </div>
        <nav style={{ display: 'flex', gap: 18, marginLeft: 18, fontSize: 12, color: '#404040' }}>
          <span>Shop</span>
          <span>Footwear</span>
          <span>Apparel</span>
          <span>Accessories</span>
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#f5f5f0' }} />
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#f5f5f0' }} />
          <span style={{ width: 22, height: 22, borderRadius: 6, background: '#f5f5f0' }} />
        </div>
      </div>
      <div style={{ padding: '36px 20px 28px', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 10,
            color: '#8c8c8c',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Spring Collection · 2026
        </div>
        <h1
          style={{
            fontFamily: '"DM Serif Display", Georgia, serif',
            fontSize: 38,
            color: '#1a1a1a',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            fontWeight: 400,
          }}
        >
          Built for the road,
          <br />
          made to last.
        </h1>
      </div>
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {CATALOG.slice(0, 6).map((p) => (
          <div key={p.id}>
            <div
              style={{
                aspectRatio: '1/1',
                background: '#f5f5f0',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image}
                alt={p.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ fontSize: 12.5, color: '#1a1a1a' }}>{p.title}</div>
            <div style={{ fontSize: 12, color: '#5c5c5c', marginTop: 2 }}>${p.price}.00</div>
          </div>
        ))}
      </div>
    </div>
  );
}
