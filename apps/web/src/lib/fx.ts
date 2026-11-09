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

/**
 * Every sound is made here with Web Audio: short, quiet and table-like (coins, wood, a bell),
 * nothing to download. All of them follow the one sound setting, and browsers only let them
 * play once the person has tapped something on the page.
 */
function play(draw: (ctx: AudioContext, t: number) => void) {
  if (!soundSetting.get()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === 'suspended') void audio.resume();
    draw(audio, audio.currentTime);
  } catch {
    /* no audio */
  }
}

/** One tone with a quick attack and a soft tail. */
function tone(ctx: AudioContext, start: number, freq: number, opts: { type?: OscillatorType; gain?: number; decay?: number; to?: number } = {}) {
  const { type = 'triangle', gain = 0.1, decay = 0.35, to } = opts;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + decay);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, start + decay);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + decay + 0.05);
}

/** A short burst of filtered noise: dice on a table, a gavel's crack. */
function knock(ctx: AudioContext, start: number, opts: { freq?: number; gain?: number; decay?: number } = {}) {
  const { freq = 1800, gain = 0.25, decay = 0.05 } = opts;
  const length = Math.ceil(ctx.sampleRate * decay);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(start);
}

/** A short coin "ching": rising for money in, falling for money out. */
export function ching(up = true) {
  play((ctx, t) => (up ? [1318, 1760] : [988, 740]).forEach((f, i) => tone(ctx, t + i * 0.07, f)));
}

export const sounds = {
  /** Dice rattling in the hand for `ms`. */
  diceShake(ms: number) {
    play((ctx, t) => {
      for (let at = 0; at < ms / 1000; at += 0.07 + Math.random() * 0.05) knock(ctx, t + at, { freq: 2200 + Math.random() * 1200, gain: 0.12, decay: 0.03 });
    });
  },
  /** Dice landing: two knocks on wood. */
  diceLand() {
    play((ctx, t) => {
      knock(ctx, t, { freq: 900, gain: 0.35, decay: 0.06 });
      tone(ctx, t, 190, { type: 'sine', gain: 0.12, decay: 0.12 });
      knock(ctx, t + 0.09, { freq: 1100, gain: 0.22, decay: 0.05 });
    });
  },
  /** It's my turn: a soft two-note bell. */
  myTurn() {
    play((ctx, t) => {
      tone(ctx, t, 659, { type: 'sine', gain: 0.09, decay: 0.6 });
      tone(ctx, t + 0.13, 988, { type: 'sine', gain: 0.08, decay: 0.8 });
    });
  },
  /** The gavel: one strike to open, two to sell. */
  gavel(strikes = 1) {
    play((ctx, t) => {
      for (let i = 0; i < strikes; i++) {
        const at = t + i * 0.22;
        knock(ctx, at, { freq: 700, gain: 0.45, decay: 0.08 });
        tone(ctx, at, 140, { type: 'sine', gain: 0.18, decay: 0.15 });
      }
    });
  },
  /** Someone raised the bid. */
  bid() {
    play((ctx, t) => tone(ctx, t, 880, { type: 'sine', gain: 0.07, decay: 0.12, to: 1320 }));
  },
  /** The last seconds of an auction. */
  tick(last = false) {
    play((ctx, t) => tone(ctx, t, last ? 1568 : 1175, { type: 'square', gain: 0.025, decay: 0.06 }));
  },
  /** A player went bankrupt: three falling notes. */
  bankrupt() {
    play((ctx, t) => [392, 349, 262].forEach((f, i) => tone(ctx, t + i * 0.2, f, { type: 'sawtooth', gain: 0.035, decay: i === 2 ? 0.7 : 0.22 })));
  },
  /** A payment went back. */
  undo() {
    play((ctx, t) => tone(ctx, t, 1400, { type: 'sine', gain: 0.07, decay: 0.22, to: 500 }));
  },
  /** The game is over: a fanfare for the winner, a softer close for everyone else. */
  finish(won: boolean) {
    play((ctx, t) => {
      const notes = won ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
      notes.forEach((f, i) => tone(ctx, t + i * 0.11, f, { gain: won ? 0.09 : 0.06, decay: i === notes.length - 1 ? 1.1 : 0.3 }));
    });
  },
};

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
