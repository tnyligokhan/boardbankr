import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { GamePreview, GameSnapshot } from '@mdb/shared';
import { Button, Spinner, buttonClass } from '../components/ui';
import { GameTopBar } from '../game/common';
import { Finished } from '../game/Finished';
import { Lobby } from '../game/Lobby';
import { Table } from '../game/Table';
import { buzz, ching } from '../lib/fx';
import { formatMoney } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { useGame, type Result } from '../lib/useGame';

export default function Game() {
  const { ref = '' } = useParams();
  const { user } = useSession();
  const { t, locale } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const meId = user!.id;

  // Tell people about what happens while they look elsewhere: money in, a new round, their turn.
  const onSnapshot = useCallback(
    (next: GameSnapshot, prev: GameSnapshot | null) => {
      if (!prev || prev.id !== next.id) return;
      if (prev.status === 'lobby' && next.status === 'active') {
        toast.turn(next.turnUserId === meId ? t('gameStartedYou') : t('gameStarted'));
        return;
      }
      const lastSeen = prev.transactions[0]?.id ?? 0;
      const fresh = next.transactions.filter((tx) => tx.id > lastSeen).reverse();
      for (const tx of fresh) {
        if (tx.toUserId !== meId || tx.actorUserId === meId || tx.amount <= 0) continue;
        const from = next.players.find((p) => p.userId === tx.fromUserId);
        const amount = formatMoney(tx.amount, next.currency, locale);
        if (tx.kind === 'player_to_player') toast.incoming(t('receivedFrom', { name: from?.name ?? '', amount }), from);
        else if (tx.kind === 'bankruptcy') toast.incoming(t('bankruptcyCredit', { name: from?.name ?? '', amount }), from);
        else continue;
        ching(true);
        buzz([30, 40, 30]);
      }
      if (next.status !== 'active' || !next.turnsEnabled) return;
      const me = next.players.find((p) => p.userId === meId);
      if (next.turnUserId === meId && prev.turnUserId !== meId) {
        toast.turn(next.round > prev.round ? t('roundStartsYou', { n: next.round }) : t('yourTurnToast'), me);
        buzz([20, 60, 20]);
      } else if (next.round > prev.round) {
        toast.turn(t('roundStarted', { n: next.round }));
      }
    },
    [meId, t, toast, locale],
  );

  const g = useGame(ref, onSnapshot);
  const { state } = g;

  useEffect(() => {
    if (state.phase === 'member') document.title = `${state.game.code} · BoardBankr`;
  }, [state]);

  useEffect(() => {
    if (state.phase === 'removed' && state.reason === 'left') navigate('/app', { replace: true });
  }, [state, navigate]);

  if (state.phase === 'loading') {
    return (
      <div className="felt grid min-h-dvh place-items-center">
        <Spinner label={t('loading')} onFelt />
      </div>
    );
  }

  if (state.phase === 'error' || state.phase === 'removed') {
    const message =
      state.phase === 'removed'
        ? state.reason === 'kicked'
          ? t('youWereKicked')
          : state.reason === 'disbanded'
            ? t('lobbyClosed')
            : ''
        : state.error === 'game_not_found'
          ? t('gameMissing')
          : null;
    return <Notice message={message} errorCode={state.phase === 'error' ? state.error : null} retry={g.reload} />;
  }

  if (state.phase === 'preview') return <JoinPreview preview={state.preview} join={g.join} />;

  const { game } = state;
  if (game.status === 'lobby') {
    return (
      <div className="felt min-h-dvh">
        <GameTopBar code={game.code} connection={g.connection} />
        <Lobby game={game} meId={meId} start={g.start} kick={g.kick} leave={g.leave} disband={g.disband} setToken={g.setToken} />
      </div>
    );
  }
  if (game.status === 'active') {
    return (
      <Table
        game={game}
        meId={meId}
        connection={g.connection}
        act={g.act}
        finish={g.finish}
        kick={g.kick}
        leave={g.leave}
        endTurn={g.endTurn}
        skipTurn={g.skipTurn}
        undo={g.undo}
        roll={g.roll}
        startAuction={g.startAuction}
        bid={g.bid}
        cancelAuction={g.cancelAuction}
        settleAuction={g.settleAuction}
      />
    );
  }
  return <Finished game={game} meId={meId} connection={g.connection} />;
}

function Notice({ message, errorCode, retry }: { message: string | null; errorCode: string | null; retry: () => void }) {
  const { t, errorText } = useI18n();
  const text = message ?? (errorCode ? errorText(errorCode as Parameters<typeof errorText>[0]) : '');
  return (
    <main className="felt flex min-h-dvh flex-col justify-center px-4 pt-safe pb-24">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <p className="font-display text-2xl leading-snug font-bold">{text}</p>
        <div className="flex gap-2">
          <Link to="/app" className={buttonClass('gold')}>
            {t('backHome')}
          </Link>
          {errorCode && errorCode !== 'game_not_found' && (
            <Button variant="glass" onClick={retry}>
              {t('retry')}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function JoinPreview({ preview, join }: { preview: GamePreview; join: () => Promise<Result> }) {
  const { t, locale, errorText } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const money = (n: number) => formatMoney(n, preview.currency, locale);

  const onJoin = async () => {
    setBusy(true);
    const r = await join();
    setBusy(false);
    if (!r.ok) toast.error(errorText(r.error));
  };

  return (
    <div className="felt min-h-dvh">
      <GameTopBar code={preview.code} connection="online" />
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 pt-10 pb-16 text-center">
        <span className="font-display text-[2.6rem] font-extrabold tracking-[0.1em] text-gold [text-shadow:0_3px_0_rgb(0_0_0/0.25)]">{preview.code}</span>
        <div>
          <h1 className="font-display text-[clamp(1.8rem,6vw,2.3rem)] leading-tight font-extrabold">{t('joinTitle', { name: preview.hostName })}</h1>
          <p className="mt-2 text-white/75">{t('joinLead', { count: preview.playerCount, max: preview.maxPlayers })}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <span className="rounded-full bg-black/22 px-3 py-1.5 text-sm font-semibold text-white/80">{t('startsWith', { amount: money(preview.startingCapital) })}</span>
          <span className="rounded-full bg-black/22 px-3 py-1.5 text-sm font-semibold text-white/80">
            {preview.salary > 0 ? t('salaryChip', { amount: money(preview.salary) }) : t('noSalaryChip')}
          </span>
        </div>
        <Button size="lg" block busy={busy} onClick={onJoin} disabled={preview.playerCount >= preview.maxPlayers}>
          {t('joinGame')}
        </Button>
      </main>
    </div>
  );
}
