'use client';
import { useEffect, useRef } from 'react';

// Note: the above-fold hero section hard-codes the "reveal in" classes (CSS-first, always visible).
// This hook drives below-fold sections only — it adds the "in" class when elements scroll into view.
export function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    el.querySelectorAll('.reveal').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}
