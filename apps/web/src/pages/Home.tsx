import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Banknote,
  ChartLine,
  ChevronRight,
  CreditCard,
  Dices,
  Download,
  Gavel,
  Hand,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Share,
  SlidersHorizontal,
  SquarePlus,
  Trophy,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  EDITION_PRESETS,
  GAME_CODE_LENGTH,
  NAME_MAX,
  NAME_MIN,
  normalizeGameCode,
  type CreateGameInput,
  type Currency,
  type GameSnapshot,
  type GameSummary,
  type MyGamesResponse,
  type PlayerColor,
} from '@mdb/shared';
import { FitText } from '../components/FitText';
import { LangSwitch, Logo } from '../components/Logo';
import { Sheet } from '../components/Sheet';
import { Token } from '../components/Token';
import { Button, Field, TextInput, buttonClass } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { compactMoney, durationParts, formatDate, formatMoney } from '../lib/format';
import type { MessageKey } from '../lib/dictionary';
import { useI18n } from '../lib/i18n';
import { useInstall } from '../lib/install';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { GoogleMark } from './Login';

function greetingKey(): 'goodMorning' | 'goodDay' | 'goodEvening' {
  const h = new Date().getHours();
  return h < 11 ? 'goodMorning' : h < 18 ? 'goodDay' : 'goodEvening';
}

export default function Home() {
  const { t, locale, errorText } = useI18n();
  const { user, googleEnabled, googleUrl } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState<MyGamesResponse | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'BoardBankr';
  }, []);

  const load = useCallback(() => {
    api<MyGamesResponse>('/api/me/games')
      .then(setData)
      .catch(() => setData({ ongoing: [], finished: [], stats: { played: 0, won: 0, playMs: 0 } }));
  }, []);
  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // old links (/app?new=1) still lead to the new game page
  useEffect(() => {
    if (params.get('new') === '1') navigate('/new', { replace: true });
  }, [params, navigate]);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== GAME_CODE_LENGTH) return;
    try {
      await api(`/api/games/${code}`);
      navigate(`/g/${code}`);
    } catch (err) {
      setCodeError(errorText(err instanceof ApiError ? err.code : 'internal'));
    }
  };

  if (!user) return null;
  const time = durationParts(data?.stats.playMs ?? 0);
  const [current, ...moreOngoing] = data?.ongoing ?? [];

  return (
    <div className="min-h-dvh">
      <div className="felt pb-7">
        <div className="mx-auto max-w-5xl px-4 pt-safe sm:px-6">
          <header className="flex items-center justify-between gap-2">
            <div className="py-4">
              <Logo to="/app" />
            </div>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label={t('account')}
              className="flex h-12 items-center gap-2.5 rounded-2xl pr-3 pl-1.5 hover:bg-white/10"
            >
              <Token color={current?.myColor ?? 'sky'} token={current?.myToken ?? 'rocket'} size={36} />
              <span className="hidden max-w-[12rem] truncate text-sm font-bold sm:block">{user.name}</span>
            </button>
          </header>

          <div className="pt-1 pb-5">
            <h1 className="font-display text-[clamp(1.9rem,6vw,2.5rem)] leading-tight font-extrabold">
              {t(greetingKey(), { name: user.name })}
            </h1>
            <p className="mt-1 text-white/75">{current ? t('homeLeadWaiting') : t('homeLead')}</p>
            {/* the two ways to a table sit on the felt, right under the greeting */}
            <div className="mt-5 flex w-full max-w-[34rem] flex-col gap-2.5 sm:flex-row">
              <Link to="/new" className={buttonClass('gold', 'lg')}>
                <Plus aria-hidden className="size-5" strokeWidth={2.6} />
                {t('newGame')}
              </Link>
              <form
                onSubmit={join}
                className="flex h-[3.6rem] min-w-0 flex-1 items-center rounded-2xl bg-white/12 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.22)] focus-within:shadow-[inset_0_0_0_2px_var(--gold)]"
              >
                <label htmlFor="home-code" className="sr-only">
                  {t('codePlaceholder')}
                </label>
                <input
                  id="home-code"
                  value={code}
                  onChange={(e) => {
                    setCodeError(null);
                    setCode(normalizeGameCode(e.target.value).slice(0, GAME_CODE_LENGTH));
                  }}
                  placeholder={t('codePlaceholder')}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="h-full min-w-0 flex-1 bg-transparent pl-4 font-display text-lg font-bold tracking-[0.2em] text-white uppercase placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case placeholder:text-white/50 focus:outline-none"
                />
                <button type="submit" disabled={code.length !== GAME_CODE_LENGTH} className="mr-1.5 h-11 rounded-xl px-4 font-bold text-gold hover:bg-white/10 disabled:text-white/40">
                  {t('join')}
                </button>
              </form>
            </div>
            {codeError && <p className="mt-2 text-sm font-bold text-loss-felt">{codeError}</p>}
          </div>

          {current && <ResumeCard game={current} />}
          {moreOngoing.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {moreOngoing.map((g) => (
                <OngoingRow key={g.ref} game={g} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-20 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-8">
            <InstallCard />
            <QuickStart last={data?.finished[0] ?? null} />
            <TableFeatures />
            {user.kind === 'guest' && googleEnabled && (
              <section className="flex flex-col gap-3 rounded-[1.25rem] bg-sand p-5 sm:flex-row sm:items-center sm:gap-5">
                <p className="flex-1 text-[0.95rem] text-ink-2">{t('guestBanner')}</p>
                <a href={googleUrl('/app')} className={buttonClass('paper')}>
                  <GoogleMark />
                  {t('guestBannerAction')}
                </a>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-2.5">
              {[
                { value: String(data?.stats.played ?? '–'), label: t('statsPlayed') },
                { value: String(data?.stats.won ?? '–'), label: t('statsWon') },
                {
                  value: time.h > 0 ? t('hoursOnly', { h: time.h }) : t('minutesShort', { n: time.m }),
                  label: t('statsTime'),
                },
              ].map((s) => (
                <div key={s.label} className="card flex flex-col-reverse items-center px-2 py-3.5 text-center">
                  <dt className="text-[0.8rem] font-semibold text-ink-2">{s.label}</dt>
                  <dd className="font-display text-2xl font-extrabold tabular">{s.value}</dd>
                </div>
              ))}
            </dl>

            <section className="card">
              <h2 className="px-5 pt-4 font-display text-lg font-bold">{t('finishedGames')}</h2>
              {data && data.finished.length === 0 && <p className="px-5 pt-1 pb-5 text-ink-2">{t('noFinished')}</p>}
              {data && data.finished.length > 0 && (
                <ul className="flex flex-col p-2">
                  {data.finished.map((g) => (
                    <li key={g.ref}>
                      <Link to={`/g/${g.ref}`} className="flex items-center gap-3.5 rounded-2xl p-2.5 hover:bg-sand">
                        <Token color={g.myColor} token={g.myToken} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">
                            {g.wonByMe ? t('wonIt') : g.winnerName ? t('winnerWas', { name: g.winnerName }) : t('noWinner')}
                          </span>
                          <span className="block text-sm text-ink-2">
                            {g.finishedAt ? formatDate(g.finishedAt, locale) : ''} · {t('playersCount', { n: g.playerCount })}
                          </span>
                        </span>
                        {g.wonByMe ? (
                          <span className="grid size-8 place-items-center rounded-full bg-gold text-gold-ink">
                            <Trophy aria-label={t('wonIt')} className="size-4" />
                          </span>
                        ) : (
                          <ChevronRight aria-hidden className="size-5 text-ink-3" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} piece={current} />
    </div>
  );
}

/**
 * Put BoardBankr on the home screen. Chrome and friends get a button that opens their own
 * install dialog; an iPhone gets the two Safari steps, since Safari has no such dialog.
 * Gone for good once dismissed, and never shown inside the installed app.
 */
function InstallCard() {
  const { t } = useI18n();
  const toast = useToast();
  const { mode, install, dismiss } = useInstall();
  const [busy, setBusy] = useState(false);
  if (!mode) return null;

  return (
    <section aria-labelledby="install-title" className="felt relative flex flex-col gap-4 rounded-[1.4rem] p-5 sm:flex-row sm:items-center sm:gap-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('close')}
        className="absolute top-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden className="size-4" />
      </button>
      <div className="flex items-center gap-4 pr-8 sm:flex-1">
        <img src="/icon-192.png" alt="" width={56} height={56} className="size-14 shrink-0 rounded-[1.1rem] shadow-[0_3px_0_rgb(0_0_0/0.25)]" />
        <div className="min-w-0">
          <h2 id="install-title" className="font-display text-lg leading-tight font-bold">
            {t('installTitle')}
          </h2>
          <p className="mt-0.5 text-[0.92rem] leading-snug text-white/75">{t('installBody')}</p>
        </div>
      </div>
      {mode === 'prompt' ? (
        <Button
          busy={busy}
          className="shrink-0"
          onClick={async () => {
            setBusy(true);
            const ok = await install();
            setBusy(false);
            if (ok) toast.success(t('installDone'));
          }}
        >
          <Download aria-hidden className="size-5" />
          {t('installAction')}
        </Button>
      ) : (
        <ol className="flex shrink-0 flex-col gap-2 text-[0.92rem] font-semibold">
          <li className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12">
              <Share aria-hidden className="size-4" />
            </span>
            {t('installIos1')}
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12">
              <SquarePlus aria-hidden className="size-4" />
            </span>
            {t('installIos2')}
          </li>
        </ol>
      )}
    </section>
  );
}

type Preset = { key: string; title: string; note: string; color: PlayerColor; icon: LucideIcon; input?: CreateGameInput; href?: string };

/**
 * One tap to a table: the classic box, the electronic box, the last game played again, or
 * your own rules. The first three open a lobby straight away; only house rules need the form.
 */
function QuickStart({ last }: { last: GameSummary | null }) {
  const { t, lang, locale, errorText } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const currency = lang === 'tr' ? '₺' : '$';
  const money = (n: number, c: Currency = currency) => compactMoney(n, c, locale);

  const presets: Preset[] = [
    {
      key: 'classic',
      title: t('quickClassic'),
      note: t('quickAmounts', { capital: money(EDITION_PRESETS.classic.capital), salary: money(EDITION_PRESETS.classic.salary) }),
      color: 'mint',
      icon: Banknote,
      input: { startingCapital: EDITION_PRESETS.classic.capital, salary: EDITION_PRESETS.classic.salary, currency, freeParkingEnabled: false, turnsEnabled: true },
    },
    {
      key: 'electronic',
      title: t('quickElectronic'),
      note: t('quickAmounts', { capital: money(EDITION_PRESETS.electronic.capital), salary: money(EDITION_PRESETS.electronic.salary) }),
      color: 'sky',
      icon: CreditCard,
      input: { startingCapital: EDITION_PRESETS.electronic.capital, salary: EDITION_PRESETS.electronic.salary, currency, freeParkingEnabled: false, turnsEnabled: true },
    },
    last
      ? {
          key: 'last',
          title: t('quickLast'),
          note: t('quickAmounts', { capital: money(last.settings.startingCapital, last.currency), salary: money(last.settings.salary, last.currency) }),
          color: 'peach',
          icon: RotateCcw,
          input: { ...last.settings, currency: last.currency },
        }
      : { key: 'custom', title: t('quickCustom'), note: t('quickCustomNote'), color: 'lilac', icon: SlidersHorizontal, href: '/new?edition=custom' },
  ];

  const start = async (p: Preset) => {
    if (busy) return;
    if (p.href) return navigate(p.href);
    setBusy(p.key);
    try {
      const res = await api<{ game: GameSnapshot }>('/api/games', { method: 'POST', body: p.input });
      navigate(`/g/${res.game.code}`);
    } catch (err) {
      toast.error(errorText(err instanceof ApiError ? err.code : 'internal'));
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="quick-title">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="quick-title" className="font-display text-xl font-bold">
            {t('quickTitle')}
          </h2>
          <p className="text-sm text-ink-2">{t('quickLead')}</p>
        </div>
        {last && (
          <Link to="/new?edition=custom" className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-gain hover:bg-sand">
            {t('quickCustom')}
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        {presets.map((p) => (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => start(p)}
              disabled={busy !== null}
              className="card group flex h-full w-full items-center gap-3.5 p-4 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-70 sm:flex-col sm:items-start sm:gap-3"
            >
              <span aria-hidden data-note={p.color} className="tok size-11 shrink-0">
                {busy === p.key ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <p.icon strokeWidth={2.3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.05rem] leading-tight font-bold">{p.title}</span>
                <span className="mt-0.5 block text-sm text-ink-2 tabular">{p.note}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3 sm:hidden" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FEATURES: { color: PlayerColor; icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { color: 'rose', icon: Hand, title: 'featDragTitle', body: 'featDragBody' },
  { color: 'sun', icon: Gavel, title: 'featAuctionTitle', body: 'featAuctionBody' },
  { color: 'sky', icon: Dices, title: 'featDiceTitle', body: 'featDiceBody' },
  { color: 'mint', icon: Undo2, title: 'featUndoTitle', body: 'featUndoBody' },
  { color: 'lilac', icon: RefreshCw, title: 'featTurnsTitle', body: 'featTurnsBody' },
  { color: 'aqua', icon: ChartLine, title: 'featChartTitle', body: 'featChartBody' },
];

/** What the table can do, so nobody finds out only halfway through a game. */
function TableFeatures() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="features-title">
      <h2 id="features-title" className="mb-4 font-display text-xl font-bold">
        {t('featuresHomeTitle')}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="card flex flex-col gap-2.5 p-4">
            <span aria-hidden data-note={f.color} className="tok size-10">
              <f.icon strokeWidth={2.3} />
            </span>
            <h3 className="font-display leading-tight font-bold">{t(f.title)}</h3>
            <p className="text-[0.85rem] leading-snug text-ink-2">{t(f.body)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function turnLine(game: GameSummary, t: ReturnType<typeof useI18n>['t']): string {
  if (game.status === 'lobby') return t('lobbyWaiting');
  if (game.myStatus !== 'active') return t('youAreOut');
  if (game.round > 0) {
    const who = game.myTurn ? t('turnYoursShort') : game.turnName ? t('turnOfShort', { name: game.turnName }) : '';
    return who ? `${t('roundN', { n: game.round })} · ${who}` : t('roundN', { n: game.round });
  }
  return t('inPlay');
}

/** The game you're in, as a dark card on the felt with your balance in gold. */
function ResumeCard({ game }: { game: GameSummary }) {
  const { t, locale } = useI18n();
  const playing = game.status === 'active' && game.myStatus === 'active';
  return (
    <Link
      to={`/g/${game.ref}`}
      className="group grid gap-4 rounded-[1.4rem] bg-black/22 p-5 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.1)] transition-colors hover:bg-black/28"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-gain-felt">
          <span aria-hidden className="size-2 rounded-full bg-gain-felt" style={{ animation: 'pulse-dot 1.6s infinite' }} />
          {turnLine(game, t)}
        </span>
        <span className="rounded-lg bg-white/10 px-2.5 py-1 font-display text-xs font-semibold tracking-[0.1em] text-white/75">{game.code}</span>
      </div>
      {playing ? (
        <div>
          <p className="eyebrow">{t('yourBalance')}</p>
          <FitText className="mt-1.5 font-display text-[clamp(2.3rem,9vw,3.1rem)] leading-none font-extrabold text-gold tabular [text-shadow:0_3px_0_rgb(0_0_0/0.22)]">
            {formatMoney(game.myBalance, game.currency, locale)}
          </FitText>
        </div>
      ) : (
        <p className="text-white/75">{t('playersCount', { n: game.playerCount })}</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <Token color={game.myColor} token={game.myToken} size={40} />
        <span className={buttonClass('gold')}>
          {game.status === 'lobby' ? t('backToLobby') : t('backToTable')}
          <ChevronRight aria-hidden className="size-5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function OngoingRow({ game }: { game: GameSummary }) {
  const { t, locale } = useI18n();
  return (
    <li>
      <Link to={`/g/${game.ref}`} className="flex items-center gap-3.5 rounded-2xl bg-black/18 px-3.5 py-3 hover:bg-black/25">
        <Token color={game.myColor} token={game.myToken} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {game.code} · {turnLine(game, t)}
          </span>
          {game.status === 'active' && game.myStatus === 'active' && (
            <FitText className="font-display text-sm font-semibold text-gold tabular">{formatMoney(game.myBalance, game.currency, locale)}</FitText>
          )}
        </span>
        <ChevronRight aria-hidden className="size-5 text-white/60" />
      </Link>
    </li>
  );
}

function AccountSheet({ open, onClose, piece }: { open: boolean; onClose: () => void; piece?: GameSummary }) {
  const { t, errorText } = useI18n();
  const { user, rename, signOut } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.name ?? '');
      setConfirmSignOut(false);
    }
  }, [open, user?.name]);

  if (!user) return null;
  const clean = name.trim().replace(/\s+/g, ' ');
  const valid = clean.length >= NAME_MIN && clean.length <= NAME_MAX;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || clean === user.name) return;
    setBusy(true);
    try {
      await rename(clean);
      toast.success(t('saved'));
    } catch (err) {
      toast.error(errorText(err instanceof ApiError ? err.code : 'internal'));
    }
    setBusy(false);
  };

  const doSignOut = async () => {
    if (user.kind === 'guest' && !confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    await signOut().catch(() => undefined);
    navigate('/', { replace: true });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('account')}>
      <div className="flex flex-col gap-6 pt-1">
        {user.kind === 'google' && user.email && <p className="text-sm text-ink-2">{t('signedInWithGoogle', { email: user.email })}</p>}
        <form onSubmit={save} className="flex items-end gap-3">
          <Token color={piece?.myColor ?? 'sky'} token={piece?.myToken ?? 'rocket'} size={52} className="mb-0.5" />
          <div className="min-w-0 flex-1">
            <Field label={t('rename')} htmlFor="rename" error={name && !valid ? t('nameInvalid') : null}>
              <div className="flex gap-2">
                <TextInput id="rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX + 8} invalid={Boolean(name) && !valid} />
                <Button type="submit" variant="ink" busy={busy} disabled={!valid || clean === user.name} aria-label={t('save')}>
                  <Pencil aria-hidden className="size-4" />
                </Button>
              </div>
            </Field>
          </div>
        </form>
        <div className="flex items-center justify-between border-t-[1.5px] border-line pt-4">
          <span className="text-sm font-bold">{t('language')}</span>
          <LangSwitch className="text-ink" />
        </div>
        <div className="flex flex-col gap-3 border-t-[1.5px] border-line pt-4">
          {confirmSignOut && <p className="rounded-2xl bg-loss-soft px-4 py-3 text-sm font-semibold text-loss">{t('signOutGuestWarn')}</p>}
          <Button variant={confirmSignOut ? 'danger' : 'quiet'} onClick={doSignOut} className="self-start">
            <LogOut aria-hidden className="size-4" />
            {t('signOut')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
