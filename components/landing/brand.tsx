import { ACCENT, shade } from './tokens';

interface SDLogoProps {
  size?: number;
  accent?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function SDLogo({
  size = 28,
  accent = ACCENT,
  'aria-label': ariaLabel = 'SmartDiscovery AI',
  'aria-hidden': ariaHidden,
}: SDLogoProps) {
  return (
    <div
      role="img"
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -18)} 100%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.4) inset, 0 4px 12px ${accent}33`,
      }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Compass + spark mark */}
        <circle
          cx="11"
          cy="11"
          r="6.5"
          stroke="white"
          strokeWidth="1.7"
          fill="none"
          opacity="0.95"
        />
        <path
          d="M14.5 14.5 L19 19"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M11 7.5 L12.2 10.3 L15 11 L12.2 11.7 L11 14.5 L9.8 11.7 L7 11 L9.8 10.3 Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

interface ShopifyMarkProps {
  size?: number;
  color?: string;
}

export function ShopifyMark({ size = 17, color = '#95BF47' }: ShopifyMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill={color}
      aria-hidden="true"
    >
      <path d="M37 10.7c0-.3-.3-.5-.5-.5l-3.4-.3-2.5-2.5c-.2-.2-.7-.2-.9-.1l-1.3.4C27.6 5.4 26.4 4.5 25 4.5c-.1 0-.2 0-.4.1-.4-.6-1-.9-1.7-.9-2.9.1-4.3 3.7-4.8 5.5l-2.4.7c-.7.2-.8.3-.9 1-.1.5-2 15.5-2 15.5L28 30.4l8.1-1.8S37 11 37 10.7zM23 8.5l-2.2.7c.4-1.6 1.2-3.2 2.5-3.3.2.4.3 1 .3 1.7l-.6.2zm-1.2-3.6c.2 0 .4.1.5.2-1.4.7-2.3 2.5-2.7 4.4l-1.8.6c.5-1.9 1.7-5.1 4-5.2zm.7 11.2l-.6 1.7s-.9-.5-2.1-.5c-1.7 0-1.8 1.1-1.8 1.3 0 1.4 3.8 2 3.8 5.4 0 2.7-1.7 4.4-4 4.4-2.7 0-4.1-1.7-4.1-1.7l.7-2.4s1.4 1.2 2.6 1.2c.8 0 1.1-.6 1.1-1.1 0-1.9-3.1-2-3.1-5.1 0-2.6 1.9-5.2 5.7-5.2 1.4 0 2.1.5 2.1.5l-.2 1.5z" />
      <path
        d="M31 9.4c-.1 0-.2 0-.3.1-.4-.6-1-.9-1.7-.9V30.4l8.1-1.8S37 11 37 10.7c0-.3-.3-.5-.5-.5l-3.4-.3-2.1-.5z"
        opacity="0.85"
      />
    </svg>
  );
}
