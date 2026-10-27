import { describe, expect, it } from 'vitest';
import { parseOpml, toOpml } from './opml';

describe('opml', () => {
  it('round-trips subscriptions, escaping special characters', () => {
    const xml = toOpml([
      { title: 'A & B "show"', feedUrl: 'https://a.example/feed?x=1&y=2' },
      { title: 'C', feedUrl: 'https://c.example/rss', link: 'https://c.example/' },
    ]);
    expect(parseOpml(xml)).toEqual([
      { title: 'A & B "show"', feedUrl: 'https://a.example/feed?x=1&y=2' },
      { title: 'C', feedUrl: 'https://c.example/rss' },
    ]);
  });

  it('reads nested folders and skips duplicates and folders', () => {
    const xml = `<?xml version="1.0"?><opml version="1.0"><body>
      <outline text="Folder">
        <outline text="One" xmlUrl="https://one.example/rss" />
        <outline text="Dup" xmlUrl="https://one.example/rss" />
      </outline>
      <outline text="Two" type="rss" xmlUrl=" https://two.example/rss " />
    </body></opml>`;
    expect(parseOpml(xml)).toEqual([
      { title: 'One', feedUrl: 'https://one.example/rss' },
      { title: 'Two', feedUrl: 'https://two.example/rss' },
    ]);
  });

  it('rejects non-OPML', () => {
    expect(() => parseOpml('<rss></rss>')).toThrow();
  });
});
