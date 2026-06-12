/** Prototype `SettingsIcon` (settings.jsx lines 53–64), ported verbatim.
 *  Lives outside the shell so sections can use it without importing the
 *  shell module (which imports the sections — would be a cycle). */

export type SettingsIconName = 'sparkle' | 'paint' | 'gauge' | 'sync' | 'gear';

export function SettingsIcon({ name, size = 14 }: { name: SettingsIconName; size?: number }) {
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
