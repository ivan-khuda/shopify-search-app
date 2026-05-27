import React from 'react';
import { rgba } from '../prototype-brand';
import { MODELS, SUGGESTED_PROMPTS, type PrototypeModel } from '../prototype-data';

export interface UsageStats {
  used: number;
  cap: number;
  storefront: number;
  admin: number;
  latency: number;
}

interface SettingsScreenProps {
  accent: string;
  model: PrototypeModel;
  setModelId: (id: string) => void;
  usage: UsageStats;
}

type Section = 'model' | 'drawer' | 'limits' | 'webhooks' | 'general';
type SettingsIconName = 'sparkle' | 'paint' | 'gauge' | 'sync' | 'gear';

export function SettingsScreen({ accent, model, setModelId, usage }: SettingsScreenProps) {
  const [section, setSection] = React.useState<Section>('model');

  const navItems: { id: Section; label: string; icon: SettingsIconName }[] = [
    { id: 'model', label: 'AI model', icon: 'sparkle' },
    { id: 'drawer', label: 'Drawer styling', icon: 'paint' },
    { id: 'limits', label: 'Usage & limits', icon: 'gauge' },
    { id: 'webhooks', label: 'Sync & webhooks', icon: 'sync' },
    { id: 'general', label: 'General', icon: 'gear' },
  ];

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '28px 28px 80px',
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 28,
      }}
    >
      <nav>
        <div
          style={{
            fontSize: 22,
            fontWeight: 650,
            color: '#1a1a1a',
            margin: '0 0 16px',
            letterSpacing: '-0.012em',
          }}
        >
          Settings
        </div>
        {navItems.map((item) => {
          const active = item.id === section;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                border: 'none',
                textAlign: 'left',
                background: active ? rgba(accent, 0.08) : 'transparent',
                color: active ? accent : '#404952',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 2,
              }}
            >
              <SettingsIcon name={item.icon} size={14} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div>
        {section === 'model' && <ModelSection accent={accent} model={model} setModelId={setModelId} />}
        {section === 'drawer' && <DrawerSection accent={accent} />}
        {section === 'limits' && <LimitsSection accent={accent} usage={usage} />}
        {section === 'webhooks' && <WebhooksSection />}
        {section === 'general' && <GeneralSection accent={accent} />}
      </div>
    </div>
  );
}

function SettingsIcon({ name, size = 14 }: { name: SettingsIconName; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'sparkle':
      return (
        <svg {...p}>
          <path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.5l-1.8-4.4L6 9.3l4.2-1.8z" />
          <path d="M19 16l.8 1.7L21.5 18.5l-1.7.8L19 21l-.8-1.7L16.5 18.5l1.7-.8z" />
        </svg>
      );
    case 'paint':
      return (
        <svg {...p}>
          <path d="M4 20l8-8" />
          <path d="M14 7l3 3M18 3l3 3-6 6h-3v-3z" />
        </svg>
      );
    case 'gauge':
      return (
        <svg {...p}>
          <path d="M12 14l4-4" />
          <circle cx="12" cy="14" r="9" />
          <path d="M3 14a9 9 0 0118 0" />
        </svg>
      );
    case 'sync':
      return (
        <svg {...p}>
          <path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8L20 17a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      );
  }
}

function ModelSection({ accent, model, setModelId }: { accent: string; model: PrototypeModel; setModelId: (id: string) => void }) {
  const providerLogos: Record<string, { bg: string; color: string; short: string }> = {
    Google: { bg: '#fef3e2', color: '#d97706', short: 'G' },
    OpenAI: { bg: '#dcfce7', color: '#15803d', short: 'A' },
    Anthropic: { bg: '#fef0e6', color: '#c2410c', short: 'C' },
    Meta: { bg: '#dbeafe', color: '#1d4ed8', short: 'M' },
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 650, color: '#202223', margin: 0, letterSpacing: '-0.01em' }}>
          AI model
        </h2>
        <p style={{ fontSize: 13, color: '#5c5f62', margin: '4px 0 0', lineHeight: 1.5 }}>
          The chat model powering your storefront drawer and admin playground. Switching takes effect
          immediately — no redeploy.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODELS.map((m) => {
          const active = m.id === model.id;
          const logo = providerLogos[m.provider] ?? { bg: '#f1f2f4', color: '#5c5f62', short: m.provider[0] };
          return (
            <label
              key={m.id}
              style={{
                background: '#fff',
                border: `1.5px solid ${active ? accent : '#e1e3e5'}`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: '24px 36px 1fr auto',
                gap: 14,
                alignItems: 'center',
                cursor: 'pointer',
                boxShadow: active ? `0 0 0 3px ${rgba(accent, 0.12)}` : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `2px solid ${active ? accent : '#c9ccd0'}`,
                  background: '#fff',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />}
              </span>
              <input
                type="radio"
                name="model"
                checked={active}
                onChange={() => setModelId(m.id)}
                style={{ display: 'none' }}
              />

              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: logo.bg,
                  color: logo.color,
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {logo.short}
              </div>

              <div onClick={() => setModelId(m.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 650, color: '#202223' }}>{m.name}</span>
                  <span style={{ fontSize: 11.5, color: '#6d7175' }}>by {m.provider}</span>
                  {m.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: m.badge === 'Recommended' ? rgba(accent, 0.12) : '#fef3e2',
                        color: m.badge === 'Recommended' ? accent : '#a16207',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {m.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: '#5c5f62', lineHeight: 1.4 }}>{m.bestFor}</div>
              </div>

              <div onClick={() => setModelId(m.id)} style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#8c9196',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Per 1M tokens
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#202223',
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 2,
                  }}
                >
                  ${m.inPrice.toFixed(2)}{' '}
                  <span style={{ color: '#a5acb1', fontWeight: 400 }}>in</span>
                  {' · '}${m.outPrice.toFixed(2)}{' '}
                  <span style={{ color: '#a5acb1', fontWeight: 400 }}>out</span>
                </div>
                <div style={{ fontSize: 11, color: '#8c9196', marginTop: 2 }}>
                  {m.contextK >= 1000 ? `${m.contextK / 1000}M` : `${m.contextK}K`} context
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: '12px 14px',
          background: '#fafbfb',
          border: '1px solid #ebebeb',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6d7175"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginTop: 2, flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h0" />
        </svg>
        <div style={{ fontSize: 12.5, color: '#5c5f62', lineHeight: 1.5 }}>
          Pricing reflects the Vercel AI Gateway live rate card. We pin a specific model version per shop so
          behavior never silently changes underneath you. Embeddings are billed separately at $0.02 / 1M
          tokens.
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          style={{
            background: '#202223',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Save changes
        </button>
        <span style={{ fontSize: 12, color: '#6d7175' }}>
          Currently active: <strong style={{ color: '#202223', fontWeight: 600 }}>{model.name}</strong>
        </span>
      </div>
    </div>
  );
}

function DrawerSection({ accent }: { accent: string }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 650, color: '#202223', margin: 0, letterSpacing: '-0.01em' }}>
        Drawer styling
      </h2>
      <p style={{ fontSize: 13, color: '#5c5f62', margin: '4px 0 18px', lineHeight: 1.5 }}>
        Merchant-facing knobs that surface in the Theme Editor App Embed settings.
      </p>

      <SettingsCard title="Accent color" description="Used for the FAB, sent messages, and primary CTAs in the drawer.">
        <div style={{ display: 'flex', gap: 8 }}>
          {['#5B4FE9', '#008060', '#D4823A', '#1A1A1A', '#D9457A'].map((c) => (
            <div
              key={c}
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: c,
                cursor: 'pointer',
                border: c === accent ? '3px solid #202223' : '1px solid rgba(0,0,0,0.1)',
                boxShadow: c === accent ? '0 0 0 2px #fff inset' : 'none',
              }}
            />
          ))}
          <button
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: '#fff',
              border: '1px dashed #c9ccd0',
              color: '#6d7175',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            +
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Greeting message" description="Shown in the empty state when shoppers first open the drawer.">
        <input
          type="text"
          defaultValue="Hi there 👋 Looking for something specific?"
          style={inputStyle}
        />
      </SettingsCard>

      <SettingsCard title="Suggested prompt chips" description="Quick-pick prompts shown to first-time visitors. 3–4 work best.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUGGESTED_PROMPTS.map((p, i) => (
            <div
              key={i}
              style={{
                background: '#fafbfb',
                border: '1px solid #ebebeb',
                borderRadius: 8,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <span style={{ fontSize: 13, color: '#202223', flex: 1 }}>{p.text}</span>
              <button style={iconBtnStyle}>✏️</button>
              <button style={iconBtnStyle}>×</button>
            </div>
          ))}
          <button
            style={{
              background: '#fff',
              border: '1px dashed #c9ccd0',
              borderRadius: 8,
              padding: '8px',
              fontSize: 12.5,
              color: '#6d7175',
              cursor: 'pointer',
            }}
          >
            + Add prompt
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

function LimitsSection({ accent, usage }: { accent: string; usage: UsageStats }) {
  const pct = Math.round((usage.used / usage.cap) * 100);
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 650, color: '#202223', margin: 0, letterSpacing: '-0.01em' }}>
        Usage & limits
      </h2>
      <p style={{ fontSize: 13, color: '#5c5f62', margin: '4px 0 18px', lineHeight: 1.5 }}>
        V1 is free with a monthly cap. Billing arrives in a future release.
      </p>

      <SettingsCard title="This month" description="May 2026 · resets in 9 days">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 650,
              color: '#202223',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {usage.used.toLocaleString()}
          </span>
          <span style={{ fontSize: 14, color: '#6d7175' }}>
            of {usage.cap.toLocaleString()} chat requests
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 600,
              color: pct > 80 ? '#bf4800' : accent,
            }}
          >
            {pct}% used
          </span>
        </div>
        <div style={{ background: '#f1f2f4', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: pct > 80 ? '#bf4800' : accent,
              borderRadius: 6,
              transition: 'width 0.4s',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12 }}>
          <Stat label="Storefront" value={usage.storefront} />
          <Stat label="Admin playground" value={usage.admin} />
          <Stat label="Avg latency" value={`${usage.latency}s`} />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Hard cap"
        description={'When reached, the drawer shows a friendly "limit reached" message instead of failing.'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="number" defaultValue={2000} style={{ ...inputStyle, width: 120 }} />
          <span style={{ fontSize: 13, color: '#6d7175' }}>requests / month</span>
        </div>
      </SettingsCard>
    </div>
  );
}

function WebhooksSection() {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 650, color: '#202223', margin: 0, letterSpacing: '-0.01em' }}>
        Sync & webhooks
      </h2>
      <p style={{ fontSize: 13, color: '#5c5f62', margin: '4px 0 18px', lineHeight: 1.5 }}>
        How your catalog stays in lockstep with Shopify.
      </p>

      <SettingsCard title="Subscribed topics" description="Webhooks we verify (HMAC) and process for incremental updates.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { topic: 'products/create', status: 'active' },
            { topic: 'products/update', status: 'active' },
            { topic: 'products/delete', status: 'active' },
            { topic: 'app/uninstalled', status: 'active' },
          ].map((w) => (
            <div
              key={w.topic}
              style={{
                background: '#fafbfb',
                border: '1px solid #ebebeb',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: '#202223',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#008060' }} />
              {w.topic}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8c9196', fontFamily: 'inherit' }}>
                last fired 2m ago
              </span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Manual resync" description="Re-run a full sync if something looks off.">
        <button
          style={{
            background: '#fff',
            border: '1px solid #c9ccd0',
            color: '#202223',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <SettingsIcon name="sync" size={13} />
          Run full resync
        </button>
        <div style={{ fontSize: 11.5, color: '#8c9196', marginTop: 6 }}>
          Last successful sync: today, 4:18pm · 15 products · 4m 12s
        </div>
      </SettingsCard>
    </div>
  );
}

function GeneralSection({ accent }: { accent: string }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 650, color: '#202223', margin: 0, letterSpacing: '-0.01em' }}>
        General
      </h2>
      <p style={{ fontSize: 13, color: '#5c5f62', margin: '4px 0 18px', lineHeight: 1.5 }}>
        Account, notifications, and the storefront experience.
      </p>

      <SettingsCard title="Notification email" description="Where we send sync completion summaries and incident alerts.">
        <input type="email" defaultValue="owner@demo-store.shop" style={inputStyle} />
      </SettingsCard>

      <SettingsCard title="Enable on storefront" description="Turn the chat drawer on or off without touching your theme.">
        <Toggle defaultOn accent={accent} label="Drawer is live" />
      </SettingsCard>

      <SettingsCard
        title="Show in Theme Editor preview"
        description="Allow the FAB to appear when previewing themes (auto-open is disabled)."
      >
        <Toggle defaultOn accent={accent} label="Visible in editor" />
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e1e3e5',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 650, color: '#202223', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#6d7175', marginBottom: 12, lineHeight: 1.45 }}>{description}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: '#8c9196',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: '#202223',
          fontWeight: 600,
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Toggle({ defaultOn, accent, label }: { defaultOn: boolean; accent: string; label: string }) {
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  color: '#202223',
  background: '#fff',
  border: '1px solid #c9ccd0',
  borderRadius: 8,
  outline: 'none',
  fontFamily: 'inherit',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#8c9196',
  fontSize: 11,
  padding: 4,
};
