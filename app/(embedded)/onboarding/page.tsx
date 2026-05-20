'use client';

import { useState } from 'react';

export default function OnboardingPage() {
  const [syncing, setSyncing] = useState(false);

  async function handleStartSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        shopify.toast.show('Sync started');
      } else if (res.status === 401) {
        shopify.toast.show('Session expired. Reload the app.', { isError: true });
      } else {
        shopify.toast.show('Sync failed. Try again.', { isError: true });
      }
    } catch {
      shopify.toast.show('Sync failed. Try again.', { isError: true });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <s-page heading="Welcome to SmartDiscovery AI">
      <s-section heading="How it works">
        <s-unordered-list>
          <s-list-item>We sync your product catalog automatically</s-list-item>
          <s-list-item>Our AI uses it to answer customer search queries</s-list-item>
          <s-list-item>You&apos;ll receive an email when the first sync completes</s-list-item>
        </s-unordered-list>
        <s-button
          data-testid="start-sync"
          variant="primary"
          onClick={handleStartSync}
          {...(syncing ? { loading: '' } : {})}
        >
          Start sync
        </s-button>
      </s-section>

      <s-section heading="What's synced">
        <s-unordered-list>
          <s-list-item>Product titles, descriptions, tags</s-list-item>
          <s-list-item>Variants and pricing</s-list-item>
          <s-list-item>Images</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="What's next">
        <s-unordered-list>
          <s-list-item>After sync: use the Search tab to test queries</s-list-item>
          <s-list-item>Billing will be introduced in a future update</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
