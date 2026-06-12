'use client';

/**
 * Settings-redesign Task 13 — General section.
 *
 * Pixel reference: design handoff settings.jsx `GeneralSection` (lines
 * 341–366). Notification email card (explicit Save — empty input saves
 * null, reverting sync emails to the shop contact address) and the two
 * storefront toggles.
 *
 * Toggles PATCH /api/settings/shop immediately on flip — optimistic, like
 * the chat-header density control (chat-shell.tsx persistDensity): the UI
 * keeps the flipped value even if the request fails. Email save surfaces
 * the raw error code inline (D-07). Zero `console.*` (CLAUDE.md).
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  INPUT_CLASS,
  SAVE_BUTTON_CLASS,
  SectionHeader,
  SettingsCard,
} from './settings-card';
import { Toggle } from './toggle';
import type { GeneralSectionProps } from './types';

async function patchShopSettings(body: Record<string, unknown>): Promise<Response> {
  const token = await shopify.idToken();
  return fetch('/api/settings/shop', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

/** Fire-and-forget flag persistence — optimistic value stays on failure. */
async function persistFlag(body: Record<string, unknown>): Promise<void> {
  try {
    await patchShopSettings(body);
  } catch {
    // ignore — optimistic value stays (mirrors chat-shell persistDensity)
  }
}

export function GeneralSection({ settings }: GeneralSectionProps) {
  const [email, setEmail] = useState(settings.notificationEmail ?? '');
  const [savedEmail, setSavedEmail] = useState(settings.notificationEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerEnabled, setDrawerEnabled] = useState(settings.drawerEnabled);
  const [editorPreviewVisible, setEditorPreviewVisible] = useState(
    settings.editorPreviewVisible,
  );

  const emailDirty = email !== savedEmail;

  async function handleSaveEmail() {
    if (!emailDirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await patchShopSettings({
        notificationEmail: email.trim() === '' ? null : email.trim(),
      });
      if (res.ok) {
        setSavedEmail(email);
        shopify.toast.show('Notification email saved');
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

  function handleToggleDrawer(next: boolean) {
    setDrawerEnabled(next);
    void persistFlag({ drawerEnabled: next });
  }

  function handleToggleEditorPreview(next: boolean) {
    setEditorPreviewVisible(next);
    void persistFlag({ editorPreviewVisible: next });
  }

  return (
    <div>
      <SectionHeader
        title="General"
        description="Account, notifications, and the storefront experience."
      />

      <SettingsCard
        title="Notification email"
        description="Where we send sync completion summaries and incident alerts."
      >
        <div className="flex items-center gap-2.5">
          <input
            type="email"
            aria-label="Notification email"
            value={email}
            placeholder="Shop contact email"
            onChange={(e) => setEmail(e.target.value)}
            className={cn(INPUT_CLASS, 'flex-1')}
          />
          <button
            type="button"
            onClick={handleSaveEmail}
            disabled={!emailDirty || saving}
            className={SAVE_BUTTON_CLASS}
          >
            Save email
          </button>
        </div>
        {error && (
          <div role="alert" className="mt-2 text-xs font-medium text-[#bf4800]">
            Save failed: {error}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Enable on storefront"
        description="Turn the chat drawer on or off without touching your theme."
      >
        <Toggle
          on={drawerEnabled}
          label="Drawer is live"
          ariaLabel="Enable on storefront"
          onToggle={handleToggleDrawer}
        />
      </SettingsCard>

      <SettingsCard
        title="Show in Theme Editor preview"
        description="Allow the FAB to appear when previewing themes (auto-open is disabled)."
      >
        <Toggle
          on={editorPreviewVisible}
          label="Visible in editor"
          ariaLabel="Show in Theme Editor preview"
          onToggle={handleToggleEditorPreview}
        />
      </SettingsCard>
    </div>
  );
}
