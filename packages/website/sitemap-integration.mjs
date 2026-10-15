// @ts-check
import { writeFile } from 'node:fs/promises';

/**
 * Writes sitemap.xml from the pages Astro actually built, so new pages are
 * listed without maintaining a page list by hand. The 404 page is excluded.
 *
 * @returns {import('astro').AstroIntegration}
 */
export function sitemapIntegration() {
  /** @type {URL | undefined} */
  let site;

  return {
    name: 'renku-sitemap',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (!config.site) throw new Error('renku-sitemap: `site` must be set in astro.config.mjs.');
        site = new URL(config.site);
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (!site) throw new Error('renku-sitemap: `site` was not resolved before the build finished.');
        const siteUrl = site;
        const locations = pages
          .map(({ pathname }) => pathname)
          .filter((pathname) => pathname !== '404/' && pathname !== '404')
          .map((pathname) => new URL(pathname.endsWith('/') || pathname === '' ? pathname : `${pathname}/`, siteUrl).href)
          .sort();
        const entries = locations.map((location) => `  <url><loc>${location}</loc></url>`).join('\n');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
        await writeFile(new URL('sitemap.xml', dir), xml);
        logger.info(`sitemap.xml written with ${locations.length} pages.`);
      },
    },
  };
}
