import React from 'react';
import { rgba, shade } from '../prototype-brand';

export type SyncState = 'idle' | 'queued' | 'running' | 'succeeded';

export interface SyncProgress {
  processed: number;
  total: number;
  stage: number;
  rate: string;
  eta: string;
}

interface OnboardingScreenProps {
  accent: string;
  syncState: SyncState;
  setSyncState: (state: SyncState) => void;
  syncProgress: SyncProgress;
}

export function OnboardingScreen({ accent, syncState, setSyncState, syncProgress }: OnboardingScreenProps) {
  const isIdle = syncState === 'idle';
  const isRunning = syncState === 'queued' || syncState === 'running';
  const isDone = syncState === 'succeeded';

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 28px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#6d7175',
            marginBottom: 8,
          }}
        >
          <span>Setup</span>
          <span>›</span>
          <span style={{ color: '#202223' }}>Welcome</span>
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 650,
            color: '#1a1a1a',
            margin: 0,
            letterSpacing: '-0.012em',
            lineHeight: 1.2,
          }}
        >
          Welcome to SmartDiscovery AI
        </h1>
        <p style={{ color: '#5c5f62', margin: '8px 0 0', fontSize: 14, maxWidth: 640, lineHeight: 1.55 }}>
          Three steps and your storefront can answer natural-language questions about your catalog.
          We&apos;ll sync your products, generate embeddings, and turn on the chat drawer.
        </p>
      </div>

      <StepRail accent={accent} syncState={syncState} />

      <div
        style={{
          background: '#fff',
          border: '1px solid #e1e3e5',
          borderRadius: 14,
          marginTop: 20,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: '1px solid #ebebeb',
            background: `linear-gradient(180deg, ${rgba(accent, 0.04)} 0%, transparent 100%)`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <SyncStateIcon state={syncState} accent={accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 650, color: '#202223' }}>
              {isIdle && 'Sync your product catalog'}
              {isRunning && `Syncing… ${syncProgress.processed} of ${syncProgress.total} products`}
              {isDone && 'Catalog synced and indexed'}
            </div>
            <p style={{ margin: '6px 0 0', color: '#5c5f62', fontSize: 13.5, lineHeight: 1.5 }}>
              {isIdle &&
                "We'll pull every active product, generate embeddings, and create the search index. Takes a few minutes for most shops."}
              {isRunning && "You can close this tab — we'll email you the moment it finishes."}
              {isDone && `${syncProgress.total} products are now searchable. Try the playground to see real results.`}
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {isIdle && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={() => setSyncState('queued')}
                style={{
                  background: '#202223',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                Start sync
              </button>
              <span style={{ color: '#6d7175', fontSize: 13 }}>
                You can keep using your store while sync runs in the background.
              </span>
            </div>
          )}
          {isRunning && <SyncProgressBar progress={syncProgress} accent={accent} />}
          {isDone && <SyncSummary progress={syncProgress} accent={accent} />}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <InfoCard
          title="What gets synced"
          items={[
            'Title, description, tags, vendor, product type',
            'Variants, options, prices',
            'Featured images',
            'Updates from Shopify in real time via webhooks',
          ]}
        />
        <InfoCard
          title="What happens next"
          items={[
            'We embed each product with text-embedding-3-small',
            'Build pgvector HNSW + tsvector indexes',
            "You'll get an email when the first sync completes",
            'Enable the App Embed block in your theme',
          ]}
        />
      </div>
    </div>
  );
}

function StepRail({ accent, syncState }: { accent: string; syncState: SyncState }) {
  const stage = syncState === 'idle' ? 0 : syncState === 'queued' || syncState === 'running' ? 1 : 2;
  const steps = [
    { label: 'Connect', sub: 'Done — shop authorized', done: true, active: false },
    { label: 'Sync products', sub: 'Pull & embed your catalog', done: stage >= 2, active: stage === 1 },
    { label: 'Enable drawer', sub: 'Turn on App Embed in theme', done: false, active: stage === 2 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {steps.map((s, i) => {
        const color = s.done ? '#008060' : s.active ? accent : '#dadada';
        const bg = s.done ? '#e6f5ee' : s.active ? rgba(accent, 0.08) : '#f6f6f7';
        return (
          <div
            key={i}
            style={{
              background: '#fff',
              border: `1px solid ${s.active ? rgba(accent, 0.4) : '#e1e3e5'}`,
              borderRadius: 12,
              padding: '14px 14px 12px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {s.done ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#202223' }}>{s.label}</div>
            </div>
            <div style={{ color: '#6d7175', fontSize: 12, marginTop: 6, paddingLeft: 34 }}>{s.sub}</div>
            {s.active && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 2,
                  background: accent,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SyncStateIcon({ state, accent }: { state: SyncState; accent: string }) {
  const size = 44;
  if (state === 'succeeded') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: '#e6f5ee',
          color: '#008060',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    );
  }
  if (state === 'queued' || state === 'running') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: rgba(accent, 0.1),
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: `2.5px solid ${rgba(accent, 0.2)}`,
            borderTopColor: accent,
            animation: 'sd-spin 0.9s linear infinite',
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: rgba(accent, 0.08),
        color: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
    </div>
  );
}

function SyncProgressBar({ progress, accent }: { progress: SyncProgress; accent: string }) {
  const pct = Math.round((progress.processed / Math.max(progress.total, 1)) * 100);
  return (
    <div>
      <div style={{ background: '#f1f2f4', borderRadius: 6, height: 10, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${accent} 0%, ${shade(accent, 12)} 100%)`,
            borderRadius: 6,
            transition: 'width 0.4s ease-out',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.4,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              animation: 'sd-shimmer 1.6s linear infinite',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
        {[
          { k: 'fetch', label: 'Fetch from Shopify', done: progress.stage >= 1, current: progress.stage === 0 },
          { k: 'upsert', label: 'Save to database', done: progress.stage >= 2, current: progress.stage === 1 },
          { k: 'embed', label: 'Generate embeddings', done: progress.stage >= 3, current: progress.stage === 2 },
          { k: 'index', label: 'Build search index', done: progress.stage >= 4, current: progress.stage === 3 },
        ].map((s) => (
          <div
            key={s.k}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              background: s.current ? rgba(accent, 0.06) : '#fafbfb',
              border: `1px solid ${s.current ? rgba(accent, 0.25) : '#ebebeb'}`,
              fontSize: 11.5,
              color: s.current ? accent : s.done ? '#008060' : '#6d7175',
              fontWeight: s.current ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                flexShrink: 0,
                background: s.done ? '#008060' : s.current ? accent : '#dadada',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              {s.done ? '✓' : ''}
            </span>
            {s.label}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
        }}
      >
        <span style={{ color: '#6d7175' }}>
          <strong style={{ color: '#202223', fontWeight: 600 }}>{progress.processed}</strong>
          {' of '}
          <strong style={{ color: '#202223', fontWeight: 600 }}>{progress.total}</strong>
          {' products · '}
          <span>{progress.rate}/sec</span>
        </span>
        <span style={{ color: accent, fontWeight: 600 }}>
          {pct}% · {progress.eta} remaining
        </span>
      </div>
    </div>
  );
}

function SyncSummary({ progress, accent }: { progress: SyncProgress; accent: string }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Products', value: progress.total },
          { label: 'Embeddings', value: progress.total },
          { label: 'Index size', value: '14 MB' },
          { label: 'Took', value: '4m 12s' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: '#fafbfb',
              border: '1px solid #ebebeb',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#6d7175',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {stat.label}
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
              {stat.value}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          style={{
            background: accent,
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 1px 2px ${rgba(accent, 0.4)}`,
          }}
        >
          Try the playground →
        </button>
        <button
          style={{
            background: '#fff',
            color: '#202223',
            border: '1px solid #c9ccd0',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Configure model
        </button>
      </div>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e1e3e5',
        borderRadius: 12,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 650, color: '#202223', marginBottom: 10 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: 12.5,
              color: '#5c5f62',
              lineHeight: 1.5,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: '#c9ccd0',
                marginTop: 7,
                flexShrink: 0,
              }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
