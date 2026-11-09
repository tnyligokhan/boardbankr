import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowUpRight, Plus } from 'lucide-react';
import { CATALOG, FAQ, PLAYER_COLORS, PLAYER_TOKENS, parsePublicPath, publicPath, type CatalogGame } from '@mdb/shared';
import { useI18n, usePublicPath } from '../lib/i18n';
import { useSession } from '../lib/session';
import { LangSwitch, Logo } from './Logo';
import { Token } from './Token';
import { buttonClass } from './ui';

const REPO = 'https://github.com/tnyligokhan/boardbankr';
const COFFEE = 'https://buymeacoffee.com/tnyligokhan';

/** Keeps the tab title and description right when moving between public pages. */
export function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

/** Top bar of the public pages. Sits on the felt band that opens each page. */
export function SiteHeader() {
  const { t } = useI18n();
  const path = usePublicPath();
  const { user } = useSession();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pt-safe sm:px-6">
      <div className="py-4">
        <Logo />
      </div>
      <nav className="flex items-center gap-1">
        <Link to={path({ kind: 'games' })} className="hidden h-10 items-center rounded-xl px-3 text-sm font-bold opacity-80 hover:bg-black/10 hover:opacity-100 sm:inline-flex">
          {t('navGames')}
        </Link>
        <LangSwitch compact />
        <Link to={user ? '/app' : '/login'} className={`${buttonClass('glass', 'sm')} ml-1`}>
          {user ? t('heroOpenApp') : t('signIn')}
        </Link>
      </nav>
    </header>
  );
}

const FOOTER_SEATS = [
  ['rose', 'crown'],
  ['sun', 'car'],
  ['mint', 'sailboat'],
  ['sky', 'rocket'],
  ['lilac', 'gem'],
  ['peach', 'bird'],
  ['aqua', 'anchor'],
  ['sand', 'cat'],
] as const;

function FooterHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 font-display text-xs font-bold tracking-[0.14em] text-gold uppercase">{children}</h2>;
}

const footerLink = 'rounded-md text-white/75 transition-colors hover:text-white focus-visible:text-white';

/**
 * The page ends at the edge of the table: a wood rail, then felt. Same pieces as the game —
 * the eight seats, the gold bank — so the footer reads as part of the table, not a site template.
 */
export function SiteFooter() {
  const { t, lang } = useI18n();
  const { user } = useSession();
  const path = usePublicPath();
  const location = useLocation();
  const here = parsePublicPath(location.pathname)?.page ?? { kind: 'home' as const };
  const year = new Date().getFullYear();

  return (
    <footer className="felt mt-6">
      <div aria-hidden className="table-rail" />
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-safe sm:px-6 lg:pt-16">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.6fr)_minmax(0,0.75fr)] lg:gap-14">
          <div className="flex flex-col items-start gap-5">
            <Logo />
            <p className="max-w-[34ch] text-[1.02rem] leading-relaxed text-pretty text-white/80">{t('footerTagline')}</p>
            <div className="flex items-center gap-3">
              <div className="flex">
                {FOOTER_SEATS.map(([c, token]) => (
                  <span key={c} className="rounded-full not-first:-ml-2.5">
                    <Token color={c} token={token} size={30} />
                  </span>
                ))}
              </div>
              <span className="text-sm font-bold text-white/65">{t('ctaPlayers')}</span>
            </div>
            <Link to={user ? '/new' : '/login?next=%2Fnew'} className={`${buttonClass('gold')} mt-1`}>
              {t('heroCreate')}
            </Link>
          </div>

          <nav aria-label={t('footerGuides')}>
            <FooterHeading>{t('footerGuides')}</FooterHeading>
            <ul className="columns-2 gap-x-6 text-[0.95rem]">
              {CATALOG.map((g) => (
                <li key={g.slug} className="mb-3 break-inside-avoid">
                  <Link to={path({ kind: 'game', slug: g.slug })} className={`${footerLink} block leading-snug`}>
                    {g.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to={path({ kind: 'games' })} className="rounded-md font-bold text-gold hover:underline">
                  {t('gamesAll')} →
                </Link>
              </li>
            </ul>
          </nav>

          <div className="grid grid-cols-2 gap-8 lg:grid-cols-1">
            <nav aria-label={t('footerLinks')}>
              <FooterHeading>{t('footerLinks')}</FooterHeading>
              <ul className="flex flex-col gap-2.5 text-[0.95rem]">
                <li>
                  <Link to={path({ kind: 'legal' })} className={footerLink}>
                    {t('footerLegal')}
                  </Link>
                </li>
                <li>
                  <a href={REPO} target="_blank" rel="noreferrer" className={footerLink}>
                    {t('footerSource')}
                  </a>
                </li>
                <li>
                  <a href={COFFEE} target="_blank" rel="noreferrer" className={footerLink}>
                    {t('footerCoffee')}
                  </a>
                </li>
              </ul>
            </nav>
            <nav aria-label={t('language')}>
              <FooterHeading>{t('language')}</FooterHeading>
              <ul className="flex flex-col gap-2.5 text-[0.95rem]">
                {(['tr', 'en'] as const).map((l) => (
                  <li key={l}>
                    <Link
                      to={publicPath(l, here)}
                      hrefLang={l}
                      lang={l}
                      aria-current={l === lang ? 'true' : undefined}
                      className={l === lang ? 'rounded-md font-bold text-white' : footerLink}
                    >
                      {l === 'tr' ? 'Türkçe' : 'English'}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/12 py-7 text-xs leading-relaxed text-white/55 lg:mt-14">
          <p className="max-w-[90ch]">{t('disclaimer')}</p>
          <p className="flex flex-wrap gap-x-2 font-semibold text-white/65">
            <span>© {year} Gökhan Tonyalı</span>
            <span aria-hidden>·</span>
            <span>{t('footerFree')}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

/** A game from the catalogue as a paper card with a piece of its own. */
export function GameTile({ game, index }: { game: CatalogGame; index: number }) {
  const { lang } = useI18n();
  const path = usePublicPath();
  const text = lang === 'tr' ? game.tr : game.en;
  return (
    <li>
      <Link
        to={path({ kind: 'game', slug: game.slug })}
        className="card group flex h-full flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-1 focus-visible:-translate-y-1"
      >
        <span className="flex items-center gap-3">
          <Token color={PLAYER_COLORS[index % PLAYER_COLORS.length]!} token={PLAYER_TOKENS[index % PLAYER_TOKENS.length]!} size={40} />
          <span className="min-w-0 flex-1 font-display text-lg leading-tight font-bold">{game.name}</span>
          <ArrowUpRight aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
        </span>
        <span className="line-clamp-3 text-sm leading-snug text-ink-2">{text.description}</span>
      </Link>
    </li>
  );
}

export function GameTiles({ exclude, limit }: { exclude?: string; limit?: number }) {
  const list = CATALOG.filter((g) => g.slug !== exclude).slice(0, limit);
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
      {list.map((g) => (
        <GameTile key={g.slug} game={g} index={CATALOG.indexOf(g)} />
      ))}
    </ul>
  );
}

export function FaqList() {
  const { lang, t } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14">
        <h2 className="font-display text-[clamp(1.8rem,4.5vw,2.5rem)] leading-tight font-extrabold">{t('faqTitle')}</h2>
        <div className="flex flex-col gap-3">
          {FAQ[lang].map((f) => (
            <details key={f.q} className="card group open:shadow-[0_0_0_2.5px_var(--ink),0_3px_0_var(--ink)]">
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 font-bold [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{f.q}</span>
                <Plus aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="px-5 pb-5 text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaLink({ to, children, variant = 'gold' }: { to: string; children: ReactNode; variant?: 'gold' | 'white' }) {
  return (
    <Link to={to} className={buttonClass(variant, 'lg')}>
      {children}
    </Link>
  );
}
