'use client';

/**
 * Settings-redesign Task 10 — Drawer styling section.
 *
 * Pixel reference: design handoff settings.jsx `DrawerSection` (lines
 * 185–241): accent swatches (36px, 9px radius, dark ring on the selected
 * one), greeting input, suggested-prompt chip editor with inline edit
 * (pencil toggles the row into icon + text inputs) and a dashed
 * "+ Add prompt" footer.
 *
 * Two save paths, mirroring the retired settings-form split:
 *   - "Save changes" → PATCH /api/settings/shop with ONLY the changed
 *     drawer fields (accent / greeting / prompts). Empty greeting is sent
 *     as '' — the route nulls it back to the built-in copy.
 *   - "Save appearance" → PATCH /api/settings/appearance with ONLY the
 *     changed appearance fields (empty-state variant / card density).
 * Both use Bearer `shopify.idToken()`; errors surface inline as raw codes
 * (D-07: codes are intentional UX signals). Zero `console.*` (CLAUDE.md).
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CARD_DENSITIES,
  EMPTY_STATE_VARIANTS,
  type CardDensity,
  type EmptyStateVariant,
} from '@/lib/chat-ui/appearance';
import { BUILTIN_GREETING } from '@/lib/chat-ui/components/empty-chat';
import {
  DRAWER_ACCENT_PALETTE,
  MAX_GREETING,
  MAX_PROMPT_ICON,
  MAX_PROMPT_TEXT,
  MAX_SUGGESTED_PROMPTS,
  type DrawerAccent,
  type SuggestedPrompt,
} from '@/lib/settings/contract';
import {
  INPUT_CLASS,
  SAVE_BUTTON_CLASS,
  SectionHeader,
  SettingsCard,
} from './settings-card';
import type { DrawerSectionProps } from './types';

const ICON_BUTTON_CLASS =
  'cursor-pointer border-none bg-transparent p-0 text-sm text-[#6d7175]';

interface PromptRow extends SuggestedPrompt {
  editing: boolean;
}

function cleanPrompts(rows: PromptRow[]): SuggestedPrompt[] {
  return rows
    .filter((r) => r.icon.trim() !== '' && r.text.trim() !== '')
    .map((r) => ({ icon: r.icon, text: r.text }));
}

function samePrompts(a: SuggestedPrompt[], b: SuggestedPrompt[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function labelOf(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DrawerSection({ settings }: DrawerSectionProps) {
  // ── Drawer fields (PATCH /api/settings/shop) ──────────────────────────
  const [base, setBase] = useState({
    accent: settings.drawerAccent,
    greeting: settings.greetingMessage ?? '',
    prompts: settings.suggestedPrompts,
  });
  const [accent, setAccent] = useState<DrawerAccent>(settings.drawerAccent);
  const [greeting, setGreeting] = useState(settings.greetingMessage ?? '');
  const [rows, setRows] = useState<PromptRow[]>(
    settings.suggestedPrompts.map((p) => ({ ...p, editing: false })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompts = cleanPrompts(rows);
  const accentDirty = accent !== base.accent;
  const greetingDirty = greeting !== base.greeting;
  const promptsDirty = !samePrompts(prompts, base.prompts);
  const dirty = accentDirty || greetingDirty || promptsDirty;

  // ── Appearance fields (PATCH /api/settings/appearance) ────────────────
  const [appearanceBase, setAppearanceBase] = useState({
    emptyStateVariant: settings.emptyStateVariant,
    cardDensity: settings.cardDensity,
  });
  const [variant, setVariant] = useState<EmptyStateVariant>(settings.emptyStateVariant);
  const [density, setDensity] = useState<CardDensity>(settings.cardDensity);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);

  const appearanceDirty =
    variant !== appearanceBase.emptyStateVariant ||
    density !== appearanceBase.cardDensity;

  async function patchWithToken(
    url: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; error: string | null }> {
    try {
      const token = await shopify.idToken();
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true, error: null };
      const payload = await res.json().catch(() => ({}) as { error?: string });
      return { ok: false, error: payload.error ?? 'save_failed' };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {};
    if (accentDirty) body.drawerAccent = accent;
    if (greetingDirty) body.greetingMessage = greeting;
    if (promptsDirty) body.suggestedPrompts = prompts;

    const result = await patchWithToken('/api/settings/shop', body);
    if (result.ok) {
      setBase({ accent, greeting, prompts });
      shopify.toast.show('Drawer styling saved');
    } else {
      setError(result.error);
    }
    setSaving(false);
  }

  async function handleSaveAppearance() {
    if (!appearanceDirty || appearanceSaving) return;
    setAppearanceSaving(true);
    setAppearanceError(null);
    const body: Record<string, unknown> = {};
    if (variant !== appearanceBase.emptyStateVariant) body.emptyStateVariant = variant;
    if (density !== appearanceBase.cardDensity) body.cardDensity = density;

    const result = await patchWithToken('/api/settings/appearance', body);
    if (result.ok) {
      setAppearanceBase({ emptyStateVariant: variant, cardDensity: density });
      shopify.toast.show('Appearance saved');
    } else {
      setAppearanceError(result.error);
    }
    setAppearanceSaving(false);
  }

  function updateRow(index: number, patch: Partial<PromptRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <SectionHeader
        title="Drawer styling"
        description="Merchant-facing knobs that surface in the Theme Editor App Embed settings."
      />

      <SettingsCard
        title="Accent color"
        description="Used for the FAB, sent messages, and primary CTAs in the drawer."
      >
        <div className="flex gap-2">
          {DRAWER_ACCENT_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use accent ${c}`}
              aria-pressed={c === accent}
              onClick={() => setAccent(c)}
              className={cn(
                'h-9 w-9 cursor-pointer rounded-[9px]',
                c === accent
                  ? 'border-[3px] border-[#202223] shadow-[inset_0_0_0_2px_#fff]'
                  : 'border border-black/10',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Greeting message"
        description="Shown in the empty state when shoppers first open the drawer."
      >
        <input
          type="text"
          aria-label="Greeting message"
          value={greeting}
          maxLength={MAX_GREETING}
          placeholder={BUILTIN_GREETING}
          onChange={(e) => setGreeting(e.target.value)}
          className={INPUT_CLASS}
        />
      </SettingsCard>

      <SettingsCard
        title="Suggested prompt chips"
        description="Quick-pick prompts shown to first-time visitors. 3–4 work best."
      >
        <div className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-[#ebebeb] bg-[#fafbfb] px-2.5 py-1.5"
            >
              {row.editing ? (
                <>
                  <input
                    type="text"
                    aria-label={`Prompt ${i + 1} icon`}
                    value={row.icon}
                    maxLength={MAX_PROMPT_ICON}
                    onChange={(e) => updateRow(i, { icon: e.target.value })}
                    className={cn(INPUT_CLASS, 'w-12 text-center')}
                  />
                  <input
                    type="text"
                    aria-label={`Prompt ${i + 1} text`}
                    value={row.text}
                    maxLength={MAX_PROMPT_TEXT}
                    onChange={(e) => updateRow(i, { text: e.target.value })}
                    className={cn(INPUT_CLASS, 'flex-1')}
                  />
                </>
              ) : (
                <>
                  <span className="text-sm">{row.icon}</span>
                  <span className="flex-1 text-[13px] text-[#202223]">{row.text}</span>
                </>
              )}
              <button
                type="button"
                aria-label={`Edit prompt ${i + 1}`}
                onClick={() => updateRow(i, { editing: !row.editing })}
                className={ICON_BUTTON_CLASS}
              >
                ✏️
              </button>
              <button
                type="button"
                aria-label={`Remove prompt ${i + 1}`}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                className={ICON_BUTTON_CLASS}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={rows.length >= MAX_SUGGESTED_PROMPTS}
            onClick={() =>
              setRows((prev) => [...prev, { icon: '✨', text: '', editing: true }])
            }
            className="cursor-pointer rounded-lg border border-dashed border-[#c9ccd0] bg-white p-2 text-[12.5px] text-[#6d7175] disabled:cursor-default disabled:opacity-50"
          >
            + Add prompt
          </button>
        </div>
      </SettingsCard>

      <div className="mb-6 flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={SAVE_BUTTON_CLASS}
        >
          Save changes
        </button>
        {error && (
          <span role="alert" className="text-xs font-medium text-[#bf4800]">
            Save failed: {error}
          </span>
        )}
      </div>

      <SettingsCard
        title="Empty state style"
        description="Layout shoppers see before the first message."
      >
        <div role="radiogroup" aria-label="Empty state style" className="flex gap-4">
          {EMPTY_STATE_VARIANTS.map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-1.5 text-[13px] text-[#202223]"
            >
              <input
                type="radio"
                name="empty-state-variant"
                value={v}
                checked={variant === v}
                onChange={() => setVariant(v)}
                className="accent-[var(--sd-accent,#5B4FE9)]"
              />
              {labelOf(v)}
            </label>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Product card density"
        description="How much detail each product result shows."
      >
        <div
          role="radiogroup"
          aria-label="Product card density"
          className="flex gap-4"
        >
          {CARD_DENSITIES.map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-1.5 text-[13px] text-[#202223]"
            >
              <input
                type="radio"
                name="card-density"
                value={d}
                checked={density === d}
                onChange={() => setDensity(d)}
                className="accent-[var(--sd-accent,#5B4FE9)]"
              />
              {labelOf(d)}
            </label>
          ))}
        </div>
      </SettingsCard>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleSaveAppearance}
          disabled={!appearanceDirty || appearanceSaving}
          className={SAVE_BUTTON_CLASS}
        >
          Save appearance
        </button>
        {appearanceError && (
          <span role="alert" className="text-xs font-medium text-[#bf4800]">
            Save failed: {appearanceError}
          </span>
        )}
      </div>
    </div>
  );
}
