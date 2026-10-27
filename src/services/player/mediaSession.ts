import type { Episode, Podcast } from '../../db/schema';

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  skipBack: () => void;
  skipForward: () => void;
  seekTo: (time: number) => void;
  next: () => void;
}

const supported = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;

export function bindMediaSession(h: MediaSessionHandlers) {
  if (!supported()) return;
  const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {

    }
  }
  set('play', h.play);
  set('pause', h.pause);
  set('seekbackward', h.skipBack);
  set('seekforward', h.skipForward);
  set('previoustrack', h.skipBack);
  set('nexttrack', h.next);
  set('seekto', (d) => d.seekTime != null && h.seekTo(d.seekTime));
}

export function setMediaMetadata(episode: Episode, podcast?: Podcast) {
  if (!supported()) return;
  const art = episode.artworkUrl ?? podcast?.artworkUrl;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: episode.title,
    artist: podcast?.author ?? podcast?.title ?? '',
    album: podcast?.title ?? '',
    artwork: art ? [{ src: art, sizes: '512x512' }] : [],
  });
}

export function setMediaPosition(position: number, duration: number, playbackRate: number) {
  if (!supported() || !Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration, playbackRate, position: Math.min(position, duration) });
  } catch {
    
  }
}

export function setMediaPlaybackState(state: MediaSessionPlaybackState) {
  if (supported()) navigator.mediaSession.playbackState = state;
}
