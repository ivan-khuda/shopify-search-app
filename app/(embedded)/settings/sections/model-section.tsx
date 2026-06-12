'use client';

/**
 * Settings-redesign Task 9 — AI model section.
 *
 * Pixel reference: design handoff settings.jsx `ModelSection` (lines 66–183).
 * One radio card per catalog model: provider tile, name + "by {provider}" +
 * optional "Recommended" badge (default model only), bestFor line, and a
 * right-aligned pricing column ($/M in · out, context label). Selected card
 * carries the accent border + 3px accent ring.
 *
 * Save flow (ported from the retired settings-form.tsx):
 *   - PATCH /api/settings/model, Bearer session token,
 *     body `{ activeChatModelId }`.
 *   - 200 `{ ok, displayName }` → toast + "Currently active" updates.
 *   - Error → inline error code (D-07: codes are intentional UX signals).
 *   - Cold-start fallback catalog → Save stays disabled (catalog is a
 *     single synthesized row; saving against it is meaningless).
 *
 * Constraints (CLAUDE.md): zero `console.*`; ambient `shopify` global from
 * types/shopify-global.d.ts.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_MODEL_ID } from '@/services/chat/getActiveChatModel';
import type { CatalogModel } from '@/services/chat/model-catalog';
import type { ModelSectionProps } from './types';

/** Prototype provider tile colors (settings.jsx lines 67–72), keyed lowercase. */
const PROVIDER_LOGOS: Record<string, { bg: string; color: string; short: string }> = {
  google: { bg: '#fef3e2', color: '#d97706', short: 'G' },
  openai: { bg: '#dcfce7', color: '#15803d', short: 'A' },
  anthropic: { bg: '#fef0e6', color: '#c2410c', short: 'C' },
  meta: { bg: '#dbeafe', color: '#1d4ed8', short: 'M' },
};

function providerLogo(provider: string): { bg: string; color: string; short: string } {
  return (
    PROVIDER_LOGOS[provider.toLowerCase()] ?? {
      bg: '#f1f2f4',
      color: '#5c5f62',
      short: provider.charAt(0).toUpperCase() || '?',
    }
  );
}

function providerLabel(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Prototype line 147 logic, adapted from contextK (thousands) to raw tokens. */
function contextLabel(contextWindow: number): string {
  const k = Math.round(contextWindow / 1000);
  return k >= 1000 ? `${Math.round(k / 1000)}M` : `${k}K`;
}

export function ModelSection({ catalog, activeModel }: ModelSectionProps) {
  const [selectedId, setSelectedId] = useState(activeModel.id);
  const [active, setActive] = useState(activeModel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = selectedId !== active.id;
  const saveDisabled = !dirty || saving || catalog.coldStartFallback;

  async function handleSave() {
    if (saveDisabled) return;
    setSaving(true);
    setError(null);
    try {
      const token = await shopify.idToken();
      const res = await fetch('/api/settings/model', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activeChatModelId: selectedId }),
      });
      if (res.ok) {
        const body = (await res.json()) as { ok: boolean; displayName: string };
        setActive({ id: selectedId, displayName: body.displayName });
        shopify.toast.show(`Model updated to ${body.displayName}`);
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
      <div className="mb-[18px]">
        <h2 className="m-0 text-lg font-[650] tracking-[-0.01em] text-[#202223]">
          AI model
        </h2>
        <p className="m-0 mt-1 text-[13px] leading-normal text-[#5c5f62]">
          The chat model powering your storefront drawer and admin playground.
          Switching takes effect immediately — no redeploy.
        </p>
      </div>

      {(catalog.stale || catalog.coldStartFallback) && (
        <div
          role="status"
          className="mb-3 rounded-lg border border-[#ebebeb] bg-[#fafbfb] px-3 py-2 text-[12.5px] text-[#8c9196]"
        >
          Model catalog is temporarily unavailable — showing cached list.
        </div>
      )}

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="AI model">
        {catalog.models.map((m: CatalogModel) => {
          const isSelected = m.id === selectedId;
          const logo = providerLogo(m.provider);
          return (
            <label
              key={m.id}
              className={cn(
                'grid cursor-pointer grid-cols-[24px_36px_1fr_auto] items-center gap-3.5 rounded-xl border-[1.5px] bg-white px-4 py-3.5 transition-all duration-150',
                isSelected
                  ? 'border-[var(--sd-accent,#5B4FE9)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--sd-accent,#5B4FE9)_12%,transparent)]'
                  : 'border-[#e1e3e5] shadow-none',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 bg-white',
                  isSelected ? 'border-[var(--sd-accent,#5B4FE9)]' : 'border-[#c9ccd0]',
                )}
              >
                {isSelected && (
                  <span className="h-2 w-2 rounded-full bg-[var(--sd-accent,#5B4FE9)]" />
                )}
              </span>
              <input
                type="radio"
                name="active-model"
                value={m.id}
                checked={isSelected}
                onChange={() => setSelectedId(m.id)}
                aria-label={`Select ${m.displayName}`}
                className="sr-only"
              />

              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold"
                style={{ background: logo.bg, color: logo.color }}
                aria-hidden="true"
              >
                {logo.short}
              </div>

              <div>
                <div className="mb-[2px] flex items-center gap-2">
                  <span className="text-sm font-[650] text-[#202223]">
                    {m.displayName}
                  </span>
                  <span className="text-[11.5px] text-[#6d7175]">
                    by {providerLabel(m.provider)}
                  </span>
                  {m.id === DEFAULT_MODEL_ID && (
                    <span className="rounded-md bg-[var(--sd-accent,#5B4FE9)]/[0.12] px-[7px] py-[2px] text-[10px] font-bold tracking-[0.02em] text-[var(--sd-accent,#5B4FE9)]">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] leading-[1.4] text-[#5c5f62]">
                  {m.bestFor}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] font-medium tracking-[0.02em] text-[#8c9196] uppercase">
                  Per 1M tokens
                </div>
                <div className="mt-[2px] text-[13px] font-semibold text-[#202223] tabular-nums">
                  ${m.inputPricePerMillion.toFixed(2)}{' '}
                  <span className="font-normal text-[#a5acb1]">in</span>
                  {' · '}${m.outputPricePerMillion.toFixed(2)}{' '}
                  <span className="font-normal text-[#a5acb1]">out</span>
                </div>
                <div className="mt-[2px] text-[11px] text-[#8c9196]">
                  {contextLabel(m.contextWindow)} context
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Info note — prototype lines 155–166, copy verbatim */}
      <div className="mt-[18px] flex items-start gap-2.5 rounded-[10px] border border-[#ebebeb] bg-[#fafbfb] px-3.5 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6d7175"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-[2px] shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h0" />
        </svg>
        <div className="text-[12.5px] leading-normal text-[#5c5f62]">
          Pricing reflects the Vercel AI Gateway live rate card. We pin a
          specific model version per shop so behavior never silently changes
          underneath you. Embeddings are billed separately at $0.02 / 1M tokens.
        </div>
      </div>

      {/* Save row — prototype lines 168–180 */}
      <div className="mt-[18px] flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="cursor-pointer rounded-lg border-none bg-[#202223] px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-default disabled:opacity-50"
        >
          Save changes
        </button>
        <span className="text-xs text-[#6d7175]">
          Currently active:{' '}
          <strong className="font-semibold text-[#202223]">{active.displayName}</strong>
        </span>
        {error && (
          <span role="alert" className="text-xs font-medium text-[#bf4800]">
            Save failed: {error}
          </span>
        )}
      </div>
    </div>
  );
}
