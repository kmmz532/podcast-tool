import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { usePlayerStore } from '../../store/playerStore';

/** 再生中のエピソードと番組 */
export function useCurrentEpisode() {
  const id = usePlayerStore((s) => s.currentEpisodeId);
  return useLiveQuery(async () => {
    if (!id) return undefined;
    const episode = await db.episodes.get(id);
    if (!episode) return undefined;
    return { episode, podcast: await db.podcasts.get(episode.podcastId) };
  }, [id]);
}
