import { APP } from '../../appConfig';
import { db, type Episode } from '../../db/schema';
import { loadSettings } from '../../settings';
import { usePlayerStore } from '../../store/playerStore';
import { bindMediaSession, setMediaMetadata, setMediaPlaybackState, setMediaPosition } from './mediaSession';
import { probeStatus } from './diagnose';
import { dequeue, shiftQueue } from './queue';

const PLAYED_REMAINING_SEC = 30;
const SAVE_INTERVAL_MS = 5000;
const LAST_KEY = APP.key('lastEpisode');

let audio: HTMLAudioElement | null = null;
let current: Episode | undefined;
let lastSavedAt = 0;
/** 読み込み後に移動する位置（loadedmetadata まで currentTime を設定できないブラウザがあるので） */
let pendingSeek: number | null = null;
let pendingPlay = false;

const set = usePlayerStore.setState
const el = () => {
  if (!audio) throw new Error('playerService.init() has not been called')
  return audio
}

async function sourceOf(episode: Episode): Promise<string | null> {
  const dl = await db.downloads.get(episode.id);
  if (dl?.status === 'done') return `${import.meta.env.BASE_URL}local-audio/${episode.id}`;
  return navigator.onLine ? episode.enclosureUrl : null;
}

/** 今の位置を保存する。played は一度 true になったら、ここでは戻さない */
async function savePosition() {
  if (!current || !audio) return;
  const position = audio.currentTime;
  const duration = Number.isFinite(audio.duration) ? audio.duration : current.duration;
  const prev = await db.playbackStates.get(current.id);
  const nearEnd = !!duration && duration - position < Math.min(PLAYED_REMAINING_SEC, duration * 0.1);
  await db.playbackStates.put({
    episodeId: current.id,
    position,
    duration,
    played: (prev?.played ?? false) || nearEnd,
    updatedAt: Date.now(),
  });
  lastSavedAt = Date.now();
}

/**
 * エピソードを読み込む。autoplay なら再生も始める。
 * 再生済みのエピソードは先頭から、それ以外は保存した位置から
 */
export async function load(episodeId: string, autoplay = true) {
  const episode = await db.episodes.get(episodeId);
  if (!episode) return;
  if (current && current.id !== episodeId) await savePosition();
  const a = el();
  current = episode;
  try {
    localStorage.setItem(LAST_KEY, episodeId);
  } catch {

  }

  // キューにあれば外す（終わったあとにもう一度流れないように）
  await dequeue(episodeId);
  const state = await db.playbackStates.get(episodeId);
  const start = state && !state.played ? state.position : 0;
  const podcast = await db.podcasts.get(episode.podcastId);
  setMediaMetadata(episode, podcast);

  const src = await sourceOf(episode);
  set({ currentEpisodeId: episodeId, position: start, duration: state?.duration ?? episode.duration ?? 0, buffered: 0, error: undefined });
  if (!src) {
    a.removeAttribute('src');
    set({ status: 'error', error: 'offline' });
    return;
  }
  pendingSeek = start;
  pendingPlay = autoplay;
  a.src = src;
  a.playbackRate = usePlayerStore.getState().playbackRate;
  set({ status: autoplay ? 'loading' : 'paused' });
  if (autoplay) await play();
}

export async function play() {
  const a = el();
  if (!current) return;
  if (!a.src) return load(current.id);
  // 再生済みのところで止まっていたら、頭から
  if (a.ended) a.currentTime = 0;
  try {
    await a.play();
  } catch (e) {
    // 自動再生の制限（NotAllowedError）や src の切り替えによる中断（AbortError）は、一時停止のまま
    if ((e as DOMException).name !== 'AbortError') set({ status: 'paused' });
  }
}

export function pause() {
  el().pause();
}

export const toggle = () => (audio && !audio.paused ? pause() : void play());

export function seekTo(sec: number) {
  const a = el();
  const max = Number.isFinite(a.duration) ? a.duration : usePlayerStore.getState().duration;
  const t = Math.max(0, max ? Math.min(sec, max) : sec);
  if (a.readyState === 0) pendingSeek = t;
  else a.currentTime = t;
  set({ position: t });
}

export const skip = (delta: number) => seekTo((audio?.currentTime ?? 0) + delta);
export const skipBack = () => skip(-loadSettings().skipBack);
export const skipForward = () => skip(loadSettings().skipForward);

/** 再生速度（0.5〜3.0、0.1 刻み） */
export function setRate(rate: number) {
  const r = Math.round(Math.min(3, Math.max(0.5, rate)) * 10) / 10;
  if (audio) audio.playbackRate = r;
  set({ playbackRate: r });
}

/** キューの次へ。キューが空なら止める */
export async function next() {
  const id = await shiftQueue();
  if (id) {
    await load(id);
    return;
  }

  audio?.pause();
  set({ status: 'paused' });
}

/** 再生済み / 未再生の切り替え */
export async function setPlayed(episodeId: string, played: boolean) {
  const prev = await db.playbackStates.get(episodeId);
  await db.playbackStates.put({
    episodeId,
    position: played ? (prev?.position ?? 0) : 0,
    duration: prev?.duration,
    played,
    updatedAt: Date.now(),
  });
  if (!played && current?.id === episodeId && audio) {
    audio.currentTime = 0;
    set({ position: 0 });
  }
}

/** <audio> を作り、イベントを store へつなぐ。アプリの起動時に一度だけ呼ぶ */
export function init() {
  if (audio) return;
  const a = document.createElement('audio');
  a.preload = 'metadata';
  document.body.appendChild(a);
  audio = a;
  set({ playbackRate: loadSettings().playbackRate });

  const syncPos = () => {
    set({ position: a.currentTime, duration: Number.isFinite(a.duration) ? a.duration : usePlayerStore.getState().duration });
    setMediaPosition(a.currentTime, a.duration, a.playbackRate);
  };
  a.addEventListener('loadedmetadata', () => {
    if (pendingSeek != null) {
      a.currentTime = pendingSeek;
      pendingSeek = null;
    }
    syncPos();
  });
  a.addEventListener('timeupdate', () => {
    syncPos();
    if (!a.paused && Date.now() - lastSavedAt > SAVE_INTERVAL_MS) void savePosition();
  });
  a.addEventListener('progress', () => {
    const b = a.buffered;
    set({ buffered: b.length ? b.end(b.length - 1) : 0 });
  });
  a.addEventListener('waiting', () => set({ status: 'loading' }));
  a.addEventListener('playing', () => {
    set({ status: 'playing' });
    setMediaPlaybackState('playing');
  });
  a.addEventListener('pause', () => {
    if (a.ended) return;
    set({ status: 'paused' });
    setMediaPlaybackState('paused');
    void savePosition();
  });
  a.addEventListener('canplay', () => {
    if (pendingPlay) {
      pendingPlay = false;
      void play();
    }
  });
  a.addEventListener('ratechange', () => set({ playbackRate: a.playbackRate }));
  a.addEventListener('ended', async () => {
    if (current) await db.playbackStates.put({ episodeId: current.id, position: 0, duration: a.duration, played: true, updatedAt: Date.now() });
    await next();
  });
  a.addEventListener('error', async () => {
    if (!a.getAttribute('src') || !current) return;
    if (a.src.includes('/local-audio/') && navigator.onLine) {
      pendingSeek = a.currentTime;
      pendingPlay = true;
      a.src = current.enclosureUrl;
      return;
    }
    set({ status: 'error', error: 'media', errorStatus: undefined });

    const id = current.id;
    const status = await probeStatus(current.enclosureUrl);
    if (current?.id !== id || usePlayerStore.getState().error !== 'media' || !status || status < 400) return;
    set({ error: status === 404 || status === 410 ? 'notFound' : 'http', errorStatus: status });
  });

  const flush = () => void savePosition();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);

  bindMediaSession({ play: () => void play(), pause, skipBack, skipForward, seekTo, next: () => void next() });

  // 前回のエピソードをミニプレイヤーに戻す（再生はしない）
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_KEY);
  } catch {
    // 読めなければ戻さない
  }
  if (last) void load(last, false);
}

export const currentEpisode = () => current;
