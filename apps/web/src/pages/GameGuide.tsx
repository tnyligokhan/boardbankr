import { Link, Navigate, useParams } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { CATALOG, PLAYER_COLORS, PLAYER_TOKENS, findCatalogGame, tipsFor } from '@mdb/shared';
import { BankChip } from '../components/BankChip';
import { RoundTable } from '../components/RoundTable';
import { CtaLink, FaqList, GameTiles, SiteFooter, SiteHeader, useSeo } from '../components/Site';
import { Token } from '../components/Token';
import { useI18n, usePublicPath } from '../lib/i18n';
import { StartForm } from './Landing';
import { useSession } from '../lib/session';

const NAMES = ['Deniz', 'Ece', 'Mert', 'Ada'];

/** /oyun/:slug and /en/games/:slug — a page per board game, for people searching "<game> banka" and similar. */
export default function GameGuide() {
  const { slug = '' } = useParams();
  const { t, lang } = useI18n();
  const { user } = useSession();
  const path = usePublicPath();
  const game = findCatalogGame(slug);
  const text = game ? (lang === 'tr' ? game.tr : game.en) : null;
  useSeo(text ? `${text.title} | BoardBankr` : 'BoardBankr', text?.description ?? '');

  if (!game || !text) return <Navigate to={path({ kind: 'games' })} replace />;

  const index = CATALOG.indexOf(game);
  const next = `/new?edition=${game.edition}`;
  const steps = [t('how1Title'), t('how2Title'), t('how3Title')];
  const tips = tipsFor(game.slug, lang);
  const seats = NAMES.map((name, i) => ({
    id: name,
    name,
    color: PLAYER_COLORS[(index + i) % PLAYER_COLORS.length]!,
    token: PLAYER_TOKENS[(index + i * 3) % PLAYER_TOKENS.length]!,
  }));

  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="felt">
        <SiteHeader />
        <section className="mx-auto max-w-6xl px-4 pt-2 pb-14 sm:px-6 lg:pt-6 lg:pb-20">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-sm font-semibold text-white/60">
            <Link to={path({ kind: 'home' })} className="hover:text-white">
              {t('home')}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
            <Link to={path({ kind: 'games' })} className="hover:text-white">
              {t('navGames')}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
            <span className="text-white/85">{game.name}</span>
          </nav>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
            <div className="flex flex-col items-start gap-5">
              <h1 className="font-display text-[clamp(2.1rem,6.5vw,3.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">{text.title}</h1>
              {text.body.map((p) => (
                <p key={p} className="max-w-[60ch] text-lg leading-relaxed text-white/80">
                  {p}
                </p>
              ))}
              {game.aliases.length > 0 && (
                <p className="text-sm text-white/55">
                  {t('alsoKnown')}: {game.aliases.join(', ')}
                </p>
              )}
              {user ? (
                <div className="mt-2">
                  <CtaLink to={next}>{t('setupFor', { name: game.name })}</CtaLink>
                </div>
              ) : (
                // name in, straight to the setup with this game's amounts already chosen
                <div className="mt-2 w-full">
                  <p className="font-display text-lg font-bold">{t('setupFor', { name: game.name })}</p>
                  <div className="-mt-4">
                    <StartForm next={next} />
                  </div>
                </div>
              )}
            </div>
            <div aria-hidden className="mx-auto w-full max-w-[22rem]">
              <RoundTable
                seats={seats}
                turnId={seats[0]!.id}
                center={<BankChip label={t('theBank')} />}
              />
            </div>
          </div>
        </section>
      </div>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s} className="card flex items-center gap-3.5 px-4 py-4">
                <Token color={PLAYER_COLORS[(index + i) % PLAYER_COLORS.length]!} token={(['crown', 'rocket', 'gem'] as const)[i]!} size={40} />
                <span className="font-display text-lg font-bold">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="tips-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-20">
          <h2 id="tips-title" className="font-display text-[clamp(1.8rem,4.5vw,2.4rem)] leading-tight font-extrabold">
            {t('tipsTitle', { name: game.name })}
          </h2>
          <p className="mt-2 max-w-[60ch] text-ink-2">{t('tipsLead')}</p>
          <ol className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-4">
            {tips.map((tip, i) => (
              <li key={tip} className="card flex items-start gap-4 p-5 sm:p-6 md:last:odd:col-span-2">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-gold font-display text-lg font-extrabold text-gold-ink tabular shadow-[inset_0_0_0_3px_rgb(255_255_255/0.45),0_3px_0_var(--gold-deep)]"
                >
                  {i + 1}
                </span>
                <p className="pt-1.5 leading-relaxed text-ink-2">{tip}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <h2 className="mb-8 font-display text-[clamp(1.8rem,4.5vw,2.4rem)] leading-tight font-extrabold">{t('otherGames')}</h2>
          <GameTiles exclude={game.slug} />
        </section>

        <FaqList />
      </main>
      <SiteFooter />
    </div>
  );
}
