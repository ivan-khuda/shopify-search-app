'use client';
/**
 * DrawerBody — heavy panel renderer extracted so React.lazy can defer it.
 *
 * Owns the hook calls for DbBackedHistoryStore / DbBackedSavedProductsStore
 * (constructors throw on empty visitorId — Pitfall 3 — so this module is only
 * mounted when shop + visitorId are both truthy).
 *
 * Settings (settings-redesign Task 6): one-shot fetch of the HMAC-verified
 * app-proxy meta endpoint (`/apps/smartdiscovery/_meta/appearance` — the
 * `/apps/smartdiscovery` prefix matches shopify.app.toml [app_proxy]). The
 * response is the full presentation bundle (appearance + accent + greeting +
 * prompts + visibility flags), decoded via parseShopSettings. Failures are
 * silent — DEFAULT_SHOP_SETTINGS keeps the drawer rendering. Bundle note:
 * @/lib/settings/contract pulls only the pure @/lib/chat-ui/appearance module,
 * so the split-chunk cost is negligible.
 *
 * Kill-switch: `drawerEnabled: false` (or Theme Editor design mode with
 * `editorPreviewVisible: false`) renders null AND fires `onDisabled` so the
 * parent (StorefrontDrawer) can hide the FAB + drawer shell too.
 *
 * Resume: history rows re-run their query in the chat tab. The parent
 * (StorefrontDrawer) owns the tab state, so DrawerBody keeps the pending
 * `resume` payload locally and asks the parent to switch tabs via the
 * optional `onSwitchToChat` callback; ChatPane consumes `autoSubmitQuery`
 * once per id change (same contract as the admin playground).
 *
 * Default export is required by React.lazy. The parent (StorefrontDrawer)
 * gates the lazy import behind the drawer's open state so the heavy panes
 * stay out of the storefront entry chunk (D-14 bundle budget).
 */
import * as React from 'react';
import {
  ChatPane,
  HistoryPanel,
  SavedProductsPanel,
  useDbBackedHistoryStore,
  useDbBackedSavedProductsStore,
} from '@/lib/chat-ui';
import {
  DEFAULT_SHOP_SETTINGS,
  parseShopSettings,
  type ShopSettingsBundle,
} from '@/lib/settings/contract';
import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';

interface DrawerBodyProps {
  activeTab: 'chat' | 'history' | 'saved';
  shop: string;
  visitorId: string;
  customerId: string | null;
  /** Asks the tab-owning parent to switch to the chat tab (history resume). */
  onSwitchToChat?: () => void;
  /** Fired when the merchant kill-switch hides the drawer (FAB included). */
  onDisabled?: () => void;
}

function DrawerBody({
  activeTab,
  shop,
  visitorId,
  customerId,
  onSwitchToChat,
  onDisabled,
}: DrawerBodyProps): React.ReactElement | null {
  const adapter = React.useMemo(() => new StorefrontAdapter(), []);
  const history = useDbBackedHistoryStore({ shop, visitorId, customerId });
  const saved = useDbBackedSavedProductsStore({ shop, visitorId, customerId });
  const savedProductIds = React.useMemo(
    () => new Set(saved.items.map((p) => p.id)),
    [saved.items],
  );

  const [settings, setSettings] = React.useState<ShopSettingsBundle>(DEFAULT_SHOP_SETTINGS);
  const [resume, setResume] = React.useState<{ id: number; query: string } | null>(null);

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

  const handleResume = React.useCallback(
    (query: string) => {
      setResume({ id: Date.now(), query });
      onSwitchToChat?.();
    },
    [onSwitchToChat],
  );

  // Tab switches unmount ChatPane (each tab renders a different tree), which
  // resets its once-per-id guard — a stale `resume` would re-submit on the
  // next chat-tab mount, so clear it as soon as the pane consumes it.
  const handleAutoSubmitConsumed = React.useCallback(() => {
    setResume(null);
  }, []);

  // Kill-switch: merchant disabled the drawer outright, or we are in the
  // Theme Editor preview (window.Shopify.designMode) with the preview
  // toggle off. Notify the parent so the FAB disappears too.
  const designMode =
    typeof window !== 'undefined' &&
    (window as unknown as { Shopify?: { designMode?: boolean } }).Shopify?.designMode === true;
  const hidden = !settings.drawerEnabled || (designMode && !settings.editorPreviewVisible);

  React.useEffect(() => {
    if (hidden) onDisabled?.();
  }, [hidden, onDisabled]);

  if (hidden) return null;

  let body: React.ReactElement;
  if (activeTab === 'chat') {
    body = (
      <ChatPane
        adapter={adapter}
        savedProductIds={savedProductIds}
        onToggleSave={saved.toggle}
        onHistoryAdd={history.add}
        density={settings.cardDensity}
        emptyStateVariant={settings.emptyStateVariant}
        greeting={settings.greetingMessage}
        prompts={settings.suggestedPrompts}
        autoSubmitQuery={resume}
        onAutoSubmitConsumed={handleAutoSubmitConsumed}
      />
    );
  } else if (activeTab === 'history') {
    body = (
      <HistoryPanel items={history.items} onClear={history.clear} onResume={handleResume} />
    );
  } else {
    body = (
      <SavedProductsPanel
        products={saved.items}
        onToggleSave={saved.toggle}
        density={settings.cardDensity}
      />
    );
  }

  // Pane wrapper: carries the merchant accent so every var(--sd-accent, …)
  // inside the panes resolves to the configured palette color.
  return (
    <div style={{ height: '100%', '--sd-accent': settings.drawerAccent } as React.CSSProperties}>
      {body}
    </div>
  );
}

export default DrawerBody;
