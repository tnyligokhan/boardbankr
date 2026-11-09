import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChartLine, CircleParking, Crown, RefreshCw, ScrollText, SunMedium, Users, type LucideIcon } from 'lucide-react';
import { GAME_CODE_LENGTH, NAME_MAX, NAME_MIN, normalizeGameCode, type PlayerColor, type PlayerToken } from '@mdb/shared';
import { BankChip } from '../components/BankChip';
import { RoundTable, type RoundTableHandle } from '../components/RoundTable';
import { FaqList, GameTiles, SiteFooter, SiteHeader, useSeo } from '../components/Site';
import { Token } from '../components/Token';
import { Button, buttonClass } from '../components/ui';
import { ApiError } from '../lib/api';
import { coinsFor, flyCoins } from '../lib/fx';
import { formatMoney } from '../lib/format';
import { useI18n, usePublicPath } from '../lib/i18n';
import { useSession } from '../lib/session';
import { GoogleMark } from './Login';

const DEMO: { id: string; name: string; color: PlayerColor; token: PlayerToken }[] = [
  { id: 'a', name: 'Zeynep', color: 'peach', token: 'bird' },
  { id: 'b', name: 'Can', color: 'aqua', token: 'car' },
  { id: 'c', name: 'Elif', color: 'sand', token: 'cat' },
  { id: 'd', name: 'Emre', color: 'mint', token: 'anchor' },
];
const AMOUNTS = [60, 120, 200, 35, 300, 150];

/** A table playing on its own: the turn goes round and money changes hands. */
function HeroTable() {
  const { lang, locale } = useI18n();
  const currency = lang === 'tr' ? '₺' : '$';
  const table = useRef<RoundTableHandle>(null);
  const [balances, setBalances] = useState<Record<string, number>>({ a: 1500, b: 1500, c: 1500, d: 1500 });
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    let k = 0;
    let alive = true;
    const id = setInterval(() => {
      const from = DEMO[k % 4]!;
      const to = DEMO[(k + 2) % 4]!;
      const amount = AMOUNTS[k % AMOUNTS.length]!;
      k++;
      void flyCoins(table.current?.node(from.id), table.current?.node(to.id), coinsFor(amount, 1500), currency).then(() => {
        if (!alive) return;
        setBalances((b) => ({ ...b, [from.id]: b[from.id]! - amount, [to.id]: b[to.id]! + amount }));
        table.current?.float(to.id, `+${formatMoney(amount, currency, locale)}`);
        setTurn(k % 4);
      });
    }, 2600);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [currency, locale]);

  const richest = DEMO.reduce((a, b) => (balances[b.id]! > balances[a.id]! ? b : a)).id;
  const seats = DEMO.map((p) => ({ ...p, balance: formatMoney(balances[p.id]!, currency, locale) }));

  return (
    <div aria-hidden className="mx-auto w-full max-w-[25rem]">
      <RoundTable
        ref={table}
        seats={seats}
        turnId={DEMO[turn]!.id}
        crownId={Object.values(balances).every((v) => v === 1500) ? null : richest}
        center={<BankChip label={lang === 'tr' ? 'Banka' : 'Bank'} />}
      />
    </div>
  );
}

/** Name in, straight to the table. Signed-in visitors get the two ways in instead. */
export function StartForm({ next = '/app' }: { next?: string }) {
  const { t, errorText } = useI18n();
  const { user, googleEnabled, googleUrl, signInAsGuest } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    const join = (e: FormEvent) => {
      e.preventDefault();
      if (code.length === GAME_CODE_LENGTH) navigate(`/g/${code}`);
    };
    return (
      <div className="mt-8 flex w-full max-w-[30rem] flex-col gap-3 sm:flex-row">
        <Link to="/new" className={buttonClass('gold', 'lg')}>
          {t('heroCreate')}
        </Link>
        <form onSubmit={join} className="flex h-[3.6rem] w-full min-w-0 shrink-0 items-center rounded-2xl sm:w-auto sm:flex-1 bg-white/12 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.22)] focus-within:shadow-[inset_0_0_0_2px_var(--gold)]">
          <label htmlFor="landing-code" className="sr-only">
            {t('codePlaceholder')}
          </label>
          <input
            id="landing-code"
            value={code}
            onChange={(e) => setCode(normalizeGameCode(e.target.value).slice(0, GAME_CODE_LENGTH))}
            placeholder={t('codePlaceholder')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent pl-4 font-display text-lg font-bold tracking-[0.2em] text-white uppercase placeholder:font-sans placeholder:text-base placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case placeholder:text-white/50 focus:outline-none"
          />
          <button type="submit" disabled={code.length !== GAME_CODE_LENGTH} className="mr-1.5 h-11 rounded-xl px-4 font-bold text-gold hover:bg-white/10 disabled:text-white/40">
            {t('join')}
          </button>
        </form>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < NAME_MIN || clean.length > NAME_MAX) {
      setError(t('nameInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInAsGuest(clean);
      navigate(next);
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'internal'));
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 w-full max-w-[30rem]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="hero-name" className="sr-only">
          {t('yourName')}
        </label>
        <input
          id="hero-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('heroNamePlaceholder')}
          maxLength={NAME_MAX + 8}
          autoComplete="nickname"
          enterKeyHint="go"
          aria-invalid={Boolean(error) || undefined}
          className="h-[3.6rem] w-full min-w-0 shrink-0 rounded-2xl bg-white/12 px-4 sm:w-auto sm:flex-1 text-[1.05rem] font-semibold text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.22)] placeholder:text-white/50 focus:shadow-[inset_0_0_0_2px_var(--gold)] focus:outline-none"
        />
        <Button type="submit" size="lg" busy={busy}>
          {t('heroSit')}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm font-bold text-loss-felt">{error}</p>}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/70">
        <span>{t('heroNoAccount')}</span>
        {googleEnabled && (
          <>
            <span aria-hidden>·</span>
            <a href={googleUrl(next)} className="-mx-2 inline-flex items-center gap-2 rounded-lg px-2 py-1 font-bold text-white hover:bg-white/10">
              <GoogleMark />
              {t('loginGoogle')}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ color, token, title, body }: { color: PlayerColor; token: PlayerToken; title: string; body: string }) {
  return (
    <li className="card flex flex-col gap-3 p-6">
      <Token color={color} token={token} size={48} />
      <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
      <p className="text-ink-2">{body}</p>
    </li>
  );
}

function Feature({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-gold-ink shadow-[inset_0_0_0_3px_rgb(255_255_255/0.45),0_3px_0_var(--gold-deep)]">
        <Icon aria-hidden className="size-5" strokeWidth={2.3} />
      </span>
      <span className="pt-2.5 text-[1.02rem] leading-snug">{children}</span>
    </li>
  );
}

export function Landing() {
  const { t } = useI18n();
  const { user } = useSession();
  const path = usePublicPath();
  useSeo(t('seoTitle'), t('seoDescription'));

  const features: { icon: LucideIcon; text: string }[] = [
    { icon: Users, text: t('feat1') },
    { icon: RefreshCw, text: t('featTurns') },
    { icon: ChartLine, text: t('featChart') },
    { icon: CircleParking, text: t('feat2') },
    { icon: ScrollText, text: t('feat3') },
    { icon: SunMedium, text: t('feat6') },
  ];

  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="felt">
        <SiteHeader />
        <section className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-6xl items-center gap-8 px-4 pt-6 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:pt-12 lg:pb-20">
          <div className="flex flex-col items-start">
            <h1 className="font-display text-[clamp(2.5rem,8.5vw,4.3rem)] leading-[1.02] font-extrabold tracking-[-0.03em]">
              <span className="mb-4 block w-fit rounded-full leading-snug bg-white/12 px-3.5 py-1.5 font-sans text-sm font-bold tracking-normal text-white/85 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.18)]">
                {t('heroKicker')}
              </span>
              {t('heroTitle')} <em className="text-gold not-italic">{t('heroTitleGold')}</em>
            </h1>
            <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-white/75">{t('heroBody')}</p>
            <StartForm />
          </div>
          <HeroTable />
        </section>
      </div>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="max-w-[22ch] font-display text-[clamp(1.8rem,4.5vw,2.5rem)] leading-tight font-extrabold">{t('howTitle')}</h2>
          <ol className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
            <Step color="rose" token="crown" title={t('how1Title')} body={t('how1Body')} />
            <Step color="sky" token="rocket" title={t('how2Title')} body={t('how2Body')} />
            <Step color="mint" token="gem" title={t('how3Title')} body={t('how3Body')} />
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:pb-20">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-[clamp(1.8rem,4.5vw,2.5rem)] leading-tight font-extrabold">{t('gamesTitle')}</h2>
              <p className="mt-2 max-w-[56ch] text-ink-2">{t('gamesLead')}</p>
            </div>
            <Link to={path({ kind: 'games' })} className="shrink-0 font-bold text-gain hover:underline">
              {t('gamesAll')}
            </Link>
          </div>
          <GameTiles limit={6} />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <h2 className="max-w-[16ch] font-display text-[clamp(1.8rem,4.5vw,2.5rem)] leading-tight font-extrabold">{t('featuresTitle')}</h2>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 sm:grid-cols-2">
              {features.map((f) => (
                <Feature key={f.text} icon={f.icon}>
                  {f.text}
                </Feature>
              ))}
            </ul>
          </div>
        </section>

        <FaqList />

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="felt relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-xl flex-col items-start gap-4">
                <h2 className="font-display text-[clamp(1.7rem,4.5vw,2.5rem)] leading-tight font-extrabold">{t('ctaTitle')}</h2>
                <p className="text-lg text-white/75">{t('ctaBody')}</p>
                <Link to={user ? '/new' : '/login?next=%2Fnew'} className={`${buttonClass('gold', 'lg')} mt-2`}>
                  {t('heroCreate')}
                </Link>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="flex">
                  {(['rose', 'sun', 'mint', 'sky', 'lilac', 'peach', 'aqua', 'sand'] as const).map((c, i) => (
                    <span key={c} className="rounded-full not-first:-ml-3 transition-transform hover:-translate-y-2">
                      <Token color={c} token={(['crown', 'car', 'sailboat', 'rocket', 'gem', 'bird', 'anchor', 'cat'] as const)[i]!} size={48} />
                    </span>
                  ))}
                </div>
                <p className="flex items-center gap-2 text-sm font-bold text-white/70">
                  <Crown aria-hidden className="size-4 text-gold" />
                  {t('ctaPlayers')}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
