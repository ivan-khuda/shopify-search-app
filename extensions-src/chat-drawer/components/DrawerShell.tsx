'use client';
/**
 * DrawerShell — positionable drawer container (drawer-redesign Task 5).
 *
 * Translated 1:1 from the design handoff (storefront.jsx ChatDrawer, lines
 * 349–416). Three merchant-selectable positions:
 *   - side (default): right-aligned 420px full-height panel.
 *   - bottom-sheet: bottom panel (78% desktop / 88% mobile + grab handle).
 *   - center-modal: centered 540×680 modal with blurred scrim.
 *
 * Mobile (matchMedia max-width:640px) always forces the bottom sheet.
 * Scrim click closes; panel clicks are swallowed via stopPropagation.
 *
 * Animations: loader.css only ships sd-slide-in/sd-slide-up (the latter
 * scoped inside a media query), so the shell injects the full sd keyframe
 * set once via a <style> tag (plan Task 5 Step 3) — DrawerMessage /
 * DrawerThinking reuse sd-spin / sd-blink / sd-bounce from here.
 */
import * as React from 'react';
import type { DrawerPosition } from '@/lib/settings/contract';

const KEYFRAMES_ID = 'sd-drawer-keyframes';
const KEYFRAMES_CSS = `
@keyframes sd-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes sd-slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes sd-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sd-spin { to { transform: rotate(360deg); } }
@keyframes sd-blink { 50% { opacity: 0; } }
@keyframes sd-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }
`;

function useInjectKeyframes(): void {
  React.useEffect(() => {
    if (document.getElementById(KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = KEYFRAMES_ID;
    style.textContent = KEYFRAMES_CSS;
    document.head.appendChild(style);
  }, []);
}

/** Tracks the storefront mobile breakpoint (640px, matching loader.css). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  );
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    setIsMobile(mql.matches);
    const onChange = (event: MediaQueryListEvent): void => setIsMobile(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

interface DrawerShellProps {
  position?: DrawerPosition;
  onClose: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function DrawerShell({
  position = 'side',
  onClose,
  ariaLabel = 'Shopping assistant',
  children,
}: DrawerShellProps) {
  useInjectKeyframes();
  const isMobile = useIsMobile();
  const resolved: DrawerPosition = isMobile ? 'bottom-sheet' : position;

  const stop = (event: React.MouseEvent): void => event.stopPropagation();

  if (resolved === 'center-modal') {
    return (
      <div
        data-testid="sd-drawer-scrim"
        data-position="center-modal"
        onClick={onClose}
        className="fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(20,20,20,0.45)] p-8 backdrop-blur-[4px]"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          onClick={stop}
          className="flex h-[min(680px,calc(100%-64px))] w-[min(540px,100%)] animate-[sd-pop_0.25s_ease-out] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        >
          {children}
        </div>
      </div>
    );
  }

  if (resolved === 'bottom-sheet') {
    return (
      <div
        data-testid="sd-drawer-scrim"
        data-position="bottom-sheet"
        onClick={onClose}
        className="fixed inset-0 z-[2100] flex flex-col justify-end bg-[rgba(20,20,20,0.4)]"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          onClick={stop}
          className={`flex ${isMobile ? 'h-[88%]' : 'h-[78%]'} animate-[sd-slide-up_0.28s_cubic-bezier(0.2,0.8,0.2,1)] flex-col overflow-hidden rounded-t-[18px] bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.15)]`}
        >
          {isMobile && (
            <div className="flex shrink-0 justify-center pt-2">
              <div data-testid="sd-grab-handle" className="h-1 w-9 rounded-[2px] bg-[#d4d4d4]" />
            </div>
          )}
          {children}
        </div>
      </div>
    );
  }

  // side (default)
  return (
    <div
      data-testid="sd-drawer-scrim"
      data-position="side"
      onClick={onClose}
      className="fixed inset-0 z-[2100] flex justify-end bg-[rgba(20,20,20,0.25)]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={stop}
        className="flex h-full w-[420px] max-w-full animate-[sd-slide-left_0.28s_cubic-bezier(0.2,0.8,0.2,1)] flex-col bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.12)]"
      >
        {children}
      </div>
    </div>
  );
}
