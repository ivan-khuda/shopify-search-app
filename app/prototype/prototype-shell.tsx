import React from 'react';
import { SDLogo, rgba } from './prototype-brand';

export type PrototypeView = 'admin' | 'storefront' | 'editor' | 'email';
export type AdminRoute = 'onboarding' | 'chat' | 'settings';
export type StorefrontViewport = 'desktop' | 'mobile';

const VIEWS: { id: PrototypeView; label: string; icon: ViewIconName }[] = [
  { id: 'admin', label: 'Admin', icon: 'admin' },
  { id: 'storefront', label: 'Storefront', icon: 'store' },
  { id: 'editor', label: 'Theme Editor', icon: 'paintbrush' },
  { id: 'email', label: 'Email', icon: 'mail' },
];

type ViewIconName = 'admin' | 'store' | 'paintbrush' | 'mail';

function ViewIcon({ name, size = 18, color = 'currentColor' }: { name: ViewIconName; size?: number; color?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'admin':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9h18M9 3v18" />
        </svg>
      );
    case 'store':
      return (
        <svg {...common}>
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M4 9v11h16V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'paintbrush':
      return (
        <svg {...common}>
          <path d="M4 20l8-8" />
          <path d="M14 7l3 3M18 3l3 3-6 6h-3v-3z" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      );
  }
}

interface PrototypeRailProps {
  view: PrototypeView;
  onView: (view: PrototypeView) => void;
  accent: string;
}

export function PrototypeRail({ view, onView, accent }: PrototypeRailProps) {
  return (
    <aside
      style={{
        width: 64,
        background: '#1a1d21',
        color: 'rgba(255,255,255,0.75)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 14,
        flexShrink: 0,
        gap: 4,
        borderRight: '1px solid #000',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <SDLogo size={32} accent={accent} />
      </div>
      {VIEWS.map((v) => {
        const active = v.id === view;
        return (
          <button
            key={v.id}
            onClick={() => onView(v.id)}
            title={v.label}
            style={{
              width: 44,
              height: 44,
              marginBottom: 2,
              border: 'none',
              background: active ? rgba(accent, 0.18) : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.55)',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#fff';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
              }
            }}
          >
            <ViewIcon name={v.icon} size={20} />
            {active && (
              <span
                style={{
                  position: 'absolute',
                  left: -1,
                  top: 10,
                  bottom: 10,
                  width: 3,
                  background: accent,
                  borderRadius: '0 3px 3px 0',
                }}
              />
            )}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.35)',
          textAlign: 'center',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '8px 4px',
          lineHeight: 1.3,
        }}
      >
        v1
        <br />
        preview
      </div>
    </aside>
  );
}

export function ShopifyTopbar({ accent }: { accent: string }) {
  return (
    <div
      style={{
        height: 56,
        background: '#1a1d21',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: '#95BF47',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 14,
            color: '#1a3a1a',
          }}
        >
          s
        </div>
      </div>

      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.08)',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: '#d4cdb8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#5a4a2a',
          }}
        >
          D
        </div>
        Demo Store
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 4l3 3 3-3"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        style={{
          flex: 1,
          maxWidth: 480,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        Search
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            opacity: 0.7,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          ⌘K
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <button
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16z" />
          <path d="M10 20a2 2 0 004 0" />
        </svg>
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            background: accent,
            borderRadius: '50%',
            border: '2px solid #1a1d21',
          }}
        />
      </button>

      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#d6cdb8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: '#5a4a2a',
        }}
      >
        AM
      </div>
    </div>
  );
}

interface AppSidebarProps {
  route: AdminRoute;
  onRoute: (route: AdminRoute) => void;
  accent: string;
  savedCount: number;
  syncState: string;
}

type NavIconName = 'home' | 'sparkle' | 'gear' | 'chart' | 'card';

function NavIcon({ name }: { name: NavIconName }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 11l9-8 9 8M5 10v10h14V10" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...props}>
          <path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.5l-1.8-4.4L6 9.3l4.2-1.8z" />
          <path d="M19 16l.8 1.7L21.5 18.5l-1.7.8L19 21l-.8-1.7L16.5 18.5l1.7-.8z" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M3 21V5M3 21h18M7 15v3M12 11v7M17 7v11" />
        </svg>
      );
    case 'card':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
  }
}

export function AppSidebar({ route, onRoute, accent, savedCount, syncState }: AppSidebarProps) {
  const items: { id: AdminRoute; label: string; icon: NavIconName; badge?: string | null; badgeColor?: string }[] = [
    {
      id: 'onboarding',
      label: 'Onboarding',
      icon: 'home',
      badge: syncState === 'succeeded' ? '✓' : null,
      badgeColor: '#008060',
    },
    { id: 'chat', label: 'Playground', icon: 'sparkle' },
    { id: 'settings', label: 'Settings', icon: 'gear' },
  ];
  const secondary: { id: string; label: string; icon: NavIconName }[] = [
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { id: 'billing', label: 'Billing', icon: 'card' },
  ];

  return (
    <aside
      style={{
        width: 232,
        background: '#fafbfb',
        borderRight: '1px solid #e1e3e5',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 10px 14px',
          borderBottom: '1px solid #e6e7e9',
          marginBottom: 10,
        }}
      >
        <SDLogo size={28} accent={accent} />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: '#202223' }}>SmartDiscovery</div>
          <div style={{ fontSize: 10.5, color: '#6d7175', marginTop: 1, letterSpacing: '0.02em' }}>
            AI PRODUCT DISCOVERY
          </div>
        </div>
      </div>

      {items.map((item) => {
        const active = item.id === route;
        return (
          <button
            key={item.id}
            onClick={() => onRoute(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              border: 'none',
              textAlign: 'left',
              background: active ? '#fff' : 'transparent',
              color: active ? '#202223' : '#404952',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 2,
              boxShadow: active ? '0 1px 0 rgba(0,0,0,0.04), inset 0 0 0 1px #e1e3e5' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = '#f1f2f4';
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            <NavIcon name={item.icon} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  background: item.badgeColor,
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.badge}
              </span>
            )}
            {item.id === 'chat' && savedCount > 0 && (
              <span
                style={{
                  background: '#f1f2f4',
                  color: '#6d7175',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 8,
                }}
              >
                {savedCount}
              </span>
            )}
          </button>
        );
      })}

      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#8c9196',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '14px 10px 6px',
        }}
      >
        Coming Soon
      </div>
      {secondary.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            color: '#a5acb1',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 8,
            marginBottom: 2,
          }}
        >
          <NavIcon name={item.icon} />
          <span style={{ flex: 1 }}>{item.label}</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              background: '#f1f2f4',
              color: '#6d7175',
              letterSpacing: '0.04em',
            }}
          >
            SOON
          </span>
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div
        style={{
          background: '#fff',
          border: '1px solid #e1e3e5',
          borderRadius: 10,
          padding: 12,
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: rgba(accent, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            ?
          </div>
          <span style={{ fontWeight: 600, color: '#202223' }}>Need a hand?</span>
        </div>
        <p style={{ color: '#6d7175', margin: 0, lineHeight: 1.45, fontSize: 11.5 }}>
          Read the setup guide or ask us anything at help@smartdiscovery.ai
        </p>
      </div>
    </aside>
  );
}

interface StorefrontTopbarProps {
  viewport: StorefrontViewport;
  setViewport: (v: StorefrontViewport) => void;
}

export function StorefrontTopbar({ viewport, setViewport }: StorefrontTopbarProps) {
  return (
    <div
      style={{
        height: 48,
        background: '#fff',
        borderBottom: '1px solid #e1e3e5',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#6d7175' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
        Live storefront
      </div>
      <div
        style={{
          flex: 1,
          maxWidth: 420,
          padding: '5px 10px',
          background: '#f1f2f4',
          borderRadius: 6,
          fontSize: 12,
          color: '#5c5f62',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        demo-store.myshopify.com
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'inline-flex', background: '#f1f2f4', borderRadius: 7, padding: 2 }}>
        {(['desktop', 'mobile'] as const).map((v) => {
          const active = v === viewport;
          return (
            <button
              key={v}
              onClick={() => setViewport(v)}
              style={{
                background: active ? '#fff' : 'transparent',
                color: '#202223',
                border: 'none',
                padding: '5px 12px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
