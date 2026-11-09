import { useEffect, useRef, useState } from 'react';

/**
 * Pointer-driven light, carried over from the old banknotes. Writes --tx / --ty (-1..1)
 * on the element; CSS turns them into glare and foil, so nothing re-renders while the
 * pointer moves. The element itself is never moved or tilted: that made pieces blurry.
 * `glint` counts each time the pointer arrives, which the caller uses as a key to replay
 * a light sweep.
 *
 * The light stands still while a drag-to-pay is running on the table.
 */
export function useTilt<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const [glint, setGlint] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const write = () => {
      raf = 0;
      el.style.setProperty('--tx', x.toFixed(3));
      el.style.setProperty('--ty', y.toFixed(3));
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      delete el.dataset.tilt;
      el.style.removeProperty('--tx');
      el.style.removeProperty('--ty');
    };
    const move = (e: PointerEvent) => {
      if (el.closest('[data-dragging]')) return reset();
      const r = el.getBoundingClientRect();
      x = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
      y = clamp(((e.clientY - r.top) / r.height) * 2 - 1);
      el.dataset.tilt = '';
      if (!raf) raf = requestAnimationFrame(write);
    };
    const enter = (e: PointerEvent) => {
      setGlint((n) => n + 1);
      move(e);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') setGlint((n) => n + 1);
      move(e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') reset();
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointercancel', reset);
    el.addEventListener('pointerup', up);
    return () => {
      reset();
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerleave', reset);
      el.removeEventListener('pointercancel', reset);
      el.removeEventListener('pointerup', up);
    };
  }, [enabled]);

  return { ref, glint };
}
