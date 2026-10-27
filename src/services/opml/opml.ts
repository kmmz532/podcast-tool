import type { Podcast } from '../../db/schema';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toOpml(podcasts: Pick<Podcast, 'title' | 'feedUrl' | 'link'>[], title = 'Podcast subscriptions'): string {
  const lines = podcasts.map(
    (p) => `    <outline type="rss" text="${esc(p.title)}" title="${esc(p.title)}" xmlUrl="${esc(p.feedUrl)}"${p.link ? ` htmlUrl="${esc(p.link)}"` : ''} />`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${esc(title)}</title>`,
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    '  </head>',
    '  <body>',
    ...lines,
    '  </body>',
    '</opml>',
    '',
  ].join('\n');
}

export function parseOpml(xml: string): { title?: string; feedUrl: string }[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName !== 'opml') throw new Error('Not an OPML file');
  const seen = new Set<string>();
  const out: { title?: string; feedUrl: string }[] = [];
  for (const o of Array.from(doc.getElementsByTagName('outline'))) {
    const url = o.getAttribute('xmlUrl')?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: o.getAttribute('title') ?? o.getAttribute('text') ?? undefined, feedUrl: url });
  }
  return out
}
