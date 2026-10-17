import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('The journal feed needs the site address set in astro.config.');
  const posts = (await getCollection('journal')).sort((a, b) => b.data.date.localeCompare(a.data.date));
  const journalUrl = new URL('/journal/', site).href;
  const items = posts
    .map((post) => {
      const link = new URL(`/journal/${post.id}/`, site).href;
      return [
        '    <item>',
        `      <title>${escapeXml(post.data.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <pubDate>${new Date(`${post.data.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(post.data.description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Renku Journal</title>
    <link>${journalUrl}</link>
    <atom:link href="${new URL('/journal/rss.xml', site).href}" rel="self" type="application/rss+xml" />
    <description>Notes on how films are made with Renku, and on how Renku itself is made.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(feed, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
