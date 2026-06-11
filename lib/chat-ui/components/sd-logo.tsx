'use client';
// Compass-spark brand mark from the design handoff (brand.jsx).
import { SD_ACCENT } from '../appearance';

export function SDLogo({ size = 28 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${SD_ACCENT} 0%, #4b41bf 100%)`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.4) inset, 0 4px 12px ${SD_ACCENT}33`,
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="6.5" stroke="white" strokeWidth="1.7" fill="none" opacity="0.95" />
        <path d="M14.5 14.5 L19 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11 7.5 L12.2 10.3 L15 11 L12.2 11.7 L11 14.5 L9.8 11.7 L7 11 L9.8 10.3 Z" fill="white" />
      </svg>
    </div>
  );
}
