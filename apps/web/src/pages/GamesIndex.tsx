import { CtaLink, GameTiles, SiteFooter, SiteHeader, useSeo } from '../components/Site';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';

/** /oyunlar and /en/games — every board game the app is known to work with. */
export default function GamesIndex() {
  const { t } = useI18n();
  const { user } = useSession();
  useSeo(`${t('gamesTitle')} | BoardBankr`, t('gamesLead'));
  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="felt">
        <SiteHeader />
        <section className="mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6 lg:pt-10 lg:pb-16">
          <h1 className="max-w-[20ch] font-display text-[clamp(2.1rem,6.5vw,3.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em]">{t('gamesTitle')}</h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-white/80">{t('gamesLead')}</p>
        </section>
      </div>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6">
        <GameTiles />
        <div className="felt mt-12 flex flex-col items-start gap-5 rounded-[1.75rem] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="max-w-[48ch] text-lg text-white/85">{t('gamesOther')}</p>
          <CtaLink to={user ? '/new?edition=custom' : '/login?next=%2Fnew%3Fedition%3Dcustom'}>{t('heroCreate')}</CtaLink>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
