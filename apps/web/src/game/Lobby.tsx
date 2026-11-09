import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Play, QrCode, Share2 } from 'lucide-react';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START, PLAYER_TOKENS, type GameSnapshot, type PlayerToken, type PlayerView } from '@mdb/shared';
import { RoundTable } from '../components/RoundTable';
import { ConfirmSheet } from '../components/Sheet';
import { Token } from '../components/Token';
import { Button } from '../components/ui';
import { buzz, ching } from '../lib/fx';
import { formatMoney } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Result } from '../lib/useGame';
import { seatsFromMe } from './common';

interface Props {
  game: GameSnapshot;
  meId: string;
  start: () => Promise<Result>;
  kick: (userId: string) => Promise<Result>;
  leave: () => Promise<Result>;
  disband: () => Promise<Result>;
  setToken: (token: PlayerToken) => Promise<Result>;
}

/** Ids seen on the previous render, so people who just sat down get the drop-in animation. */
function useArrivals(ids: string[]): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const key = ids.join(',');
  useEffect(() => {
    const now = new Set(key.split(',').filter(Boolean));
    if (seen.current) setFresh(new Set([...now].filter((id) => !seen.current!.has(id))));
    seen.current = now;
  }, [key]);
  return fresh;
}

export function Lobby({ game, meId, start, kick, leave, disband, setToken }: Props) {
  const { t, locale, errorText } = useI18n();
  const toast = useToast();
  const isHost = game.hostUserId === meId;
  const me = game.players.find((p) => p.userId === meId)!;
  const host = game.players.find((p) => p.userId === game.hostUserId);
  const inviteUrl = `${location.origin}/g/${game.code}`;
  const [busy, setBusy] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'kick'; player: PlayerView } | { kind: 'disband' } | null>(null);
  const money = (n: number) => formatMoney(n, game.currency, locale);

  const ordered = seatsFromMe(game.players, meId);
  const arrived = useArrivals(ordered.map((p) => p.userId));
  // every chair is laid from the start, so people see where the next player will sit
  const empties = MAX_PLAYERS - ordered.length;
  const seats = [
    ...ordered.map((p) => ({ id: p.userId, name: p.userId === meId ? t('you') : p.name, color: p.color, token: p.token, arrived: arrived.has(p.userId), label: isHost ? `${t('kick')}: ${p.name}` : p.name })),
    ...Array.from({ length: empties }, () => null),
  ];

  const run = async (key: string, fn: () => Promise<Result>, success?: string) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    setConfirm(null);
    if (!r.ok) toast.error(errorText(r.error));
    else if (success) toast.success(success);
  };

  const share = async () => {
    const text = t('shareText', { code: game.code });
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BoardBankr', text, url: inviteUrl });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    await navigator.clipboard?.writeText(inviteUrl).catch(() => undefined);
    toast.success(t('linkCopied'));
  };

  const copyCode = async () => {
    await navigator.clipboard?.writeText(game.code).catch(() => undefined);
    toast.success(t('codeCopied'));
  };

  const pick = async (token: PlayerToken) => {
    if (token === me.token) return;
    buzz(12);
    ching(true);
    const r = await setToken(token);
    if (!r.ok) toast.error(errorText(r.error));
  };

  const canStart = game.players.length >= MIN_PLAYERS_TO_START;
  const taken = new Set(game.players.filter((p) => p.userId !== meId).map((p) => p.token));

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-6 px-4 pt-1 pb-14 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:pt-6">
      <RoundTable
        seats={seats}
        meId={meId}
        label={t('players')}
        onSeat={isHost ? (id) => setConfirm({ kind: 'kick', player: game.players.find((p) => p.userId === id)! }) : undefined}
        center={
          <button type="button" onClick={copyCode} className="flex flex-col items-center rounded-2xl px-3 py-1 text-center hover:bg-white/5" aria-label={`${t('copyCode')}: ${game.code}`}>
            <span className="eyebrow">{t('tableCode')}</span>
            <span className="font-display text-[1.75rem] font-extrabold tracking-[0.1em] text-gold [text-shadow:0_3px_0_rgb(0_0_0/0.25)]">{game.code}</span>
          </button>
        }
      />

      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="font-display text-sm font-semibold tracking-[0.08em] text-white/60 uppercase">
            {t('playersOf', { n: game.players.length, max: MAX_PLAYERS })}
          </p>
          <h1 className="mt-1 font-display text-[1.6rem] leading-tight font-extrabold">{t('lobbyTitle')}</h1>
          <p className="mt-1.5 text-white/75">{t('lobbyShareLead')}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="glass" onClick={share}>
            <Share2 aria-hidden className="size-4" />
            {t('shareLink')}
          </Button>
          <Button variant="glass" onClick={copyCode}>
            <Copy aria-hidden className="size-4" />
            {t('copyCode')}
          </Button>
          <Button variant="glass" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
            <QrCode aria-hidden className="size-4" />
            {showQr ? t('hideQr') : t('showQr')}
          </Button>
        </div>
        {showQr && (
          <div className="flex justify-center" style={{ animation: 'pop-in 220ms cubic-bezier(0.2, 1.2, 0.4, 1)' }}>
            <div className="rounded-2xl bg-white p-3 shadow-[0_4px_0_rgb(0_0_0/0.2)]">
              <QRCodeSVG value={inviteUrl} size={148} fgColor="#15201a" bgColor="#ffffff" level="M" />
            </div>
          </div>
        )}

        <section className="text-center">
          <h2 className="eyebrow mb-3">{t('pickPiece')}</h2>
          <div role="radiogroup" aria-label={t('pickPiece')} className="mx-auto flex max-w-[24rem] flex-wrap justify-center gap-2.5">
            {PLAYER_TOKENS.map((tok) => {
              const on = tok === me.token;
              return (
                <button
                  key={tok}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={t(`piece_${tok}`)}
                  disabled={taken.has(tok)}
                  onClick={() => pick(tok)}
                  className="rounded-full transition-transform duration-200 enabled:hover:-translate-y-0.5 disabled:opacity-30"
                  style={on ? { transform: 'translateY(-4px) scale(1.08)' } : undefined}
                >
                  <span className={`block rounded-full ${on ? 'shadow-[0_0_0_3px_var(--felt),0_0_0_6px_var(--gold)]' : ''}`}>
                    <Token color={me.color} token={tok} size={46} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-1.5">
          {[
            t('startsWith', { amount: money(game.startingCapital) }),
            game.salary > 0 ? t('salaryChip', { amount: money(game.salary) }) : t('noSalaryChip'),
            game.freeParkingEnabled ? t('parkingOn') : t('parkingOff'),
            game.turnsEnabled ? t('turnsOn') : t('turnsOff'),
          ].map((r) => (
            <span key={r} className="rounded-full bg-black/22 px-3 py-1.5 text-[0.8rem] font-semibold text-white/75">
              {r}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {isHost ? (
            <>
              <Button size="lg" block disabled={!canStart} busy={busy === 'start'} onClick={() => run('start', start)}>
                <Play aria-hidden className="size-5" fill="currentColor" />
                {t('startGame')}
              </Button>
              <p className="text-center text-sm text-white/60">{canStart ? t('firstTurnHost') : t('needMorePlayers')}</p>
              <button type="button" onClick={() => setConfirm({ kind: 'disband' })} className="mx-auto mt-1 rounded-lg px-3 py-1.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white">
                {t('cancelGame')}
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center justify-center gap-2.5 rounded-2xl bg-black/22 px-4 py-3 text-center font-semibold">
                {host && <Token color={host.color} token={host.token} size={28} />}
                {t('waitingForHost', { name: host?.name ?? '' })}
              </p>
              <button
                type="button"
                disabled={busy === 'leave'}
                onClick={() => run('leave', leave)}
                className="mx-auto mt-1 rounded-lg px-3 py-1.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
              >
                {t('leaveLobby')}
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={confirm?.kind === 'kick'}
        title={t('kick')}
        body={confirm?.kind === 'kick' ? t('kickConfirm', { name: confirm.player.name }) : ''}
        confirmLabel={t('kick')}
        danger
        busy={busy === 'kick'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'kick' && run('kick', () => kick(confirm.player.userId), t('kicked', { name: confirm.player.name }))}
      />
      <ConfirmSheet
        open={confirm?.kind === 'disband'}
        title={t('cancelGame')}
        body={t('cancelGameConfirm')}
        confirmLabel={t('cancelGame')}
        danger
        busy={busy === 'disband'}
        onClose={() => setConfirm(null)}
        onConfirm={() => run('disband', disband)}
      />
    </main>
  );
}
