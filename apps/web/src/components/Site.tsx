import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Plus } from 'lucide-react';
import { CATALOG, FAQ, PLAYER_COLORS, PLAYER_TOKENS, type CatalogGame } from '@mdb/shared';
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

export function SiteFooter() {
  const { t } = useI18n();
  const path = usePublicPath();
  return (
    <footer className="border-t-[1.5px] border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 pb-safe text-sm text-ink-2 sm:px-6">
        <nav aria-label={t('navGames')} className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
          {CATALOG.map((g) => (
            <Link key={g.slug} to={path({ kind: 'game', slug: g.slug })} className="hover:text-ink">
              {g.name}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Gökhan Tonyalı</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to={path({ kind: 'legal' })} className="font-bold hover:text-ink">
              {t('footerLegal')}
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="font-bold hover:text-ink">
              {t('footerSource')}
            </a>
            <a href={COFFEE} target="_blank" rel="noreferrer" className="font-bold hover:text-ink">
              {t('footerCoffee')}
            </a>
          </div>
        </div>
        <p className="max-w-[80ch] text-xs leading-relaxed text-ink-3">{t('disclaimer')}</p>
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
