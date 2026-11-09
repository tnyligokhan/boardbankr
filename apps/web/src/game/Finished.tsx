import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { RotateCcw } from 'lucide-react';
import type { GameSnapshot, PlayerView } from '@mdb/shared';
import { BalanceChart, type ChartNote, type ChartSeries } from '../components/BalanceChart';
import { FitText } from '../components/FitText';
import { Token } from '../components/Token';
import { Button, buttonClass } from '../components/ui';
import { compactMoney, durationParts, formatMoney } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Connection } from '../lib/useGame';
import { ActivityList, GameTopBar } from './common';

function rank(players: PlayerView[], winnerId: string | null): PlayerView[] {
  return [...players].sort((a, b) => {
    if (a.userId === winnerId) return -1;
    if (b.userId === winnerId) return 1;
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    if (a.status === 'active') return b.balance - a.balance;
    // whoever went out later placed higher
    return (b.outAt ?? '').localeCompare(a.outAt ?? '');
  });
}

/** Each player's balance by round, cut where they went out. */
function buildSeries(game: GameSnapshot, order: PlayerView[]): ChartSeries[] {
  const rounds = [...game.rounds].sort((a, b) => a.round - b.round);
  return order
    .map((p) => {
      const values: number[] = [];
      for (const r of rounds) {
        const v = r.balances[p.userId];
        if (v === undefined) {
          if (values.length) break;
          continue;
        }
        values.push(v);
      }
      return { id: p.userId, name: p.name, color: p.color, token: p.token, values, out: p.status !== 'active' };
    })
    .filter((s) => s.values.length > 0);
}

export function Finished({ game, meId, connection }: { game: GameSnapshot; meId: string; connection: Connection }) {
  const { t, locale } = useI18n();
  const [replay, setReplay] = useState(0);
  const winner = game.players.find((p) => p.userId === game.winnerUserId) ?? null;
  const iWon = winner?.userId === meId;
  const standings = useMemo(() => rank(game.players, game.winnerUserId), [game.players, game.winnerUserId]);
  const money = (n: number) => formatMoney(n, game.currency, locale);
  const span = game.startedAt && game.finishedAt ? durationParts(Date.parse(game.finishedAt) - Date.parse(game.startedAt)) : null;
  const time = span ? (span.h > 0 ? t('hoursShort', { h: span.h, m: span.m }) : t('minutesShort', { n: span.m })) : null;
  const roundsPlayed = Math.max(0, ...game.rounds.map((r) => r.round));

  const series = useMemo(() => buildSeries(game, standings), [game, standings]);
  const story = useMemo(() => {
    let best: { d: number; i: number; s: ChartSeries } | null = null;
    for (const s of series) {
      for (let i = 1; i < s.values.length; i++) {
        const d = s.values[i]! - s.values[i - 1]!;
        if (d > 0 && (!best || d > best.d)) best = { d, i, s };
      }
    }
    let leadChanges = 0;
    let prev: string | null = null;
    for (let i = 1; i <= roundsPlayed; i++) {
      const top = series.filter((s) => s.values[i] !== undefined).sort((a, b) => b.values[i]! - a.values[i]!)[0];
      if (!top) continue;
      if (prev && top.id !== prev) leadChanges++;
      prev = top.id;
    }
    const notes: ChartNote[] = [];
    if (best) notes.push({ index: best.i, value: best.s.values[best.i]!, text: `${best.s.name} +${money(best.d)}` });
    for (const s of series) {
      if (!s.out || s.values.length - 1 >= roundsPlayed) continue;
      const p = game.players.find((x) => x.userId === s.id)!;
      notes.push({ index: s.values.length - 1, value: s.values.at(-1)!, text: t(p.status === 'bankrupt' ? 'wentBankrupt' : 'leftShort', { name: s.name }) });
    }
    return { best, leadChanges, notes: notes.slice(0, 3) };
    // money and t only change with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, roundsPlayed, game.players, locale]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const key = `mdb:confetti:${game.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    void import('canvas-confetti').then(({ default: confetti }) => {
      const colors = ['#ffc53d', '#ff5b4f', '#4a86ff', '#2fc98d', '#a06bff', '#ff6fae', '#ffffff'];
      confetti({ particleCount: iWon ? 160 : 90, spread: 80, origin: { y: 0.3 }, colors, disableForReducedMotion: true });
    });
  }, [iWon, game.id]);

  const podium = [standings[1], standings[0], standings[2]];
  const rematch = `/new?capital=${game.startingCapital}&salary=${game.salary}&currency=${encodeURIComponent(game.currency)}&parking=${game.freeParkingEnabled ? 1 : 0}&turns=${game.turnsEnabled ? 1 : 0}`;

  return (
    <div className="min-h-dvh">
      <div className="felt pb-8">
        <GameTopBar code={game.code} connection={connection} />
        <main className="mx-auto flex max-w-2xl flex-col items-center px-4 text-center">
          <p className="eyebrow">{t('gameOver')}</p>
          <h1 className="mt-1.5 font-display text-[clamp(2.1rem,7vw,2.9rem)] leading-tight font-extrabold">
            {iWon ? t('youWon') : winner ? t('winnerIs', { name: winner.name }) : t('noWinnerTitle')}
          </h1>
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-white/75">
            {game.turnsEnabled && roundsPlayed > 0 && <span>{t('roundsPlayed', { n: roundsPlayed })}</span>}
            {time && <span>{time}</span>}
            <span>{t('paymentsCount', { n: game.transactions.length })}</span>
          </p>

          <ol className="mt-7 grid w-full max-w-[26rem] grid-cols-[1fr_1.15fr_1fr] items-end gap-2.5" aria-label={t('standings')}>
            {podium.map((p, col) => {
              if (!p) return <li key={col} />;
              const place = col === 1 ? 1 : col === 0 ? 2 : 3;
              return (
                <li key={p.userId} className="flex min-w-0 flex-col items-center gap-2" value={place}>
                  <Token color={p.color} token={p.token} size={place === 1 ? 92 : 68} muted={p.status !== 'active' && place !== 1} />
                  <span className="max-w-full truncate text-sm font-bold">{p.userId === meId ? t('you') : p.name}</span>
                  <FitText className="max-w-full font-display text-sm font-semibold text-gold tabular">
                    {p.status === 'active' ? money(p.balance) : p.status === 'bankrupt' ? t('bankrupt') : t('left')}
                  </FitText>
                  <span
                    aria-hidden
                    className={`grid w-full place-items-start justify-center rounded-t-2xl rounded-b-md pt-2.5 font-display text-2xl font-extrabold shadow-[inset_0_0_0_3px_rgb(255_255_255/0.3)] ${
                      place === 1 ? 'bg-gradient-to-b from-gold to-gold-deep text-gold-ink' : place === 2 ? 'bg-gradient-to-b from-[#e7ede9] to-[#b9c4be] text-ink' : 'bg-gradient-to-b from-[#f0c79e] to-[#c98d5a] text-ink'
                    }`}
                    style={{ height: place === 1 ? 104 : place === 2 ? 70 : 50 }}
                  >
                    {place}
                  </span>
                </li>
              );
            })}
          </ol>

          {series.length > 0 && roundsPlayed >= 1 && (
            <section className="mt-8 w-full rounded-3xl bg-black/24 p-4 text-left shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.08)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">{t('storyTitle')}</h2>
                  <p className="mt-0.5 text-sm text-white/70">{t('storyLead')}</p>
                </div>
                <Button variant="glass" size="sm" onClick={() => setReplay((n) => n + 1)}>
                  <RotateCcw aria-hidden className="size-4" />
                  {t('replay')}
                </Button>
              </div>
              <BalanceChart
                series={series}
                notes={story.notes}
                replayKey={replay}
                startLabel={t('chartStart')}
                roundLabel={(n) => t('roundShort', { n })}
                format={money}
                formatAxis={(n) => compactMoney(n, game.currency, locale)}
                legendLabel={t('chartLegend')}
                ariaLabel={t('chartAria')}
              />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/75">
                {series.length > 1 && story.leadChanges > 0 && <span>{t('leadChanged', { n: story.leadChanges })}</span>}
                {story.best && (
                  <span>
                    {t('biggestJump', { round: story.best.i, name: story.best.s.name, amount: money(story.best.d) })}
                  </span>
                )}
              </div>
              <details className="mt-3 text-sm text-white/75">
                <summary className="cursor-pointer font-bold">{t('asTable')}</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse tabular">
                    <thead>
                      <tr>
                        <th className="px-2.5 py-1.5 text-left font-bold">{t('round')}</th>
                        {series.map((s) => (
                          <th key={s.id} className="px-2.5 py-1.5 text-right font-bold whitespace-nowrap">
                            {s.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: roundsPlayed + 1 }, (_, i) => (
                        <tr key={i} className="border-t border-white/10">
                          <td className="px-2.5 py-1.5">{i === 0 ? t('chartStart') : i}</td>
                          {series.map((s) => (
                            <td key={s.id} className="px-2.5 py-1.5 text-right whitespace-nowrap">
                              {s.values[i] === undefined ? '–' : money(s.values[i]!)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}
        </main>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <section className="card px-5 py-4">
            <h2 className="font-display text-lg font-bold">{t('standings')}</h2>
            <ol className="mt-1 divide-y-[1.5px] divide-sand">
              {standings.map((p, i) => (
                <li key={p.userId} className="flex items-center gap-3 py-2.5">
                  <span className="w-4 text-center font-display text-sm font-bold text-ink-3">{i + 1}</span>
                  <Token color={p.color} token={p.token} size={34} muted={p.status !== 'active' && p.userId !== game.winnerUserId} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {p.name}
                    {p.userId === meId && <span className="font-medium text-ink-2"> ({t('you')})</span>}
                  </span>
                  <FitText className="max-w-[45%] text-right font-display font-semibold tabular">
                    {p.status === 'active' ? money(p.balance) : p.status === 'bankrupt' ? t('bankrupt') : t('left')}
                  </FitText>
                </li>
              ))}
            </ol>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link to={rematch} className={`${buttonClass('gold', 'lg')} sm:flex-1 lg:flex-none`}>
              {t('rematch')}
            </Link>
            <Link to="/app" className={`${buttonClass('paper', 'lg')} sm:flex-1 lg:flex-none`}>
              {t('backHome')}
            </Link>
          </div>
        </div>
        <section className="card self-start px-5 py-4">
          <h2 className="font-display text-lg font-bold">{t('history')}</h2>
          <ActivityList game={game} meId={meId} />
        </section>
      </div>
    </div>
  );
}
