'use client';

/**
 * Settings-redesign Task 8 — client side-nav shell for /settings.
 *
 * Pixel reference: design handoff settings.jsx `SettingsScreen` (lines 1–51)
 * + `SettingsIcon` (53–64). Layout: 1080px max-width two-column grid
 * (200px nav / 1fr content), 28px gutters, 80px bottom padding. The accent
 * var `--sd-accent` is set on the shell root (mirrors chat-shell.tsx) so
 * every section can reference `var(--sd-accent,#5B4FE9)`.
 */
import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { SD_ACCENT } from '@/lib/chat-ui/appearance';
import { ModelSection } from './sections/model-section';
import { DrawerSection } from './sections/drawer-section';
import { LimitsSection } from './sections/limits-section';
import { WebhooksSection } from './sections/webhooks-section';
import { GeneralSection } from './sections/general-section';
import type { SettingsShellProps } from './sections/types';
import { SettingsIcon } from './sections/settings-icon';

const NAV_ITEMS = [
  { id: 'model', label: 'AI model', icon: 'sparkle' },
  { id: 'drawer', label: 'Drawer styling', icon: 'paint' },
  { id: 'limits', label: 'Usage & limits', icon: 'gauge' },
  { id: 'webhooks', label: 'Sync & webhooks', icon: 'sync' },
  { id: 'general', label: 'General', icon: 'gear' },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]['id'];

export function SettingsShell(props: SettingsShellProps) {
  const [section, setSection] = useState<SectionId>('model');

  return (
    <div
      className="mx-auto grid max-w-[1080px] grid-cols-[200px_1fr] gap-7 px-7 pt-7 pb-20"
      style={{ '--sd-accent': SD_ACCENT } as CSSProperties}
    >
      {/* Side nav — prototype lines 12–39 */}
      <nav>
        <div className="mb-4 text-[22px] font-[650] tracking-[-0.012em] text-[#1a1a1a]">
          Settings
        </div>
        {NAV_ITEMS.map((item) => {
          const active = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'mb-[2px] flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none px-2.5 py-2 text-left text-[13px]',
                active
                  ? 'bg-[var(--sd-accent,#5B4FE9)]/[0.08] font-semibold text-[var(--sd-accent,#5B4FE9)]'
                  : 'bg-transparent font-medium text-[#404952]',
              )}
            >
              <SettingsIcon name={item.icon} size={14} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div>
        {section === 'model' && (
          <ModelSection catalog={props.catalog} activeModel={props.activeModel} />
        )}
        {section === 'drawer' && <DrawerSection settings={props.settings} />}
        {section === 'limits' && <LimitsSection usage={props.usage} />}
        {section === 'webhooks' && (
          <WebhooksSection webhooks={props.webhooks} lastSync={props.lastSync} />
        )}
        {section === 'general' && <GeneralSection settings={props.settings} />}
      </div>
    </div>
  );
}
