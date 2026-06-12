'use client';

/**
 * Settings-redesign Task 12 — Sync & webhooks section.
 *
 * Pixel reference: design handoff settings.jsx `WebhooksSection` (lines
 * 292–339): monospace topic rows (green 8px dot, muted right-aligned
 * "last fired …"), and the manual-resync card with an outline button and
 * the last-successful-sync footnote.
 *
 * Data is SSR-only (webhook last-fired map + last successful run summary
 * from the page Server Component). The resync button POSTs the existing
 * /api/shopify/sync endpoint (Bearer `shopify.idToken()`, returns
 * `{ syncRunId }`) — running state while in flight, "Sync queued" on
 * success, raw error code inline on failure (D-07).
 * Zero `console.*` (CLAUDE.md).
 */
import { useState } from 'react';
import { SettingsIcon } from './settings-icon';
import { SectionHeader, SettingsCard } from './settings-card';
import type { WebhooksSectionProps } from './types';

/** Topics the app subscribes to — mirrors the prototype list verbatim. */
const TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'app/uninstalled',
] as const;

const MIN_MS = 60_000;

/** "2m ago" / "3h ago" / "5d ago" — minutes, hours, days; no dependency. */
function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / MIN_MS);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** finishedAt − startedAt formatted "Xm Ys". */
function duration(startedAt: string, finishedAt: string): string {
  const totalSeconds = Math.max(
    0,
    Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  );
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

function syncDateLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export function WebhooksSection({ webhooks, lastSync }: WebhooksSectionProps) {
  const [syncing, setSyncing] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResync() {
    if (syncing) return;
    setSyncing(true);
    setQueued(false);
    setError(null);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setQueued(true);
      } else {
        const body = await res.json().catch(() => ({}) as { error?: string });
        setError(body.error ?? 'sync_failed');
      }
    } catch {
      setError('network_error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Sync & webhooks"
        description="How your catalog stays in lockstep with Shopify."
      />

      <SettingsCard
        title="Subscribed topics"
        description="Webhooks we verify (HMAC) and process for incremental updates."
      >
        <div className="flex flex-col gap-1.5">
          {TOPICS.map((topic) => (
            <div
              key={topic}
              className="flex items-center gap-2.5 rounded-lg border border-[#ebebeb] bg-[#fafbfb] px-3 py-2 font-mono text-[13px] text-[#202223]"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#008060]"
              />
              {topic}
              <span className="ml-auto font-mono text-[11px] text-[#8c9196]">
                last fired {webhooks[topic] ? relativeTime(webhooks[topic]) : '—'}
              </span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Manual resync"
        description="Re-run a full sync if something looks off."
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResync}
            disabled={syncing}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#c9ccd0] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#202223] disabled:cursor-default disabled:opacity-50"
          >
            <SettingsIcon name="sync" size={13} />
            {syncing ? 'Running…' : 'Run full resync'}
          </button>
          {queued && (
            <span role="status" className="text-xs font-medium text-[#008060]">
              Sync queued
            </span>
          )}
          {error && (
            <span role="alert" className="text-xs font-medium text-[#bf4800]">
              Sync failed: {error}
            </span>
          )}
        </div>
        {lastSync && (
          <div className="mt-1.5 text-[11.5px] text-[#8c9196]">
            Last successful sync: {syncDateLabel(lastSync.finishedAt)} ·{' '}
            {lastSync.processedCount} products ·{' '}
            {duration(lastSync.startedAt, lastSync.finishedAt)}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
