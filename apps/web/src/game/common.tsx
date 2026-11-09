import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Landmark, WifiOff } from 'lucide-react';
import { reversedIds, type GameSnapshot, type PlayerView, type TransactionView } from '@mdb/shared';
import { useI18n } from '../lib/i18n';
import { describeTx, deltaFor } from '../lib/describe';
import { formatMoney, formatTime } from '../lib/format';
import type { Connection } from '../lib/useGame';
import { FitText } from '../components/FitText';
import { Token } from '../components/Token';

/** Hides short connection blips: "connecting" only shows once it lasts longer than a moment. */
function useVisibleConnection(connection: Connection, delay = 1500): Connection {
  const [shown, setShown] = useState<Connection>(connection === 'offline' ? 'offline' : 'online');
  useEffect(() => {
    if (connection !== 'connecting') {
      setShown(connection);
      return;
    }
    const timer = setTimeout(() => setShown('connecting'), delay);
    return () => clearTimeout(timer);
  }, [connection, delay]);
  return shown;
}

/** Bar across the top of a game screen. Sits on the felt. */
export function GameTopBar({ code, connection: raw, center, right }: { code: string; connection: Connection; center?: ReactNode; right?: ReactNode }) {
  const { t } = useI18n();
  const connection = useVisibleConnection(raw);
  return (
    <>
      <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-2 pt-safe sm:px-4">
        <Link to="/app" aria-label={t('back')} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 justify-center">
          {center ?? <span className="font-display text-sm font-semibold tracking-[0.12em] text-white/75">{code}</span>}
        </div>
        <div className="flex w-11 shrink-0 justify-end">{right}</div>
      </header>
      {connection !== 'online' && (
        <div role="status" className="fixed inset-x-0 top-[calc(4.25rem+env(safe-area-inset-top))] z-40 flex justify-center px-4">
          <p className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper shadow-[0_4px_0_#000]">
            {connection === 'offline' ? (
              <WifiOff aria-hidden className="size-4" />
            ) : (
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-gold" />
            )}
            {connection === 'offline' ? t('offline') : t('reconnecting')}
          </p>
        </div>
      )}
    </>
  );
}

/** The bank as a small gold chip, for lists. */
export function BankBadge({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-gold text-gold-ink shadow-[inset_0_0_0_2px_rgb(255_255_255/0.45)]"
      style={{ width: size, height: size }}
    >
      <Landmark className="size-[45%]" strokeWidth={2.4} />
    </span>
  );
}

export function ParkingBadge({ size = 34 }: { size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-felt font-display text-xs font-extrabold text-white" style={{ width: size, height: size }}>
      P
    </span>
  );
}

/** Whether money went into or out of the free parking pot, also for the undo of such a payment. */
export function touchesParking(tx: TransactionView, game: GameSnapshot): boolean {
  const kind = tx.kind === 'reversal' ? game.transactions.find((x) => x.id === tx.reversesTxId)?.kind : tx.kind;
  return kind === 'player_to_parking' || kind === 'parking_to_player';
}

/** Whose piece to show next to a payment: the other side of it from me, or whoever paid. */
function counterpart(tx: TransactionView, game: GameSnapshot, meId: string): PlayerView | 'bank' | 'parking' {
  const ids = tx.fromUserId === meId ? [tx.toUserId] : tx.toUserId === meId ? [tx.fromUserId] : [tx.fromUserId, tx.toUserId];
  for (const id of ids) {
    const p = id && game.players.find((x) => x.userId === id);
    if (p) return p;
  }
  return touchesParking(tx, game) ? 'parking' : 'bank';
}

/** Undo controls for the activity list: who may undo what, and doing it. */
export interface UndoControls {
  can: (tx: TransactionView) => boolean;
  run: (tx: TransactionView) => void;
  busyId: number | null;
}

export function ActivityItem({
  tx,
  game,
  meId,
  reversed,
  undo,
}: {
  tx: TransactionView;
  game: GameSnapshot;
  meId: string;
  reversed?: boolean;
  undo?: UndoControls;
}) {
  const { t, locale } = useI18n();
  const delta = deltaFor(tx, meId);
  const who = counterpart(tx, game, meId);
  return (
    <li className="flex items-center gap-3 py-3" style={{ animation: 'slide-in 450ms cubic-bezier(0.2, 1.2, 0.4, 1)' }}>
      {who === 'bank' ? <BankBadge /> : who === 'parking' ? <ParkingBadge /> : <Token color={who.color} token={who.token} size={34} muted={who.status !== 'active'} />}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.95rem] leading-snug font-bold">{describeTx(tx, game, t)}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[0.8rem] text-ink-3 tabular">
          {formatTime(tx.createdAt, locale)}
          {reversed && <span className="rounded-full bg-sand px-2 font-bold text-ink-2">{t('undoneTag')}</span>}
          {!reversed && undo?.can(tx) && (
            <button
              type="button"
              disabled={undo.busyId === tx.id}
              onClick={() => undo.run(tx)}
              className="-my-1 rounded-md px-1.5 py-1 font-bold text-gain hover:bg-sand disabled:opacity-50"
            >
              {t('undo')}
            </button>
          )}
        </p>
      </div>
      <FitText
        className={`max-w-[45%] text-right font-display text-[0.95rem] font-bold tabular ${reversed ? 'text-ink-3 line-through' : delta > 0 ? 'text-gain' : delta < 0 ? 'text-loss' : 'text-ink-2'}`}
      >
        {delta > 0 ? '+' : delta < 0 ? '−' : ''}
        {formatMoney(tx.amount, game.currency, locale)}
      </FitText>
    </li>
  );
}

export function ActivityList({ game, meId, limit, undo }: { game: GameSnapshot; meId: string; limit?: number; undo?: UndoControls }) {
  const { t } = useI18n();
  const reversed = reversedIds(game.transactions);
  const items = limit ? game.transactions.slice(0, limit) : game.transactions;
  if (items.length === 0) return <p className="py-3 text-ink-2">{t('noActivity')}</p>;
  return (
    <ul className="divide-y-[1.5px] divide-sand">
      {items.map((tx) => (
        <ActivityItem key={tx.id} tx={tx} game={game} meId={meId} reversed={reversed.has(tx.id)} undo={undo} />
      ))}
    </ul>
  );
}

/** Players ordered for the table: seat order, starting with me so I sit at the bottom. */
export function seatsFromMe(players: PlayerView[], meId: string): PlayerView[] {
  const bySeat = [...players].sort((a, b) => a.seat - b.seat);
  const i = bySeat.findIndex((p) => p.userId === meId);
  return i <= 0 ? bySeat : [...bySeat.slice(i), ...bySeat.slice(0, i)];
}
