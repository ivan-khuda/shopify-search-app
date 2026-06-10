'use client';
/**
 * StorefrontDrawer — storefront chat drawer shell (D-13, STR-01, STR-05).
 *
 * Renders a FAB-paired drawer. The heavy DrawerBody (ChatPane + panels + Db-backed
 * stores from @/lib/chat-ui) is loaded via React.lazy on first drawer open so the
 * storefront entry chunk stays under the D-14 bundle budget. Falls back to
 * placeholder content for test renders / design-mode preview (no props).
 *
 * STR-07 / Pitfall 5: designMode check at FAB click time, not at mount.
 *
 * Accessibility:
 *   - FAB toggles aria-label between "Open SmartDiscovery AI chat" and
 *     "Close SmartDiscovery AI chat".
 *   - Drawer is `role="complementary"` so screen readers announce it as an
 *     adjacent region.
 *   - Escape closes the drawer; focus returns to FAB.
 */
import * as React from 'react';

const DrawerBody = React.lazy(() => import('./DrawerBody'));

interface StorefrontDrawerProps {
  shop?: string;
  visitorId?: string;
  customerId?: string | null;
  accent?: string;
  position?: 'bottom_right' | 'bottom_left';
  initialOpen?: boolean;
  /**
   * WR-03: registers an imperative toggle so the bundle entry (entry.tsx)
   * can re-open the drawer from the loader FAB after the user closes it.
   * `initialOpen` only seeds the first render — re-rendering with a different
   * value has no effect on a mounted component.
   */
  registerToggle?: (toggle: () => void) => void;
}

export function StorefrontDrawer(props: StorefrontDrawerProps = {}): React.ReactElement {
  const { shop, visitorId, customerId, accent = '#008060', position = 'bottom_right', initialOpen = false, registerToggle } = props;
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const [activeTab, setActiveTab] = React.useState<'chat' | 'history' | 'saved'>('chat');
  const fabRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  const closeDrawer = React.useCallback(() => {
    setIsOpen(false);
    setTimeout(() => fabRef.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    registerToggle?.(() => setIsOpen((prev) => !prev));
  }, [registerToggle]);

  const handleFabClick = React.useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { Shopify?: { designMode?: boolean } }).Shopify?.designMode === true
    ) {
      return;
    }
    setIsOpen((prev) => !prev);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeDrawer]);

  return (
    <div className="sd-root">
      <button
        ref={fabRef}
        type="button"
        aria-label={isOpen ? 'Close SmartDiscovery AI chat' : 'Open SmartDiscovery AI chat'}
        aria-expanded={isOpen}
        aria-controls="sd-drawer"
        onClick={handleFabClick}
        className={`sd-fab sd-fab--${position}`}
        style={{
          position: 'fixed',
          bottom: 24,
          [position === 'bottom_right' ? 'right' : 'left']: 24,
          width: 56,
          height: 56,
          borderRadius: 9999,
          border: 0,
          background: accent,
          color: '#fff',
          zIndex: 2002,
          cursor: 'pointer',
        }}
      >
        {isOpen ? '×' : '✨'}
      </button>
      {isOpen ? (
        <aside
          id="sd-drawer"
          role="complementary"
          aria-label="SmartDiscovery AI chat drawer"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            height: '100%',
            width: 400,
            background: '#fff',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.08)',
            zIndex: 2001,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>SmartDiscovery AI</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Shopify Assistant</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close chat drawer"
              onClick={closeDrawer}
              style={{
                width: 24,
                height: 24,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </header>
          <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {(['chat', 'history', 'saved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: 0,
                  background: activeTab === tab ? '#f3f4f6' : '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 600 : 400,
                }}
              >
                {tab === 'chat' ? 'Chat' : tab === 'history' ? 'History' : 'Saved'}
              </button>
            ))}
          </div>
          <div role="tabpanel" style={{ flex: 1, padding: 16, overflow: 'auto' }}>
            {shop && visitorId ? (
              <React.Suspense fallback={<p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>}>
                <DrawerBody
                  activeTab={activeTab}
                  shop={shop}
                  visitorId={visitorId}
                  customerId={customerId ?? null}
                />
              </React.Suspense>
            ) : (
              <>
                {activeTab === 'chat' && <p style={{ margin: 0, color: '#6b7280' }}>Chat coming up…</p>}
                {activeTab === 'history' && (
                  <p style={{ margin: 0, color: '#6b7280' }}>No history yet.</p>
                )}
                {activeTab === 'saved' && (
                  <p style={{ margin: 0, color: '#6b7280' }}>No saved products yet.</p>
                )}
              </>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
