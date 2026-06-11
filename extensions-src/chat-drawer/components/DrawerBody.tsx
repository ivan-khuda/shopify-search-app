'use client';
/**
 * DrawerBody — heavy panel renderer extracted so React.lazy can defer it.
 *
 * Owns the hook calls for DbBackedHistoryStore / DbBackedSavedProductsStore
 * (constructors throw on empty visitorId — Pitfall 3 — so this module is only
 * mounted when shop + visitorId are both truthy).
 *
 * Appearance (chat-redesign Task 14): one-shot fetch of the HMAC-verified
 * app-proxy meta endpoint (`/apps/smartdiscovery/_meta/appearance` — the
 * `/apps/smartdiscovery` prefix matches shopify.app.toml [app_proxy]).
 * Failures are silent — DEFAULT_APPEARANCE keeps the drawer rendering.
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
  DEFAULT_APPEARANCE,
  parseAppearance,
  type ShopAppearance,
} from '@/lib/chat-ui/appearance';
import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';

interface DrawerBodyProps {
  activeTab: 'chat' | 'history' | 'saved';
  shop: string;
  visitorId: string;
  customerId: string | null;
  /** Asks the tab-owning parent to switch to the chat tab (history resume). */
  onSwitchToChat?: () => void;
}

function DrawerBody({
  activeTab,
  shop,
  visitorId,
  customerId,
  onSwitchToChat,
}: DrawerBodyProps): React.ReactElement {
  const adapter = React.useMemo(() => new StorefrontAdapter(), []);
  const history = useDbBackedHistoryStore({ shop, visitorId, customerId });
  const saved = useDbBackedSavedProductsStore({ shop, visitorId, customerId });
  const savedProductIds = React.useMemo(
    () => new Set(saved.items.map((p) => p.id)),
    [saved.items],
  );

  const [appearance, setAppearance] = React.useState<ShopAppearance>(DEFAULT_APPEARANCE);
  const [resume, setResume] = React.useState<{ id: number; query: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/apps/smartdiscovery/_meta/appearance')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setAppearance(parseAppearance(data));
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

  if (activeTab === 'chat') {
    return (
      <ChatPane
        adapter={adapter}
        savedProductIds={savedProductIds}
        onToggleSave={saved.toggle}
        onHistoryAdd={history.add}
        density={appearance.cardDensity}
        emptyStateVariant={appearance.emptyStateVariant}
        autoSubmitQuery={resume}
        onAutoSubmitConsumed={handleAutoSubmitConsumed}
      />
    );
  }
  if (activeTab === 'history') {
    return <HistoryPanel items={history.items} onClear={history.clear} onResume={handleResume} />;
  }
  return (
    <SavedProductsPanel
      products={saved.items}
      onToggleSave={saved.toggle}
      density={appearance.cardDensity}
    />
  );
}

export default DrawerBody;
