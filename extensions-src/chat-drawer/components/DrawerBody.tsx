'use client';
/**
 * DrawerBody — heavy pane renderer extracted so React.lazy can defer it
 * (drawer-redesign Task 8).
 *
 * Owns the hook calls for DbBackedHistoryStore / DbBackedSavedProductsStore
 * (constructors throw on empty visitorId — Pitfall 3 — so this module is only
 * mounted when shop + visitorId are both truthy).
 *
 * Settings now arrive as a prop: StorefrontDrawer performs the single
 * mount-time fetch of the app-proxy meta endpoint (it needs fabStyle /
 * drawerPosition / the kill-switch before this lazy module ever loads) and
 * threads the parsed ShopSettingsBundle down. This module no longer fetches
 * and no longer owns the kill-switch.
 *
 * Renders the compact drawer panes (DrawerChat / DrawerHistory / DrawerSaved)
 * instead of the admin ChatPane / HistoryPanel / SavedProductsPanel — keeping
 * the admin compound prompt-input out of the storefront chunks entirely.
 *
 * Tab badges: history/saved item counts are reported to the tab-owning
 * parent via onCountsChange.
 *
 * Resume: history rows re-run their query in the chat tab. The parent owns
 * the tab state, so DrawerBody keeps the pending `resume` payload locally and
 * asks the parent to switch tabs via `onSwitchToChat`; DrawerChat consumes
 * `autoSubmitQuery` once per id change (useChatController contract).
 *
 * Default export is required by React.lazy.
 */
import * as React from 'react';
// Sub-path import (NOT the `@/lib/chat-ui` barrel): the barrel re-exports
// ProductCard/ChatMessage which pull in next/image — its module-scope
// `process.env.*` reads crash the storefront bundle in the browser
// ("process is not defined") and bloat the chunk. The build script's
// process.env guard enforces this.
import {
  useDbBackedHistoryStore,
  useDbBackedSavedProductsStore,
} from '@/lib/chat-ui/stores/hooks';
import type { ShopSettingsBundle } from '@/lib/settings/contract';
import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';
import { DrawerChat } from './DrawerChat';
import { DrawerHistory } from './DrawerHistory';
import { DrawerSaved } from './DrawerSaved';

interface DrawerBodyProps {
  activeTab: 'chat' | 'history' | 'saved';
  shop: string;
  visitorId: string;
  customerId: string | null;
  /** Parsed per-shop settings bundle — fetched once by StorefrontDrawer. */
  settings: ShopSettingsBundle;
  /** Asks the tab-owning parent to switch to the chat tab (history resume). */
  onSwitchToChat?: () => void;
  /** Reports history/saved item counts for the parent's tab badges. */
  onCountsChange?: (counts: { history: number; saved: number }) => void;
}

function DrawerBody({
  activeTab,
  shop,
  visitorId,
  customerId,
  settings,
  onSwitchToChat,
  onCountsChange,
}: DrawerBodyProps): React.ReactElement {
  const adapter = React.useMemo(() => new StorefrontAdapter(), []);
  const history = useDbBackedHistoryStore({ shop, visitorId, customerId });
  const saved = useDbBackedSavedProductsStore({ shop, visitorId, customerId });
  const savedProductIds = React.useMemo(
    () => new Set(saved.items.map((p) => p.id)),
    [saved.items],
  );

  const [resume, setResume] = React.useState<{ id: number; query: string } | null>(null);

  const historyCount = history.items.length;
  const savedCount = saved.items.length;
  React.useEffect(() => {
    onCountsChange?.({ history: historyCount, saved: savedCount });
  }, [historyCount, savedCount, onCountsChange]);

  const handleResume = React.useCallback(
    (query: string) => {
      setResume({ id: Date.now(), query });
      onSwitchToChat?.();
    },
    [onSwitchToChat],
  );

  // Tab switches unmount DrawerChat (each tab renders a different tree), which
  // resets its once-per-id guard — a stale `resume` would re-submit on the
  // next chat-tab mount, so clear it as soon as the pane consumes it.
  const handleAutoSubmitConsumed = React.useCallback(() => {
    setResume(null);
  }, []);

  let body: React.ReactElement;
  if (activeTab === 'chat') {
    body = (
      <DrawerChat
        adapter={adapter}
        savedProductIds={savedProductIds}
        onToggleSave={saved.toggle}
        onHistoryAdd={history.add}
        greeting={settings.greetingMessage}
        prompts={settings.suggestedPrompts}
        autoSubmitQuery={resume}
        onAutoSubmitConsumed={handleAutoSubmitConsumed}
      />
    );
  } else if (activeTab === 'history') {
    body = <DrawerHistory items={history.items} onClear={history.clear} onResume={handleResume} />;
  } else {
    body = <DrawerSaved products={saved.items} onToggleSave={saved.toggle} />;
  }

  // Pane wrapper: carries the merchant accent so every var(--sd-accent, …)
  // inside the panes resolves to the configured palette color.
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ '--sd-accent': settings.drawerAccent } as React.CSSProperties}
    >
      {body}
    </div>
  );
}

export default DrawerBody;
