import { db, type Episode, type Podcast } from '../../db/schema';
import { sha1 } from '../../util/hash';
import { OfflineError } from '../network/errors';
import { gatewayFetch } from '../network';
import { parseFeed, type ParsedFeed } from './parseFeed';

export const podcastIdOf = (feedUrl: string) => sha1(feedUrl);
export const episodeIdOf = (podcastId: string, key: string) => sha1(`${podcastId}\n${key}`);

async function fetchFeed(feedUrl: string, cond?: Pick<Podcast, 'etag' | 'lastModified'>) {
  if (!navigator.onLine) throw new OfflineError(feedUrl);
  const headers: Record<string, string> = {};
  if (cond?.etag) headers['If-None-Match'] = cond.etag;
  if (cond?.lastModified) headers['If-Modified-Since'] = cond.lastModified;
  const res = await gatewayFetch(feedUrl, { headers });
  if (res.status === 304) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {
    feed: parseFeed(await res.text()),
    etag: res.headers.get('ETag') ?? undefined,
    lastModified: res.headers.get('Last-Modified') ?? undefined,
  };
}

export async function applyFeed(podcastId: string, feed: ParsedFeed): Promise<number> {
  const episodes: Episode[] = await Promise.all(
    feed.episodes.map(async (e) => ({ ...e, id: await episodeIdOf(podcastId, e.guid ?? e.enclosureUrl), podcastId })),
  );
  return db.transaction('rw', db.episodes, async () => {
    const existing = new Set((await db.episodes.bulkGet(episodes.map((e) => e.id))).flatMap((e) => (e ? [e.id] : [])));
    await db.episodes.bulkPut(episodes);
    return episodes.filter((e) => !existing.has(e.id)).length;
  });
}

export async function subscribe(feedUrl: string): Promise<Podcast> {
  const url = new URL(feedUrl.trim()).href;
  const id = await podcastIdOf(url);
  const found = await db.podcasts.get(id);
  if (found) return found;
  const got = await fetchFeed(url);
  if (!got) throw new Error('Unexpected 304');
  const { episodes: _, ...meta } = got.feed;
  const last = await db.podcasts.orderBy('sortOrder').last();
  const podcast: Podcast = {
    id,
    feedUrl: url,
    ...meta,
    etag: got.etag,
    lastModified: got.lastModified,
    lastFetchedAt: Date.now(),
    autoDownload: false,
    addedAt: Date.now(),
    sortOrder: (last?.sortOrder ?? 0) + 1,
  };
  await applyFeed(id, got.feed);
  await db.podcasts.put(podcast);
  return podcast;
}

export async function refreshPodcast(p: Podcast): Promise<number> {
  const got = await fetchFeed(p.feedUrl, p);
  if (!got) {
    await db.podcasts.update(p.id, { lastFetchedAt: Date.now() });
    return 0;
  }
  const { episodes: _, ...meta } = got.feed;
  const added = await applyFeed(p.id, got.feed);
  await db.podcasts.update(p.id, { ...meta, etag: got.etag, lastModified: got.lastModified, lastFetchedAt: Date.now() });
  return added;
}

export interface RefreshResult {
  added: number;
  failed: { podcast: Podcast; error: unknown }[];
}

export async function refreshAll(podcasts?: Podcast[]): Promise<RefreshResult> {
  const list = podcasts ?? (await db.podcasts.toArray());
  const result: RefreshResult = { added: 0, failed: [] };
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const p = list[next++];
      try {
        result.added += await refreshPodcast(p);
      } catch (error) {
        result.failed.push({ podcast: p, error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
  return result;
}

export async function unsubscribe(podcastId: string) {
  await db.transaction('rw', [db.podcasts, db.episodes, db.playbackStates, db.queue, db.downloads], async () => {
    const ids = await db.episodes.where('podcastId').equals(podcastId).primaryKeys();
    await Promise.all([db.playbackStates.bulkDelete(ids), db.queue.bulkDelete(ids), db.downloads.bulkDelete(ids)]);
    await db.episodes.where('podcastId').equals(podcastId).delete();
    await db.podcasts.delete(podcastId);
  });
}
