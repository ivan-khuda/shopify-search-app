'use client';

/**
 * Settings-redesign Task 8 — client side-nav shell for /settings.
 *
 * Pixel reference: design handoff settings.jsx `SettingsScreen` (lines 1–51)
 * + `SettingsIcon` (53–64). Layout: 1080px max-width two-column grid
 * (200px nav / 1fr content), 28px gutters, 80px bottom padding. The accent
 * var `--sd-accent` is set on the shell root (mirrors chat-shell.tsx) so
 * every section can reference `var(--sd-accent,#5B4FE9)`.
 *
 * Sections land incrementally (Tasks 9–13); until a section ships it renders
 * a placeholder carrying its prototype heading so nav switching is real from
 * day one.
 */
import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { SD_ACCENT } from '@/lib/chat-ui/appearance';
import { ModelSection } from './sections/model-section';
import { DrawerSection } from './sections/drawer-section';
import { LimitsSection } from './sections/limits-section';
import { WebhooksSection } from './sections/webhooks-section';
import type { SettingsShellProps } from './sections/types';

const NAV_ITEMS = [
  { id: 'model', label: 'AI model', icon: 'sparkle' },
  { id: 'drawer', label: 'Drawer styling', icon: 'paint' },
  { id: 'limits', label: 'Usage & limits', icon: 'gauge' },
  { id: 'webhooks', label: 'Sync & webhooks', icon: 'sync' },
  { id: 'general', label: 'General', icon: 'gear' },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]['id'];
type IconName = (typeof NAV_ITEMS)[number]['icon'];

/** Prototype `SettingsIcon` (settings.jsx lines 53–64), ported verbatim. */
export function SettingsIcon({ name, size = 14 }: { name: IconName; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;
  switch (name) {
    case 'sparkle':
      return (
        <svg {...p}>
          <path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.5l-1.8-4.4L6 9.3l4.2-1.8z" />
          <path d="M19 16l.8 1.7L21.5 18.5l-1.7.8L19 21l-.8-1.7L16.5 18.5l1.7-.8z" />
        </svg>
      );
    case 'paint':
      return (
        <svg {...p}>
          <path d="M4 20l8-8" />
          <path d="M14 7l3 3M18 3l3 3-6 6h-3v-3z" />
        </svg>
      );
    case 'gauge':
      return (
        <svg {...p}>
          <path d="M12 14l4-4" />
          <circle cx="12" cy="14" r="9" />
          <path d="M3 14a9 9 0 0118 0" />
        </svg>
      );
    case 'sync':
      return (
        <svg {...p}>
          <path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8L20 17a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      );
    default:
      return null;
  }
}

/** Placeholder until the real section lands (Tasks 9–13). */
function PlaceholderSection({ heading }: { heading: string }) {
  return (
    <div>
      <h2 className="m-0 text-lg font-[650] tracking-[-0.01em] text-[#202223]">
        {heading}
      </h2>
    </div>
  );
}

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
        {section === 'general' && <PlaceholderSection heading="General" />}
      </div>
    </div>
  );
}
