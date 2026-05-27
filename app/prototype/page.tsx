'use client';

import React from 'react';
import { DEFAULT_ACCENT } from './prototype-brand';
import {
  PrototypeRail,
  ShopifyTopbar,
  AppSidebar,
  StorefrontTopbar,
  type PrototypeView,
  type AdminRoute,
  type StorefrontViewport,
} from './prototype-shell';
import { OnboardingScreen, type SyncState, type SyncProgress } from './screens/onboarding-screen';
import { ChatScreen } from './screens/chat-screen';
import { SettingsScreen, type UsageStats } from './screens/settings-screen';
import { StorefrontScreen } from './screens/storefront-screen';
import { ThemeEditorScreen } from './screens/editor-screen';
import { EmailScreen } from './screens/email-screen';
import { CATALOG, MODELS, type HistoryEntry, type PrototypeProduct } from './prototype-data';

const ACCENT = DEFAULT_ACCENT;
const DENSITY = 'standard' as const;
const EMPTY_STYLE = 'cards' as const;
const FAB_STYLE = 'circle' as const;
const DRAWER_POSITION = 'side' as const;

const USAGE: UsageStats = {
  used: 1284,
  cap: 2000,
  storefront: 1102,
  admin: 182,
  latency: 1.2,
};

const PROTOTYPE_STYLES = `
@keyframes sd-spin { to { transform: rotate(360deg); } }
@keyframes sd-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes sd-blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
@keyframes sd-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}
@keyframes sd-slide-left {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes sd-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes sd-pop {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.sd-prototype-root .sd-composer:focus-within {
  border-color: ${ACCENT} !important;
  box-shadow: 0 0 0 3px ${ACCENT}1f;
}

.sd-prototype-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.sd-prototype-root ::-webkit-scrollbar-track { background: transparent; }
.sd-prototype-root ::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.15);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.sd-prototype-root ::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.28);
  border: 2px solid transparent;
  background-clip: content-box;
}

.sd-prototype-root input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  height: 16px;
}
.sd-prototype-root input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  background: #ededed;
  border-radius: 2px;
}
.sd-prototype-root input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1a1a1a;
  margin-top: -5px;
  cursor: pointer;
}
`;

export default function PrototypePage() {
  const [view, setView] = React.useState<PrototypeView>('admin');
  const [route, setRoute] = React.useState<AdminRoute>('chat');
  const [storefrontViewport, setStorefrontViewport] = React.useState<StorefrontViewport>('desktop');

  const [syncState, setSyncState] = React.useState<SyncState>('idle');
  const [syncProgress, setSyncProgress] = React.useState<SyncProgress>({
    processed: 0,
    total: CATALOG.length,
    stage: 0,
    rate: '0',
    eta: '—',
  });

  const [savedIds, setSavedIds] = React.useState<Set<string>>(new Set());
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [modelId, setModelId] = React.useState('gemini-2.5-flash');
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];

  React.useEffect(() => {
    if (syncState !== 'queued') return;
    const id = setTimeout(() => setSyncState('running'), 600);
    return () => clearTimeout(id);
  }, [syncState]);

  React.useEffect(() => {
    if (syncState !== 'running') return;
    const total = CATALOG.length;
    let processed = 0;
    const interval = setInterval(() => {
      processed += 1;
      const stage = Math.min(3, Math.floor((processed / total) * 4));
      const remaining = total - processed;
      const secs = Math.max(1, Math.round(remaining * 1.5));
      setSyncProgress({
        processed,
        total,
        stage,
        rate: (1 / 1.5).toFixed(1),
        eta: secs > 60 ? `${Math.round(secs / 60)}m` : `${secs}s`,
      });
      if (processed >= total) {
        clearInterval(interval);
        setTimeout(() => {
          setSyncProgress((p) => ({ ...p, stage: 4 }));
          setSyncState('succeeded');
        }, 600);
      }
    }, 350);
    return () => clearInterval(interval);
  }, [syncState]);

  const toggleSave = (product: PrototypeProduct) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  };

  return (
    <div
      className="sd-prototype-root"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#fff',
        color: '#202223',
        fontFamily: '-apple-system, "Inter", "Segoe UI", Roboto, sans-serif',
        fontSize: 14,
      }}
    >
      <style>{PROTOTYPE_STYLES}</style>

      <PrototypeRail view={view} onView={setView} accent={ACCENT} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {view === 'admin' && (
          <>
            <ShopifyTopbar accent={ACCENT} />
            <div style={{ flex: 1, display: 'flex', minHeight: 0, background: '#f6f6f7' }}>
              <AppSidebar
                route={route}
                onRoute={setRoute}
                accent={ACCENT}
                savedCount={savedIds.size}
                syncState={syncState}
              />
              <main
                style={{
                  flex: 1,
                  overflow: 'auto',
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {route === 'onboarding' && (
                  <OnboardingScreen
                    accent={ACCENT}
                    syncState={syncState}
                    setSyncState={setSyncState}
                    syncProgress={syncProgress}
                  />
                )}
                {route === 'chat' && (
                  <ChatScreen
                    accent={ACCENT}
                    density={DENSITY}
                    emptyStyle={EMPTY_STYLE}
                    savedIds={savedIds}
                    onToggleSave={toggleSave}
                    history={history}
                    onAddHistory={(e) => setHistory((h) => [e, ...h].slice(0, 20))}
                    onClearHistory={() => setHistory([])}
                    model={model}
                  />
                )}
                {route === 'settings' && (
                  <SettingsScreen accent={ACCENT} model={model} setModelId={setModelId} usage={USAGE} />
                )}
              </main>
            </div>
          </>
        )}

        {view === 'storefront' && (
          <>
            <StorefrontTopbar viewport={storefrontViewport} setViewport={setStorefrontViewport} />
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                background: '#e9e9eb',
                padding: storefrontViewport === 'mobile' ? '20px' : '0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flex: 1,
                  maxWidth: storefrontViewport === 'mobile' ? 390 : 'none',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderRadius: storefrontViewport === 'mobile' ? 30 : 0,
                  boxShadow:
                    storefrontViewport === 'mobile' ? '0 12px 50px rgba(0,0,0,0.18)' : 'none',
                  border: storefrontViewport === 'mobile' ? '8px solid #1a1a1a' : 'none',
                  position: 'relative',
                }}
              >
                <StorefrontScreen
                  accent={ACCENT}
                  fabStyle={FAB_STYLE}
                  drawerPosition={DRAWER_POSITION}
                  savedIds={savedIds}
                  onToggleSave={toggleSave}
                  viewport={storefrontViewport}
                />
              </div>
            </div>
          </>
        )}

        {view === 'editor' && <ThemeEditorScreen accent={ACCENT} fabStyle={FAB_STYLE} />}

        {view === 'email' && <EmailScreen accent={ACCENT} />}
      </div>
    </div>
  );
}
