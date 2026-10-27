import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { applyFeed, unsubscribe } from './syncPodcast';
import type { ParsedFeed } from './parseFeed';

const feed = (episodes: ParsedFeed['episodes']): ParsedFeed => ({ title: 'Show', episodes });
const ep = (guid: string, title = guid, pubDate = 1) => ({ guid, title, pubDate, enclosureUrl: `https://cdn.example/${guid}.mp3` });

describe('applyFeed', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('adds new episodes, updates existing, and keeps ones that disappeared', async () => {
    expect(await applyFeed('p', feed([ep('a'), ep('b')]))).toBe(2);
    expect(await applyFeed('p', feed([ep('b', 'B renamed'), ep('c')]))).toBe(1);
    const all = await db.episodes.where('podcastId').equals('p').toArray();
    expect(all.map((e) => e.title).sort()).toEqual(['B renamed', 'a', 'c']);
  });

  it('does not touch playback state when the feed is refreshed', async () => {
    await applyFeed('p', feed([ep('a')]));
    const [a] = await db.episodes.toArray();
    await db.playbackStates.put({ episodeId: a.id, position: 42, played: false, updatedAt: 1 });
    await applyFeed('p', feed([ep('a', 'new title')]));
    expect((await db.playbackStates.get(a.id))?.position).toBe(42);
  });

  it('uses the enclosure URL as the key when there is no guid', async () => {
    const noGuid = { title: 'x', pubDate: 1, enclosureUrl: 'https://cdn.example/x.mp3' };
    await applyFeed('p', feed([noGuid]));
    expect(await applyFeed('p', feed([{ ...noGuid, title: 'y' }]))).toBe(0);
  });

  it('unsubscribe removes the podcast and everything attached to it', async () => {
    await db.podcasts.put({ id: 'p', feedUrl: 'https://f.example', title: 'Show', autoDownload: false, addedAt: 1, sortOrder: 1 });
    await applyFeed('p', feed([ep('a')]));
    await applyFeed('q', feed([ep('z')]));
    const [a] = await db.episodes.where('podcastId').equals('p').toArray();
    await db.playbackStates.put({ episodeId: a.id, position: 1, played: false, updatedAt: 1 });
    await db.queue.put({ episodeId: a.id, order: 1 });
    await unsubscribe('p');
    expect(await db.podcasts.count()).toBe(0);
    expect(await db.episodes.count()).toBe(1);
    expect(await db.playbackStates.count()).toBe(0);
    expect(await db.queue.count()).toBe(0);
  });
});
