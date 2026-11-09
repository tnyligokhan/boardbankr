import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PlayerColor, PlayerToken } from '@mdb/shared';
import { Token } from './Token';

export interface ChartSeries {
  id: string;
  name: string;
  color: PlayerColor;
  token: PlayerToken;
  /** Balance at each round index, from the start. Shorter than the others when the player went out. */
  values: number[];
  out: boolean;
}

export interface ChartNote {
  index: number;
  value: number;
  text: string;
}

const PAD = { l: 50, r: 18, t: 28, b: 26 };
const NOTE_COLOR = '#ffffff';

/** A "nice" step for the value axis: 1, 2 or 5 × 10ⁿ, giving about four gridlines. */
function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
}

function valueAt(values: number[], at: number): { v: number; at: number } {
  const last = values.length - 1;
  if (at >= last) return { v: values[last]!, at: last };
  const i = Math.floor(at);
  return { v: values[i]! + (values[i + 1]! - values[i]!) * (at - i), at };
}

/**
 * Everyone's balance round by round, on the felt. It plays like a race: the lines draw from left
 * to right while each player's piece rides the tip of their line. Afterwards a finger or pointer
 * scrubs through the rounds, and tapping a name in the legend picks out that player.
 */
export function BalanceChart({
  series,
  notes,
  roundLabel,
  startLabel,
  format,
  formatAxis,
  replayKey,
  legendLabel,
  ariaLabel,
}: {
  series: ChartSeries[];
  notes: ChartNote[];
  roundLabel: (n: number) => string;
  startLabel: string;
  format: (n: number) => string;
  formatAxis: (n: number) => string;
  /** Change it to play the animation again. */
  replayKey: number;
  legendLabel: string;
  ariaLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clip = useRef<SVGRectElement>(null);
  const cursor = useRef<SVGLineElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const riders = useRef(new Map<string, HTMLSpanElement>());

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const R = Math.max(1, ...series.map((s) => s.values.length - 1));
  const H = width < 520 ? 250 : 300;
  const geo = useMemo(() => {
    const top = Math.max(1, ...series.flatMap((s) => s.values));
    const step = niceStep(top);
    const maxV = Math.ceil(top / step) * step;
    const x = (i: number) => PAD.l + (i / R) * (width - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / maxV) * (H - PAD.t - PAD.b);
    const yTicks = Array.from({ length: Math.round(maxV / step) + 1 }, (_, i) => i * step);
    const xEvery = R <= 8 ? 1 : R <= 16 ? 2 : R <= 30 ? 5 : 10;
    const xTicks = Array.from({ length: Math.floor(R / xEvery) + 1 }, (_, i) => i * xEvery);
    return { x, y, yTicks, xTicks };
  }, [series, width, H, R]);

  const place = (at: number) => {
    for (const s of series) {
      const el = riders.current.get(s.id);
      if (!el) continue;
      const p = valueAt(s.values, at);
      el.style.left = `${geo.x(p.at)}px`;
      el.style.top = `${geo.y(p.v)}px`;
    }
  };

  // the race
  useEffect(() => {
    if (!width) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      place(R);
      return;
    }
    setPlaying(true);
    setHover(null);
    const dur = Math.min(6500, Math.max(2600, R * 300));
    const t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const at = k * R;
      const px = geo.x(at);
      clip.current?.setAttribute('width', String(px + 1));
      cursor.current?.setAttribute('x1', String(px));
      cursor.current?.setAttribute('x2', String(px));
      if (tag.current) {
        tag.current.style.left = `${px}px`;
        tag.current.textContent = at < 0.5 ? startLabel : roundLabel(Math.round(at));
      }
      place(at);
      if (k < 1) raf = requestAnimationFrame(frame);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // replayKey restarts it; width changes redraw from the start too
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, width]);

  useEffect(() => {
    if (!playing) place(R);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, geo]);

  const scrub = (clientX: number) => {
    if (playing || !box.current) return;
    const left = box.current.getBoundingClientRect().left;
    const i = Math.round(((clientX - left - PAD.l) / (width - PAD.l - PAD.r)) * R);
    setHover(Math.max(0, Math.min(R, i)));
  };

  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${geo.x(i).toFixed(1)},${geo.y(v).toFixed(1)}`).join('');
  const hoverRows =
    hover === null
      ? []
      : series
          .map((s) => ({ s, v: s.values[hover] }))
          .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));

  return (
    <div>
      <div role="group" aria-label={legendLabel} className="mt-4 flex flex-wrap gap-1.5">
        {series.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={focus === s.id}
            onClick={() => setFocus((f) => (f === s.id ? null : s.id))}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full py-0 pr-3 pl-0.5 text-[0.82rem] font-bold transition-[opacity,background-color] ${
              focus === s.id ? 'bg-white/20' : 'bg-white/8'
            } ${focus && focus !== s.id ? 'opacity-45' : ''}`}
          >
            <Token color={s.color} token={s.token} size={26} muted={s.out} />
            {s.name}
          </button>
        ))}
      </div>

      <div
        ref={box}
        className="chart relative mt-3 touch-pan-y select-none"
        data-focused={focus ? '' : undefined}
        onPointerMove={(e) => scrub(e.clientX)}
        onPointerDown={(e) => scrub(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 && (
          <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={ariaLabel} className="block overflow-visible">
            <defs>
              <clipPath id="chart-reveal">
                <rect ref={clip} x="0" y="0" width={playing ? PAD.l : width} height={H} />
              </clipPath>
            </defs>
            <g>
              {geo.yTicks.map((v) => (
                <g key={v}>
                  <line x1={PAD.l} x2={width - PAD.r} y1={geo.y(v)} y2={geo.y(v)} stroke={v === 0 ? 'rgb(255 255 255 / 0.28)' : 'rgb(255 255 255 / 0.1)'} />
                  <text x={PAD.l - 8} y={geo.y(v) + 4} textAnchor="end" className="fill-white/55 text-[11px] font-semibold tabular">
                    {formatAxis(v)}
                  </text>
                </g>
              ))}
              {geo.xTicks.map((i) => (
                <text key={i} x={geo.x(i)} y={H - 6} textAnchor="middle" className="fill-white/55 text-[11px] font-semibold tabular">
                  {i === 0 ? startLabel : roundLabel(i)}
                </text>
              ))}
            </g>
            <g clipPath="url(#chart-reveal)">
              {series.map((s) => (
                <path key={s.id} className="chart-line" data-on={focus === s.id || undefined} d={path(s.values)} data-note={s.color} style={{ stroke: 'var(--note)' }} />
              ))}
              {notes.map((n) => {
                const nx = geo.x(n.index);
                const ny = geo.y(n.value);
                const right = nx < width - 150;
                return (
                  <g key={`${n.index}-${n.text}`}>
                    <circle cx={nx} cy={ny} r="7" fill="none" stroke={NOTE_COLOR} strokeWidth="1.5" />
                    <text x={right ? nx + 11 : nx - 11} y={ny - 10} textAnchor={right ? 'start' : 'end'} className="fill-white text-[11.5px] font-bold">
                      {n.text}
                    </text>
                  </g>
                );
              })}
            </g>
            {playing && <line ref={cursor} x1={PAD.l} x2={PAD.l} y1={PAD.t - 6} y2={H - PAD.b} stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="3 4" />}
            {hover !== null && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t - 6} y2={H - PAD.b} stroke="rgb(255 255 255 / 0.4)" />}
          </svg>
        )}
        {playing && (
          <span
            ref={tag}
            aria-hidden
            className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold px-2 py-0.5 font-display text-xs font-bold whitespace-nowrap text-gold-ink"
            style={{ top: PAD.t - 6, left: PAD.l }}
          />
        )}
        {width > 0 &&
          series.map((s) => (
            <span
              key={s.id}
              ref={(el) => {
                if (el) riders.current.set(s.id, el);
                else riders.current.delete(s.id);
              }}
              className="chart-rider"
              data-on={focus === s.id || undefined}
            >
              <Token color={s.color} token={s.token} size={26} muted={s.out} />
            </span>
          ))}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[11rem] rounded-2xl bg-paper px-3 py-2.5 text-[0.82rem] text-ink shadow-[0_4px_0_rgb(0_0_0/0.25),0_12px_24px_rgb(0_0_0/0.25)]"
            style={geo.x(hover) > width / 2 ? { right: width - geo.x(hover) + 12 } : { left: geo.x(hover) + 12 }}
          >
            <p className="mb-1 font-display text-sm font-bold">{hover === 0 ? startLabel : roundLabel(hover)}</p>
            {hoverRows.map(({ s, v }) => (
              <p key={s.id} className="flex items-center gap-2 py-0.5">
                <span data-note={s.color} className="size-2.5 shrink-0 rounded-full bg-[var(--note)]" />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <b className="font-display font-semibold tabular">{v === undefined ? '–' : format(v)}</b>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
