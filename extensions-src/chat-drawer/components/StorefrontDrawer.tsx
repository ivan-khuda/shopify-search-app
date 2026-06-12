'use client';
/**
 * StorefrontDrawer — storefront chat drawer shell (drawer-redesign Task 8).
 *
 * Owns the per-shop settings bundle: a single mount-time fetch of the
 * HMAC-verified app-proxy meta endpoint (`/apps/smartdiscovery/_meta/appearance`)
 * decoded via parseShopSettings (fail-open: network errors keep
 * DEFAULT_SHOP_SETTINGS so the drawer always renders). The fetched bundle
 * drives:
 *   - Fab variant (settings.fabStyle) — fixed bottom-right per the handoff;
 *     the legacy bottom_left position only applies to the loader's paint.
 *   - DrawerShell position (settings.drawerPosition).
 *   - `--sd-accent` on the root wrapper (settings.drawerAccent).
 *   - Kill-switch: drawerEnabled:false (or Theme Editor preview hidden)
 *     renders null outright — no FAB, no drawer, no DrawerBody mount.
 *
 * The heavy DrawerBody (DbBacked stores + useChatController panes) stays
 * behind React.lazy so the storefront entry chunk holds the D-14 budget; it
 * receives the settings as a prop and reports history/saved counts back via
 * onCountsChange for the tab badges.
 *
 * STR-07 / Pitfall 5: designMode check at FAB click time, not at mount.
 *
 * Accessibility: FAB aria-label toggles open/close; DrawerShell renders
 * role="dialog"; Escape closes; focus moves to the close button on open and
 * returns to the FAB on close.
 */
import * as React from 'react';
import { Fab } from './Fab';
import { DrawerShell } from './DrawerShell';
import { SDLogo } from '@/lib/chat-ui/components/sd-logo';
import {
  DEFAULT_SHOP_SETTINGS,
  parseShopSettings,
  type ShopSettingsBundle,
} from '@/lib/settings/contract';

const DrawerBody = React.lazy(() => import('./DrawerBody'));

type TabId = 'chat' | 'history' | 'saved';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'history', label: 'History' },
  { id: 'saved', label: 'Saved' },
];

interface StorefrontDrawerProps {
  shop?: string;
  visitorId?: string;
  customerId?: string | null;
  /** Storefront shop display name — header "Ask {shopName}" + pill FAB copy. */
  shopName?: string | null;
  /** Theme-embed FAB corner — forwarded so the React FAB stays on the same
   *  side as the loader's synchronous paint. */
  fabPosition?: 'bottom_right' | 'bottom_left';
  initialOpen?: boolean;
  /**
   * WR-03: registers an imperative toggle so the bundle entry (entry.tsx)
   * can re-open the drawer from the loader FAB after the user closes it.
   * `initialOpen` only seeds the first render — re-rendering with a different
   * value has no effect on a mounted component.
   */
  registerToggle?: (toggle: () => void) => void;
}

export function StorefrontDrawer(props: StorefrontDrawerProps = {}): React.ReactElement | null {
  const { shop, visitorId, customerId, shopName, fabPosition, initialOpen = false, registerToggle } = props;
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const [activeTab, setActiveTab] = React.useState<TabId>('chat');
  const [settings, setSettings] = React.useState<ShopSettingsBundle>(DEFAULT_SHOP_SETTINGS);
  const [counts, setCounts] = React.useState({ history: 0, saved: 0 });
  const fabRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // Single mount-time settings fetch (lifted from DrawerBody so the Fab and
  // DrawerShell can use it before the lazy body ever loads). Fail-open.
  React.useEffect(() => {
    let cancelled = false;
    fetch('/apps/smartdiscovery/_meta/appearance')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setSettings(parseShopSettings(data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSwitchToChat = React.useCallback(() => setActiveTab('chat'), []);
  const handleCountsChange = React.useCallback(
    (next: { history: number; saved: number }) => setCounts(next),
    [],
  );

  // Merchant kill-switch: the shell owns the settings now, so it hides itself
  // directly — drawerEnabled:false, or Theme Editor preview toggled off.
  const designMode =
    typeof window !== 'undefined' &&
    (window as unknown as { Shopify?: { designMode?: boolean } }).Shopify?.designMode === true;
  if (!settings.drawerEnabled || (designMode && !settings.editorPreviewVisible)) {
    return null;
  }

  return (
    <div
      className="sd-root"
      style={{ '--sd-accent': settings.drawerAccent } as React.CSSProperties}
    >
      <Fab
        ref={fabRef}
        fabStyle={settings.fabStyle}
        position={fabPosition}
        shopName={shopName}
        ariaLabel={isOpen ? 'Close SmartDiscovery AI chat' : 'Open SmartDiscovery AI chat'}
        onClick={handleFabClick}
      />
      {isOpen ? (
        <DrawerShell
          position={settings.drawerPosition}
          onClose={closeDrawer}
          ariaLabel="SmartDiscovery AI chat drawer"
        >
          <header className="flex shrink-0 items-center gap-2.5 border-b border-[#ededed] bg-white py-3 pr-3.5 pl-4">
            <SDLogo size={28} />
            <div className="flex-1 leading-[1.1]">
              <h2 className="m-0 text-[13.5px] font-semibold text-[#1a1a1a]">
                Ask {shopName || 'us'}
              </h2>
              <p className="m-0 mt-0.5 flex items-center gap-1 text-[11px] text-[#8c8c8c]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" aria-hidden="true" />
                AI-powered · usually replies instantly
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close chat drawer"
              onClick={closeDrawer}
              className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-[#f5f5f5]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#404040"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </header>
          <div role="tablist" className="flex shrink-0 border-b border-[#ededed] bg-white">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const badge =
                tab.id === 'history' ? counts.history : tab.id === 'saved' ? counts.saved : 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 cursor-pointer border-none bg-transparent px-2 py-2.5 text-[12.5px] ${
                    active ? 'font-semibold text-[#1a1a1a]' : 'font-medium text-[#8c8c8c]'
                  }`}
                >
                  {tab.label}
                  {badge > 0 ? (
                    <span className="ml-1 rounded-[5px] bg-[color-mix(in_srgb,var(--sd-accent,#5B4FE9)_12%,transparent)] px-[5px] py-px text-[10px] font-bold text-[var(--sd-accent,#5B4FE9)]">
                      {badge}
                    </span>
                  ) : null}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-[15%] -bottom-px left-[15%] h-0.5 rounded-[1px] bg-[var(--sd-accent,#5B4FE9)]"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
            {shop && visitorId ? (
              <React.Suspense
                fallback={<p className="m-0 p-4 text-[13px] text-[#8c8c8c]">Loading…</p>}
              >
                <DrawerBody
                  activeTab={activeTab}
                  shop={shop}
                  visitorId={visitorId}
                  customerId={customerId ?? null}
                  settings={settings}
                  onSwitchToChat={handleSwitchToChat}
                  onCountsChange={handleCountsChange}
                />
              </React.Suspense>
            ) : (
              <div className="flex-1 overflow-auto bg-[#fafafa] p-4">
                {activeTab === 'chat' && (
                  <p className="m-0 text-[13px] text-[#8c8c8c]">Chat coming up…</p>
                )}
                {activeTab === 'history' && (
                  <p className="m-0 text-[13px] text-[#8c8c8c]">No history yet.</p>
                )}
                {activeTab === 'saved' && (
                  <p className="m-0 text-[13px] text-[#8c8c8c]">No saved products yet.</p>
                )}
              </div>
            )}
          </div>
        </DrawerShell>
      ) : null}
    </div>
  );
}
