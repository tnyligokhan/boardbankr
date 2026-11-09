import { CATALOG, FAQ, LEGAL, findCatalogGame, parsePublicPath, publicPath, type CatalogGame, type PublicPage, type SiteLang } from '@mdb/shared';

/**
 * Server-side SEO for a client-rendered app.
 *
 * Public pages exist in Turkish (/, /oyunlar, /oyun/:slug, /yasal) and English (/en, /en/games,
 * /en/games/:slug, /en/legal). Each gets its own title, description, canonical, hreflang
 * alternates, structured data and a plain-HTML copy of the visible content inside #root, so
 * crawlers see the page without running JavaScript. React replaces that markup on load.
 * Private pages (lobby, table, account) are marked noindex.
 *
 * Trademark rule: game names describe what the app works with ("for Monopoly"), never what
 * the app is called. BoardBankr stays the only product name, including in structured data.
 */

const SITE_NAME = 'BoardBankr';
const LANGS: SiteLang[] = ['tr', 'en'];

const TEXT = {
  tr: {
    homeTitle: 'Monopoly için dijital banka ve mobil bankacılık, ücretsiz | BoardBankr',
    homeDescription:
      'Kâğıt parayı kutuda bırakın. Monopoly, Molipoly, Metropol ve tüm masa oyunları için tarayıcıda çalışan ücretsiz dijital banka. İndirme yok, kurulum yok.',
    homeKicker: 'Monopoly ve masa oyunları için dijital banka',
    homeHeading: 'Kâğıt parayı kutuda bırakın. Banka sizde.',
    gamesTitle: 'Desteklenen oyunlar: Monopoly, Molipoly, Metropol ve fazlası | BoardBankr',
    gamesHeading: 'Hangi oyunla oynuyorsunuz?',
    gamesDescription:
      'Monopoly, Monopoly Elektronik Bankacılık, Molipoly, Metropol, Hotel Tycoon, Milyoner, Cashflow ve kağıt parayla oynanan diğer masa oyunları için dijital banka.',
    create: 'Oyun kur',
    setupFor: (name: string) => `${name} için masa kur`,
    alsoKnown: 'Diğer adlarıyla',
    otherGames: 'Diğer oyunlar',
    faqTitle: 'Sık sorulan sorular',
    home: 'Ana sayfa',
    games: 'Oyunlar',
    legal: 'Yasal uyarı',
    locale: 'tr_TR',
    currency: 'TRY',
    disclaimer:
      'Monopoly, Hasbro, Inc.’in tescilli markasıdır; adı geçen diğer oyun adları da sahiplerine aittir. BoardBankr bağımsızdır, hiçbir oyun üreticisiyle bağlantılı değildir ve onlar tarafından onaylanmamıştır. Uygulamadaki paralar sanaldır, gerçek bir değeri yoktur.',
  },
  en: {
    homeTitle: 'Free digital bank & mobile banking for Monopoly | BoardBankr',
    homeDescription:
      'Play Monopoly without paper money. A free digital banker in your browser: balances on every phone, one-tap payments, GO salary and turn tracking. No download.',
    homeKicker: 'A digital bank for Monopoly and board games',
    homeHeading: 'Leave the paper money in the box. You’re the bank now.',
    gamesTitle: 'Supported games: Monopoly, Cashflow, Hotel Tycoon and more | BoardBankr',
    gamesHeading: 'Which game are you playing?',
    gamesDescription:
      'A digital bank for Monopoly, Monopoly Electronic Banking, Cashflow, Hotel Tycoon, Anti-Monopoly and every other board game played with paper money.',
    create: 'Start a game',
    setupFor: (name: string) => `Set up a table for ${name}`,
    alsoKnown: 'Also known as',
    otherGames: 'Other games',
    faqTitle: 'Frequently asked questions',
    home: 'Home',
    games: 'Games',
    legal: 'Legal notice',
    locale: 'en_US',
    currency: 'USD',
    disclaimer:
      'Monopoly is a registered trademark of Hasbro, Inc.; the other game names mentioned belong to their owners. BoardBankr is independent, not affiliated with or endorsed by any game publisher. Money in the app is play money with no real value.',
  },
} satisfies Record<SiteLang, unknown>;

export interface SeoPage {
  title: string;
  description: string;
  path: string;
  lang: SiteLang;
  index: boolean;
  /** An unknown game guide: crawlers get a real 404, people get redirected by the app. */
  notFound: boolean;
  /** hreflang alternates of an indexed page. */
  alternates: { lang: SiteLang; path: string }[];
  jsonLd: object[];
  body: string;
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function alternatesOf(page: PublicPage) {
  return LANGS.map((lang) => ({ lang, path: publicPath(lang, page) }));
}

function gameText(g: CatalogGame, lang: SiteLang) {
  return lang === 'tr' ? g.tr : g.en;
}

function gameList(lang: SiteLang): string {
  return `<ul>${CATALOG.map((g) => `<li><a href="${publicPath(lang, { kind: 'game', slug: g.slug })}">${esc(gameText(g, lang).title)}</a></li>`).join('')}</ul>`;
}

function faqHtml(lang: SiteLang): string {
  return `<section><h2>${esc(TEXT[lang].faqTitle)}</h2>${FAQ[lang].map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>`;
}

function faqLd(lang: SiteLang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: FAQ[lang].map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

function appLd(url: string, description: string, lang: SiteLang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url,
    description,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Works in iOS, Android and desktop browsers.',
    inLanguage: lang,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: TEXT[lang].currency },
  };
}

function breadcrumbLd(base: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: base + it.path })),
  };
}

function footer(lang: SiteLang): string {
  return `<footer><p>${esc(TEXT[lang].disclaimer)}</p><p><a href="${publicPath(lang, { kind: 'legal' })}">${esc(TEXT[lang].legal)}</a></p></footer>`;
}

function gamePage(base: string, lang: SiteLang, g: CatalogGame): SeoPage {
  const t = TEXT[lang];
  const text = gameText(g, lang);
  const page: PublicPage = { kind: 'game', slug: g.slug };
  const path = publicPath(lang, page);
  const others = CATALOG.filter((o) => o.slug !== g.slug)
    .map((o) => `<li><a href="${publicPath(lang, { kind: 'game', slug: o.slug })}">${esc(o.name)}</a></li>`)
    .join('');
  return {
    title: `${text.title} | ${SITE_NAME}`,
    description: text.description,
    path,
    lang,
    index: true,
    notFound: false,
    alternates: alternatesOf(page),
    jsonLd: [
      appLd(base + path, text.description, lang),
      breadcrumbLd(base, [
        { name: t.home, path: publicPath(lang, { kind: 'home' }) },
        { name: t.games, path: publicPath(lang, { kind: 'games' }) },
        { name: g.name, path },
      ]),
    ],
    body: `<main><h1>${esc(text.title)}</h1>${text.body.map((p) => `<p>${esc(p)}</p>`).join('')}<p>${esc(t.alsoKnown)}: ${esc(
      g.aliases.join(', '),
    )}</p><p><a href="/new?edition=${g.edition}">${esc(t.setupFor(g.name))}</a></p><h2>${esc(t.otherGames)}</h2><ul>${others}</ul></main>${footer(lang)}`,
  };
}

function privatePage(path: string): SeoPage {
  return {
    title: SITE_NAME,
    description: TEXT.tr.homeDescription,
    path,
    lang: 'tr',
    index: false,
    notFound: false,
    alternates: [],
    jsonLd: [],
    body: '',
  };
}

export function seoFor(pathname: string, base: string): SeoPage {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const parsed = parsePublicPath(clean);
  if (!parsed) return privatePage(clean);

  const { lang, page } = parsed;
  const t = TEXT[lang];
  const home = publicPath(lang, { kind: 'home' });
  const games = publicPath(lang, { kind: 'games' });

  switch (page.kind) {
    case 'home':
      return {
        title: t.homeTitle,
        description: t.homeDescription,
        path: home,
        lang,
        index: true,
        notFound: false,
        alternates: alternatesOf(page),
        jsonLd: [appLd(base + home, t.homeDescription, lang), faqLd(lang)],
        body: `<main><h1><span>${esc(t.homeKicker)}</span> ${esc(t.homeHeading)}</h1><p>${esc(t.homeDescription)}</p><p><a href="/new">${esc(
          t.create,
        )}</a></p><h2>${esc(t.gamesHeading)}</h2>${gameList(lang)}${faqHtml(lang)}</main>${footer(lang)}`,
      };

    case 'games':
      return {
        title: t.gamesTitle,
        description: t.gamesDescription,
        path: games,
        lang,
        index: true,
        notFound: false,
        alternates: alternatesOf(page),
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: CATALOG.map((g, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: g.name,
              url: base + publicPath(lang, { kind: 'game', slug: g.slug }),
            })),
          },
          breadcrumbLd(base, [
            { name: t.home, path: home },
            { name: t.games, path: games },
          ]),
        ],
        body: `<main><h1>${esc(t.gamesHeading)}</h1><p>${esc(t.gamesDescription)}</p>${gameList(lang)}</main>${footer(lang)}`,
      };

    case 'legal': {
      const legal = LEGAL[lang];
      const path = publicPath(lang, page);
      const sections = legal.sections
        .map((s) => `<section><h2>${esc(s.title)}</h2>${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`)
        .join('');
      return {
        title: `${legal.title} | ${SITE_NAME}`,
        description: legal.description,
        path,
        lang,
        index: true,
        notFound: false,
        alternates: alternatesOf(page),
        jsonLd: [
          breadcrumbLd(base, [
            { name: t.home, path: home },
            { name: legal.title, path },
          ]),
        ],
        body: `<main><h1>${esc(legal.title)}</h1><p>${esc(legal.lead)}</p>${sections}<p>${esc(legal.updated)}</p></main>`,
      };
    }

    case 'game': {
      const game = findCatalogGame(page.slug);
      if (game) return gamePage(base, lang, game);
      return { ...privatePage(clean), lang, notFound: true };
    }
  }
}

/** Fills the built index.html with the page's head tags and crawlable content. */
export function renderShell(template: string, page: SeoPage, base: string): string {
  const url = base + page.path;
  const t = TEXT[page.lang];
  const alternates = page.index
    ? [
        ...page.alternates.map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${esc(base + a.path)}" />`),
        ...page.alternates.filter((a) => a.lang === 'en').map((a) => `<link rel="alternate" hreflang="x-default" href="${esc(base + a.path)}" />`),
      ]
    : [];
  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    page.index ? `<link rel="canonical" href="${esc(url)}" />` : '<meta name="robots" content="noindex" />',
    ...alternates,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${t.locale}" />`,
    ...LANGS.filter((l) => l !== page.lang).map((l) => `<meta property="og:locale:alternate" content="${TEXT[l].locale}" />`),
    `<meta name="twitter:card" content="summary" />`,
    ...page.jsonLd.map((ld) => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`),
  ].join('\n    ');

  return template
    .replace(/<html([^>]*?)\slang="[^"]*"/, '<html$1')
    .replace(/<html/, `<html lang="${page.lang}"`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, '')
    .replace(/<meta\s+property="og:[^"]+"[\s\S]*?\/>/g, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
}

export function sitemapXml(base: string): string {
  const pages: PublicPage[] = [{ kind: 'home' }, { kind: 'games' }, ...CATALOG.map((g) => ({ kind: 'game' as const, slug: g.slug })), { kind: 'legal' }];
  const urls = pages
    .flatMap((page) =>
      LANGS.map((lang) => {
        const links = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(base + publicPath(l, page))}"/>`).join('');
        const priority = page.kind === 'home' ? '1.0' : '0.8';
        return `  <url><loc>${esc(base + publicPath(lang, page))}</loc>${links}<changefreq>monthly</changefreq><priority>${priority}</priority></url>`;
      }),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(base: string): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /app', 'Disallow: /g/', 'Disallow: /new', 'Disallow: /login', '', `Sitemap: ${base}/sitemap.xml`, ''].join(
    '\n',
  );
}
