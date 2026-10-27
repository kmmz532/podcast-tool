import DOMPurify from 'dompurify';

const ITUNES = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
const CONTENT = 'http://purl.org/rss/1.0/modules/content/';

export interface ParsedEpisode {
  guid?: string;
  title: string;
  description?: string;
  pubDate: number;
  enclosureUrl: string;
  enclosureType?: string;
  enclosureLength?: number;
  duration?: number;
  artworkUrl?: string;
}

export interface ParsedFeed {
  title: string;
  author?: string;
  description?: string;
  artworkUrl?: string;
  link?: string;
  episodes: ParsedEpisode[];
}

export class FeedParseError extends Error {
  constructor() {
    super('Not an RSS feed');
    this.name = 'FeedParseError';
  }
}

export function parseDuration(text: string | null | undefined): number | undefined {
  const s = text?.trim();
  if (!s) return undefined;

  const parts = s.split(':').map(Number);
  if (parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0));
}

const child = (el: Element, name: string, ns?: string) => Array.from(el.children).find((c) => c.localName === name && (ns ? c.namespaceURI === ns : !c.namespaceURI));
const text = (el: Element | undefined) => el?.textContent?.trim() || undefined;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const sanitizeHtml = (html: string) => DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input'], ADD_ATTR: ['target'] });

export function parseFeed(xml: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new FeedParseError();
  const channel = doc.documentElement.localName === 'rss' ? child(doc.documentElement, 'channel') : undefined;
  if (!channel) throw new FeedParseError();

  const episodes: ParsedEpisode[] = [];
  for (const item of Array.from(channel.children).filter((c) => c.localName === 'item' && !c.namespaceURI)) {
    const enc = child(item, 'enclosure');
    const enclosureUrl = enc?.getAttribute('url')?.trim();
    if (!enc || !enclosureUrl) continue;
    const length = Number(enc.getAttribute('length'));
    const date = Date.parse(text(child(item, 'pubDate')) ?? '');
    const desc = text(child(item, 'encoded', CONTENT)) ?? text(child(item, 'description')) ?? text(child(item, 'summary', ITUNES));
    episodes.push({
      guid: text(child(item, 'guid')),
      title: text(child(item, 'title')) ?? text(child(item, 'title', ITUNES)) ?? enclosureUrl,
      description: desc ? sanitizeHtml(desc) : undefined,
      pubDate: Number.isFinite(date) ? date : 0,
      enclosureUrl,
      enclosureType: enc.getAttribute('type') || undefined,
      enclosureLength: length > 0 ? length : undefined,
      duration: parseDuration(text(child(item, 'duration', ITUNES))),
      artworkUrl: child(item, 'image', ITUNES)?.getAttribute('href') || undefined,
    });
  }
  episodes.sort((a, b) => b.pubDate - a.pubDate);

  const title = text(child(channel, 'title'));
  if (!title) throw new FeedParseError();
  const image = child(channel, 'image');
  return {
    title,
    author: text(child(channel, 'author', ITUNES)),
    description: text(child(channel, 'description')) ?? text(child(channel, 'summary', ITUNES)),
    artworkUrl: child(channel, 'image', ITUNES)?.getAttribute('href') || (image && text(child(image, 'url'))),
    link: text(child(channel, 'link')),
    episodes,
  };
}
