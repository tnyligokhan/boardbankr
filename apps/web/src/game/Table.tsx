import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Dices,
  Ellipsis,
  Flag,
  Gavel,
  History,
  Hourglass,
  LogOut,
  SkipForward,
  Trophy,
  UserMinus,
} from 'lucide-react';
import { REVERSIBLE_KINDS, canUndo, reversedIds, type GameAction, type GameSnapshot, type PlayerView, type TransactionView } from '@mdb/shared';
import { BankChip } from '../components/BankChip';
import { FitText } from '../components/FitText';
import { RoundTable, type RoundTableHandle } from '../components/RoundTable';
import { ConfirmSheet, Sheet } from '../components/Sheet';
import { Token } from '../components/Token';
import { Button, IconButton, Toggle } from '../components/ui';
import { buzz, ching, coinsFor, flyCoins, sounds, useSoundSetting } from '../lib/fx';
import { formatMoney } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { useAnimatedNumber } from '../lib/useAnimatedNumber';
import type { Connection, Result } from '../lib/useGame';
import { useWakeLock } from '../lib/useWakeLock';
import { ActivityList, BankBadge, GameTopBar, seatsFromMe, touchesParking, type UndoControls } from './common';
import { AuctionBanner, AuctionSheet, AuctionStartSheet, DiceOverlay, DiceSheet, useAuctionClock, useDiceCount } from './Extras';
import { PaySheet, type PayMode } from './PaySheet';

interface Props {
  game: GameSnapshot;
  meId: string;
  connection: Connection;
  act: (a: GameAction) => Promise<Result>;
  finish: () => Promise<Result>;
  kick: (userId: string) => Promise<Result>;
  leave: () => Promise<Result>;
  endTurn: (userId: string) => Promise<Result>;
  skipTurn: (userId: string) => Promise<Result>;
  undo: (txId: number) => Promise<Result>;
  roll: (count: number) => Promise<Result>;
  startAuction: (title: string, minBid: number) => Promise<Result>;
  bid: (auctionId: string, amount: number) => Promise<Result>;
  cancelAuction: (auctionId: string) => Promise<Result>;
  settleAuction: (auctionId: string) => Promise<Result>;
}

type Confirm = { kind: 'finish' } | { kind: 'leave' } | { kind: 'kick'; player: PlayerView } | { kind: 'skip'; player: PlayerView } | null;

/** Where a payment starts and ends on the table: a seat id, 'bank' or 'parking'. */
function ends(tx: TransactionView, game: GameSnapshot): [string, string] | null {
  switch (tx.kind) {
    case 'auction':
      return [tx.fromUserId!, 'bank'];
    case 'reversal': {
      const pool = touchesParking(tx, game) ? 'parking' : 'bank';
      return [tx.fromUserId ?? pool, tx.toUserId ?? pool];
    }
    case 'player_to_player':
      return [tx.fromUserId!, tx.toUserId!];
    case 'player_to_bank':
      return [tx.fromUserId!, 'bank'];
    case 'bank_to_player':
    case 'salary':
      return ['bank', tx.toUserId!];
    case 'player_to_parking':
      return [tx.fromUserId!, 'parking'];
    case 'parking_to_player':
      return ['parking', tx.toUserId!];
    case 'bankruptcy':
      return [tx.fromUserId!, tx.toUserId ?? 'bank'];
    default:
      return null;
  }
}

export function Table({ game, meId, connection, act, finish, kick, leave, endTurn, skipTurn, undo, roll, startAuction, bid, cancelAuction, settleAuction }: Props) {
  const { t, locale, errorText } = useI18n();
  const toast = useToast();
  const me = game.players.find((p) => p.userId === meId)!;
  const isHost = game.hostUserId === meId;
  const imIn = me.status === 'active';
  const money = useCallback((n: number) => formatMoney(n, game.currency, locale), [game.currency, locale]);
  const coin = game.currency;

  const table = useRef<RoundTableHandle>(null);
  const [pay, setPay] = useState<PayMode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bankruptOpen, setBankruptOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const wake = useWakeLock(true);
  const sound = useSoundSetting();
  const balance = useAnimatedNumber(me.balance, 800);

  // ----- undo -----
  const gameRef = useRef(game);
  gameRef.current = game;
  const [undoing, setUndoing] = useState<number | null>(null);
  const runUndo = useCallback(
    async (txId: number) => {
      setUndoing(txId);
      const r = await undo(txId);
      setUndoing(null);
      if (r.ok) {
        buzz(15);
        toast.success(t('undoDone'));
      } else toast.error(errorText(r.error));
    },
    [undo, toast, t, errorText],
  );
  const undoControls: UndoControls = {
    can: (tx) => canUndo(tx, { userId: meId, isHost, now: Date.now(), reversed: reversedIds(game.transactions) }) && game.status === 'active',
    run: (tx) => void runUndo(tx.id),
    busyId: undoing,
  };
  /** The toast after a payment offers to undo it: my newest payment that can still be undone. */
  const undoLastAction = useCallback(
    () => ({
      label: t('undo'),
      onClick: () => {
        const g = gameRef.current;
        const done = reversedIds(g.transactions);
        const last = g.transactions.find((tx) => tx.actorUserId === meId && REVERSIBLE_KINDS.includes(tx.kind) && !done.has(tx.id));
        if (last) void runUndo(last.id);
      },
    }),
    [meId, runUndo, t],
  );

  // ----- dice -----
  const [diceCount, setDiceCount] = useDiceCount();
  const [diceOpen, setDiceOpen] = useState(false);
  const rollDice = useCallback(async () => {
    const r = await roll(diceCount);
    if (!r.ok) toast.error(errorText(r.error));
  }, [roll, diceCount, toast, errorText]);

  // ----- auction -----
  const auction = game.auction;
  const auctionLeft = useAuctionClock(auction, game.version);
  const [auctionStartOpen, setAuctionStartOpen] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const seenAuction = useRef(auction?.status === 'open' ? null : (auction?.id ?? null));
  // a new auction opens on every phone at the table; its result shows for a moment, then goes
  useEffect(() => {
    if (!auction) return;
    if (auction.status === 'open' && seenAuction.current !== auction.id) {
      seenAuction.current = auction.id;
      setAuctionOpen(true);
      buzz(20);
    }
    if (auction.status !== 'open') {
      const timer = setTimeout(() => setAuctionOpen(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [auction]);
  // the last three seconds tick
  const secondsLeft = auction?.status === 'open' ? Math.ceil(auctionLeft / 1000) : 0;
  useEffect(() => {
    if (secondsLeft > 0 && secondsLeft <= 3) sounds.tick(secondsLeft === 1);
  }, [secondsLeft]);

  // when the countdown runs out, ask the server to settle (it also does so on its own)
  const auctionId = auction?.status === 'open' ? auction.id : null;
  const expired = auctionId !== null && auctionLeft <= 0;
  useEffect(() => {
    if (!expired || !auctionId) return;
    const first = setTimeout(() => void settleAuction(auctionId), 400);
    const again = setTimeout(() => void settleAuction(auctionId), 2500);
    return () => {
      clearTimeout(first);
      clearTimeout(again);
    };
  }, [expired, auctionId, settleAuction]);

  // money moving on the table: every new payment flies across, whoever made it
  const lastTx = useRef(game.transactions[0]?.id ?? 0);
  useEffect(() => {
    const fresh = game.transactions.filter((tx) => tx.id > lastTx.current).reverse();
    lastTx.current = game.transactions[0]?.id ?? lastTx.current;
    for (const tx of fresh) {
      const e = ends(tx, game);
      if (!e || tx.amount <= 0) continue;
      const [from, to] = e;
      void flyCoins(table.current?.node(from), table.current?.node(to), coinsFor(tx.amount, game.startingCapital), coin).then(() => {
        const text = money(tx.amount);
        if (from !== 'bank' && from !== 'parking') table.current?.float(from, `−${text}`, true);
        if (to !== 'bank' && to !== 'parking') table.current?.float(to, `+${text}`);
      });
    }
  }, [game, money, coin]);

  const quick = async (key: string, action: GameAction, done: string) => {
    if (busy) return;
    setBusy(key);
    const r = await act(action);
    setBusy(null);
    if (r.ok) {
      buzz(20);
      ching(true);
      toast.success(done, undoLastAction());
    } else toast.error(errorText(r.error));
  };

  const runConfirm = async (fn: () => Promise<Result>) => {
    setBusy('confirm');
    const r = await fn();
    setBusy(null);
    setConfirm(null);
    if (!r.ok) toast.error(errorText(r.error));
  };

  const onDrop = useCallback((target: string) => setPay({ kind: 'pay', to: target }), []);
  const onTapMe = useCallback(() => setPay({ kind: 'pay', to: null }), []);
  const onTake = useCallback(() => setPay({ kind: 'take' }), []);

  const others = game.players.filter((p) => p.userId !== meId);
  const active = game.players.filter((p) => p.status === 'active');
  const richest = active.reduce<PlayerView | null>((a, b) => (!a || b.balance > a.balance ? b : a), null);
  const leaderId = richest && active.some((p) => p.balance !== richest.balance) ? richest.userId : null;
  const turnPlayer = game.turnsEnabled ? (game.players.find((p) => p.userId === game.turnUserId) ?? null) : null;
  const myTurn = turnPlayer?.userId === meId;
  const ordered = seatsFromMe(game.players, meId);

  const seats = ordered.map((p) => ({
    id: p.userId,
    name: p.userId === meId ? t('you') : p.name,
    color: p.color,
    token: p.token,
    balance: p.status === 'active' ? money(p.balance) : p.status === 'bankrupt' ? t('bankrupt') : t('left'),
    out: p.status !== 'active',
    label: t('payTo', { name: p.name }),
  }));

  const standings = [...game.players].sort((a, b) => (a.status === 'active') === (b.status === 'active') ? b.balance - a.balance : a.status === 'active' ? -1 : 1);

  /**
   * The whole status in one slim bar between back and menu: my balance on the left, the round and
   * whose turn it is on the right. Everything else on the screen goes to the table.
   */
  const statusBar = (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2" aria-live="polite">
      <div className="relative flex min-w-0 flex-col items-start leading-none">
        <span className="max-w-full truncate text-[0.62rem] font-bold tracking-[0.12em] text-white/55 uppercase">
          {imIn ? t('yourBalance') : me.status === 'bankrupt' ? t('bankrupt') : t('left')}
        </span>
        <FitText className="max-w-full font-display text-[1.45rem] leading-[1.15] font-extrabold text-gold tabular">
          <span key={balance.change ? `${me.balance}` : 'still'} className="inline-block" style={balance.change ? { animation: 'bump 500ms cubic-bezier(0.3, 1.6, 0.5, 1)' } : undefined}>
            {money(balance.shown)}
          </span>
        </FitText>
        {/* the change floats under the number instead of taking a line */}
        <span
          className={`pointer-events-none absolute top-full left-0 font-display text-[0.78rem] font-bold whitespace-nowrap ${balance.change === 'gain' ? 'text-gain-felt' : 'text-loss-felt'}`}
        >
          {balance.change ? `${balance.delta > 0 ? '+' : '−'}${money(Math.abs(balance.delta))}` : ''}
        </span>
      </div>
      {turnPlayer && (
        <span
          className={`inline-flex h-10 max-w-[9.5rem] min-w-0 items-center gap-1.5 rounded-full pr-3 pl-1 ${myTurn ? 'bg-gold text-gold-ink' : 'bg-black/25'}`}
          style={myTurn ? { animation: 'glow 1.6s ease-in-out infinite' } : undefined}
        >
          <Token color={turnPlayer.color} token={turnPlayer.token} size={30} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-display text-[0.85rem] font-bold">{myTurn ? t('turnYou') : t('turnOther', { name: turnPlayer.name })}</span>
            <span className={`text-[0.68rem] font-bold ${myTurn ? 'text-gold-ink/70' : 'text-white/60'}`}>
              {t('round')} <span key={game.round} className="inline-block tabular" style={{ animation: 'tick 500ms cubic-bezier(0.3, 1.6, 0.5, 1)' }}>{game.round}</span>
            </span>
          </span>
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* the first screen is exactly one viewport: the table takes whatever height the controls leave */}
      <div className="felt game-screen">
        <GameTopBar
          code={game.code}
          connection={connection}
          center={statusBar}
          right={
            <IconButton label={t('menu')} onClick={() => setMenuOpen(true)} className="hover:bg-white/10">
              <Ellipsis aria-hidden className="size-5" />
            </IconButton>
          }
        />

        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col items-center px-4">
          {auction?.status === 'open' && <AuctionBanner auction={auction} left={auctionLeft} onOpen={() => setAuctionOpen(true)} />}

          {!imIn && <p className="mt-3 shrink-0 rounded-2xl bg-black/22 px-4 py-3 text-center text-[0.95rem] text-white/80">{t('outBanner')}</p>}

          <div className="table-fit relative">
            <RoundTable
              ref={table}
              seats={seats}
              meId={meId}
              coin={coin}
              turnId={turnPlayer?.userId ?? null}
              crownId={leaderId}
              label={t('players')}
              onSeat={imIn ? (id) => setPay({ kind: 'pay', to: id }) : undefined}
              onDrop={imIn ? onDrop : undefined}
              onTake={imIn ? onTake : undefined}
              onTapMe={imIn ? onTapMe : undefined}
              center={
                <>
                  <BankChip
                    drop
                    label={t('theBank')}
                    ariaLabel={imIn ? t('payBank') : undefined}
                    onClick={imIn ? () => setPay({ kind: 'pay', to: 'bank' }) : undefined}
                  />
                  {game.freeParkingEnabled && (
                    <button
                      type="button"
                      data-drop="parking"
                      className="pot-chip"
                      disabled={!imIn}
                      aria-label={`${t('parkingPot')}: ${money(game.freeParkingPot)}`}
                      onClick={() => imIn && setPay({ kind: 'pay', to: 'parking' })}
                    >
                      <i>P</i>
                      {money(game.freeParkingPot)}
                    </button>
                  )}
                </>
              }
            />
            {/* every roll lands here, on the felt in the middle of the table */}
            <DiceOverlay roll={game.lastRoll} players={game.players} meId={meId} onRollAgain={() => void rollDice()} />
          </div>
          {imIn && <p className="game-hint shrink-0 text-center text-[0.82rem] text-white/55">{t('dragHint')}</p>}

          {imIn && (
            <div className="mt-3 grid w-full max-w-md shrink-0 grid-cols-2 gap-2">
              {game.salary > 0 && (
                <Button
                  size="lg"
                  className="col-span-2 justify-between"
                  busy={busy === 'salary'}
                  onClick={() => quick('salary', { kind: 'salary' }, t('salaryDone', { amount: money(game.salary) }))}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Coins aria-hidden className="size-5" />
                    {t('passedGo')}
                  </span>
                  <FitText className="min-w-0 text-right tabular">+{money(game.salary)}</FitText>
                </Button>
              )}
              {/* the smaller moves share one row, so the table keeps its room */}
              <div className="col-span-2 grid grid-cols-5 gap-1.5">
                <ToolTile icon={ArrowDownLeft} label={t('toolTake')} onClick={() => setPay({ kind: 'take' })} />
                <ToolTile icon={ArrowUpRight} label={t('toolPay')} onClick={() => setPay({ kind: 'pay', to: 'bank' })} />
                <ToolTile icon={Dices} label={t('toolDice')} onClick={() => setDiceOpen(true)} />
                <ToolTile
                  icon={Gavel}
                  label={t('toolAuction')}
                  live={auction?.status === 'open'}
                  onClick={() => (auction?.status === 'open' ? setAuctionOpen(true) : setAuctionStartOpen(true))}
                />
                <ToolTile icon={Flag} label={t('toolBankrupt')} danger onClick={() => setBankruptOpen(true)} />
              </div>
              {game.freeParkingEnabled && game.freeParkingPot > 0 && (
                <Button
                  variant="glass"
                  className="col-span-2"
                  busy={busy === 'pot'}
                  onClick={() => quick('pot', { kind: 'parking_to_player' }, t('tookDone', { amount: money(game.freeParkingPot) }))}
                >
                  {t('collectPotAmount', { amount: money(game.freeParkingPot) })}
                </Button>
              )}
              {turnPlayer && (
                <Button
                  variant="white"
                  size="lg"
                  className="col-span-2"
                  disabled={!myTurn}
                  busy={busy === 'turn'}
                  onClick={async () => {
                    setBusy('turn');
                    buzz(15);
                    const r = await endTurn(meId);
                    setBusy(null);
                    if (!r.ok) toast.error(errorText(r.error));
                  }}
                >
                  {myTurn ? <SkipForward aria-hidden className="size-5" /> : <Hourglass aria-hidden className="size-5" />}
                  {myTurn ? t('endTurn') : t('turnOf', { name: turnPlayer.name })}
                </Button>
              )}
            </div>
          )}
          {turnPlayer && isHost && !myTurn && (
            <p className="mt-2 shrink-0 text-center text-sm text-white/60">
              {t('skipLead')}{' '}
              <button type="button" onClick={() => setConfirm({ kind: 'skip', player: turnPlayer })} className="rounded-md px-1 font-bold text-gold hover:bg-white/10">
                {t('skipTurn')}
              </button>
            </p>
          )}
        </main>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-2">
        <section className="card px-5 py-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold">{t('activity')}</h2>
            {game.transactions.length > 6 && (
              <button type="button" onClick={() => setHistoryOpen(true)} className="rounded-lg px-2 py-1 text-sm font-bold text-gain hover:bg-sand">
                {t('seeAll')}
              </button>
            )}
          </div>
          <ActivityList game={game} meId={meId} limit={6} undo={undoControls} />
        </section>
        <section className="card self-start px-5 py-4">
          <h2 className="font-display text-lg font-bold">{t('standings')}</h2>
          <ol className="mt-1 divide-y-[1.5px] divide-sand">
            {standings.map((p, i) => {
              const out = p.status !== 'active';
              return (
                <li key={p.userId} className="flex items-center gap-3 py-2.5">
                  <span className="w-4 text-center font-display text-sm font-bold text-ink-3">{i + 1}</span>
                  <Token color={p.color} token={p.token} size={34} muted={out} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {p.name}
                    {p.userId === meId && <span className="font-medium text-ink-2"> ({t('you')})</span>}
                  </span>
                  <FitText className={`max-w-[45%] text-right font-display font-semibold tabular ${out ? 'text-ink-3' : ''}`}>
                    {out ? (p.status === 'bankrupt' ? t('bankrupt') : t('left')) : money(p.balance)}
                  </FitText>
                  {isHost && !out && p.userId !== meId && (
                    <button
                      type="button"
                      aria-label={`${t('kick')}: ${p.name}`}
                      title={t('kick')}
                      onClick={() => setConfirm({ kind: 'kick', player: p })}
                      className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-sand hover:text-loss"
                    >
                      <UserMinus aria-hidden className="size-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <PaySheet mode={pay} game={game} me={me} act={act} onClose={() => setPay(null)} undoAction={undoLastAction} />

      <DiceSheet open={diceOpen} onClose={() => setDiceOpen(false)} count={diceCount} setCount={setDiceCount} onRoll={rollDice} />
      <AuctionStartSheet open={auctionStartOpen} onClose={() => setAuctionStartOpen(false)} game={game} start={startAuction} />
      <AuctionSheet open={auctionOpen} onClose={() => setAuctionOpen(false)} game={game} me={me} left={auctionLeft} bid={bid} cancel={cancelAuction} />

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title={t('history')}>
        <ActivityList game={game} meId={meId} undo={undoControls} />
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t('menu')}>
        <div className="flex flex-col gap-1 pt-1">
          <Toggle flat checked={sound.on} onChange={sound.set} label={t('coinSound')} description={t('coinSoundNote')} />
          {wake.supported && <Toggle flat checked={wake.enabled} onChange={wake.setEnabled} label={t('keepAwake')} description={t('keepAwakeNote')} />}
          <MenuItem icon={History} label={t('history')} onClick={() => { setMenuOpen(false); setHistoryOpen(true); }} />
          {imIn && <MenuItem icon={Flag} label={t('declareBankruptcy')} onClick={() => { setMenuOpen(false); setBankruptOpen(true); }} />}
          {isHost && <MenuItem icon={Trophy} label={t('finishGame')} onClick={() => { setMenuOpen(false); setConfirm({ kind: 'finish' }); }} />}
          {imIn && <MenuItem icon={LogOut} label={t('leaveGame')} danger onClick={() => { setMenuOpen(false); setConfirm({ kind: 'leave' }); }} />}
        </div>
      </Sheet>

      <BankruptcySheet open={bankruptOpen} onClose={() => setBankruptOpen(false)} balance={money(me.balance)} creditors={others.filter((p) => p.status === 'active')} act={act} />

      <ConfirmSheet open={confirm?.kind === 'finish'} title={t('finishGame')} body={t('finishGameConfirm')} confirmLabel={t('finishGame')} busy={busy === 'confirm'} onClose={() => setConfirm(null)} onConfirm={() => runConfirm(finish)} />
      <ConfirmSheet open={confirm?.kind === 'leave'} title={t('leaveGame')} body={t('leaveGameConfirm')} confirmLabel={t('leaveGame')} danger busy={busy === 'confirm'} onClose={() => setConfirm(null)} onConfirm={() => runConfirm(leave)} />
      <ConfirmSheet
        open={confirm?.kind === 'kick'}
        title={t('kick')}
        body={confirm?.kind === 'kick' ? t('kickConfirmActive', { name: confirm.player.name }) : ''}
        confirmLabel={t('kick')}
        danger
        busy={busy === 'confirm'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'kick' && runConfirm(() => kick(confirm.player.userId))}
      />
      <ConfirmSheet
        open={confirm?.kind === 'skip'}
        title={t('skipTurn')}
        body={confirm?.kind === 'skip' ? t('skipConfirm', { name: confirm.player.name }) : ''}
        confirmLabel={t('skipTurn')}
        busy={busy === 'confirm'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'skip' && runConfirm(() => skipTurn(confirm.player.userId))}
      />
    </div>
  );
}

/** A compact key on the felt: icon over a short label. Five fit across a phone. */
function ToolTile({
  icon: Icon,
  label,
  onClick,
  danger,
  live,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  live?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tool-tile ${live ? 'bg-gold text-gold-ink shadow-[0_3px_0_var(--gold-deep)]' : danger ? 'text-loss-felt' : 'text-white'}`}
    >
      <Icon aria-hidden className="size-5" />
      <span className="line-clamp-2 max-w-full px-0.5 text-center text-[0.72rem] leading-[1.1] font-bold">{label}</span>
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-14 items-center gap-3 rounded-2xl px-3.5 text-left font-bold hover:bg-sand ${danger ? 'text-loss' : 'text-ink'}`}>
      <Icon aria-hidden className="size-5" />
      {label}
    </button>
  );
}

function BankruptcySheet({ open, onClose, balance, creditors, act }: { open: boolean; onClose: () => void; balance: string; creditors: PlayerView[]; act: (a: GameAction) => Promise<Result> }) {
  const { t, errorText } = useI18n();
  const toast = useToast();
  const [creditor, setCreditor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const r = await act({ kind: 'bankruptcy', creditorUserId: creditor });
    setBusy(false);
    if (r.ok) onClose();
    else toast.error(errorText(r.error));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('bankruptcyTitle')}
      footer={
        <Button variant="danger" size="lg" block busy={busy} onClick={submit}>
          {t('bankruptcyConfirm')}
        </Button>
      }
    >
      <p className="text-ink-2">{t('bankruptcyLead', { balance })}</p>
      <p className="mt-5 text-sm font-bold">{t('bankruptcyTo')}</p>
      <div role="radiogroup" aria-label={t('bankruptcyTo')} className="mt-2 flex flex-wrap gap-2">
        {[{ id: null as string | null, p: null as PlayerView | null }, ...creditors.map((c) => ({ id: c.userId as string | null, p: c }))].map((o) => {
          const on = creditor === o.id;
          return (
            <button
              key={o.id ?? 'bank'}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCreditor(o.id)}
              className={`flex h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-sm font-bold ${on ? 'bg-ink text-paper shadow-[0_2px_0_#000]' : 'bg-card shadow-[0_0_0_1.5px_var(--line),0_2px_0_var(--line)]'}`}
            >
              {o.p ? <Token color={o.p.color} token={o.p.token} size={30} /> : <BankBadge size={30} />}
              {o.p ? o.p.name : t('theBank')}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
