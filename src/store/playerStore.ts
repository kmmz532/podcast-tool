import { create } from 'zustand';

export interface PlayerState {
  currentEpisodeId?: string;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  position: number;
  duration: number;
  playbackRate: number;
  buffered: number;
  error?: 'offline' | 'media' | 'notFound' | 'http';
  errorStatus?: number;
}

export function playerErrorText(s: Pick<PlayerState, 'error' | 'errorStatus'>, t: (key: 'player.offlineUnavailable' | 'player.mediaError' | 'player.notFound' | 'player.httpError', vars?: Record<string, string | number>) => string) {
  switch (s.error) {
    case 'offline':
      return t('player.offlineUnavailable');
    case 'notFound':
      return t('player.notFound');
    case 'http':
      return t('player.httpError', { status: s.errorStatus ?? '' });
    case 'media':
      return t('player.mediaError');
    default:
      return undefined;
  }
}

export const usePlayerStore = create<PlayerState>(() => ({
  status: 'idle',
  position: 0,
  duration: 0,
  playbackRate: 1,
  buffered: 0,
}));
