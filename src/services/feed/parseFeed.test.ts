import { describe, expect, it } from 'vitest';
import { FeedParseError, parseDuration, parseFeed } from './parseFeed';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Show</title>
    <link>https://example.com/</link>
    <description>Channel desc</description>
    <itunes:author>Alice</itunes:author>
    <itunes:image href="https://example.com/art.jpg" />
    <image><url>https://example.com/fallback.jpg</url><title>ignored</title></image>
    <item>
      <title>Old episode</title>
      <guid>ep-1</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/1.mp3" type="audio/mpeg" length="12345" />
      <itunes:duration>1:02:03</itunes:duration>
      <description>plain desc</description>
    </item>
    <item>
      <title>New episode</title>
      <pubDate>Wed, 01 May 2024 00:00:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/2.mp3" type="audio/mpeg" />
      <itunes:duration>754</itunes:duration>
      <itunes:image href="https://example.com/ep2.jpg" />
      <content:encoded><![CDATA[<p>Hi <a href="https://x.example/">link</a><script>alert(1)</script><img src="a.png" onerror="alert(1)"></p>]]></content:encoded>
    </item>
    <item>
      <title>No audio</title>
    </item>
  </channel>
</rss>`;

describe('parseDuration', () => {
  it.each([
    ['1:02:03', 3723],
    ['02:03', 123],
    ['754', 754],
    ['12.6', 13],
    ['', undefined],
    ['abc', undefined],
    ['1:2:3:4', undefined],
    [null, undefined],
  ])('%s → %s', (input, expected) => expect(parseDuration(input)).toBe(expected));
});

describe('parseFeed', () => {
  const feed = parseFeed(FEED);

  it('reads channel metadata', () => {
    expect(feed).toMatchObject({ title: 'Test Show', author: 'Alice', description: 'Channel desc', link: 'https://example.com/', artworkUrl: 'https://example.com/art.jpg' });
  });

  it('drops items without enclosure and sorts newest first', () => {
    expect(feed.episodes.map((e) => e.title)).toEqual(['New episode', 'Old episode']);
  });

  it('reads episode fields', () => {
    const [ep2, ep1] = feed.episodes
    expect(ep1).toMatchObject({ guid: 'ep-1', enclosureUrl: 'https://cdn.example.com/1.mp3', enclosureLength: 12345, duration: 3723, description: 'plain desc' });
    expect(ep2.guid).toBeUndefined();
    expect(ep2.duration).toBe(754);
    expect(ep2.artworkUrl).toBe('https://example.com/ep2.jpg');
  });

  it('prefers content:encoded and sanitizes it', () => {
    const html = feed.episodes[0].description!;
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('falls back to <image><url> for artwork', () => {
    const f = parseFeed(FEED.replace('<itunes:image href="https://example.com/art.jpg" />', ''));
    expect(f.artworkUrl).toBe('https://example.com/fallback.jpg');
  });

  it('rejects non-RSS', () => {
    expect(() => parseFeed('<html><body>hi</body></html>')).toThrow(FeedParseError);
    expect(() => parseFeed('not xml <')).toThrow(FeedParseError);
    expect(() => parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><title>x</title></feed>')).toThrow(FeedParseError);
  });
});
