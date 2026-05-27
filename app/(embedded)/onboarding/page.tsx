'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type SyncState = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';

const TERMINAL_STATES: SyncState[] = ['succeeded', 'partial', 'failed'];

function stateLabel(s: SyncState | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const retryId = searchParams?.get('retry') ?? null;

  const [syncing, setSyncing] = useState(false);
  const [syncRunId, setSyncRunId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [retryRun, setRetryRun] = useState<{ state: SyncState; errors: string[] } | null>(null);

  async function handleStartSync() {
    if (syncing) return;

    // Retry from terminal state — clear so the polling effect re-runs cleanly.
    if (syncState && TERMINAL_STATES.includes(syncState)) {
      setSyncRunId(null);
      setSyncState(null);
      setProcessedCount(0);
      setTotalCount(null);
      setErrors([]);
    }

    setSyncing(true);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSyncRunId(data.syncRunId);
        setSyncState('queued');
        setProcessedCount(0);
        setTotalCount(null);
        setErrors([]);
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

  // One-shot lookup for ?retry= deep-link from failure notification email.
  // Only fires when retryId is present and no active sync is in progress.
  useEffect(() => {
    if (!retryId || syncRunId !== null) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await shopify.idToken();
        const res = await fetch(`/api/shopify/sync/status?syncRunId=${retryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.state === 'failed') {
            setRetryRun({ state: 'failed', errors: data.errors ?? [] });
          }
        }
      } catch {
        // Treat network/auth errors as silent dismiss (D-11)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryId, syncRunId]);

  useEffect(() => {
    if (!syncRunId) return;
    if (syncState && TERMINAL_STATES.includes(syncState)) return;

    const id = setInterval(async () => {
      try {
        const token = await shopify.idToken();
        const res = await fetch(`/api/shopify/sync/status?syncRunId=${syncRunId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSyncState(data.state);
          setProcessedCount(data.processedCount);
          setTotalCount(data.totalCount ?? null);
          setErrors(data.errors ?? []);
        }
      } catch {
        // transient network error; let next tick retry
      }
    }, 2000);

    return () => clearInterval(id);
  }, [syncRunId, syncState]);

  const progressValue = totalCount
    ? Math.round((processedCount / totalCount) * 100)
    : 0;

  return (
    <s-page heading="Welcome to SmartDiscovery AI">
      <s-section heading="How it works">
        <s-unordered-list>
          <s-list-item>We sync your product catalog automatically</s-list-item>
          <s-list-item>Our AI uses it to answer customer search queries</s-list-item>
          <s-list-item>You&apos;ll receive an email when the first sync completes</s-list-item>
        </s-unordered-list>

        {retryRun?.state === 'failed' && syncRunId === null ? (
          <s-banner tone="critical">
            Your previous sync failed — Retry?
            {retryRun.errors[0] ? <s-text>{retryRun.errors[0]}</s-text> : null}
            <s-button data-testid="retry-deep-link" variant="primary" onClick={handleStartSync}>
              Retry sync
            </s-button>
          </s-banner>
        ) : null}

        {syncRunId === null ? (
          <s-button
            data-testid="start-sync"
            variant="primary"
            onClick={handleStartSync}
            {...(syncing ? { loading: '' } : {})}
          >
            Start sync
          </s-button>
        ) : (
          <>
            <s-progress-bar
              data-testid="progress-bar"
              value={String(progressValue)}
            />
            <s-text>
              {totalCount
                ? `${processedCount} / ${totalCount} products (${progressValue}%)`
                : `${processedCount} products synced so far`}
            </s-text>
            <s-badge data-testid="state-badge">{stateLabel(syncState)}</s-badge>

            {syncState === 'succeeded' && (
              <>
                <s-banner tone="success">
                  Your store is ready — {processedCount} products synced
                </s-banner>
                <s-button
                  data-testid="open-chat"
                  variant="primary"
                  href="/chat"
                >
                  Open admin chat
                </s-button>
              </>
            )}

            {syncState === 'partial' && (
              <>
                <s-banner tone="warning">
                  {processedCount} products synced, {errors.length} failed
                </s-banner>
                <s-button data-testid="retry-sync" onClick={handleStartSync}>
                  Retry sync
                </s-button>
              </>
            )}

            {syncState === 'failed' && (
              <>
                <s-banner tone="critical">Sync failed</s-banner>
                <s-button data-testid="retry-sync" onClick={handleStartSync}>
                  Retry sync
                </s-button>
              </>
            )}
          </>
        )}
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
