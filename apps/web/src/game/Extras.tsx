import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Gavel } from 'lucide-react';
import {
  AMOUNT_MAX,
  AUCTION_TITLE_MAX,
  highBid,
  nextBidFloor,
  type AuctionView,
  type DiceRoll,
  type GameSnapshot,
  type PlayerView,
} from '@mdb/shared';
import { FitText } from '../components/FitText';
import { Sheet } from '../components/Sheet';
import { Token } from '../components/Token';
import { Button, Field, Segmented, TextInput } from '../components/ui';
import { buzz, sounds } from '../lib/fx';
import { formatMoney, quickAmounts } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { storage } from '../lib/storage';
import { useToast } from '../lib/toast';
import type { Result } from '../lib/useGame';

// ---------- dice ----------

/** Pip positions on a 3×3 grid, per face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** The colour of every face, so the thrown cube and the resting die look the same. */
const DIE_FACE = '#faf7f0';

/** A paper die with ink pips, drawn crisp at any size. */
export function Die({ value, size = 64 }: { value: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 grid-cols-3 grid-rows-3 rounded-[20%] shadow-[inset_0_0_0_2px_var(--line),0_4px_0_var(--line),0_8px_18px_rgb(0_0_0/0.18)]"
      // padding in pixels: a percentage would be taken from the row the die sits in, not the die
      style={{ width: size, height: size, padding: size * 0.16, background: DIE_FACE }}
    >
      <Pips value={value} />
    </span>
  );
}

/** How long a throw takes, from the hand to the last bounce. */
const ROLL_MS = 1300;
const SHOW_MS = 3800;
/** When a die hits the table, as a share of the throw; the drop keyframes below use the same. */
const IMPACTS = [0.42, 0.66, 0.82, 0.92];
/** The second die lands a moment after the first. */
const DIE_DELAY_MS = 70;

/** How to turn the cube so `value` faces the viewer: [rotateX, rotateY]. */
const FACE_TURN: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
/** Where each face sits on the cube; opposite faces add up to seven, like a real die. */
const FACE_PLACE: [number, string][] = [
  [1, 'rotateY(0deg)'],
  [6, 'rotateY(180deg)'],
  [3, 'rotateY(90deg)'],
  [4, 'rotateY(-90deg)'],
  [2, 'rotateX(90deg)'],
  [5, 'rotateX(-90deg)'],
];

function Pips({ value }: { value: number }) {
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="grid place-items-center">
          {PIPS[value]?.includes(i) && <span className="block size-[78%] rounded-full bg-ink" />}
        </span>
      ))}
    </>
  );
}

/** How high a thrown die starts above the felt, in px. */
const DROP = 110;
/** Height of the die over the felt during the throw; the shadow is drawn from the same curve. */
function hopFrames(): { y: number; offset: number; easing?: string }[] {
  const [a, b, c, d] = IMPACTS as [number, number, number, number];
  const fall = 'cubic-bezier(.5,0,1,1)';
  const rise = 'cubic-bezier(0,0,.5,1)';
  return [
    { y: -DROP, offset: 0, easing: fall },
    { y: 0, offset: a, easing: rise },
    { y: -28, offset: (a + b) / 2, easing: fall },
    { y: 0, offset: b, easing: rise },
    { y: -11, offset: (b + c) / 2, easing: fall },
    { y: 0, offset: c, easing: rise },
    { y: -3, offset: (c + d) / 2, easing: fall },
    { y: 0, offset: d },
    { y: 0, offset: 1 },
  ];
}

/**
 * A real cube, thrown onto the felt: it drops in, bounces three times while it tumbles, and
 * comes to rest with `value` on top, its shadow tightening as it nears the table. It only
 * exists while it moves; the resting die is the flat one, so it stays sharp.
 */
function ThrownDie({ value, size, delay, onDone }: { value: number; size: number; delay: number; onDone: () => void }) {
  const hop = useRef<HTMLSpanElement>(null);
  const cube = useRef<HTMLSpanElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const [fx, fy] = FACE_TURN[value] ?? [0, 0];
    const spin = (n: number) => 360 * n * (Math.random() < 0.5 ? -1 : 1);
    const from = `rotateX(${spin(2) + Math.random() * 90}deg) rotateY(${spin(1) + Math.random() * 90}deg) rotateZ(${Math.random() * 60 - 30}deg)`;
    const mid = `rotateX(${fx + spin(1)}deg) rotateY(${fy + 180}deg) rotateZ(0deg)`;
    const to = `rotateX(${fx}deg) rotateY(${fy}deg) rotateZ(0deg)`;
    const timing = { duration: ROLL_MS, delay, fill: 'both' as const };
    const frames = hopFrames();
    const drop = hop.current?.animate(
      frames.map((f) => ({ transform: `translateY(${f.y}px)`, offset: f.offset, easing: f.easing })),
      timing,
    );
    const shade = shadow.current?.animate(
      frames.map((f) => {
        const lift = -f.y / DROP;
        return { transform: `scale(${1 - lift * 0.55})`, opacity: 1 - lift * 0.75, offset: f.offset, easing: f.easing };
      }),
      timing,
    );
    const turn = cube.current?.animate(
      [
        { transform: from, offset: 0 },
        { transform: mid, offset: IMPACTS[0] },
        { transform: to, offset: 0.88, easing: 'cubic-bezier(.2,.8,.3,1)' },
        { transform: to, offset: 1 },
      ],
      { ...timing, easing: 'cubic-bezier(.3,.1,.3,1)' },
    );
    let live = true;
    const finish = () => {
      if (!live) return;
      live = false;
      done.current();
    };
    void Promise.all([drop?.finished, turn?.finished, shade?.finished])
      .catch(() => undefined)
      .then(finish);
    // a phone that sleeps mid-throw may never report the end: land it anyway
    const fallback = setTimeout(finish, ROLL_MS + delay + 600);
    return () => {
      live = false;
      clearTimeout(fallback);
      drop?.cancel();
      turn?.cancel();
      shade?.cancel();
    };
  }, [value, delay]);

  const half = size / 2;
  return (
    <span aria-hidden className="relative block" style={{ width: size, height: size }}>
      <DieShadow ref={shadow} size={size} />
      {/* the perspective and the 3D space run through every layer, or some browsers flatten the cube and hide its faces */}
      <span className="block size-full" style={{ perspective: size * 9, transformStyle: 'preserve-3d' }}>
        <span ref={hop} className="block size-full" style={{ transformStyle: 'preserve-3d' }}>
          <span ref={cube} className="relative block size-full" style={{ transformStyle: 'preserve-3d' }}>
            {FACE_PLACE.map(([face, place]) => (
              <span
                key={face}
                className="absolute inset-0 grid grid-cols-3 grid-rows-3 rounded-[20%]"
                style={{
                  transform: `${place} translateZ(${half}px)`,
                  padding: size * 0.16,
                  background: DIE_FACE,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  // a faint edge so the cube reads as solid while it turns
                  boxShadow: 'inset 0 0 0 2px var(--line), inset 0 -6px 10px rgb(0 0 0 / 0.06)',
                }}
              >
                <Pips value={face} />
              </span>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}

/** The soft dark patch a die casts on the felt. */
const DieShadow = forwardRef<HTMLSpanElement, { size: number }>(function DieShadow({ size }, ref) {
  return (
    <span
      ref={ref}
      aria-hidden
      className="absolute left-1/2 rounded-[50%] bg-black/45 blur-[5px]"
      style={{ width: size * 0.95, height: size * 0.3, top: size * 0.86, marginLeft: -(size * 0.95) / 2 }}
    />
  );
});

const DIE_SIZE = 58;

/**
 * Every roll at the table lands on the felt in the middle of it, on every phone: the dice are
 * thrown, bounce, and settle on what the server rolled, with a small label for who rolled and
 * the total. It fades away by itself; nothing to tap, so a stray touch can't lose a roll.
 */
export function DiceOverlay({ roll, players, meId, onRollAgain }: { roll: DiceRoll | null; players: PlayerView[]; meId: string; onRollAgain: () => void }) {
  const { t } = useI18n();
  const seen = useRef(roll?.seq ?? 0);
  const [shown, setShown] = useState<DiceRoll | null>(null);
  const [rolling, setRolling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const landed = useRef(0);

  // keyed on the roll number: later snapshots carry the same roll and must not restart it
  const seq = roll?.seq ?? 0;
  const latest = useRef(roll);
  latest.current = roll;
  useEffect(() => {
    const roll = latest.current;
    if (!roll || seq <= seen.current) return;
    seen.current = seq;
    landed.current = 0;
    setShown(roll);
    setLeaving(false);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRolling(!still);
    buzz(12);
    // rattle in the hand while they fly, then a clack at every bounce of every die
    sounds.diceRoll(
      380,
      roll.dice.map((_, i) => IMPACTS.map((f) => (i * DIE_DELAY_MS + f * ROLL_MS) / 1000)),
    );
    const fade = setTimeout(() => setLeaving(true), ROLL_MS + SHOW_MS - 400);
    const hide = setTimeout(() => setShown(null), ROLL_MS + SHOW_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, [seq]);

  const count = shown?.dice.length ?? 0;
  const onDieDone = useCallback(() => {
    landed.current++;
    if (landed.current >= count) {
      setRolling(false);
      buzz(25);
    }
  }, [count]);

  if (!shown) return null;
  const who = players.find((p) => p.userId === shown.userId);
  const mine = shown.userId === meId;
  const total = shown.dice.reduce((a, b) => a + b, 0);
  const double = shown.dice.length === 2 && shown.dice[0] === shown.dice[1];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute inset-0 z-30 grid place-items-center transition-opacity duration-400 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-6" style={{ height: DIE_SIZE }}>
          {shown.dice.map((v, i) =>
            rolling ? (
              <ThrownDie key={`${shown.seq}-${i}`} value={v} size={DIE_SIZE} delay={i * DIE_DELAY_MS} onDone={onDieDone} />
            ) : (
              <span key={`${shown.seq}-${i}`} className="relative block">
                <DieShadow size={DIE_SIZE} />
                <span className="relative block">
                  <Die value={v} size={DIE_SIZE} />
                </span>
              </span>
            ),
          )}
        </div>
        <div
          className={`flex h-10 items-center gap-2 rounded-full bg-black/45 pr-1.5 pl-1 text-sm font-bold text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.12)] backdrop-blur-sm transition-opacity duration-300 ${rolling ? 'opacity-0' : 'opacity-100'}`}
        >
          {who && <Token color={who.color} token={who.token} size={30} />}
          <span className="pr-2">
            {mine ? t('diceYou') : who?.name} · <span className="font-display tabular">{t('diceTotal', { n: total })}</span>
            {double && <span className="text-gold"> · {t('diceDouble')}</span>}
          </span>
          {mine && !rolling && (
            <button
              type="button"
              onClick={onRollAgain}
              className="pointer-events-auto h-8 rounded-full bg-gold px-3 font-display text-xs font-bold text-gold-ink shadow-[0_2px_0_var(--gold-deep)]"
            >
              {t('rollAgain')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** How many dice this phone rolls; remembered between games. */
export function useDiceCount(): [number, (n: number) => void] {
  const [count, setCount] = useState(() => (storage.get('dice') === '1' ? 1 : 2));
  return [
    count,
    (n: number) => {
      storage.set('dice', String(n));
      setCount(n);
    },
  ];
}

export function DiceSheet({
  open,
  onClose,
  count,
  setCount,
  onRoll,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  setCount: (n: number) => void;
  onRoll: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('dice')}
      footer={
        <Button
          size="lg"
          block
          busy={busy}
          onClick={async () => {
            setBusy(true);
            await onRoll();
            setBusy(false);
            onClose();
          }}
        >
          {t('rollDice')}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-5 pt-2 pb-1">
        <div className="flex gap-4">
          {Array.from({ length: count }, (_, i) => (
            <Die key={i} value={i === 0 ? 5 : 3} size={72} />
          ))}
        </div>
        <Segmented
          label={t('dice')}
          value={count}
          onChange={(n) => {
            buzz(8);
            setCount(n);
          }}
          options={[1, 2].map((n) => ({ value: n, label: t('diceCount', { n }) }))}
        />
      </div>
    </Sheet>
  );
}

// ---------- auction ----------

const digits = (s: string) => {
  const n = Number(s.replace(/\D/g, '').slice(0, 13));
  return Math.min(n, AMOUNT_MAX);
};

export function AuctionStartSheet({
  open,
  onClose,
  game,
  start,
}: {
  open: boolean;
  onClose: () => void;
  game: GameSnapshot;
  start: (title: string, minBid: number) => Promise<Result>;
}) {
  const { t, locale, errorText } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [minBid, setMinBid] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setMinBid(0);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    const r = await start(title, minBid);
    setBusy(false);
    if (r.ok) onClose();
    else toast.error(errorText(r.error));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('auctionStart')}
      footer={
        <Button size="lg" block busy={busy} onClick={submit}>
          <Gavel aria-hidden className="size-5" />
          {t('auctionOpen')}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('auctionHowTo')}</p>
        <Field label={t('auctionWhat')} htmlFor="auction-title">
          <TextInput
            id="auction-title"
            value={title}
            maxLength={AUCTION_TITLE_MAX}
            placeholder={t('auctionWhatPlaceholder')}
            autoComplete="off"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label={t('auctionMin')} htmlFor="auction-min" hint={t('auctionMinNote')}>
          <TextInput
            id="auction-min"
            inputMode="numeric"
            autoComplete="off"
            value={minBid ? formatMoney(minBid, game.currency, locale) : ''}
            placeholder={formatMoney(0, game.currency, locale)}
            onChange={(e) => setMinBid(digits(e.target.value))}
            className="font-display text-lg tabular"
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

/** Time left on the auction, counted down on this phone from what the server said last. */
export function useAuctionClock(auction: AuctionView | null, version: number): number {
  const base = useRef({ at: 0, ms: 0 });
  const [left, setLeft] = useState(auction?.remainingMs ?? 0);

  useEffect(() => {
    base.current = { at: performance.now(), ms: auction?.remainingMs ?? 0 };
    setLeft(auction?.remainingMs ?? 0);
    if (!auction || auction.status !== 'open') return;
    const id = setInterval(() => setLeft(Math.max(0, base.current.ms - (performance.now() - base.current.at))), 200);
    return () => clearInterval(id);
    // a new snapshot (new bid, new end time) restarts the count from the server's figure
  }, [auction, version]);

  return left;
}

/** A slim gold bar on the table while an auction runs, to get back to it after closing the sheet. */
export function AuctionBanner({ auction, left, onOpen }: { auction: AuctionView; left: number; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full bg-gold pr-4 pl-3 font-display text-sm font-bold text-gold-ink shadow-[0_3px_0_var(--gold-deep)]"
      style={{ animation: 'glow 1.6s ease-in-out infinite' }}
    >
      <Gavel aria-hidden className="size-4" />
      <span className="max-w-[12rem] truncate">{auction.title || t('auctionLive')}</span>
      <span className="tabular">· {t('auctionSecondsLeft', { n: Math.ceil(left / 1000) })}</span>
    </button>
  );
}

export function AuctionSheet({
  open,
  onClose,
  game,
  me,
  left,
  bid,
  cancel,
}: {
  open: boolean;
  onClose: () => void;
  game: GameSnapshot;
  me: PlayerView;
  left: number;
  bid: (auctionId: string, amount: number) => Promise<Result>;
  cancel: (auctionId: string) => Promise<Result>;
}) {
  const { t, locale, errorText } = useI18n();
  const toast = useToast();
  const [custom, setCustom] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const a = game.auction;

  useEffect(() => {
    if (open) setCustom(0);
  }, [open, a?.id]);

  if (!a) return null;
  const money = (n: number) => formatMoney(n, game.currency, locale);
  const name = (id: string) => (id === me.userId ? t('you') : (game.players.find((p) => p.userId === id)?.name ?? ''));
  const high = highBid(a);
  const leader = high ? game.players.find((p) => p.userId === high.userId) : null;
  const floor = nextBidFloor(a);
  const isOpen = a.status === 'open';
  const canCancel = isOpen && (a.startedBy === me.userId || game.hostUserId === me.userId);
  const imIn = me.status === 'active';
  const steps = quickAmounts(game.startingCapital).slice(0, 3);
  const offers = high ? steps.map((s) => high.amount + s) : [floor, ...steps.slice(1).map((s) => Math.max(floor, s))].filter((v, i, list) => list.indexOf(v) === i);
  // the bar runs from the last bid (or the start) to the end time; both are server times
  const windowMs = Math.max(1, Date.parse(a.endsAt) - Date.parse(high?.at ?? a.startedAt));
  const secs = Math.ceil(left / 1000);

  const place = async (amount: number, key: string) => {
    if (busy) return;
    setBusy(key);
    buzz(10);
    const r = await bid(a.id, amount);
    setBusy(null);
    if (!r.ok) toast.error(errorText(r.error));
    else setCustom(0);
  };

  let result: string | null = null;
  if (a.status === 'sold') result = `${a.winnerUserId === me.userId ? t('auctionSoldYou') : t('auctionSold', { name: name(a.winnerUserId!) })} · ${money(a.price ?? 0)}`;
  if (a.status === 'unsold') result = t('auctionUnsold');
  if (a.status === 'cancelled') result = t('auctionCancelled');

  return (
    <Sheet open={open} onClose={onClose} title={a.title || t('auction')}>
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-sm font-semibold text-ink-2">{a.startedBy === me.userId ? t('auctionStartedByYou') : t('auctionStartedBy', { name: name(a.startedBy) })}</p>

        <div className="felt relative overflow-hidden rounded-[1.4rem] px-5 pt-4 pb-5 text-center">
          {isOpen ? (
            <>
              <p className="eyebrow">{high ? (high.userId === me.userId ? t('auctionYouLead') : t('auctionLeads', { name: name(high.userId) })) : t('auctionNoBids')}</p>
              <div className="mt-1 flex items-center justify-center gap-3">
                {leader && <Token color={leader.color} token={leader.token} size={40} />}
                <FitText className="max-w-full font-display text-[clamp(2.2rem,11vw,3rem)] leading-tight font-extrabold text-gold tabular">
                  <span key={high?.amount ?? 0} className="inline-block" style={{ animation: 'bump 450ms cubic-bezier(0.3, 1.6, 0.5, 1)' }}>
                    {high ? money(high.amount) : t('auctionFrom', { amount: money(floor) })}
                  </span>
                </FitText>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/25">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ease-linear ${secs <= 3 ? 'bg-loss-felt' : 'bg-gold'}`}
                    style={{ width: `${Math.min(100, (left / windowMs) * 100)}%` }}
                  />
                </div>
                <span className={`shrink-0 text-right font-display text-sm font-bold whitespace-nowrap tabular ${secs <= 3 ? 'text-loss-felt' : 'text-white/80'}`} aria-live="off">
                  {t('auctionSecondsLeft', { n: secs })}
                </span>
              </div>
            </>
          ) : (
            <p className="py-3 font-display text-2xl leading-snug font-extrabold text-gold" role="status" style={{ animation: 'pop-in 300ms cubic-bezier(0.2, 1.4, 0.4, 1)' }}>
              {result}
            </p>
          )}
        </div>

        {isOpen && imIn && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {offers.map((amount) => (
                <Button
                  key={amount}
                  variant={amount > me.balance ? 'paper' : 'gold'}
                  disabled={amount > me.balance || left <= 0}
                  busy={busy === `q${amount}`}
                  onClick={() => place(amount, `q${amount}`)}
                  className="min-w-0 px-2"
                >
                  <FitText className="min-w-0 tabular">{money(amount)}</FitText>
                </Button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom >= floor && custom <= me.balance) void place(custom, 'custom');
              }}
            >
              <label htmlFor="auction-custom" className="sr-only">
                {t('auctionCustom')}
              </label>
              <TextInput
                id="auction-custom"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t('auctionCustom')}
                value={custom ? formatMoney(custom, game.currency, locale) : ''}
                onChange={(e) => setCustom(digits(e.target.value))}
                invalid={custom > me.balance}
                className="flex-1 font-display tabular"
              />
              <Button type="submit" variant="white" disabled={custom < floor || custom > me.balance || left <= 0} busy={busy === 'custom'}>
                <Gavel aria-hidden className="size-4" />
              </Button>
            </form>
            <p className={`-mt-2 text-sm font-semibold tabular ${custom > me.balance ? 'text-loss' : 'text-ink-2'}`}>
              {custom > me.balance ? t('auctionCantAfford') : t('balanceAfter', { from: money(me.balance), to: money(me.balance - (custom || offers[0] || 0)) })}
            </p>
          </>
        )}

        {canCancel && (
          <button
            type="button"
            disabled={busy === 'cancel'}
            onClick={async () => {
              setBusy('cancel');
              const r = await cancel(a.id);
              setBusy(null);
              if (!r.ok) toast.error(errorText(r.error));
            }}
            className="self-center rounded-lg px-2 py-1 text-sm font-bold text-loss hover:bg-loss-soft"
          >
            {t('auctionCancel')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
