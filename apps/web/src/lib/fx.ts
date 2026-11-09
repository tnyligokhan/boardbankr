import { useState } from 'react';
import { storage } from './storage';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export const MAX_COINS = 16;

/**
 * More coins for bigger payments, relative to what the game starts with. Grows with the
 * square root, so small amounts still differ from each other and huge ones level off:
 * with 1,500 to start, 20 sends 2 coins, 200 sends 5, 750 sends 9, 1,500 sends 12.
 */
export function coinsFor(amount: number, startingCapital: number): number {
  if (!(amount > 0) || !(startingCapital > 0)) return 1;
  const share = Math.min(amount / startingCapital, 2);
  return Math.max(1, Math.min(MAX_COINS, Math.round(1 + 11 * Math.sqrt(share))));
}

/** Small fixed scatter per coin, so a stream of coins looks like a handful, not a queue. */
function jitter(k: number, spread: number): number {
  return (((k * 7919) % 13) / 12 - 0.5) * spread;
}

/**
 * Gold coins arcing from one element to another. Resolves when they land. However many
 * coins go, the whole stream takes about the same time, so a big payment doesn't hold
 * the balance update back.
 */
export function flyCoins(
  from: Element | null | undefined,
  to: Element | null | undefined,
  count = 1,
  symbol = '₺',
): Promise<void> {
  if (!from || !to || reduced() || typeof document.body.animate !== 'function') return Promise.resolve();
  const a = centerOf(from);
  const b = centerOf(to);
  const n = Math.max(1, Math.min(MAX_COINS, Math.round(count)));
  const gap = n > 1 ? Math.min(90, 520 / (n - 1)) : 0;
  const flights = Array.from({ length: n }, (_, k) => {
    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.textContent = symbol;
    coin.setAttribute('aria-hidden', 'true');
    document.body.append(coin);
    const lift = 60 + Math.min(n, 8) * 4 + jitter(k + 3, 34);
    const mid = { x: (a.x + b.x) / 2 + jitter(k, 40), y: Math.min(a.y, b.y) - lift };
    const end = { x: b.x + jitter(k + 5, 14), y: b.y + jitter(k + 9, 10) };
    const anim = coin.animate(
      [
        { transform: `translate(${a.x - 21}px,${a.y - 21}px) scale(.5) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${mid.x - 21}px,${mid.y - 21}px) scale(1.05) rotate(180deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${end.x - 21}px,${end.y - 21}px) scale(.7) rotate(360deg)`, opacity: 1 },
      ],
      { duration: 640, delay: k * gap, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' },
    );
    return anim.finished.catch(() => undefined).then(() => coin.remove());
  });
  return Promise.all(flights).then(() => undefined);
}

// ---------- sound ----------

let audio: AudioContext | null = null;

export const soundSetting = {
  get: () => storage.get('sound') !== 'off',
  set: (on: boolean) => storage.set('sound', on ? 'on' : 'off'),
};

/** A short coin "ching": rising for money in, falling for money out. Plays only after a user gesture. */
export function ching(up = true) {
  if (!soundSetting.get()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const t = audio.currentTime;
    (up ? [1318, 1760] : [988, 740]).forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const start = t + i * 0.07;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.1, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      o.connect(g).connect(audio!.destination);
      o.start(start);
      o.stop(start + 0.4);
    });
  } catch {
    /* no audio */
  }
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export function useSoundSetting() {
  const [on, setOn] = useState(soundSetting.get);
  return {
    on,
    set: (next: boolean) => {
      soundSetting.set(next);
      setOn(next);
      if (next) ching(true);
    },
  };
}
