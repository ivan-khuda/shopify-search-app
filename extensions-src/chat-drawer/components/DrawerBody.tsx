'use client';
/**
 * DrawerBody — heavy panel renderer extracted so React.lazy can defer it.
 *
 * Owns the hook calls for DbBackedHistoryStore / DbBackedSavedProductsStore
 * (constructors throw on empty visitorId — Pitfall 3 — so this module is only
 * mounted when shop + visitorId are both truthy).
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
import { StorefrontAdapter } from '@/lib/chat-ui/adapters/storefront';

interface DrawerBodyProps {
  activeTab: 'chat' | 'history' | 'saved';
  shop: string;
  visitorId: string;
  customerId: string | null;
}

function DrawerBody({ activeTab, shop, visitorId, customerId }: DrawerBodyProps): React.ReactElement {
  const adapter = React.useMemo(() => new StorefrontAdapter(), []);
  const history = useDbBackedHistoryStore({ shop, visitorId, customerId });
  const saved = useDbBackedSavedProductsStore({ shop, visitorId, customerId });
  const savedProductIds = React.useMemo(
    () => new Set(saved.items.map((p) => p.id)),
    [saved.items],
  );

  if (activeTab === 'chat') {
    return (
      <ChatPane
        adapter={adapter}
        savedProductIds={savedProductIds}
        onToggleSave={saved.toggle}
        onHistoryAdd={history.add}
      />
    );
  }
  if (activeTab === 'history') {
    // onResume is a no-op until the drawer grows tab-switch + resume wiring
    // (chat-redesign Task 14 reworks this component).
    return <HistoryPanel items={history.items} onClear={history.clear} onResume={() => {}} />;
  }
  return <SavedProductsPanel products={saved.items} onToggleSave={saved.toggle} />;
}

export default DrawerBody;
