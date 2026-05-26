import React from 'react';
import { SDLogo, rgba, shade } from '../prototype-brand';

export function EmailScreen({ accent }: { accent: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', background: '#f5f5f5', overflow: 'hidden' }}>
      <EmailClientChrome accent={accent} />
    </div>
  );
}

function EmailClientChrome({ accent }: { accent: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        background: '#fff',
        fontFamily: 'system-ui',
      }}
    >
      <div style={{ background: '#f5f5f5', padding: '16px 8px', borderRight: '1px solid #ededed' }}>
        <button
          style={{
            background: '#c2185b',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 16,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 16,
            marginLeft: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Compose
        </button>
        {[
          { name: 'Inbox', count: 12, active: true },
          { name: 'Starred', count: null, active: false },
          { name: 'Snoozed', count: null, active: false },
          { name: 'Sent', count: null, active: false },
          { name: 'Drafts', count: 2, active: false },
          { name: 'All Mail', count: null, active: false },
          { name: 'Spam', count: null, active: false },
        ].map((f) => (
          <div
            key={f.name}
            style={{
              padding: '6px 14px',
              borderRadius: '0 16px 16px 0',
              background: f.active ? '#fce4ec' : 'transparent',
              color: f.active ? '#c2185b' : '#3c4043',
              fontSize: 13,
              fontWeight: f.active ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 1,
              marginRight: 8,
            }}
          >
            {f.name}
            {f.count && <span style={{ marginLeft: 'auto', fontSize: 11 }}>{f.count}</span>}
          </div>
        ))}

        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#5f6368',
            padding: '20px 14px 8px',
            letterSpacing: '0.02em',
          }}
        >
          LABELS
        </div>
        {['Demo Store', 'Personal', 'Vendors'].map((l) => (
          <div
            key={l}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              color: '#3c4043',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#9b8ed8' }} />
            {l}
          </div>
        ))}
      </div>

      <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 28px 12px', borderBottom: '1px solid #ededed' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#5f6368',
              marginBottom: 4,
            }}
          >
            <span>Inbox</span>
            <span>·</span>
            <span
              style={{
                background: '#fce4ec',
                color: '#c2185b',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              SmartDiscovery
            </span>
          </div>
          <h1
            style={{
              fontSize: 22,
              color: '#202124',
              margin: 0,
              fontWeight: 400,
              lineHeight: 1.3,
              letterSpacing: '-0.005em',
            }}
          >
            🎉 Your catalog is synced and ready
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -20)} 100%)`,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              SD
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <div style={{ color: '#202124' }}>
                <strong>SmartDiscovery</strong>
                <span style={{ color: '#5f6368' }}> &lt;hello@smartdiscovery.ai&gt;</span>
              </div>
              <div style={{ color: '#5f6368', fontSize: 12, marginTop: 2 }}>
                to owner@demo-store.shop · today, 4:22 PM
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px', background: '#fff' }}>
          <EmailTemplate accent={accent} />
        </div>

        <div style={{ padding: '12px 28px', borderTop: '1px solid #ededed' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Reply', 'Reply all', 'Forward'].map((label) => (
              <button
                key={label}
                style={{
                  background: '#fff',
                  border: '1px solid #dadce0',
                  borderRadius: 16,
                  padding: '7px 16px',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  color: '#3c4043',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 17l-5-5 5-5M20 18v-2a4 4 0 00-4-4H4" />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailTemplate({ accent }: { accent: string }) {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: '0 auto',
        background: '#fff',
        border: '1px solid #ededed',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: '"Helvetica Neue", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          padding: '32px 32px 28px',
          background: `linear-gradient(135deg, ${rgba(accent, 0.08)} 0%, ${rgba(accent, 0.02)} 100%)`,
          borderBottom: `1px solid ${rgba(accent, 0.15)}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <SDLogo size={32} accent={accent} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            SmartDiscovery <span style={{ color: accent }}>AI</span>
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#fff',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            color: '#008060',
            border: '1px solid #e6f5ee',
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#008060',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            ✓
          </span>
          Sync complete
        </div>

        <h1
          style={{
            fontSize: 28,
            color: '#1a1a1a',
            margin: 0,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
          }}
        >
          Your catalog is searchable.
        </h1>
        <p style={{ fontSize: 14.5, color: '#5c5f62', margin: '10px 0 0', lineHeight: 1.55 }}>
          We just finished syncing your full catalog. Shoppers can now ask questions in natural language and
          get real products in return.
        </p>
      </div>

      <div style={{ padding: '24px 32px 8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Products synced', value: '15' },
            { label: 'Embeddings built', value: '15' },
            { label: 'Total time', value: '4m 12s' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: '#fafbfb',
                border: '1px solid #ebebeb',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  color: '#6d7175',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 650,
                  color: '#202223',
                  marginTop: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#6d7175',
            margin: '0 0 12px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          What&apos;s next
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              num: 1,
              title: 'Try a few queries in the playground',
              body: 'Test the assistant against your own catalog from the admin app — no shoppers see it yet.',
            },
            {
              num: 2,
              title: 'Enable the App Embed in your theme',
              body: "One toggle in the Theme Editor turns the chat drawer on for shoppers. We'll keep your catalog in sync via webhooks.",
            },
            {
              num: 3,
              title: 'Pick the AI model that fits',
              body: "We've set you up with Gemini 2.5 Flash by default — fast and affordable. Swap it any time.",
            },
          ].map((step) => (
            <div key={step.num} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: rgba(accent, 0.1),
                  color: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {step.num}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 13, color: '#5c5f62', lineHeight: 1.55 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 32px 28px', textAlign: 'center' }}>
        <a
          style={{
            display: 'inline-block',
            background: '#1a1a1a',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '-0.005em',
          }}
        >
          Open SmartDiscovery →
        </a>
        <div style={{ fontSize: 12, color: '#8c9196', marginTop: 10 }}>
          or paste this into your browser:{' '}
          <span style={{ color: accent }}>demo-store.myshopify.com/admin/apps/smartdiscovery</span>
        </div>
      </div>

      <div
        style={{
          padding: '20px 32px',
          background: '#fafbfb',
          borderTop: '1px solid #ededed',
          fontSize: 11.5,
          color: '#8c9196',
          lineHeight: 1.5,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          You&apos;re receiving this because you installed SmartDiscovery AI on demo-store.myshopify.com.
        </div>
        <div style={{ display: 'flex', gap: 10, color: '#5c5f62' }}>
          <a style={{ color: 'inherit', textDecoration: 'underline' }}>Manage notifications</a>
          <span>·</span>
          <a style={{ color: 'inherit', textDecoration: 'underline' }}>Help</a>
          <span>·</span>
          <a style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy</a>
        </div>
      </div>
    </div>
  );
}
