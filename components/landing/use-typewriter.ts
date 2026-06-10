'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTypewriter(): [string, (full: string, ms: number, done?: () => void) => void, () => void] {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const run = useCallback((full: string, ms: number, done?: () => void) => {
    let i = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      i++;
      setText(full.slice(0, i));
      if (i >= full.length) {
        if (timer.current) clearInterval(timer.current);
        done?.();
      }
    }, ms);
  }, []);
  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setText('');
  }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  return [text, run, reset];
}
