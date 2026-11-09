import { useEffect, useRef, useState } from 'react';

/** Counts towards a new value so balance changes are visible. */
export function useAnimatedNumber(value: number, duration = 650): { shown: number; change: 'gain' | 'loss' | null; delta: number } {
  const [shown, setShown] = useState(value);
  const [change, setChange] = useState<{ dir: 'gain' | 'loss'; delta: number } | null>(null);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    from.current = value;
    setChange({ dir: value > start ? 'gain' : 'loss', delta: value - start });
    const clear = setTimeout(() => setChange(null), 2200);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return () => clearTimeout(clear);
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setShown(Math.round(start + (value - start) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clear);
    };
  }, [value, duration]);

  return { shown, change: change?.dir ?? null, delta: change?.delta ?? 0 };
}
