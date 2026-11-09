import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * One line of text that shrinks to fit its box instead of overflowing.
 * Used for money: a balance can grow far longer than the space designed for it.
 * The box keeps the font size it is given; only the text inside scales down.
 */
export function FitText({ children, className = '', min = 0.35 }: { children: ReactNode; className?: string; min?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    i.style.fontSize = '';
    const avail = b.clientWidth;
    const need = i.offsetWidth;
    if (avail > 0 && need > avail) i.style.fontSize = `${Math.max(min, avail / need)}em`;
  }, [min]);

  // re-measure on every render: the text (an animated balance) changes often
  useLayoutEffect(fit);

  useLayoutEffect(() => {
    const b = box.current;
    if (!b || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    // web fonts change the width once they load
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <div ref={box} className={`min-w-0 max-w-full overflow-hidden ${className}`}>
      <span ref={inner} className="inline-block whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}
