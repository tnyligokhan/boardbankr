import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CATALOG } from '@mdb/shared';
import { renderShell, robotsTxt, seoFor, sitemapXml } from '../seo';
import { PUBLIC_URL, createTestApp } from './helpers';

const TEMPLATE = `<!doctype html><html><head><title>Old</title>
<meta name="description" content="old" />
<meta property="og:title" content="old" />
</head><body><div id="root"></div></body></html>`;

describe('seo', () => {
  it('renders a game page with its own head, content and structured data', () => {
    const html = renderShell(TEMPLATE, seoFor('/oyun/milyarder', PUBLIC_URL), PUBLIC_URL);
    expect(html).toContain('<title>Milyarder kutu oyunu için dijital banka | BoardBankr</title>');
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC_URL}/oyun/milyarder" />`);
    expect(html).toContain('<h1>Milyarder kutu oyunu için dijital banka</h1>');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).not.toContain('<title>Old</title>');
    expect(html).not.toContain('content="old"');
  });

  it('puts the FAQ on the home page and keeps private pages out of the index', () => {
    expect(renderShell(TEMPLATE, seoFor('/', PUBLIC_URL), PUBLIC_URL)).toContain('"@type":"FAQPage"');
    const lobby = renderShell(TEMPLATE, seoFor('/g/ABCDE', PUBLIC_URL), PUBLIC_URL);
    expect(lobby).toContain('<meta name="robots" content="noindex" />');
    expect(lobby).not.toContain('rel="canonical"');
    expect(seoFor('/oyun/unknown', PUBLIC_URL).index).toBe(false);
  });

  it('serves the legal notice as an indexed page, linked from every footer and in the sitemap', () => {
    const html = renderShell(TEMPLATE, seoFor('/yasal', PUBLIC_URL), PUBLIC_URL);
    expect(html).toContain('<title>Yasal uyarı | BoardBankr</title>');
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC_URL}/yasal" />`);
    expect(html).toContain('<h2>Sanal para</h2>');
    expect(renderShell(TEMPLATE, seoFor('/oyunlar', PUBLIC_URL), PUBLIC_URL)).toContain('<a href="/yasal">Yasal uyarı</a>');
    expect(sitemapXml(PUBLIC_URL)).toContain(`${PUBLIC_URL}/yasal</loc>`);
  });

  it('serves English pages under /en, linked to the Turkish ones with hreflang', () => {
    const en = renderShell(TEMPLATE, seoFor('/en/games/monopoly', PUBLIC_URL), PUBLIC_URL);
    expect(en).toContain('<title>A digital bank for Monopoly | BoardBankr</title>');
    expect(en).toContain('<html lang="en">');
    expect(en).toContain(`<link rel="canonical" href="${PUBLIC_URL}/en/games/monopoly" />`);
    expect(en).toContain(`<link rel="alternate" hreflang="tr" href="${PUBLIC_URL}/oyun/monopoly" />`);
    expect(en).toContain(`<link rel="alternate" hreflang="x-default" href="${PUBLIC_URL}/en/games/monopoly" />`);
    expect(en).toContain('<meta property="og:locale" content="en_US" />');
    expect(en).toContain('href="/en/legal"');
    const home = renderShell(TEMPLATE, seoFor('/en', PUBLIC_URL), PUBLIC_URL);
    expect(home).toContain('for Monopoly | BoardBankr</title>');
    expect(seoFor('/en/legal', PUBLIC_URL).index).toBe(true);
    expect(seoFor('/en/games/unknown', PUBLIC_URL).notFound).toBe(true);
    const xml = sitemapXml(PUBLIC_URL);
    expect(xml).toContain(`${PUBLIC_URL}/en/games/cashflow</loc>`);
    expect(xml).toContain('hreflang="en"');
  });

  it('never names the app after a trademark and links guides to a preset setup', () => {
    for (const path of ['/', '/en']) {
      const app = seoFor(path, PUBLIC_URL).jsonLd.find((ld) => (ld as { '@type': string })['@type'] === 'WebApplication') as Record<string, unknown>;
      expect(app.name).toBe('BoardBankr');
      expect(app).not.toHaveProperty('alternateName');
    }
    const html = renderShell(TEMPLATE, seoFor('/oyun/monopoly-electronic-banking', PUBLIC_URL), PUBLIC_URL);
    expect(html).toContain('href="/new?edition=electronic"');
  });

  it('escapes text and lists every game in the sitemap', () => {
    const page = { ...seoFor('/', PUBLIC_URL), title: '<script>"x"</script>' };
    expect(renderShell(TEMPLATE, page, PUBLIC_URL)).toContain('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
    const xml = sitemapXml(PUBLIC_URL);
    for (const g of CATALOG) expect(xml).toContain(`${PUBLIC_URL}/oyun/${g.slug}</loc>`);
    expect(robotsTxt(PUBLIC_URL)).toContain(`Sitemap: ${PUBLIC_URL}/sitemap.xml`);
  });

  it('serves pages through the SEO shell even if the build contains its own robots.txt', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mdb-web-'));
    writeFileSync(path.join(dir, 'index.html'), TEMPLATE);
    writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
    const t = await createTestApp({ webDist: dir });
    try {
      const home = await t.app.inject({ method: 'GET', url: '/' });
      expect(home.statusCode).toBe(200);
      expect(home.body).toContain('"@type":"FAQPage"');
      const guide = await t.app.inject({ method: 'GET', url: '/oyun/hotel-tycoon' });
      expect(guide.body).toContain('<h1>Hotel Tycoon için dijital banka</h1>');
      expect((await t.app.inject({ method: 'GET', url: '/oyun/yok-boyle-oyun' })).statusCode).toBe(404);
      expect((await t.app.inject({ method: 'GET', url: '/robots.txt' })).body).toContain('Sitemap:');
      expect((await t.app.inject({ method: 'GET', url: '/assets/app.js' })).headers['cache-control']).toContain('immutable');
    } finally {
      await t.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('serves robots.txt and sitemap.xml', async () => {
    const t = await createTestApp();
    try {
      const robots = await t.app.inject({ method: 'GET', url: '/robots.txt' });
      expect(robots.statusCode).toBe(200);
      expect(robots.body).toContain('Disallow: /g/');
      const sitemap = await t.app.inject({ method: 'GET', url: '/sitemap.xml' });
      expect(sitemap.headers['content-type']).toContain('application/xml');
    } finally {
      await t.close();
    }
  });
});
