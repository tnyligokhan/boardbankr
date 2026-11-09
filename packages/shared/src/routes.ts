/**
 * Public, indexable page addresses in both languages. Turkish keeps the original
 * addresses at the root; English lives under /en. Server SEO, the sitemap, hreflang
 * links and the web app's language switch all read from here.
 */
export type SiteLang = 'tr' | 'en';

export type PublicPage = { kind: 'home' } | { kind: 'games' } | { kind: 'legal' } | { kind: 'game'; slug: string };

const PATHS: Record<SiteLang, { home: string; games: string; legal: string; game: string }> = {
  tr: { home: '/', games: '/oyunlar', legal: '/yasal', game: '/oyun/' },
  en: { home: '/en', games: '/en/games', legal: '/en/legal', game: '/en/games/' },
};

export function publicPath(lang: SiteLang, page: PublicPage): string {
  const p = PATHS[lang];
  return page.kind === 'game' ? p.game + page.slug : p[page.kind];
}

/** Reads a public address back into its language and page; null for app pages. */
export function parsePublicPath(pathname: string): { lang: SiteLang; page: PublicPage } | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const lang of ['tr', 'en'] as const) {
    const p = PATHS[lang];
    if (clean === p.home) return { lang, page: { kind: 'home' } };
    if (clean === p.games) return { lang, page: { kind: 'games' } };
    if (clean === p.legal) return { lang, page: { kind: 'legal' } };
    if (clean.startsWith(p.game)) {
      const slug = clean.slice(p.game.length);
      if (/^[a-z0-9-]+$/.test(slug)) return { lang, page: { kind: 'game', slug } };
    }
  }
  return null;
}
