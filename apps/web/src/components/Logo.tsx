import { useRef, type PointerEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { parsePublicPath, publicPath } from '@mdb/shared';
import { Globe, Landmark } from 'lucide-react';
import { usePublicPath, useI18n } from '../lib/i18n';
import { dictionaries } from '../lib/dictionary';

const SPIN_MS = 1000;
/** Coin size and thickness in px. */
const RADIUS = 16;
const THICKNESS = 3;
/**
 * The edge is a real cylinder: this many narrow strips stand around the rim, at right
 * angles to the faces. Each is a touch wider than its share so no seams show.
 */
const SEGMENTS = 40;
const SEGMENT_WIDTH = (2 * Math.PI * RADIUS) / SEGMENTS + 0.6;

/** Strips facing up catch the light; the ones underneath fall into shade. */
const EDGE = Array.from({ length: SEGMENTS }, (_, i) => {
  const deg = (i / SEGMENTS) * 360;
  const light = 0.5 + 0.5 * Math.cos((deg * Math.PI) / 180);
  const mix = Math.round(55 + light * 45);
  return {
    transform: `rotateZ(${deg}deg) translateY(${-RADIUS + 0.4}px) rotateX(90deg)`,
    background: `color-mix(in srgb, var(--gold-deep) ${mix}%, #6b4300)`,
  };
});

/**
 * The bank chip from the middle of the table, and the name. Inherits the text colour.
 * Hovering turns the chip round its vertical axis in real 3D, centred on itself. When
 * the pointer leaves, it finishes the turn it is on instead of snapping back.
 */
export function Logo({ to }: { to?: string }) {
  const path = usePublicPath();
  const coin = useRef<HTMLSpanElement>(null);
  const spin = useRef<Animation | null>(null);

  const start = (e: PointerEvent) => {
    const el = coin.current;
    if (e.pointerType !== 'mouse' || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const running = spin.current;
    if (running && running.playState === 'running') {
      running.effect?.updateTiming({ iterations: Infinity });
    } else {
      spin.current = el.querySelector<HTMLElement>('.logo-coin-body')!.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
        { duration: SPIN_MS, iterations: Infinity },
      );
    }
    el.dataset.spinning = '';
  };

  const stop = () => {
    const el = coin.current;
    const running = spin.current;
    if (!el || !running) return;
    const done = Math.floor(Number(running.currentTime ?? 0) / SPIN_MS) + 1;
    running.effect?.updateTiming({ iterations: done });
    running.onfinish = () => {
      if (spin.current === running) delete el.dataset.spinning;
    };
  };

  return (
    <Link
      to={to ?? path({ kind: 'home' })}
      onPointerEnter={start}
      onPointerLeave={stop}
      className="inline-flex items-center gap-2.5 rounded-lg py-1"
      aria-label="BoardBankr"
    >
      <span ref={coin} aria-hidden className="logo-coin">
        <span className="logo-coin-body">
          {EDGE.map((s, i) => (
            <span key={i} className="logo-coin-seg" style={{ ...s, width: SEGMENT_WIDTH, height: THICKNESS }} />
          ))}
          <span className="logo-coin-face">
            <Landmark className="size-4" strokeWidth={2.4} />
          </span>
          <span className="logo-coin-face" data-back="">
            <Landmark className="size-4" strokeWidth={2.4} />
          </span>
        </span>
      </span>
      <span className="font-display text-[1.05rem] leading-tight font-bold whitespace-nowrap">
        Board<span className="text-gold">Bankr</span>
      </span>
    </Link>
  );
}

/** `compact` hides the language name on phones, for crowded headers. */
export function LangSwitch({ className = '', compact }: { className?: string; compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const next = lang === 'tr' ? 'en' : 'tr';
  const location = useLocation();
  const navigate = useNavigate();
  // on a public page the language lives in the address, so switching moves to the other version
  const onPublic = parsePublicPath(location.pathname);
  const switchLang = () => {
    setLang(next);
    if (onPublic) navigate(publicPath(next, onPublic.page));
  };
  return (
    <button
      type="button"
      onClick={switchLang}
      aria-label={`${t('language')}: ${dictionaries[next].langName}`}
      className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold opacity-80 hover:bg-black/10 hover:opacity-100 ${className}`}
    >
      <Globe aria-hidden className="size-4" />
      <span className={compact ? 'hidden sm:inline' : undefined}>{next === 'en' ? 'English' : 'Türkçe'}</span>
    </button>
  );
}
