'use client';

/**
 * Settings-redesign Task 11 — Usage & limits section.
 *
 * Pixel reference: design handoff settings.jsx `LimitsSection` (lines
 * 243–290) + `Stat` (385–394). "This month" card: 28px tabular-nums used
 * count, "of {cap} chat requests", right-aligned "{pct}% used" (accent
 * under 80%, #bf4800 above — same color drives the progress bar), then the
 * Storefront / Admin playground stat pair. The prototype's "Avg latency"
 * stat is omitted: no latency data exists server-side yet.
 *
 * Usage arrives as an SSR prop (no client fetch in V1). The hard-cap input
 * saves { monthlyCapRequests } to PATCH /api/settings/shop (Bearer
 * `shopify.idToken()`); the route's cap_above_limit rejection surfaces
 * inline as the raw code (D-07). Zero `console.*` (CLAUDE.md).
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  INPUT_CLASS,
  SAVE_BUTTON_CLASS,
  SectionHeader,
  SettingsCard,
} from './settings-card';
import type { LimitsSectionProps } from './types';

const DAY_MS = 86_400_000;

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

/** Prototype `Stat` (settings.jsx 385–394). */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold tracking-[0.04em] text-[#8c9196] uppercase">
        {label}
      </div>
      <div className="mt-[2px] text-sm font-semibold text-[#202223] tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function LimitsSection({ usage }: LimitsSectionProps) {
  const [capValue, setCapValue] = useState(String(usage.cap));
  const [savedCap, setSavedCap] = useState(String(usage.cap));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = usage.cap > 0 ? Math.round((usage.used / usage.cap) * 100) : 0;
  const overThreshold = pct > 80;
  const barColor = overThreshold ? '#bf4800' : 'var(--sd-accent, #5B4FE9)';

  const parsedCap = Number.parseInt(capValue, 10);
  const dirty = capValue !== savedCap && Number.isInteger(parsedCap) && parsedCap > 0;

  async function handleSaveCap() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/settings/shop', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monthlyCapRequests: parsedCap }),
      });
      if (res.ok) {
        setSavedCap(capValue);
        shopify.toast.show('Cap updated');
      } else {
        const body = await res.json().catch(() => ({}) as { error?: string });
        setError(body.error ?? 'save_failed');
      }
    } catch {
      setError('network_error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Usage & limits"
        description="V1 is free with a monthly cap. Billing arrives in a future release."
      />

      <SettingsCard
        title="This month"
        description={`${usage.periodLabel} · resets in ${daysUntil(usage.resetsAt)} days`}
      >
        <div className="mb-2.5 flex items-baseline gap-2">
          <span className="text-[28px] font-[650] tracking-[-0.02em] text-[#202223] tabular-nums">
            {usage.used.toLocaleString('en-US')}
          </span>
          <span className="text-sm text-[#6d7175]">
            of {usage.cap.toLocaleString('en-US')} chat requests
          </span>
          <span
            className={cn(
              'ml-auto text-xs font-semibold',
              overThreshold ? 'text-[#bf4800]' : 'text-[var(--sd-accent,#5B4FE9)]',
            )}
          >
            {pct}% used
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-md bg-[#f1f2f4]">
          <div
            data-testid="usage-bar-fill"
            className="h-full rounded-md transition-[width] duration-[400ms]"
            style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
          />
        </div>
        <div className="mt-3.5 flex gap-4 text-xs">
          <Stat label="Storefront" value={usage.storefrontUsed.toLocaleString('en-US')} />
          <Stat
            label="Admin playground"
            value={usage.adminUsed.toLocaleString('en-US')}
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Hard cap"
        description="When reached, the drawer shows a friendly “limit reached” message instead of failing."
      >
        <div className="flex items-center gap-2.5">
          <input
            type="number"
            aria-label="Monthly request cap"
            value={capValue}
            min={1}
            onChange={(e) => setCapValue(e.target.value)}
            className={cn(INPUT_CLASS, 'w-[120px]')}
          />
          <span className="text-[13px] text-[#6d7175]">requests / month</span>
          <button
            type="button"
            onClick={handleSaveCap}
            disabled={!dirty || saving}
            className={SAVE_BUTTON_CLASS}
          >
            Save cap
          </button>
          {error && (
            <span role="alert" className="text-xs font-medium text-[#bf4800]">
              Save failed: {error}
            </span>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
