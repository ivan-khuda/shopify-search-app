'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StepRail, type SyncStage } from './step-rail';
import { InfoCards } from './info-cards';

type SyncState = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';

const TERMINAL_STATES: SyncState[] = ['succeeded', 'partial', 'failed'];

function stateLabel(s: SyncState | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// useSearchParams() forces a CSR bailout during prerender; Next requires a
// Suspense boundary around it for `next build` to succeed on this route.
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
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
        const res = await fetch(`/api/shopify/sync/status?syncRunId=${encodeURIComponent(retryId)}`, {
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

  const stage: SyncStage =
    syncState === 'succeeded' ? 2 : syncRunId !== null ? 1 : 0;

  const isRunning =
    syncRunId !== null && (syncState === null || syncState === 'queued' || syncState === 'running');

  const syncHeading =
    syncState === 'succeeded'
      ? 'Catalog synced and indexed'
      : syncState === 'partial'
        ? 'Sync finished with errors'
        : syncState === 'failed'
          ? 'Sync failed'
          : isRunning
            ? 'Syncing your catalog'
            : 'Sync your product catalog';

  return (
    <s-page heading="Welcome to SmartDiscovery AI">
      <s-paragraph>
        Three steps and your storefront can answer natural-language questions
        about your catalog. We&apos;ll sync your products, generate embeddings,
        and turn on the chat drawer.
      </s-paragraph>

      <StepRail stage={stage} />

      <s-section heading={syncHeading}>
        {syncRunId === null && (
          <s-paragraph>
            We&apos;ll pull every active product, generate embeddings, and create
            the search index. Takes a few minutes for most shops.
          </s-paragraph>
        )}
        {isRunning && (
          <s-paragraph>
            You can close this tab — we&apos;ll email you the moment it finishes.
          </s-paragraph>
        )}

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
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button
              data-testid="start-sync"
              variant="primary"
              onClick={handleStartSync}
              {...(syncing ? { loading: '' } : {})}
            >
              Start sync
            </s-button>
            <s-text tone="subdued">
              You can keep using your store while sync runs in the background.
            </s-text>
          </s-stack>
        ) : (
          <>
            {isRunning && (
              <>
                <s-progress-bar
                  data-testid="progress-bar"
                  value={String(progressValue)}
                />
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-text>
                    {totalCount
                      ? `${processedCount} of ${totalCount} products (${progressValue}%)`
                      : `${processedCount} products synced so far`}
                  </s-text>
                  <s-badge data-testid="state-badge">{stateLabel(syncState)}</s-badge>
                </s-stack>
              </>
            )}

            {syncState === 'succeeded' && (
              <>
                <s-paragraph>
                  {totalCount ?? processedCount} products are now searchable. Try
                  the admin chat to see real results.
                </s-paragraph>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-box
                    padding="base"
                    borderWidth="small"
                    borderStyle="solid"
                    borderColor="base"
                    borderRadius="base"
                    background="subdued"
                    data-testid="stat-products"
                  >
                    <s-text tone="subdued">Products</s-text>
                    <s-heading>{String(totalCount ?? processedCount)}</s-heading>
                  </s-box>
                  <s-box
                    padding="base"
                    borderWidth="small"
                    borderStyle="solid"
                    borderColor="base"
                    borderRadius="base"
                    background="subdued"
                    data-testid="stat-embeddings"
                  >
                    <s-text tone="subdued">Embeddings</s-text>
                    <s-heading>{String(totalCount ?? processedCount)}</s-heading>
                  </s-box>
                </s-grid>
                <s-stack direction="inline" gap="base">
                  <s-button data-testid="open-chat" variant="primary" href="/chat">
                    Open admin chat
                  </s-button>
                  <s-button data-testid="configure-model" href="/settings">
                    Configure model
                  </s-button>
                </s-stack>
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

      <InfoCards />
    </s-page>
  );
}
