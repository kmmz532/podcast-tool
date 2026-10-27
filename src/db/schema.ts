import Dexie, { type EntityTable } from 'dexie';

export interface Podcast {
  id: string;
  feedUrl: string;
  title: string;
  author?: string;
  description?: string;
  artworkUrl?: string;
  link?: string;
  /** epoch ms */
  lastFetchedAt?: number;
  /** 条件付き GET 用 */
  etag?: string;
  lastModified?: string;
  autoDownload: boolean;
  addedAt: number;
  sortOrder: number;
}

export interface Episode {
  /** podcastId + (guid ?? enclosureUrl) のハッシュ */
  id: string;
  podcastId: string;
  guid?: string;
  title: string;
  /** サニタイズ済み HTML */
  description?: string;
  pubDate: number;
  enclosureUrl: string;
  enclosureType?: string;
  enclosureLength?: number;
  /** 秒。itunes:duration から */
  duration?: number;
  /** itunes:image（エピソード個別） */
  artworkUrl?: string;
}

/** エピソードと分けて、フィード更新で上書きされないようにする */
export interface PlaybackState {
  episodeId: string;
  /** 秒 */
  position: number;
  /** 実測値 */
  duration?: number;
  played: boolean;
  updatedAt: number;
}

export interface Download {
  episodeId: string;
  status: 'queued' | 'downloading' | 'done' | 'blocked' | 'error';
  bytes: number;
  totalBytes?: number;
  mimeType?: string;
  /** audio/{episodeId} */
  opfsPath: string;
  error?: string;
  completedAt?: number;
}

export interface QueueItem {
  episodeId: string;
  order: number;
}

export interface OriginRoute {
  origin: string;
  /** 'direct' または ProxyConfig.id */
  transportId: string;
  checkedAt: number;
}

export const db = new Dexie('podcast') as Dexie & {
  podcasts: EntityTable<Podcast, 'id'>,
  episodes: EntityTable<Episode, 'id'>,
  playbackStates: EntityTable<PlaybackState, 'episodeId'>,
  downloads: EntityTable<Download, 'episodeId'>,
  queue: EntityTable<QueueItem, 'episodeId'>,
  originRoutes: EntityTable<OriginRoute, 'origin'>,
};

db.version(1).stores({
  podcasts: 'id, &feedUrl, sortOrder',
  episodes: 'id, podcastId, [podcastId+pubDate], pubDate',
  playbackStates: 'episodeId, updatedAt',
  downloads: 'episodeId, status',
  queue: 'episodeId, order',
  originRoutes: 'origin',
});
