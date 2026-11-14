// Pre-renders the SEO landing page into dist/index.html and writes the SPA shell (app.html),
// robots.txt and sitemap.xml. Runs after `vite build` and `vite build --ssr`.
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');

const base = (process.env.VITE_BASE_PATH || '/').replace(/\/?$/, '/');
const site = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
const pageUrl = site ? `${site}${base}` : base;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const title = 'GigMasterPro: Setlist, Song & Gig Management for Gigging Musicians';
const description =
  'GigMasterPro helps working musicians manage their repertoire, build setlists, schedule gigs, perform from a full-screen stage Play Mode, and connect with musicians nearby.';
const image = `${site}${base}og-image.png`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'GigMasterPro',
      applicationCategory: 'MusicApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description,
      featureList: ['Repertoire management', 'Setlist builder', 'Gig scheduling and calendar sync', 'Stage Play Mode with transposition and auto-scroll', 'Musician networking and bands'],
    },
    { '@type': 'WebSite', name: 'GigMasterPro', url: pageUrl },
  ],
};

const seo = [
  site && `<link rel="canonical" href="${esc(pageUrl)}" />`,
  `<meta name="robots" content="index, follow" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="GigMasterPro" />`,
  `<meta property="og:title" content="${esc(title)}" />`,
  `<meta property="og:description" content="${esc(description)}" />`,
  site && `<meta property="og:url" content="${esc(pageUrl)}" />`,
  `<meta property="og:image" content="${esc(image)}" />`,
  `<meta property="og:image:width" content="1200" />`,
  `<meta property="og:image:height" content="630" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${esc(title)}" />`,
  `<meta name="twitter:description" content="${esc(description)}" />`,
  `<meta name="twitter:image" content="${esc(image)}" />`,
  `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
]
  .filter(Boolean)
  .join('\n    ');

const template = await readFile(path.join(dist, 'index.html'), 'utf8');

// SPA shell for app routes: no landing markup, not indexed.
const shell = template.replace('<!--seo-->', '<meta name="robots" content="noindex" />').replace('<!--app-html-->', '');
await writeFile(path.join(dist, 'app.html'), shell);

const entry = ['entry-server.js', 'entry-server.mjs'].map((f) => path.join(ssrDir, f)).find(existsSync);
if (!entry) throw new Error('SSR bundle not found in dist-ssr/');
const { render } = await import(pathToFileURL(entry).href);
const html = render(base.replace(/\/$/, '') || '/');
await writeFile(path.join(dist, 'index.html'), template.replace('<!--seo-->', seo).replace('<!--app-html-->', html));

const disallow = ['api/', 'dashboard', 'songs', 'setlists', 'gigs', 'community', 'bands', 'profile', 'reset-password', 'verify-email'].map((p) => `Disallow: ${base}${p}`);
await writeFile(path.join(dist, 'robots.txt'), ['User-agent: *', `Allow: ${base}$`, ...disallow, site ? `\nSitemap: ${site}${base}sitemap.xml` : ''].join('\n') + '\n');

const urls = [['', '1.0', 'weekly']];
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(([p, prio, freq]) => `  <url><loc>${esc(`${site}${base}${p}`)}</loc><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
);

await rm(ssrDir, { recursive: true, force: true });
console.log(`Pre-rendered landing page (${(html.length / 1024).toFixed(1)} kB) for base ${base}${site ? ` at ${site}` : ' (set VITE_SITE_URL for absolute URLs)'}`);
